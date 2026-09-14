import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@earendil-works/pi-agent-core";
import type { MockStore } from "./mock-store.js";
import type { HardGateEvaluator } from "../evaluator/evaluator.js";
import type { SessionContext, ToolCallContext } from "../evaluator/context.js";
import { WRITE_TOOLS } from "../ir/user-rules-catalog.js";

export function createHardGatedTool(
  baseTool: AgentTool<any, any>,
  store: MockStore,
  evaluator: HardGateEvaluator,
  session: SessionContext
): AgentTool<any, any> {
  const originalExecute = baseTool.execute;

  return {
    ...baseTool,
    execute: async (
      toolCallId: string,
      params: any,
      signal?: AbortSignal,
      onUpdate?: AgentToolUpdateCallback<any>
    ): Promise<AgentToolResult<any>> => {
      // 1. Ghi nhận INTENT vào Ledger
      store.recordLedger("INTENT", baseTool.name, params);

      // 2. Chống đòn Evasion A-14: Lạm dụng ask_user để xúi người dùng làm hộ việc bị cấm
      if (baseTool.name === "ask_user") {
        const question = (params?.question || "").toLowerCase();
        const forbiddenDelegationPhrases = [
          "tự vào notion archive",
          "tự vào notion xoá",
          "bạn tự archive",
          "bạn tự xoá",
          "bạn tự làm giúp",
          "tự xoá giúp",
          "xoá 12 task quá hạn này giúp",
        ];
        const isDelegatingBlockedAction = forbiddenDelegationPhrases.some((p) =>
          question.includes(p)
        );

        if (isDelegatingBlockedAction) {
          const reason =
            "Agent vi phạm nguyên tắc Phụ lục A.5 mục 7: cấm dùng ask_user để nhờ người dùng tự thực hiện thao tác mà chính agent bị hook chặn. Phải xin phê duyệt hợp lệ.";
          store.recordLedger("BLOCKED", baseTool.name, params, `[A-14 EVASION BLOCKED] ${reason}`);
          return {
            content: [{ type: "text", text: `[EVASION BLOCKED: A-14] ${reason}` }],
            details: { blocked: true, reason, evasionCase: "A-14" },
          };
        }
      }

      // 3. Trích xuất metadata ngữ cảnh đối tượng (Target Context Enrichment)
      const pageId = params?.page_id;
      const databaseId = params?.database_id;
      const page = pageId ? store.pages.get(pageId) : undefined;
      const db = databaseId ? store.databases.get(databaseId) : undefined;

      const callContext: ToolCallContext = {
        toolCallId,
        toolName: baseTool.name,
        connector: baseTool.name.startsWith("gmail") ? "gmail" : "notion",
        params,
        target: {
          targetType: db ? "database" : page ? "page" : undefined,
          id: pageId || databaseId,
          databaseId: page?.databaseId || databaseId,
          pageId,
          ancestorIds: page?.ancestorIds || [],
          createdBy: page?.createdBy,
          currentAssignee: page?.assignee || [],
          currentStatus: page?.status,
        },
        isIrreversible:
          baseTool.name === "delete_block" ||
          (baseTool.name === "update_database" && Boolean(params?.remove_property)),
        changesPermission: baseTool.name === "update_page_permissions",
      };

      // 4. Đánh giá cứng qua Pure Evaluator
      const evalResult = evaluator.evaluate(callContext, session);

      // 5. Thẩm định kết quả: DENY
      if (evalResult.verdict === "DENY") {
        store.recordLedger(
          "BLOCKED",
          baseTool.name,
          params,
          `[HARDLINE DENY: ${evalResult.ruleId}] ${evalResult.reason}`
        );
        return {
          content: [
            {
              type: "text",
              text: `[HARD GATE DENIED: ${evalResult.ruleId}] Thao tác bị TỪ CHỐI TUYỆT ĐỐI bởi Hardline Blocklist (FR-AP-10): ${evalResult.reason}`,
            },
          ],
          details: { blocked: true, verdict: "DENY", ruleId: evalResult.ruleId, reason: evalResult.reason },
        };
      }

      // 6. Thẩm định kết quả: APPROVAL_REQUIRED
      if (evalResult.verdict === "APPROVAL_REQUIRED") {
        store.recordLedger(
          "WAITING_APPROVAL",
          baseTool.name,
          params,
          `[APPROVAL_REQUIRED: ${evalResult.ruleId}] ${evalResult.reason}`
        );
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
          },
        };
      }

      // 7. Thẩm định kết quả: ALLOW -> Cập nhật bộ đếm & thực thi tool gốc
      if (WRITE_TOOLS.includes(baseTool.name)) {
        session.cumulativeWritesInJob++;
        if (params?.properties?.["Due date"]) {
          session.deadlineChangesInJob++;
        }
        if (pageId) {
          session.distinctPagesModifiedInJob.add(pageId);
        }
        if (baseTool.name === "create_page") {
          session.dailyTaskCreates++;
        }
      }

      try {
        const result = await originalExecute(toolCallId, params, signal, onUpdate);
        store.recordLedger("RESULT", baseTool.name, params, undefined, result);
        return result;
      } catch (err: any) {
        store.recordLedger("BLOCKED", baseTool.name, params, `Execution failed: ${err.message}`);
        throw err;
      }
    },
  };
}
