-- PRD §12.2 Backend Data Model
-- Entities: Account, Device, Session, InviteAllowlist
-- ARCHITECTURAL INVARIANT (NFR-BE-05):
-- No connector tokens, no user commands/prompts, no Notion data, no images, no ledger.

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, device_id)
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invite_allowlist (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  invite_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', -- active, redeemed, revoked
  expires_at TIMESTAMPTZ,
  activated_account_id TEXT REFERENCES account(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_google_sub ON account(google_sub);
CREATE INDEX IF NOT EXISTS idx_account_email ON account(email);
CREATE INDEX IF NOT EXISTS idx_device_account ON device(account_id);
CREATE INDEX IF NOT EXISTS idx_session_refresh_hash ON session(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_allowlist_email ON invite_allowlist(email);
CREATE INDEX IF NOT EXISTS idx_allowlist_code ON invite_allowlist(invite_code);
