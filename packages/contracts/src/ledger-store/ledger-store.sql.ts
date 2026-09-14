// Generated from ledger-store.sql

export interface JobRow {
  id: string;
}

export interface ActionRecordRow {
  record_id: string;
  job_id: string;
  position: number;
  type: string;
  origin_device: string;
  origin_sequence: number;
  recorded_at: string;
  correlation_id: string | null;
  references_json: string | null;
  content: string;
}
