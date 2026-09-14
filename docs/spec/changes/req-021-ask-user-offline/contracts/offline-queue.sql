-- Physical schema of the offline command queue, normative for app/contracts/offline-queue@0.1.0.
--
-- What this file owns: the relation that holds commands the user submitted while the intake service was
-- unreachable, and the two constraints that carry the guarantees the queue exists for. Status is a closed set,
-- so a row can never be in a state the drain worker does not know how to act on. The idempotency key is unique,
-- so a command that has already been accepted cannot be enqueued twice on this device, and a retried dispatch
-- is deduplicated at the backend against the same value.
--
-- What this file does not own: the ledger, the job and the decision relations that share the same database
-- file. Those belong to `ledger` and `job` and are declared by their own changes, so that none is specified
-- twice.
--
-- Queued commands are device-bound and are deliberately outside replication: a command that has not been
-- accepted is not yet a job, and carrying one to a second device would mean two devices racing to submit the
-- same intention. Replication begins where the backend turns a command into a job.
--
-- Evidence: the relation, the idempotency key and the chronological drain are the ones the spike ran against -
-- spikes/SP-21-ask-user-offline/REPORT.md section 1 Q8, Q10, Q12, the harness source at
-- spikes/SP-21-ask-user-offline/src/ledger.ts, and the stores the runs left behind at
-- spikes/SP-21-ask-user-offline/evidence/test-queue-q8.db and .../test-persistence-q12.db. Two things below
-- were not what the spike ran and are UNVERIFIED as written: the spike enforced the status set in application
-- code rather than as a constraint, and it scanned the whole relation rather than reading a partial index.
-- Neither changes what the measured runs demonstrated; both move an existing rule into the store.

PRAGMA foreign_keys = ON;

-- ── Relations ───────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offline_command_queue (
    id              TEXT    PRIMARY KEY,
    -- The instruction exactly as the user typed it into the composer. Never interpreted while queued: nothing
    -- reads it until the backend accepts it and creates a job.
    command_text    TEXT    NOT NULL,
    status          TEXT    NOT NULL,
    -- Client-generated, and the whole basis of exactly-once acceptance. The backend answers a repeat of a key
    -- it has already processed as deduplicated, which the client records as a successful sync rather than as
    -- a second command.
    idempotency_key TEXT    NOT NULL UNIQUE,
    -- Milliseconds since the epoch, at the moment the user pressed send. This is the drain order, so that
    -- commands reach the backend in the order the user meant them.
    created_at      INTEGER NOT NULL,
    synced_at       INTEGER,
    retry_count     INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT offline_command_status_closed CHECK (status IN (
        'QUEUED_OFFLINE', 'SENDING', 'SYNCED', 'FAILED', 'CANCELLED'
    )),
    -- An empty command is refused at submission and therefore never queued.
    CONSTRAINT offline_command_text_present CHECK (length(trim(command_text)) > 0)
);

-- The drain reads only what is still waiting, oldest first. A partial index keeps that read proportional to
-- the backlog rather than to the retained history, which matters because synced rows are kept for seven days
-- after they stop being interesting.
CREATE INDEX IF NOT EXISTS offline_command_drain
    ON offline_command_queue (created_at ASC)
    WHERE status = 'QUEUED_OFFLINE';
