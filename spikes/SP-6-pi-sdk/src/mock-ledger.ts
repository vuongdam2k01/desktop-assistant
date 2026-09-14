export interface LedgerEntry {
  id: string;
  timestamp: number;
  toolCallId: string;
  toolName: string;
  status: "INTENT" | "BLOCKED" | "EXECUTED" | "RESULT" | "FAILED";
  params?: unknown;
  result?: unknown;
  reason?: string;
}

export class MockLedger {
  private entries: LedgerEntry[] = [];

  recordIntent(toolCallId: string, toolName: string, params: unknown): LedgerEntry {
    const entry: LedgerEntry = {
      id: `led-${this.entries.length + 1}`,
      timestamp: Date.now(),
      toolCallId,
      toolName,
      status: "INTENT",
      params,
    };
    this.entries.push(entry);
    return entry;
  }

  recordBlocked(toolCallId: string, toolName: string, reason: string): LedgerEntry {
    const entry: LedgerEntry = {
      id: `led-${this.entries.length + 1}`,
      timestamp: Date.now(),
      toolCallId,
      toolName,
      status: "BLOCKED",
      reason,
    };
    this.entries.push(entry);
    return entry;
  }

  recordResult(toolCallId: string, toolName: string, result: unknown): LedgerEntry {
    const entry: LedgerEntry = {
      id: `led-${this.entries.length + 1}`,
      timestamp: Date.now(),
      toolCallId,
      toolName,
      status: "RESULT",
      result,
    };
    this.entries.push(entry);
    return entry;
  }

  getEntries(): readonly LedgerEntry[] {
    return this.entries;
  }

  getEntriesForToolCall(toolCallId: string): LedgerEntry[] {
    return this.entries.filter((e) => e.toolCallId === toolCallId);
  }

  clear(): void {
    this.entries = [];
  }
}
