import Database, { Database as DatabaseInstance } from 'better-sqlite3';
import { ActionRecord, Job } from './types.js';

export class LedgerDb {
  public db: DatabaseInstance;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        undo_of TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
      );

      CREATE TABLE IF NOT EXISTS action_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        correlation_id TEXT NOT NULL,
        record_type TEXT NOT NULL CHECK (record_type IN ('tool_intent', 'tool_result', 'error')),
        tool_name TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        target_urn TEXT NOT NULL,
        arguments_json TEXT NOT NULL,
        snapshot_before_json TEXT,
        snapshot_after_json TEXT,
        is_reversible INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_action_records_job ON action_records(job_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_action_records_urn ON action_records(target_urn);

      -- FR-LG-02 Append-only enforcement via triggers
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
    `);
  }

  public createJob(job: Job): void {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (id, name, status, undo_of)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(job.id, job.name, job.status, job.undo_of || null);
  }

  public updateJobStatus(jobId: string, status: Job['status']): void {
    const stmt = this.db.prepare(`
      UPDATE jobs SET status = ?, updated_at = datetime('now', 'subsec')
      WHERE id = ?
    `);
    stmt.run(status, jobId);
  }

  public appendRecord(record: ActionRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO action_records (
        job_id, sequence, correlation_id, record_type, tool_name,
        connector_id, target_urn, arguments_json, snapshot_before_json,
        snapshot_after_json, is_reversible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      record.job_id,
      record.sequence,
      record.correlation_id,
      record.record_type,
      record.tool_name,
      record.connector_id,
      record.target_urn,
      record.arguments_json,
      record.snapshot_before_json || null,
      record.snapshot_after_json || null,
      record.is_reversible
    );
    return Number(info.lastInsertRowid);
  }

  public getRecordsByJobId(jobId: string): ActionRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM action_records WHERE job_id = ? ORDER BY sequence ASC
    `);
    return stmt.all(jobId) as ActionRecord[];
  }

  public getAllRecords(): ActionRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM action_records ORDER BY id ASC
    `);
    return stmt.all() as ActionRecord[];
  }

  public close(): void {
    this.db.close();
  }
}
