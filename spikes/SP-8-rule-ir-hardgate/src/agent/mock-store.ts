export interface MockPage {
  id: string;
  databaseId?: string;
  title: string;
  status: string;
  dueDate?: string;
  createdBy: string;
  assignee: string[];
  ancestorIds?: string[];
  content?: string;
  archived?: boolean;
}

export interface MockDatabase {
  id: string;
  title: string;
  archived?: boolean;
  properties: string[];
}

export interface MockEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  status: "INTENT" | "BLOCKED" | "WAITING_APPROVAL" | "RESULT";
  toolName: string;
  params: any;
  reason?: string;
  result?: any;
}

export class MockStore {
  public databases: Map<string, MockDatabase> = new Map();
  public pages: Map<string, MockPage> = new Map();
  public emails: Map<string, MockEmail> = new Map();
  public webPages: Map<string, string> = new Map();

  // Execution counters (critical for hard gate verification)
  public executedCallCount: Map<string, number> = new Map();
  public ledger: LedgerEntry[] = [];

  constructor() {
    this.reset();
  }

  public reset() {
    this.databases.clear();
    this.pages.clear();
    this.emails.clear();
    this.webPages.clear();
    this.executedCallCount.clear();
    this.ledger = [];
  }

  public recordExecutedCall(toolName: string) {
    const count = this.executedCallCount.get(toolName) || 0;
    this.executedCallCount.set(toolName, count + 1);
  }

  public getExecutedCount(toolName?: string): number {
    if (toolName) {
      return this.executedCallCount.get(toolName) || 0;
    }
    let total = 0;
    for (const count of this.executedCallCount.values()) {
      total += count;
    }
    return total;
  }

  public recordLedger(
    status: "INTENT" | "BLOCKED" | "WAITING_APPROVAL" | "RESULT",
    toolName: string,
    params: any,
    reason?: string,
    result?: any
  ) {
    this.ledger.push({
      id: `led-${this.ledger.length + 1}`,
      timestamp: new Date().toISOString(),
      status,
      toolName,
      params,
      reason,
      result,
    });
  }
}
