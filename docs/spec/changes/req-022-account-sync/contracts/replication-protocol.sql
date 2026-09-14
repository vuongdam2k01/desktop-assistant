-- Physical schema of the account's replicated store on the backend, normative for
-- sync/contracts/replication-protocol@0.1.0.
--
-- The property this file exists to make visible: every column the backend reads in order to route, order or
-- resolve a record is outside the ciphertext, and the ciphertext is never read at all. Ordering is by causal
-- position and device sequence; the recorded time is carried for display and is not an ordering column. A
-- server that could resolve a conflict only by decrypting content would make the privacy claim a promise
-- rather than a property of the schema.
--
-- Scope. This is the backend partition. The device-side working copy of the same records is the Local Store,
-- whose schema is owned by ledger/contracts/ledger-store@0.1.0 in req-013-sqlite-ledger; the account's device
-- rows are in the authentication store owned by backend/contracts/client-session-api@0.1.0 in
-- req-020-backend-slice. None of the three is repeated here.
--
-- Dialect: PostgreSQL, following the backend slice. What is normative is the set of relations, their columns
-- and their constraints, not the spelling of a type name. Sizing and partition strategy are UNVERIFIED and
-- belong to SP-22; nothing here states a volume.

-- ── Records ─────────────────────────────────────────────────────────────────────────────────────────────
-- One relation carries every replicated store, because stores differ by their descriptor and never by their
-- transport or their storage. A store the descriptor set does not name has no rows here.

CREATE TABLE IF NOT EXISTS replicated_record (
    -- The account partition. Every read and every deletion is bounded by it, which is what makes an account's
    -- data separable as a unit for service and for destruction.
    account_id       TEXT NOT NULL,
    store_id         TEXT NOT NULL,
    record_id        TEXT NOT NULL,
    origin_device    TEXT NOT NULL,
    -- Monotonic within origin_device and never reused. Assigned when the record was written and never
    -- recomputed here.
    origin_sequence  BIGINT NOT NULL,
    -- Per-device high-water marks the originating device had observed. Read to order; never derived from a
    -- clock.
    causal_position  JSONB NOT NULL,
    -- Carried and displayed. Deliberately not an ordering column and deliberately not indexed as one.
    recorded_at      TIMESTAMPTZ NOT NULL,
    -- Mutable stores only; 0 for append-only. A non-zero version on an append-only store is refused.
    version          INTEGER NOT NULL DEFAULT 0,
    -- The order in which the backend received records, which is what
    -- last-writer-wins-with-preservation resolves by. It is a property of the server, not a claim about time.
    received_sequence BIGSERIAL NOT NULL,
    -- Opaque. Never read to route, order or resolve.
    ciphertext       BYTEA NOT NULL,
    -- Names the key without being one. The key itself is held by the key manager and reached only from the
    -- replication path.
    key_id           TEXT NOT NULL,

    CONSTRAINT replicated_record_identity PRIMARY KEY (account_id, store_id, record_id),
    -- A device's sequence position identifies one record within an account, so a redelivered record reconciles
    -- to the row already held instead of appending a second one.
    CONSTRAINT replicated_record_origin_unique UNIQUE (account_id, origin_device, origin_sequence),
    CONSTRAINT replicated_record_version_nonnegative CHECK (version >= 0)
);

-- The read path of replication.pull: an account's records for one store, in the order the backend received
-- them, resumable from a cursor.
CREATE INDEX IF NOT EXISTS replicated_record_store_receipt
    ON replicated_record (account_id, store_id, received_sequence);

-- ── Checkpoints ─────────────────────────────────────────────────────────────────────────────────────────
-- A cursor is per device and per store, so one store's large transfer cannot force another to restart and an
-- interrupted enrolment resumes where it stopped. A device with no row for a store is enrolling into it.

CREATE TABLE IF NOT EXISTS replication_cursor (
    account_id TEXT NOT NULL,
    device_id  TEXT NOT NULL,
    store_id   TEXT NOT NULL,
    position   BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT replication_cursor_identity PRIMARY KEY (account_id, device_id, store_id)
);

-- ── Key access audit ────────────────────────────────────────────────────────────────────────────────────
-- No key use without its audit record, and no self-modification of it: the path that caused an access cannot
-- alter the record of it. The relation is append-only for the same reason the ledger is — a record that can be
-- edited afterwards is not evidence. Whether every access is in fact recorded is a review obligation the risk
-- register carries; what this schema fixes is that a recorded one cannot be changed.

CREATE TABLE IF NOT EXISTS key_access_audit (
    id           BIGSERIAL PRIMARY KEY,
    account_id   TEXT NOT NULL,
    key_id       TEXT NOT NULL,
    -- The path that used the key. Confined to replication by INV-BE-07; a value naming an authentication or
    -- brokering path is evidence of a defect, not a permitted state.
    used_by_path TEXT NOT NULL,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS key_access_audit_account ON key_access_audit (account_id, occurred_at);

-- The refusal is raised rather than silently absorbed: a caller that tries to edit or remove an audit record
-- learns that it failed, which a silently discarded write would not tell it.
CREATE OR REPLACE FUNCTION key_access_audit_refuse() RETURNS trigger AS $refuse$
BEGIN
    RAISE EXCEPTION 'key_access_audit is append-only: % is refused', TG_OP;
END;
$refuse$ LANGUAGE plpgsql;

CREATE TRIGGER key_access_audit_no_change
BEFORE UPDATE OR DELETE ON key_access_audit
FOR EACH ROW EXECUTE FUNCTION key_access_audit_refuse();
