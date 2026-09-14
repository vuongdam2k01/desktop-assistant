-- ==========================================================================
-- POSTGRESQL SCHEMA DUMP — Desktop Assistant Backend (SP-20)
-- Generated at: 2026-09-12T05:10:33.936Z
-- Proof for Q4 / NFR-BE-05 (No connector tokens, prompts, or ledger)
-- ==========================================================================

CREATE TABLE public.account (
  id TEXT NOT NULL,
  google_sub TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.device (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.invite_allowlist (
  id TEXT NOT NULL,
  email TEXT,
  invite_code TEXT,
  status TEXT NOT NULL DEFAULT 'active'::text,
  expires_at TIMESTAMP WITH TIME ZONE,
  activated_account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.session (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX account_email_key ON public.account USING btree (email);
CREATE UNIQUE INDEX account_google_sub_key ON public.account USING btree (google_sub);
CREATE UNIQUE INDEX account_pkey ON public.account USING btree (id);
CREATE INDEX idx_account_email ON public.account USING btree (email);
CREATE INDEX idx_account_google_sub ON public.account USING btree (google_sub);
CREATE UNIQUE INDEX device_account_id_device_id_key ON public.device USING btree (account_id, device_id);
CREATE UNIQUE INDEX device_pkey ON public.device USING btree (id);
CREATE INDEX idx_device_account ON public.device USING btree (account_id);
CREATE INDEX idx_allowlist_code ON public.invite_allowlist USING btree (invite_code);
CREATE INDEX idx_allowlist_email ON public.invite_allowlist USING btree (email);
CREATE UNIQUE INDEX invite_allowlist_email_key ON public.invite_allowlist USING btree (email);
CREATE UNIQUE INDEX invite_allowlist_invite_code_key ON public.invite_allowlist USING btree (invite_code);
CREATE UNIQUE INDEX invite_allowlist_pkey ON public.invite_allowlist USING btree (id);
CREATE INDEX idx_session_refresh_hash ON public.session USING btree (refresh_token_hash);
CREATE UNIQUE INDEX session_pkey ON public.session USING btree (id);
CREATE UNIQUE INDEX session_refresh_token_hash_key ON public.session USING btree (refresh_token_hash);
