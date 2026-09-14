export type LedgerEntryType =
  | "INTENT"
  | "PRE_SNAPSHOT"
  | "BLOCKED"
  | "WAITING_APPROVAL"
  | "RESULT";

export interface LedgerRecord {
  id: string;
  seq: number;
  jobId: string;
  timestamp: string;
  type: LedgerEntryType;
  connectorId: string; // FR-CF-10: connector identifier clearly recorded
  toolName: string;
  params: any;
  targetId?: string;
  preSnapshot?: any;
  compensatingAction?: any;
  isIrreversible?: boolean;
  reason?: string;
  ruleId?: string;
  result?: any;
}

/**
 * Uniform Ledger for all connectors (FR-CF-07, FR-CF-10)
 * Completely connector-agnostic. Does not branch on connector name.
 */
export class UniformLedger {
  private records: LedgerRecord[] = [];
  private seqCounter = 0;

  record(entry: {
    jobId: string;
    type: LedgerEntryType;
    connectorId: string;
    toolName: string;
    params: any;
    targetId?: string;
    preSnapshot?: any;
    compensatingAction?: any;
    isIrreversible?: boolean;
    reason?: string;
    ruleId?: string;
    result?: any;
  }): LedgerRecord {
    this.seqCounter++;
    const record: LedgerRecord = {
      id: `led-${this.seqCounter}`,
      seq: this.seqCounter,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.records.push(record);
    return record;
  }

  getRecords(filter?: { jobId?: string; connectorId?: string; type?: LedgerEntryType }): LedgerRecord[] {
    return this.records.filter((r) => {
      if (filter?.jobId && r.jobId !== filter.jobId) return false;
      if (filter?.connectorId && r.connectorId !== filter.connectorId) return false;
      if (filter?.type && r.type !== filter.type) return false;
      return true;
    });
  }

  getAllRecords(): LedgerRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
    this.seqCounter = 0;
  }
}
