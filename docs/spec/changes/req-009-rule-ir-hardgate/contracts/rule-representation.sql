-- Physical schema of the Rule Catalogue store, normative for approval/contracts/rule-representation@1.0.0.
--
-- What this file owns: the account's stored rules, the permanent allowlist entries that sit beside them, and
-- the constraints that make the two safety properties of the catalogue true of the store itself rather than of
-- the code that writes to it — that no stored rule can claim an origin other than the user (INV-APPROVAL-04),
-- and that a rule is present only once it has been confirmed (INV-APPROVAL-08).
--
-- What this file does not own: the shape of a rule's condition. That is rule-representation.schema.json, and it
-- is held here as one structured-text column, so a change to what a rule can express is a change to that file
-- rather than to this schema. Nor does it own hardline rules or the smart tier's static patterns: those are
-- part of the application build and are deliberately in no store at all, which is what makes them unreachable
-- by editing, corrupting or replicating a catalogue.
--
-- This is a store of its own, separate from the ledger's (INV-APPROVAL-07): editing, adding or withdrawing a
-- rule never touches a ledger record, and a rule withdrawn today does not change what the gate decided
-- yesterday. Scoped Approvals and Refusal Notices are absent by design — both live with the running job and
-- vanish with it, so neither has a relation here.
--
-- Evidence: the closed leaf set and the identifier-anchored targeting the rule column carries are the ones the
-- frozen adversarial corpus was run against — spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi
-- Q1, Q3, Q5 and spikes/SP-8-rule-ir-hardgate/src/ir/schema.json. The store itself is UNVERIFIED: the spike
-- held its catalogue in memory, so no measurement covers load time or resident size.

-- ── Configuration ───────────────────────────────────────────────────────────────────────────────────────
-- Referential integrity enforced, because an allowlist entry that outlived the rule it was granted against
-- would be an exception with nothing to explain it. The catalogue's shape version is the database's own
-- user_version marker; it is not the representation version a rule carries.

PRAGMA foreign_keys = ON;

-- ── Relations ───────────────────────────────────────────────────────────────────────────────────────────

-- One row per stored rule. The catalogue is read in full on load and on every change, whether the change came
-- from this device or from replication; there is no partial residency, because a partially resident catalogue
-- is a gate with holes in it.
CREATE TABLE IF NOT EXISTS rule (
    id                     TEXT    PRIMARY KEY,
    -- The version of approval/contracts/rule-representation the rule was written against. A row whose version
    -- is ahead of the build refuses the whole catalogue (RULE_VERSION_AHEAD) rather than being read around.
    representation_version TEXT    NOT NULL,
    name                   TEXT    NOT NULL,
    -- The restatement the user confirmed, in their own language. Displayed, never parsed.
    restatement            TEXT    NOT NULL,
    origin                 TEXT    NOT NULL DEFAULT 'user',
    verdict                TEXT    NOT NULL,
    -- The condition tree per rule-representation.schema.json, held as structured text. Its shape belongs to
    -- that file; this column carries no opinion about it beyond requiring one to be present.
    condition_json         TEXT    NOT NULL,
    -- ISO-8601. A rule binds from this moment and not before; an unconfirmed rule is not stored at all, which
    -- is why this column admits no null (INV-APPROVAL-08).
    confirmed_at           TEXT    NOT NULL,
    updated_at             TEXT    NOT NULL,

    -- No stored rule may claim the hardline or static origin. This is the tampering guard of INV-APPROVAL-04
    -- expressed as a refusal in the store's own definition, so that a catalogue written by anything other than
    -- the product's own elicitation path still cannot introduce one.
    CONSTRAINT rule_origin_user_only CHECK (origin = 'user'),
    CONSTRAINT rule_verdict_closed CHECK (verdict IN ('refuse', 'hold', 'allow')),
    CONSTRAINT rule_name_present CHECK (length(trim(name)) > 0),
    CONSTRAINT rule_restatement_present CHECK (length(trim(restatement)) > 0)
);

-- One row per permanent exception the user made outside any one job. An entry never overrides a rule whose
-- verdict stops: a permanent exception for an operation a stopping rule also matches is refused at the moment
-- it is requested (APPROVAL_LEVEL_FORBIDDEN), because the exception belongs inside that rule.
CREATE TABLE IF NOT EXISTS allowlist_entry (
    id            TEXT PRIMARY KEY,
    connector     TEXT NOT NULL,
    tool          TEXT NOT NULL,
    -- The scope the user was shown when they made the exception permanent. Both parts are required: an entry
    -- naming a tool but no object is the widening that case A-19 measured.
    object_type   TEXT NOT NULL,
    object_id     TEXT NOT NULL,
    added_at      TEXT NOT NULL,

    CONSTRAINT allowlist_entry_unique UNIQUE (connector, tool, object_type, object_id)
);

-- The catalogue is read whole, so it carries no index for evaluation. This index serves the application
-- window's rule list, which orders by when the user confirmed each rule.
CREATE INDEX IF NOT EXISTS rule_by_confirmation ON rule (confirmed_at DESC);
