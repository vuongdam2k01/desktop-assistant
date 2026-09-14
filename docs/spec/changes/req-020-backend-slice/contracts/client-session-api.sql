-- Physical schema of the authentication and brokering store, normative for
-- backend/contracts/client-session-api@0.1.0.
--
-- The store holds exactly four record types: account, device enrolment, session and invitation. What is not
-- here is the point of the file. There is no relation for a provider token, no relation for a user's request or
-- a model's answer, no relation for platform content, and no relation for an action record. A reviewer
-- establishes the retention claim by reading this schema and dumping the relations it declares, rather than by
-- reading the service's code — spikes/SP-20-backend-slice/REPORT.md §1 Q1, Q4, Q10, and
-- spikes/SP-20-backend-slice/src/db/schema.sql, which this file follows.
--
-- Two server-side artifacts are deliberately absent. The Authorisation Request that the broker holds between
-- issuing a binding and redeeming it is transient and destroyed on use or expiry, so it has no durable
-- relation here. Server Secrets live in the secret manager and appear in a descriptor only by name
-- (backend/contracts/authorisation-provider-descriptor@0.1.0).
--
-- The encrypted replication partition is a separate store with its own schema, owned by
-- sync/contracts/replication-protocol@0.1.0 in req-022-account-sync.
--
-- Dialect: PostgreSQL, the engine the slice was measured against. What is normative is the set of relations,
-- their columns and their constraints, not the spelling of a type name.

-- ── Account ─────────────────────────────────────────────────────────────────────────────────────────────
-- Everything derived from an Account cascades from it, which is what makes deletion provable by walking from
-- the Account rather than by enumerating cleanup steps.

CREATE TABLE IF NOT EXISTS account (
    id          TEXT PRIMARY KEY,
    -- The identity provider's subject. One account per verified identity.
    identity_subject TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL UNIQUE,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT account_status_closed CHECK (status IN ('active', 'suspended'))
);

-- ── Device enrolment ────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device (
    id             TEXT PRIMARY KEY,
    account_id     TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    -- Supplied by the device. Signing in twice from one device produces one enrolment because the pair below
    -- is unique in the store, not because the calling code checks first.
    device_id      TEXT NOT NULL,
    -- Display text only. A label is never unique and never authenticates anything.
    device_name    TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT device_one_enrolment_per_account UNIQUE (account_id, device_id)
);

-- ── Session ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session (
    id                  TEXT PRIMARY KEY,
    account_id          TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    device_id           TEXT NOT NULL,
    -- An irreversible hash of the refresh token. The backend can verify a presented token and cannot produce
    -- one: nothing a client holds is reconstructible from this store.
    refresh_token_hash  TEXT NOT NULL UNIQUE,
    expires_at          TIMESTAMPTZ NOT NULL,
    -- Sign-out revokes exactly one session; the account's sessions on other devices are untouched.
    revoked_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Invitation ──────────────────────────────────────────────────────────────────────────────────────────
-- An invitation admits one address. Sign-in verifies the identity first and consults this relation second; an
-- account row created before this check would admit, on the next attempt, exactly the user the check exists to
-- refuse. An invitation is consumed by at most one Account — structurally, since consumption is a single
-- column — and a consumed invitation does not return to an unconsumed state; that second half is a transition
-- rule rather than a shape, so it is stated in the contract and enforced by the service, not by this file.

CREATE TABLE IF NOT EXISTS invitation (
    id                   TEXT PRIMARY KEY,
    email                TEXT UNIQUE,
    invite_code          TEXT UNIQUE,
    status               TEXT NOT NULL DEFAULT 'active',
    expires_at           TIMESTAMPTZ,
    activated_account_id TEXT REFERENCES account(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT invitation_status_closed CHECK (status IN ('active', 'redeemed', 'revoked')),
    CONSTRAINT invitation_addressed CHECK (email IS NOT NULL OR invite_code IS NOT NULL),
    -- Consumed means exactly: redeemed by a named account.
    CONSTRAINT invitation_consumption CHECK ((status = 'redeemed') = (activated_account_id IS NOT NULL))
);

-- ── Read paths ──────────────────────────────────────────────────────────────────────────────────────────
-- Sign-in resolves an identity and an invitation; renewal resolves a presented refresh token by its hash;
-- the device registry lists an account's devices.

CREATE INDEX IF NOT EXISTS account_identity_subject ON account (identity_subject);
CREATE INDEX IF NOT EXISTS account_email ON account (email);
CREATE INDEX IF NOT EXISTS device_account ON device (account_id);
CREATE INDEX IF NOT EXISTS session_account_device ON session (account_id, device_id);
CREATE INDEX IF NOT EXISTS session_refresh_hash ON session (refresh_token_hash);
CREATE INDEX IF NOT EXISTS invitation_email ON invitation (email);
CREATE INDEX IF NOT EXISTS invitation_code ON invitation (invite_code);
