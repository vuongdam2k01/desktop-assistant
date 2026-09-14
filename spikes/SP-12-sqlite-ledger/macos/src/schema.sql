-- Schema for SPIKE SP-12: SQLite Ledger & Jobs Engine
-- PRD §12.1, FR-LG-01..05, FR-INT-15, Appendix A.10 (E5)

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- 1. Jobs Table
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

-- 2. Approval Requests Table (Tracking blocking approval requests)
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

-- 3. Action Records (Append-Only Ledger - FR-LG-01, FR-LG-02)
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

-- 4. Triggers to Enforce Append-Only (FR-LG-02)
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

-- 5. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_action_records_job_seq ON action_records(job_id, seq);
CREATE INDEX IF NOT EXISTS idx_action_records_correlation ON action_records(correlation_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_job ON approval_requests(job_id, status);
