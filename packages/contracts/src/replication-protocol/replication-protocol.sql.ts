// Generated from replication-protocol.sql

export interface ReplicatedRecordRow {
  account_id: string;
  store_id: string;
  record_id: string;
  origin_device: string;
  origin_sequence: string;
  causal_position: unknown;
  recorded_at: string;
  version: number;
  received_sequence: string;
  ciphertext: Uint8Array;
  key_id: string;
}

export interface ReplicationCursorRow {
  account_id: string;
  device_id: string;
  store_id: string;
  position: string;
  updated_at: string;
}

export interface KeyAccessAuditRow {
  id: string;
  account_id: string;
  key_id: string;
  used_by_path: string;
  occurred_at: string;
}
