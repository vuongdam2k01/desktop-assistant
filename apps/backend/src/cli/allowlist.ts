import crypto from 'node:crypto';
import pg from 'pg';
import { loadConfig } from '../config.js';
import { pathToFileURL } from 'node:url';

export interface InvitationRecord {
  id: string;
  email: string | null;
  invite_code: string | null;
  status: 'active' | 'redeemed' | 'revoked';
  expires_at: Date | null;
  activated_account_id: string | null;
  created_at: Date;
}

export async function addInvitation(params: {
  email: string;
  expiresAt?: Date | null | undefined;
  databaseUrl?: string | undefined;
}): Promise<InvitationRecord> {
  const email = params.email.toLowerCase().trim();
  if (!email || !email.includes('@')) {
    throw new Error(`Invalid email address: "${params.email}"`);
  }

  const config = loadConfig();
  const pool = new pg.Pool({
    connectionString: params.databaseUrl || config.database.url,
  });

  try {
    const existing = await pool.query<InvitationRecord>(
      'SELECT * FROM invitation WHERE email = $1',
      [email]
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.status === 'active') {
        return row;
      }
      throw new Error(
        `Cannot add invitation for "${email}": invitation already exists with status "${row.status}" and cannot be silently reopened`
      );
    }

    const id = crypto.randomUUID();
    const res = await pool.query<InvitationRecord>(
      `INSERT INTO invitation (id, email, status, expires_at)
       VALUES ($1, $2, 'active', $3)
       RETURNING *`,
      [id, email, params.expiresAt ?? null]
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error('Failed to insert invitation');
    }
    return row;
  } finally {
    await pool.end();
  }
}

export async function listInvitations(params: {
  status?: string | undefined;
  databaseUrl?: string | undefined;
} = {}): Promise<InvitationRecord[]> {
  const config = loadConfig();
  const pool = new pg.Pool({
    connectionString: params.databaseUrl || config.database.url,
  });

  try {
    if (params.status) {
      const res = await pool.query<InvitationRecord>(
        'SELECT * FROM invitation WHERE status = $1 ORDER BY created_at DESC',
        [params.status]
      );
      return res.rows;
    }
    const res = await pool.query<InvitationRecord>(
      'SELECT * FROM invitation ORDER BY created_at DESC'
    );
    return res.rows;
  } finally {
    await pool.end();
  }
}

export async function revokeInvitation(params: {
  email: string;
  databaseUrl?: string | undefined;
}): Promise<{
  revoked: boolean;
  invitationId: string;
  accountId?: string | undefined;
  sessionsRevoked: number;
}> {
  const email = params.email.toLowerCase().trim();
  const config = loadConfig();
  const pool = new pg.Pool({
    connectionString: params.databaseUrl || config.database.url,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query<InvitationRecord>(
      'SELECT * FROM invitation WHERE email = $1 FOR UPDATE',
      [email]
    );

    const invitation = res.rows[0];
    if (!invitation) {
      throw new Error(`Invitation for email "${email}" not found`);
    }

    let sessionsRevoked = 0;
    const accountId = invitation.activated_account_id;

    if (accountId) {
      const sessRes = await client.query(
        'UPDATE session SET revoked_at = CURRENT_TIMESTAMP WHERE account_id = $1 AND revoked_at IS NULL',
        [accountId]
      );
      sessionsRevoked = sessRes.rowCount ?? 0;
    }

    await client.query(
      `UPDATE invitation 
       SET status = 'revoked', activated_account_id = NULL 
       WHERE id = $1`,
      [invitation.id]
    );

    await client.query('COMMIT');

    return {
      revoked: true,
      invitationId: invitation.id,
      accountId: accountId ?? undefined,
      sessionsRevoked,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

function parseArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'add') {
    const email = parseArg(args, '--email');
    if (!email) {
      process.stderr.write('Usage: tsx src/cli/allowlist.ts add --email <email> [--expires-at <iso>]\n');
      process.exit(1);
    }
    const expiresAtStr = parseArg(args, '--expires-at');
    const expiresAt = expiresAtStr ? new Date(expiresAtStr) : undefined;

    addInvitation({ email, expiresAt })
      .then(inv => {
        process.stdout.write(`Invitation created for ${inv.email} (id: ${inv.id})\n`);
        process.exit(0);
      })
      .catch(err => {
        process.stderr.write(`Failed to add invitation: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      });
  } else if (command === 'list') {
    const status = parseArg(args, '--status');
    listInvitations(status ? { status } : {})
      .then(invs => {
        process.stdout.write(JSON.stringify(invs, null, 2) + '\n');
        process.exit(0);
      })
      .catch(err => {
        process.stderr.write(`Failed to list invitations: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      });
  } else if (command === 'revoke') {
    const email = parseArg(args, '--email');
    if (!email) {
      process.stderr.write('Usage: tsx src/cli/allowlist.ts revoke --email <email>\n');
      process.exit(1);
    }

    revokeInvitation({ email })
      .then(res => {
        process.stdout.write(
          `Revoked invitation for ${email}. Sessions revoked: ${res.sessionsRevoked}\n`
        );
        process.exit(0);
      })
      .catch(err => {
        process.stderr.write(`Failed to revoke invitation: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      });
  } else {
    process.stderr.write('Usage: allowlist <add|list|revoke> [options]\n');
    process.exit(1);
  }
}
