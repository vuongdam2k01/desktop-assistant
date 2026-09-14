import Database from "better-sqlite3";
import path from "node:path";
import crypto from "node:crypto";

export interface DecisionRecord {
  id: string;
  jobId: string;
  question: string;
  options?: Array<{ id: string; label: string; description?: string }>;
  answer: { option_id?: string; text?: string };
  answerSource: "bubble" | "app";
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  jobId: string;
  recordType: "decision" | "tool_intent" | "tool_blocked" | "tool_result" | "job_state";
  payload: any;
  createdAt: string;
}

export interface OfflineCommand {
  id: string;
  commandText: string;
  status: "QUEUED_OFFLINE" | "SENDING" | "SYNCED" | "FAILED";
  idempotencyKey: string;
  createdAt: number;
  syncedAt?: number | null;
  retryCount: number;
}

export class SQLiteLedger {
  private db: Database.Database;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        question TEXT NOT NULL,
        options TEXT,
        answer TEXT NOT NULL,
        answer_source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (id) REFERENCES ledger_entries(id)
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        active_ask_call_id TEXT,
        checkpoint_transcript TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_command_queue (
        id TEXT PRIMARY KEY,
        command_text TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        synced_at INTEGER,
        retry_count INTEGER DEFAULT 0
      );

      -- Append-only enforcement on ledger_entries (FR-LG-02)
      CREATE TRIGGER IF NOT EXISTS prevent_ledger_update
      BEFORE UPDATE ON ledger_entries
      BEGIN
        SELECT RAISE(FAIL, 'APPEND_ONLY_VIOLATION: ledger_entries cannot be updated');
      END;

      CREATE TRIGGER IF NOT EXISTS prevent_ledger_delete
      BEFORE DELETE ON ledger_entries
      BEGIN
        SELECT RAISE(FAIL, 'APPEND_ONLY_VIOLATION: ledger_entries cannot be deleted');
      END;

      CREATE TRIGGER IF NOT EXISTS prevent_decisions_update
      BEFORE UPDATE ON decisions
      BEGIN
        SELECT RAISE(FAIL, 'APPEND_ONLY_VIOLATION: decisions cannot be updated');
      END;

      CREATE TRIGGER IF NOT EXISTS prevent_decisions_delete
      BEFORE DELETE ON decisions
      BEGIN
        SELECT RAISE(FAIL, 'APPEND_ONLY_VIOLATION: decisions cannot be deleted');
      END;
    `);
  }

  // --- Ledger Methods ---
  recordDecision(params: {
    jobId: string;
    question: string;
    options?: Array<{ id: string; label: string; description?: string }>;
    answer: { option_id?: string; text?: string };
    answerSource: "bubble" | "app";
  }): DecisionRecord {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const record: DecisionRecord = {
      id,
      jobId: params.jobId,
      question: params.question,
      options: params.options,
      answer: params.answer,
      answerSource: params.answerSource,
      createdAt,
    };

    const insertLedger = this.db.prepare(`
      INSERT INTO ledger_entries (id, job_id, record_type, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertDecision = this.db.prepare(`
      INSERT INTO decisions (id, job_id, question, options, answer, answer_source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      insertLedger.run(id, params.jobId, "decision", JSON.stringify(record), createdAt);
      insertDecision.run(
        id,
        params.jobId,
        params.question,
        params.options ? JSON.stringify(params.options) : null,
        JSON.stringify(params.answer),
        params.answerSource,
        createdAt
      );
    });

    tx();
    return record;
  }

  recordEntry(jobId: string, recordType: LedgerEntry["recordType"], payload: any): LedgerEntry {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const entry: LedgerEntry = { id, jobId, recordType, payload, createdAt };

    const stmt = this.db.prepare(`
      INSERT INTO ledger_entries (id, job_id, record_type, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, jobId, recordType, JSON.stringify(payload), createdAt);
    return entry;
  }

  getDecisionsForJob(jobId: string): DecisionRecord[] {
    const rows = this.db.prepare(`
      SELECT id, job_id, question, options, answer, answer_source, created_at
      FROM decisions
      WHERE job_id = ?
      ORDER BY created_at ASC
    `).all(jobId) as any[];

    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      question: r.question,
      options: r.options ? JSON.parse(r.options) : undefined,
      answer: JSON.parse(r.answer),
      answerSource: r.answer_source,
      createdAt: r.created_at,
    }));
  }

  // --- Job Management ---
  saveJobState(jobId: string, status: string, activeAskCallId: string | null, checkpointTranscript?: any) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO jobs (id, status, active_ask_call_id, checkpoint_transcript, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        active_ask_call_id = excluded.active_ask_call_id,
        checkpoint_transcript = COALESCE(excluded.checkpoint_transcript, jobs.checkpoint_transcript),
        updated_at = excluded.updated_at
    `);
    stmt.run(
      jobId,
      status,
      activeAskCallId,
      checkpointTranscript ? JSON.stringify(checkpointTranscript) : null,
      now,
      now
    );
  }

  getJob(jobId: string): any {
    const row = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as any;
    if (!row) return null;
    return {
      ...row,
      checkpoint_transcript: row.checkpoint_transcript ? JSON.parse(row.checkpoint_transcript) : null,
    };
  }

  // --- Offline Command Queue (Part 2) ---
  enqueueOfflineCommand(commandText: string, idempotencyKey = crypto.randomUUID()): OfflineCommand {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO offline_command_queue (id, command_text, status, idempotency_key, created_at, retry_count)
      VALUES (?, ?, 'QUEUED_OFFLINE', ?, ?, 0)
    `);
    stmt.run(id, commandText, idempotencyKey, createdAt);
    return {
      id,
      commandText,
      status: "QUEUED_OFFLINE",
      idempotencyKey,
      createdAt,
      retryCount: 0,
    };
  }

  getQueuedCommands(): OfflineCommand[] {
    const rows = this.db.prepare(`
      SELECT id, command_text, status, idempotency_key, created_at, synced_at, retry_count
      FROM offline_command_queue
      WHERE status IN ('QUEUED_OFFLINE', 'SENDING')
      ORDER BY created_at ASC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      commandText: r.command_text,
      status: r.status,
      idempotencyKey: r.idempotency_key,
      createdAt: r.created_at,
      syncedAt: r.synced_at,
      retryCount: r.retry_count,
    }));
  }

  markCommandSynced(id: string) {
    const now = Date.now();
    this.db.prepare(`
      UPDATE offline_command_queue
      SET status = 'SYNCED', synced_at = ?
      WHERE id = ?
    `).run(now, id);
  }

  close() {
    this.db.close();
  }
}
