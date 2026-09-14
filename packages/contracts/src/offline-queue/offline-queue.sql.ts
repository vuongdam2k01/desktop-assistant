// Generated from offline-queue.sql

export interface OfflineCommandQueueRow {
  id: string;
  command_text: string;
  status: string;
  idempotency_key: string;
  created_at: number;
  synced_at: number | null;
  retry_count: number;
}
