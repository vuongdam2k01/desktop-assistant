import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@earendil-works/pi-agent-core";
import type { GeneratedAgentTool } from "../generator/tool-generator.js";
import type { HardGateEvaluator } from "./evaluator/evaluator.js";
import type { SessionContext, ToolCallContext } from "./evaluator/context.js";
import type { UniformLedger } from "./ledger.js";
import type { ConnectorAdapter } from "../adapters/adapter-interface.js";

/**
 * Strips computed/read-only properties according to manifest sanitization list
 * (SP-1 Compensation Matrix section 2)
 */
function sanitizeSnapshotProperties(properties: any, excludeList: string[] = []): any {
  if (!properties || typeof properties !== "object") return properties;
  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(properties)) {
    // Check if property type or key is in excludeList
    const propType = (val as any)?.type;
    if (excludeList.includes(key) || (propType && excludeList.includes(propType))) {
      continue;
    }
    sanitized[key] = val;
  }
  return sanitized;
}

/**
 * Wraps a GeneratedAgentTool with HardGateEvaluator, UniformLedger, and pre-write snapshots
 * PRD §10.10, FR-CF-01, FR-CF-07, FR-AP-05, FR-NT-04/05
 */
export function createHardGatedTool(
  baseTool: GeneratedAgentTool,
  ledger: UniformLedger,
  evaluator: HardGateEvaluator,
  session: SessionContext,
  adapter?: ConnectorAdapter
): AgentTool<any, any> {
  const originalExecute = baseTool.execute;
  const meta = baseTool.manifestMeta;
  const connectorId = meta.connectorId;
  const isWrite = meta.category === "write";
  const isIrreversible = meta.isIrreversible;
  const changesPermission = meta.changesPermission;

  return {
    ...baseTool,
    execute: async (
      toolCallId: string,
      params: any,
      signal?: AbortSignal,
      onUpdate?: AgentToolUpdateCallback<any>
    ): Promise<AgentToolResult<any>> => {
      // 1. Record INTENT in Uniform Ledger
      ledger.record({
        jobId: session.jobId,
        type: "INTENT",
        connectorId,
        toolName: baseTool.name,
        params,
      });

      // 2. Anti-evasion check (A-14)
      if (baseTool.name === "ask_user") {
        const question = (params?.question || "").toLowerCase();
        const forbiddenDelegations = [
          "tự vào notion archive",
          "tự vào notion xoá",
          "bạn tự archive",
          "bạn tự xoá",
        ];
        if (forbiddenDelegations.some((p) => question.includes(p))) {
          const reason = "Evasion A-14 blocked: Cannot delegate forbidden operation to user.";
          ledger.record({
            jobId: session.jobId,
            type: "BLOCKED",
            connectorId,
            toolName: baseTool.name,
            params,
            reason,
          });
          return {
            content: [{ type: "text", text: `[EVASION BLOCKED: A-14] ${reason}` }],
            details: { blocked: true, reason, evasionCase: "A-14" },
          };
        }
      }

      // 3. Extract Target Metadata
      const targetIdParam = meta.snapshot?.target_id_param || "page_id";
      const targetId = params?.[targetIdParam] || params?.database_id || params?.message_id;

      const callContext: ToolCallContext = {
        toolCallId,
        toolName: baseTool.name,
        connector: connectorId,
        params,
        target: {
          targetType: params?.database_id ? "database" : params?.page_id ? "page" : undefined,
          id: targetId,
          databaseId: params?.database_id,
          pageId: params?.page_id,
        },
        isIrreversible,
        changesPermission,
        isWriteTool: isWrite,
      };

      // 4. Hard Gate Evaluation (Evaluates IR rules, modes, and FR-AP-05 irreversible gate)
      const evalResult = evaluator.evaluate(callContext, session);

      // 5. Hardline DENY
      if (evalResult.verdict === "DENY") {
        ledger.record({
          jobId: session.jobId,
          type: "BLOCKED",
          connectorId,
          toolName: baseTool.name,
          params,
          reason: evalResult.reason,
          ruleId: evalResult.ruleId,
        });
        return {
          content: [
            {
              type: "text",
              text: `[HARD GATE DENIED: ${evalResult.ruleId}] Thao tác bị TỪ CHỐI bởi Rule Hardline: ${evalResult.reason}`,
            },
          ],
          details: { blocked: true, verdict: "DENY", ruleId: evalResult.ruleId, reason: evalResult.reason },
        };
      }

      // 6. APPROVAL_REQUIRED (FR-AP-05 / User Rules)
      if (evalResult.verdict === "APPROVAL_REQUIRED") {
        ledger.record({
          jobId: session.jobId,
          type: "WAITING_APPROVAL",
          connectorId,
          toolName: baseTool.name,
          params,
          reason: evalResult.reason,
          ruleId: evalResult.ruleId,
          isIrreversible,
        });
        return {
          content: [
            {
              type: "text",
              text: `[HARD GATE WAITING APPROVAL: ${evalResult.ruleId}] Thao tác tạm dừng chờ người dùng phê duyệt: ${evalResult.reason}`,
            },
          ],
          details: {
            blocked: true,
            verdict: "APPROVAL_REQUIRED",
            ruleId: evalResult.ruleId,
            reason: evalResult.reason,
            isIrreversible,
          },
        };
      }

      // 7. ALLOW -> Handle Pre-Write Snapshot (FR-NT-04, FR-CF-01)
      let preSnapshot: any = undefined;
      let compensatingAction: any = undefined;

      if (isWrite) {
        session.cumulativeWritesInJob++;

        if (meta.snapshot?.enabled && adapter?.fetchSnapshot && targetId) {
          try {
            const rawSnapshot = await adapter.fetchSnapshot(baseTool.manifestMeta.toolId, targetId, signal);
            const sanitization = meta.snapshot.sanitization || [];
            preSnapshot = {
              ...rawSnapshot,
              properties: sanitizeSnapshotProperties(rawSnapshot.properties, sanitization),
            };

            // Formulate compensating action from manifest formula
            if (meta.compensation?.type === "static_formula") {
              const formula = meta.compensation.formula_type;
              if (formula === "restore_properties") {
                compensatingAction = {
                  operation: meta.compensation.target_operation || "update_page_properties",
                  params: {
                    [targetIdParam]: targetId,
                    properties: preSnapshot.properties,
                  },
                };
              } else if (formula === "unarchive_page") {
                compensatingAction = {
                  operation: meta.compensation.target_operation || "update_page_properties",
                  params: {
                    [targetIdParam]: targetId,
                    archived: false,
                  },
                };
              } else if (formula === "archive_page") {
                compensatingAction = {
                  operation: meta.compensation.target_operation || "archive_page",
                  params: {
                    [targetIdParam]: targetId,
                  },
                };
              }
            }

            ledger.record({
              jobId: session.jobId,
              type: "PRE_SNAPSHOT",
              connectorId,
              toolName: baseTool.name,
              params,
              targetId,
              preSnapshot,
              compensatingAction,
              isIrreversible,
            });
          } catch (snapshotErr: any) {
            // If taking pre-snapshot fails, fail-closed per NFR-RL-03
            const reason = `Pre-write snapshot failed: ${snapshotErr.message}. Aborting write.`;
            ledger.record({
              jobId: session.jobId,
              type: "BLOCKED",
              connectorId,
              toolName: baseTool.name,
              params,
              reason,
            });
            throw new Error(reason);
          }
        } else if (meta.compensation?.type === "static_formula" && meta.compensation.formula_type === "archive_page") {
          // For create operations, page doesn't exist before write, but compensating action is archive_page
          compensatingAction = {
            operation: meta.compensation.target_operation || "archive_page",
            note: "Target ID will be resolved from creation result",
          };
          ledger.record({
            jobId: session.jobId,
            type: "PRE_SNAPSHOT",
            connectorId,
            toolName: baseTool.name,
            params,
            preSnapshot: null,
            compensatingAction,
            isIrreversible: false,
          });
        }
      }

      // 8. Execute Tool
      try {
        const result = await originalExecute(toolCallId, params, signal, onUpdate);
        ledger.record({
          jobId: session.jobId,
          type: "RESULT",
          connectorId,
          toolName: baseTool.name,
          params,
          result: result.details || result.content,
        });
        return result;
      } catch (err: any) {
        ledger.record({
          jobId: session.jobId,
          type: "BLOCKED",
          connectorId,
          toolName: baseTool.name,
          params,
          reason: `Execution failed: ${err.message}`,
        });
        throw err;
      }
    },
  };
}
