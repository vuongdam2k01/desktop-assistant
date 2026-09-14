import type Database from 'better-sqlite3';
import { LedgerStoreError } from './errors.js';

export const SYSTEM_MAINTENANCE_JOB_ID = 'system:ledger-maintenance' as const;

export const TRIGGER_NO_UPDATE_NAME = 'action_record_no_update' as const;
export const TRIGGER_NO_DELETE_NAME = 'action_record_no_delete' as const;

export const TRIGGER_NO_UPDATE_SQL = `
CREATE TRIGGER IF NOT EXISTS action_record_no_update
BEFORE UPDATE ON action_record
BEGIN
    SELECT RAISE(ABORT, 'APPEND_ONLY_VIOLATION: RECORD_IMMUTABLE: action_record UPDATE is forbidden');
END;
`.trim();

export const TRIGGER_NO_DELETE_SQL = `
CREATE TRIGGER IF NOT EXISTS action_record_no_delete
BEFORE DELETE ON action_record
BEGIN
    SELECT RAISE(ABORT, 'APPEND_ONLY_VIOLATION: RECORD_IMMUTABLE: action_record DELETE is forbidden');
END;
`.trim();

export const INITIAL_SCHEMA_SQL = `
-- Job projection
CREATE TABLE IF NOT EXISTS job (
    id TEXT PRIMARY KEY,
    original_request TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN (
        'created', 'queued', 'running', 'waiting_approval', 'waiting_input',
        'suspended', 'recovering', 'waiting_user_confirmation', 'done', 'failed', 'cancelled'
    )),
    approval_mode TEXT NOT NULL CHECK (approval_mode IN ('off', 'smart', 'on')),
    summary_result TEXT,
    undo_of TEXT REFERENCES job(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    state_changed_at TEXT NOT NULL
);

-- Job state transition append-only history
CREATE TABLE IF NOT EXISTS job_state_transition (
    job_id TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    from_state TEXT CHECK (from_state IS NULL OR from_state IN (
        'created', 'queued', 'running', 'waiting_approval', 'waiting_input',
        'suspended', 'recovering', 'waiting_user_confirmation', 'done', 'failed', 'cancelled'
    )),
    to_state TEXT NOT NULL CHECK (to_state IN (
        'created', 'queued', 'running', 'waiting_approval', 'waiting_input',
        'suspended', 'recovering', 'waiting_user_confirmation', 'done', 'failed', 'cancelled'
    )),
    changed_at TEXT NOT NULL,
    PRIMARY KEY (job_id, sequence)
);

-- Approval request projection
CREATE TABLE IF NOT EXISTS approval_request (
    request_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES job(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'expired')),
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    decided_at TEXT,
    decided_by TEXT CHECK (decided_by IS NULL OR decided_by IN ('user', 'risk_judge'))
);

-- Local device identity singleton
CREATE TABLE IF NOT EXISTS local_device (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    device_id TEXT NOT NULL
);

-- Device sequence tracking
CREATE TABLE IF NOT EXISTS device_sequence (
    device_id TEXT PRIMARY KEY,
    last_sequence INTEGER NOT NULL
);

-- Normative Action Record table (ledger-store.sql)
CREATE TABLE IF NOT EXISTS action_record (
    record_id       TEXT    PRIMARY KEY,
    job_id          TEXT    NOT NULL REFERENCES job(id),
    position        INTEGER NOT NULL,
    type            TEXT    NOT NULL,
    origin_device   TEXT    NOT NULL,
    origin_sequence INTEGER NOT NULL,
    recorded_at     TEXT    NOT NULL,
    correlation_id  TEXT,
    references_json TEXT,
    content         TEXT    NOT NULL,

    CONSTRAINT action_record_type_closed CHECK (type IN (
        'intent', 'result', 'decision', 'error', 'information', 'removal_announcement', 'superseded_version'
    )),
    CONSTRAINT action_record_correlation_scope CHECK (
        (type IN ('intent', 'result')) = (correlation_id IS NOT NULL)
    ),
    CONSTRAINT action_record_position_unique UNIQUE (job_id, position),
    CONSTRAINT action_record_origin_unique UNIQUE (origin_device, origin_sequence)
);

-- Record attachment references
CREATE TABLE IF NOT EXISTS record_attachment (
    record_id TEXT NOT NULL REFERENCES action_record(record_id) ON DELETE CASCADE,
    attachment_path TEXT NOT NULL,
    PRIMARY KEY (record_id, attachment_path)
);

-- Removal maintenance state
CREATE TABLE IF NOT EXISTS removal_operation (
    operation_id TEXT PRIMARY KEY,
    announcement_record_id TEXT NOT NULL REFERENCES action_record(record_id),
    reason TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    target_count INTEGER NOT NULL,
    database_completed INTEGER NOT NULL DEFAULT 0 CHECK (database_completed IN (0, 1)),
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS removal_target (
    operation_id TEXT NOT NULL REFERENCES removal_operation(operation_id) ON DELETE CASCADE,
    record_id TEXT NOT NULL,
    PRIMARY KEY (operation_id, record_id)
);

CREATE TABLE IF NOT EXISTS removal_attachment (
    operation_id TEXT NOT NULL REFERENCES removal_operation(operation_id) ON DELETE CASCADE,
    attachment_path TEXT NOT NULL,
    removed INTEGER NOT NULL DEFAULT 0 CHECK (removed IN (0, 1)),
    removed_at TEXT,
    PRIMARY KEY (operation_id, attachment_path)
);

-- Unique index on correlation pair
CREATE UNIQUE INDEX IF NOT EXISTS action_record_correlation_pair
    ON action_record (correlation_id, type)
    WHERE correlation_id IS NOT NULL;

-- Action record performance indexes
CREATE INDEX IF NOT EXISTS action_record_job_position ON action_record (job_id, position);
CREATE INDEX IF NOT EXISTS action_record_correlation ON action_record (correlation_id);
CREATE INDEX IF NOT EXISTS action_record_recorded_at_desc ON action_record (recorded_at DESC);

-- Projections indexes
CREATE INDEX IF NOT EXISTS idx_job_state ON job(state);
CREATE INDEX IF NOT EXISTS idx_approval_request_pending ON approval_request(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_removal_operation_pending ON removal_operation(completed) WHERE completed = 0;

-- Recovery view: unresolved intents
CREATE VIEW IF NOT EXISTS unresolved_intent AS
SELECT i.record_id,
       i.job_id,
       i.position,
       i.origin_device,
       i.origin_sequence,
       i.recorded_at,
       i.correlation_id,
       i.content
FROM action_record AS i
WHERE i.type = 'intent'
  AND NOT EXISTS (
      SELECT 1
      FROM action_record AS r
      WHERE r.type = 'result'
        AND r.correlation_id = i.correlation_id
  );
`.trim();

/**
 * Creates the immutability triggers on action_record.
 */
export function createImmutabilityTriggers(db: Database.Database): void {
  db.exec(TRIGGER_NO_UPDATE_SQL);
  db.exec(TRIGGER_NO_DELETE_SQL);
}

/**
 * Drops the delete trigger during controlled removal operations.
 */
export function dropDeleteTrigger(db: Database.Database): void {
  db.exec(`DROP TRIGGER IF EXISTS ${TRIGGER_NO_DELETE_NAME};`);
}

/**
 * Verifies that both immutability triggers exist and match expected definitions.
 */
export function verifyImmutabilityGuards(db: Database.Database): void {
  const triggers = db
    .prepare<[], { name: string; sql: string }>(
      `SELECT name, sql FROM sqlite_schema WHERE type = 'trigger' AND name IN ('${TRIGGER_NO_UPDATE_NAME}', '${TRIGGER_NO_DELETE_NAME}')`
    )
    .all();

  const triggerMap = new Map(triggers.map((t) => [t.name, t.sql]));
  const updateSql = triggerMap.get(TRIGGER_NO_UPDATE_NAME);
  const deleteSql = triggerMap.get(TRIGGER_NO_DELETE_NAME);

  if (!updateSql || !deleteSql) {
    throw new LedgerStoreError(
      'STORE_DAMAGED',
      `Immutability triggers missing in database schema. Found: ${triggers.map((t) => t.name).join(', ')}`
    );
  }

  if (
    !updateSql.includes('APPEND_ONLY_VIOLATION') ||
    !updateSql.includes('RECORD_IMMUTABLE') ||
    !deleteSql.includes('APPEND_ONLY_VIOLATION') ||
    !deleteSql.includes('RECORD_IMMUTABLE')
  ) {
    throw new LedgerStoreError(
      'STORE_DAMAGED',
      'Immutability triggers compromised: missing required APPEND_ONLY_VIOLATION or RECORD_IMMUTABLE definition.'
    );
  }
}

/**
 * Applies initial schema, device identity, system maintenance job, and immutability triggers.
 */
export function initializeSchema(db: Database.Database, deviceId: string): void {
  db.transaction(() => {
    db.exec(INITIAL_SCHEMA_SQL);
    createImmutabilityTriggers(db);
    verifyImmutabilityGuards(db);

    // Verify or set local device identity
    const existingDeviceRow = db
      .prepare<[], { device_id: string }>('SELECT device_id FROM local_device WHERE singleton = 1')
      .get();

    if (existingDeviceRow) {
      if (existingDeviceRow.device_id !== deviceId) {
        throw new LedgerStoreError(
          'DEVICE_ID_MISMATCH',
          `Local store belongs to device "${existingDeviceRow.device_id}", cannot open with device "${deviceId}".`
        );
      }
    } else {
      db.prepare('INSERT INTO local_device (singleton, device_id) VALUES (1, ?)').run(deviceId);
    }

    // Ensure device sequence tracking exists for local device
    db.prepare('INSERT OR IGNORE INTO device_sequence (device_id, last_sequence) VALUES (?, -1)').run(deviceId);

    // Initialize system maintenance job
    db.prepare(`
      INSERT OR IGNORE INTO job (
        id, original_request, state, approval_mode, summary_result, undo_of, created_at, updated_at, state_changed_at
      ) VALUES (
        ?,
        'System job for ledger maintenance operations (retention expiry, user deletion)',
        'done',
        'off',
        'Reserved maintenance coordinator',
        NULL,
        '1970-01-01T00:00:00.000Z',
        '1970-01-01T00:00:00.000Z',
        '1970-01-01T00:00:00.000Z'
      )
    `).run(SYSTEM_MAINTENANCE_JOB_ID);
  })();
}
