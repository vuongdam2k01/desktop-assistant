import type { PredicateNode, RuleIR } from "./types.js";
import { HARDLINE_RULES } from "./hardline-rules.js";
import type {
  ToolCallContext,
  SessionContext,
  EvaluationResult,
} from "./context.js";
import {
  evaluateToolPredicate,
  evaluateTargetScopePredicate,
  evaluatePropertyPredicate,
  evaluateOwnershipPredicate,
  evaluateThresholdPredicate,
  evaluateTemporalPredicate,
  evaluateIrreversiblePredicate,
  evaluatePermissionPredicate,
} from "./predicates.js";

export class HardGateEvaluator {
  private allRules: RuleIR[];

  constructor(customRules: RuleIR[] = []) {
    // Hardline rules always included with top priority
    this.allRules = [...HARDLINE_RULES, ...customRules].sort(
      (a, b) => b.priority - a.priority
    );
  }

  /**
   * Deterministic, pure evaluation of a tool call against the rule catalog.
   * Completely independent of LLMs, runs synchronously in sub-millisecond time.
   */
  public evaluate(
    call: ToolCallContext,
    session: SessionContext
  ): EvaluationResult {
    const start = performance.now();

    // --------------------------------------------------------------------------
    // 1. HARDLINE BLOCKLIST (FR-AP-10): Always active, even in mode "off"
    // --------------------------------------------------------------------------
    for (const rule of this.allRules) {
      if (rule.action === "DENY" && rule.priority >= 1000) {
        if (this.evaluateNode(rule.predicate, call, session)) {
          const latencyMs = performance.now() - start;
          return {
            verdict: "DENY",
            ruleId: rule.id,
            ruleName: rule.name,
            reason: rule.description || `Hardline denial by rule ${rule.id}`,
            latencyMs,
          };
        }
      }
    }

    // --------------------------------------------------------------------------
    // 2. MODE HANDLING (FR-AP-01)
    // --------------------------------------------------------------------------
    if (session.mode === "off") {
      // In mode off: only Hardline blocklist applies (checked above).
      const latencyMs = performance.now() - start;
      return {
        verdict: "ALLOW",
        reason: "Approval mode is OFF; hardline checks passed.",
        latencyMs,
      };
    }

    // --------------------------------------------------------------------------
    // 3. EVALUATE USER RULES & STATIC PATTERNS (Descending by priority)
    // --------------------------------------------------------------------------
    for (const rule of this.allRules) {
      // Skip hardline rules since they were already evaluated
      if (rule.action === "DENY" && rule.priority >= 1000) {
        continue;
      }

      if (this.evaluateNode(rule.predicate, call, session)) {
        if (rule.action === "DENY") {
          const latencyMs = performance.now() - start;
          return {
            verdict: "DENY",
            ruleId: rule.id,
            ruleName: rule.name,
            reason: rule.description || `Denied by rule ${rule.id}`,
            latencyMs,
          };
        }

        if (rule.action === "APPROVAL") {
          const isJobApproved = this.isCoveredByActiveJobApproval(rule, call, session);
          if (isJobApproved) {
            continue; // Already approved by user in this job
          }

          const latencyMs = performance.now() - start;
          return {
            verdict: "APPROVAL_REQUIRED",
            ruleId: rule.id,
            ruleName: rule.name,
            reason: rule.description || `Triggered approval rule ${rule.id}`,
            latencyMs,
          };
        }

        if (rule.action === "ALLOW") {
          const latencyMs = performance.now() - start;
          return {
            verdict: "ALLOW",
            ruleId: rule.id,
            ruleName: rule.name,
            reason: rule.description || `Explicitly allowed by rule ${rule.id}`,
            latencyMs,
          };
        }
      }
    }

    // --------------------------------------------------------------------------
    // 4. FR-AP-05 / FR-CF-07: Irreversible operations default to APPROVAL in smart/on
    // --------------------------------------------------------------------------
    if (call.isIrreversible === true && (session.mode === "smart" || session.mode === "on")) {
      const isJobApproved = session.activeJobApprovals?.some(
        (a) => a.jobId === session.jobId && a.toolName === call.toolName && a.ruleId === "FR-AP-05-IRREVERSIBLE"
      );
      if (!isJobApproved) {
        const latencyMs = performance.now() - start;
        return {
          verdict: "APPROVAL_REQUIRED",
          ruleId: "FR-AP-05-IRREVERSIBLE",
          ruleName: "FR-AP-05: Thao tác gắn cờ irreversible mặc định thuộc diện phê duyệt",
          reason: `Tool '${call.toolName}' được gắn cờ irreversible trong manifest và cần người dùng phê duyệt trước khi thực thi.`,
          latencyMs,
        };
      }
    }

    // --------------------------------------------------------------------------
    // 5. MODE "ON" BLANKET GATE: All write tools require approval
    // --------------------------------------------------------------------------
    if (session.mode === "on" && (call.isWriteTool || call.toolName.includes("create") || call.toolName.includes("update") || call.toolName.includes("archive") || call.toolName.includes("delete"))) {
      const latencyMs = performance.now() - start;
      return {
        verdict: "APPROVAL_REQUIRED",
        ruleId: "MODE-ON-BLANKET",
        ruleName: "Mode ON: Mọi thao tác ghi đều cần phê duyệt",
        reason: `Tool '${call.toolName}' is a write tool and mode is set to ON`,
        latencyMs,
      };
    }

    // Default: ALLOW
    const latencyMs = performance.now() - start;
    return {
      verdict: "ALLOW",
      reason: "No matching blocking rules; operation allowed.",
      latencyMs,
    };
  }

  private isCoveredByActiveJobApproval(
    rule: RuleIR,
    call: ToolCallContext,
    session: SessionContext
  ): boolean {
    const match = (session.activeJobApprovals || []).find(
      (a) =>
        a.jobId === session.jobId &&
        a.ruleId === rule.id &&
        a.toolName === call.toolName &&
        (!a.databaseId ||
          a.databaseId === call.target?.databaseId ||
          a.databaseId === call.params?.database_id)
    );
    return Boolean(match);
  }

  private evaluateNode(
    node: PredicateNode,
    call: ToolCallContext,
    session: SessionContext
  ): boolean {
    switch (node.kind) {
      case "and":
        return node.predicates.every((p) => this.evaluateNode(p, call, session));
      case "or":
        return node.predicates.some((p) => this.evaluateNode(p, call, session));
      case "not":
        return !this.evaluateNode(node.predicate, call, session);
      case "tool":
        return evaluateToolPredicate(node, call);
      case "target_scope":
        return evaluateTargetScopePredicate(node, call);
      case "property":
        return evaluatePropertyPredicate(node, call);
      case "ownership":
        return evaluateOwnershipPredicate(node, call, session);
      case "threshold":
        return evaluateThresholdPredicate(node, session);
      case "temporal":
        return evaluateTemporalPredicate(node, session);
      case "irreversible":
        return evaluateIrreversiblePredicate(node, call);
      case "permission":
        return evaluatePermissionPredicate(node, call);
      default:
        return false;
    }
  }
}
