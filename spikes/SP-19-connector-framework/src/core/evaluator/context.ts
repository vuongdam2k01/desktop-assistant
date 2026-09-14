import type { ActiveJobApproval } from "./types.js";

export type ApprovalMode = "on" | "smart" | "off";

export interface TargetMetadata {
  targetType?: "database" | "page" | "block" | "schema" | "workspace";
  id?: string;
  databaseId?: string;
  pageId?: string;
  ancestorIds?: string[];
  createdBy?: string;
  currentAssignee?: string[];
  currentStatus?: string;
}

export interface ToolCallContext {
  toolCallId: string;
  toolName: string;
  connector: string;
  params: Record<string, any>;
  target?: TargetMetadata;
  isIrreversible?: boolean;
  changesPermission?: boolean;
  isWriteTool?: boolean;
}

export interface SessionContext {
  jobId: string;
  mode: ApprovalMode;
  currentUser: string;
  now: Date;
  timezone?: string;
  cumulativeWritesInJob: number;
  deadlineChangesInJob: number;
  distinctPagesModifiedInJob: Set<string>;
  createdPagesInJob: Set<string>;
  dailyTaskCreates: number;
  activeJobApprovals: ActiveJobApproval[];
}

export interface EvaluationResult {
  verdict: "ALLOW" | "APPROVAL_REQUIRED" | "DENY";
  ruleId?: string;
  ruleName?: string;
  reason?: string;
  latencyMs: number;
}
