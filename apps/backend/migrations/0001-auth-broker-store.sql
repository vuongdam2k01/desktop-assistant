-- 0001-auth-broker-store.sql
-- Exact four-table store for authentication and brokering.
-- Normative schema from docs/spec/changes/req-020-backend-slice/contracts/client-session-api.sql

-- Drop obsolete F0 migration metadata table to maintain the exact 4-table boundary
DROP TABLE IF EXISTS pgmigrations CASCADE;

-- ── Account ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account (
    id               TEXT PRIMARY KEY,
    identity_subject TEXT NOT NULL UNIQUE,
    email            TEXT NOT NULL UNIQUE,
    status           TEXT NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT account_status_closed CHECK (status IN ('active', 'suspended'))
);

-- ── Device enrolment ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device (
    id             TEXT PRIMARY KEY,
    account_id     TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    device_id      TEXT NOT NULL,
    device_name    TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT device_one_enrolment_per_account UNIQUE (account_id, device_id)
);

-- ── Session ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session (
    id                 TEXT PRIMARY KEY,
    account_id         TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    device_id          TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    expires_at         TIMESTAMPTZ NOT NULL,
    revoked_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Invitation ────────────────────────────────────────────────────────────────
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
    CONSTRAINT invitation_consumption CHECK ((status = 'redeemed') = (activated_account_id IS NOT NULL))
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS account_identity_subject ON account (identity_subject);
CREATE INDEX IF NOT EXISTS account_email ON account (email);
CREATE INDEX IF NOT EXISTS device_account ON device (account_id);
CREATE INDEX IF NOT EXISTS session_account_device ON session (account_id, device_id);
CREATE INDEX IF NOT EXISTS session_refresh_hash ON session (refresh_token_hash);
CREATE INDEX IF NOT EXISTS invitation_email ON invitation (email);
CREATE INDEX IF NOT EXISTS invitation_code ON invitation (invite_code);
