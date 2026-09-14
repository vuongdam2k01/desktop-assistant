-- Physical schema of the device's credential store, normative for
-- platform/contracts/secure-storage@0.1.0.
--
-- The property this file is written to make visible rather than promised: there is no column anywhere below
-- that holds a credential in plain text. A value exists in plain text only inside the process that is using it,
-- for the duration of that use (INV-PLT-10), and the only stored form is the ciphertext the operating system's
-- encryption facility produced.
--
-- The store is a file in the application's per-user data directory, separate from the Local Store that
-- `req-013-sqlite-ledger` describes. Nothing belonging to it is written to the operating system's own
-- credential vault, which is what makes an orphaned entry in the user's system settings impossible rather than
-- unlikely — spikes/SP-11-secure-storage/REPORT.md §1 Q6.
--
-- The registered Credential Classes are not a relation here. A class is registered in the process that holds
-- the store, from platform/contracts/credential-class-descriptor@0.1.0, and an entry derives its class from its
-- key; holding a second copy on disk would let the erasure policy of a stored credential be decided by a stale
-- row rather than by the registered descriptor.

PRAGMA foreign_keys = ON;

-- ── Entries ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credential_entry (
    -- "<domain>:<category>:<identity>" with an optional ":<field>". The key is the identity of the entry and
    -- the basis of every scoped erasure: prefix ordering on this column is how a disconnect finds exactly the
    -- rows belonging to one connector.
    key         TEXT    PRIMARY KEY,
    -- The class registered for this key. Never resolved by position or registration order: a key matching no
    -- class, or two, is refused before it is written.
    class_id    TEXT    NOT NULL,
    -- Ciphertext as produced by the encryption facility: a three-byte scheme marker, a twelve-byte
    -- initialisation vector, a sixteen-byte authentication tag and the body — a fixed 31-byte overhead at every
    -- size (VERIFIED, spikes/SP-11-secure-storage/REPORT.md §1 Q2). The product recognises the marker and does
    -- not otherwise interpret the bytes.
    ciphertext  BLOB    NOT NULL,
    -- ISO-8601, when the entry was last written. Replacement, never append: an earlier value is not recoverable
    -- from this store once a new one is written.
    updated_at  TEXT    NOT NULL,
    -- 0 once a read has failed to decrypt this entry. A state, not a value (INV-PLT-07): it is set by the failed
    -- read that discovered it, never by a sweep, and it is what lets a surface say which connections are
    -- unavailable on this device without any caller attempting a read.
    readable    INTEGER NOT NULL DEFAULT 1,
    -- Non-secret fields only, and only those the class declares (INV-PLT-09). This column is read on paths that
    -- never decrypt, so anything reachable here is something a window process may hold.
    metadata    TEXT    NOT NULL DEFAULT '{}',

    CONSTRAINT credential_entry_key_named CHECK (key GLOB '?*:?*:?*'),
    CONSTRAINT credential_entry_readable_flag CHECK (readable IN (0, 1))
);

-- The class an entry belongs to is reported by `presence` and named in every erasure report, so it is read by
-- class as well as by key prefix.
CREATE INDEX IF NOT EXISTS credential_entry_class ON credential_entry (class_id);

-- ── Erasure in flight ───────────────────────────────────────────────────────────────────────────────────
-- An erasure that is interrupted records its state before it removes anything, and the next start reads this
-- relation before any other use of the store, so the run finishes before a credential could be used again
-- (INV-PLT-08). At most one erasure is in flight: a second trigger arriving during one does not start a
-- competing run, it joins the one already recorded.

CREATE TABLE IF NOT EXISTS pending_erasure (
    id         INTEGER PRIMARY KEY,
    -- What called for the erasure. connector_disconnect is the only scoped trigger; the other four cover the
    -- whole store and no class may decline them.
    trigger    TEXT    NOT NULL,
    -- A key prefix for a scoped erasure, or '*' for the whole store.
    scope      TEXT    NOT NULL,
    started_at TEXT    NOT NULL,

    CONSTRAINT pending_erasure_single CHECK (id = 1),
    CONSTRAINT pending_erasure_trigger_closed CHECK (trigger IN (
        'connector_disconnect', 'sign_out', 'device_revocation', 'account_deletion', 'uninstall'
    )),
    CONSTRAINT pending_erasure_scope_named CHECK (scope = '*' OR scope GLOB '?*:?*')
);
