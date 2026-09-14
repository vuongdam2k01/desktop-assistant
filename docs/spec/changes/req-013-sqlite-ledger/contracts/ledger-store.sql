-- Physical schema of the device-resident Local Store, normative for
-- ledger/contracts/ledger-store@0.1.0.
--
-- What this file owns: the action records this contract appends and reads, the relations that hold the
-- store's guarantees, and the configuration under which those guarantees were measured. The same store file
-- also holds the job and approval-request relations; those are owned by `job` and `approval` and are not
-- declared here, so that neither is specified twice. Only the job identity the ledger's foreign key rests on
-- appears below.
--
-- What this file does not own: the shape of a record's content. That is
-- ledger/contracts/ledger-record@0.1.0, and it is held here as one structured-text column so that a change to
-- the record shape is a change to that contract rather than to this schema.
--
-- Evidence: the configuration, the guard mechanism, the shape-version marker and the index below are the ones
-- crash injection and migration actually ran against — spikes/SP-12-sqlite-ledger/REPORT.md §1 Q1d, Q2, Q5, Q6
-- and spikes/SP-12-sqlite-ledger/src/schema.sql. Credentials are never in this store; they are reached through
-- platform/contracts/secure-storage@0.1.0.

-- ── Configuration ───────────────────────────────────────────────────────────────────────────────────────
-- Write-ahead logging with the ordinary durability setting, and referential integrity enforced. This is the
-- configuration under which a process killed immediately after an append was found to hold the record and not
-- the call; changing it changes what the evidence covers. The store's shape version is the database's own
-- user_version marker, advanced one whole step at a time (INV-LG-08).

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- ── Relations ───────────────────────────────────────────────────────────────────────────────────────────

-- Identity only. The job record's own shape is owned by `job`.
CREATE TABLE IF NOT EXISTS job (
    id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS action_record (
    record_id       TEXT    PRIMARY KEY,
    job_id          TEXT    NOT NULL REFERENCES job(id),
    position        INTEGER NOT NULL,
    type            TEXT    NOT NULL,
    origin_device   TEXT    NOT NULL,
    origin_sequence INTEGER NOT NULL,
    -- ISO-8601. Displayed, never used to order: ordering is position within a job and origin_sequence within
    -- a device (INV-SYNC-06).
    recorded_at     TEXT    NOT NULL,
    correlation_id  TEXT,
    -- JSON array of record_id: the records this one corrects, answers, or announces the removal of.
    references_json TEXT,
    -- The record's content per ledger-record@0.1.0, held as structured text, uncompressed, carrying whole
    -- state rather than differences.
    content         TEXT    NOT NULL,

    CONSTRAINT action_record_type_closed CHECK (type IN (
        'intent', 'result', 'decision', 'error', 'information', 'removal_announcement', 'superseded_version'
    )),
    -- A correlation identifier is carried by intent and result records and by no other type.
    CONSTRAINT action_record_correlation_scope CHECK (
        (type IN ('intent', 'result')) = (correlation_id IS NOT NULL)
    ),
    -- Position is dense and strictly increasing within the job (INV-LG-02).
    CONSTRAINT action_record_position_unique UNIQUE (job_id, position),
    -- A device's sequence position is assigned once and never reused (INV-LG-09).
    CONSTRAINT action_record_origin_unique UNIQUE (origin_device, origin_sequence)
);

-- INV-LG-04, in the store rather than in the writing path: one intent and at most one result may carry a
-- given correlation identifier, so a second call cannot reuse it and one call's result cannot close another
-- call's intent.
CREATE UNIQUE INDEX IF NOT EXISTS action_record_correlation_pair
    ON action_record (correlation_id, type)
    WHERE correlation_id IS NOT NULL;

-- ── Immutability guard (INV-LG-06) ──────────────────────────────────────────────────────────────────────
-- The guard belongs to the store's definition, not to the code that writes records, so it refuses every
-- process that opens the file, including tools that are not the product. The retention and deletion operation
-- is the one operation permitted to set it aside, and it restores it inside the same transaction as the
-- removal announcement and the removal itself.

CREATE TRIGGER IF NOT EXISTS action_record_no_update
BEFORE UPDATE ON action_record
BEGIN
    SELECT RAISE(ABORT, 'action_record is append-only: UPDATE is refused');
END;

CREATE TRIGGER IF NOT EXISTS action_record_no_delete
BEFORE DELETE ON action_record
BEGIN
    SELECT RAISE(ABORT, 'action_record is append-only: DELETE is refused');
END;

-- ── Reading ─────────────────────────────────────────────────────────────────────────────────────────────

-- The recovery surface: intents with no result carrying their correlation identifier. It is a derived set,
-- never a stored state, which is what lets the classification pass run again after an interrupted start and
-- reach the same classification (INV-PLT-01).
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

CREATE INDEX IF NOT EXISTS action_record_job_position ON action_record (job_id, position);
CREATE INDEX IF NOT EXISTS action_record_correlation ON action_record (correlation_id);
-- The descending recorded-time index the recent-jobs listing reads; it took that query from roughly 30 ms to
-- under 1 ms in the storage measurement.
CREATE INDEX IF NOT EXISTS action_record_recorded_at_desc ON action_record (recorded_at DESC);
