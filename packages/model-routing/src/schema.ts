import type Database from 'better-sqlite3';

export const INITIAL_SCHEMA_SQL = `
-- Provider profiles store (replicated configuration)
CREATE TABLE IF NOT EXISTS provider_profile (
    id TEXT PRIMARY KEY,
    profile_version TEXT NOT NULL,
    display_name TEXT NOT NULL,
    endpoint_json TEXT NOT NULL,
    credential_key TEXT NOT NULL,
    models_json TEXT NOT NULL,
    built_in INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Routing table singleton (replicated configuration)
CREATE TABLE IF NOT EXISTS routing_table (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    table_version TEXT NOT NULL,
    assignments_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Unit prices per model per profile (replicated configuration)
CREATE TABLE IF NOT EXISTS unit_price (
    profile_id TEXT NOT NULL,
    model TEXT NOT NULL,
    input_price_per_million TEXT NOT NULL,
    output_price_per_million TEXT NOT NULL,
    currency TEXT NOT NULL,
    entered_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, model)
);

-- Write-once usage accounting records per model request
CREATE TABLE IF NOT EXISTS usage_record (
    request_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    role TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    model TEXT NOT NULL,
    reported INTEGER NOT NULL CHECK (reported IN (0, 1)),
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER NOT NULL,
    cost_json TEXT,
    recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_record_job_id ON usage_record(job_id);

-- Job routing snapshot (persisted for crash resilience across app restarts)
CREATE TABLE IF NOT EXISTS job_routing_snapshot (
    job_id TEXT NOT NULL,
    role TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (job_id, role)
);

CREATE INDEX IF NOT EXISTS idx_job_routing_snapshot_job_id ON job_routing_snapshot(job_id);
`.trim();

export function initializeDatabase(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(INITIAL_SCHEMA_SQL);
}
