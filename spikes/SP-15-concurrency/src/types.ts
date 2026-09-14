export type WorkspaceRole = 'tasks' | 'projects';

export interface ActionRecord {
  id?: number;
  job_id: string;
  sequence: number;
  correlation_id: string;
  record_type: 'tool_intent' | 'tool_result' | 'error';
  tool_name: string;
  connector_id: string;
  target_urn: string;
  arguments_json: string;
  snapshot_before_json: string | null;
  snapshot_after_json: string | null;
  is_reversible: number; // 0 or 1
  created_at?: string;
}

export interface Job {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  undo_of?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NotionPageSnapshot {
  id: string;
  archived: boolean;
  last_edited_time: string;
  properties: Record<string, any>;
}

export interface LockAcquireResult {
  acquired: boolean;
  resourceUrn: string;
  holderJobId?: string;
  waitTimeMs: number;
  timedOut?: boolean;
}

export interface QueueRequestMetrics {
  id: string;
  jobId: string;
  enqueuedAt: number;
  startedAt: number;
  completedAt: number;
  queueWaitMs: number;
  executionMs: number;
  totalMs: number;
  status: number;
}
