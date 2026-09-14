import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { JobRecord, ActionRecord } from './types.js';

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        original_request TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'waiting_approval', 'waiting_input', 'completed', 'failed', 'cancelled')),
        approval_mode TEXT NOT NULL CHECK(approval_mode IN ('off', 'smart', 'on')),
        summary_result TEXT,
        undo_of TEXT REFERENCES jobs(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS approval_requests (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id),
        tool_name TEXT NOT NULL,
        tool_params TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied', 'cancelled')),
        decided_by TEXT,
        decided_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS action_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL REFERENCES jobs(id),
        seq INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('tool_intent', 'tool_result', 'decision', 'approval', 'error', 'info')),
        tool TEXT,
        args TEXT,
        result TEXT,
        snapshot_before TEXT,
        snapshot_after TEXT,
        is_reversible INTEGER NOT NULL DEFAULT 0 CHECK(is_reversible IN (0, 1)),
        compensating_action TEXT,
        correlation_id TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE TRIGGER IF NOT EXISTS trg_action_records_no_update
      BEFORE UPDATE ON action_records
      BEGIN
        SELECT RAISE(ABORT, 'ActionRecord is append-only: UPDATE is forbidden (FR-LG-02)');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_action_records_no_delete
      BEFORE DELETE ON action_records
      BEGIN
        SELECT RAISE(ABORT, 'ActionRecord is append-only: DELETE is forbidden (FR-LG-02)');
      END;

      CREATE INDEX IF NOT EXISTS idx_action_records_job_seq ON action_records(job_id, seq);
      CREATE INDEX IF NOT EXISTS idx_action_records_correlation ON action_records(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    `);
  }

  public getDb(): Database.Database {
    return this.db;
  }

  public close() {
    this.db.close();
  }
}

export class LedgerRepository {
  private db: Database.Database;
  private insertJobStmt: Database.Statement;
  private updateJobStatusStmt: Database.Statement;
  private getJobStmt: Database.Statement;
  private insertActionStmt: Database.Statement;
  private byJobStmt: Database.Statement;
  private maxSeqStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;

    this.insertJobStmt = this.db.prepare(`
      INSERT INTO jobs (id, original_request, status, approval_mode, summary_result, undo_of, created_at, updated_at)
      VALUES (@id, @original_request, @status, @approval_mode, @summary_result, @undo_of, @created_at, @updated_at)
    `);

    this.updateJobStatusStmt = this.db.prepare(`
      UPDATE jobs SET status = @status, summary_result = @summary_result, updated_at = @updated_at
      WHERE id = @id
    `);

    this.getJobStmt = this.db.prepare(`
      SELECT * FROM jobs WHERE id = ?
    `);

    this.insertActionStmt = this.db.prepare(`
      INSERT INTO action_records (
        job_id, seq, type, tool, args, result,
        snapshot_before, snapshot_after, is_reversible,
        compensating_action, correlation_id, timestamp
      ) VALUES (
        @jobId, @seq, @type, @tool, @args, @result,
        @snapshotBefore, @snapshotAfter, @isReversible,
        @compensatingAction, @correlationId, @timestamp
      )
    `);

    this.byJobStmt = this.db.prepare(`
      SELECT * FROM action_records WHERE job_id = ? ORDER BY seq ASC
    `);

    this.maxSeqStmt = this.db.prepare(`
      SELECT COALESCE(MAX(seq), 0) AS max_seq FROM action_records WHERE job_id = ?
    `);
  }

  public createJob(job: {
    id: string;
    original_request: string;
    status?: JobRecord['status'];
    approval_mode?: JobRecord['approval_mode'];
    summary_result?: string | null;
    undo_of?: string | null;
  }): JobRecord {
    const now = new Date().toISOString();
    const record: JobRecord = {
      id: job.id,
      original_request: job.original_request,
      status: job.status || 'running',
      approval_mode: job.approval_mode || 'off',
      summary_result: job.summary_result || null,
      undo_of: job.undo_of || null,
      created_at: now,
      updated_at: now,
    };
    this.insertJobStmt.run(record);
    return record;
  }

  public updateJobStatus(id: string, status: JobRecord['status'], summaryResult: string | null = null) {
    const now = new Date().toISOString();
    this.updateJobStatusStmt.run({
      id,
      status,
      summary_result: summaryResult,
      updated_at: now,
    });
  }

  public getJob(id: string): JobRecord | null {
    const row = this.getJobStmt.get(id);
    return (row as JobRecord) || null;
  }

  public getNextSeq(jobId: string): number {
    const row = this.maxSeqStmt.get(jobId) as { max_seq: number };
    return (row ? row.max_seq : 0) + 1;
  }

  public appendRecord(record: {
    jobId: string;
    seq?: number;
    type: ActionRecord['type'];
    tool?: string | null;
    args?: any;
    result?: any;
    snapshotBefore?: any;
    snapshotAfter?: any;
    isReversible?: boolean | number;
    compensatingAction?: any;
    correlationId?: string | null;
    timestamp?: string;
  }): ActionRecord {
    const currentSeq = record.seq !== undefined ? record.seq : this.getNextSeq(record.jobId);
    const now = record.timestamp || new Date().toISOString();

    const info = this.insertActionStmt.run({
      jobId: record.jobId,
      seq: currentSeq,
      type: record.type,
      tool: record.tool || null,
      args: record.args ? (typeof record.args === 'string' ? record.args : JSON.stringify(record.args)) : null,
      result: record.result ? (typeof record.result === 'string' ? record.result : JSON.stringify(record.result)) : null,
      snapshotBefore: record.snapshotBefore ? (typeof record.snapshotBefore === 'string' ? record.snapshotBefore : JSON.stringify(record.snapshotBefore)) : null,
      snapshotAfter: record.snapshotAfter ? (typeof record.snapshotAfter === 'string' ? record.snapshotAfter : JSON.stringify(record.snapshotAfter)) : null,
      isReversible: record.isReversible ? 1 : 0,
      compensatingAction: record.compensatingAction ? (typeof record.compensatingAction === 'string' ? record.compensatingAction : JSON.stringify(record.compensatingAction)) : null,
      correlationId: record.correlationId || null,
      timestamp: now,
    });

    return {
      id: Number(info.lastInsertRowid),
      job_id: record.jobId,
      seq: currentSeq,
      type: record.type,
      tool: record.tool || null,
      args: record.args || null,
      result: record.result || null,
      snapshot_before: record.snapshotBefore || null,
      snapshot_after: record.snapshotAfter || null,
      is_reversible: record.isReversible ? 1 : 0,
      compensating_action: record.compensatingAction || null,
      correlation_id: record.correlationId || null,
      timestamp: now,
    };
  }

  public getRecordsByJobId(jobId: string): ActionRecord[] {
    const rows = this.byJobStmt.all(jobId) as any[];
    return rows.map((row) => ({
      ...row,
      args: row.args ? JSON.parse(row.args) : null,
      result: row.result ? JSON.parse(row.result) : null,
      snapshot_before: row.snapshot_before ? JSON.parse(row.snapshot_before) : null,
      snapshot_after: row.snapshot_after ? JSON.parse(row.snapshot_after) : null,
      compensating_action: row.compensating_action ? JSON.parse(row.compensating_action) : null,
    }));
  }
}
