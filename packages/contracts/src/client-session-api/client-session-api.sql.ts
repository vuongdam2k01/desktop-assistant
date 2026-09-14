// Generated from client-session-api.sql

export interface AccountRow {
  id: string;
  identity_subject: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceRow {
  id: string;
  account_id: string;
  device_id: string;
  device_name: string | null;
  last_active_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  account_id: string;
  device_id: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface InvitationRow {
  id: string;
  email: string | null;
  invite_code: string | null;
  status: string;
  expires_at: string | null;
  activated_account_id: string | null;
  created_at: string;
}
