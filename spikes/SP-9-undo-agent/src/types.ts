export interface JobRecord {
  id: string;
  original_request: string;
  status: 'pending' | 'running' | 'waiting_approval' | 'waiting_input' | 'completed' | 'failed' | 'cancelled';
  approval_mode: 'off' | 'smart' | 'on';
  summary_result?: string | null;
  undo_of?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionRecord {
  id: number;
  job_id: string;
  seq: number;
  type: 'tool_intent' | 'tool_result' | 'decision' | 'approval' | 'error' | 'info';
  tool: string | null;
  args: any;
  result: any;
  snapshot_before: any;
  snapshot_after: any;
  is_reversible: number;
  compensating_action: any;
  correlation_id: string | null;
  timestamp: string;
}

export type ClassificationType = 'reversible' | 'irreversible' | 'conflict';

export interface PlannedCompensatingItem {
  original_seq: number;
  original_tool: string;
  target_object_id: string;
  classification: ClassificationType;
  reason?: string;
  compensating_tool?: string;
  compensating_args?: any;
  order_rationale?: string;
}

export interface UndoPreview {
  job_id: string;
  can_undo: boolean;
  disabled_reason?: string;
  reversible_items: PlannedCompensatingItem[];
  irreversible_items: PlannedCompensatingItem[];
  conflict_items: PlannedCompensatingItem[];
  total_items: number;
}

export interface UndoExecutionReport {
  undo_job_id: string;
  original_job_id: string;
  success: boolean;
  executed_steps: {
    seq: number;
    tool: string;
    target_id: string;
    success: boolean;
    result?: any;
    error?: string;
  }[];
  manual_handling_required: {
    target_id: string;
    reason: string;
    classification: 'irreversible' | 'conflict';
  }[];
}
