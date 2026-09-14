// Generated from secure-storage.sql

export interface CredentialEntryRow {
  key: string;
  class_id: string;
  ciphertext: Uint8Array;
  updated_at: string;
  readable: number;
  metadata: string;
}

export interface PendingErasureRow {
  id: number;
  trigger: string;
  scope: string;
  started_at: string;
}
