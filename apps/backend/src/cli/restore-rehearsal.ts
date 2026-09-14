import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadConfig } from '../config.js';
import { parseDatabaseUrl } from './backup-database.js';
import { verifyExactSchemaBoundary } from './dump-auth-store.js';
import { pathToFileURL } from 'node:url';
import { resolveBackupDirectory } from './backup-location.js';

export interface RestoreRehearsalResult {
  rehearsalDatabase: string;
  dumpFile: string;
  tablesVerified: string[];
  rowCounts: Record<string, number>;
  refreshHashConstraintVerified: boolean;
  credentialSentinelsClean: boolean;
}

function getLatestDump(backupDir: string): { dumpPath: string; metadataPath?: string | undefined } {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory "${backupDir}" does not exist`);
  }

  const files = fs
    .readdirSync(backupDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.dump'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`No backup dump files found in "${backupDir}"`);
  }

  const firstFile = files[0];
  if (!firstFile) {
    throw new Error(`No backup dump files found in "${backupDir}"`);
  }
  const dumpPath = path.join(backupDir, firstFile);
  const metaName = firstFile.replace(/\.dump$/, '.json');
  const metadataPath = path.join(backupDir, metaName);

  return {
    dumpPath,
    metadataPath: fs.existsSync(metadataPath) ? metadataPath : undefined,
  };
}

export async function runRestoreRehearsal(options: {
  dumpPath?: string;
  adminDatabaseUrl?: string;
} = {}): Promise<RestoreRehearsalResult> {
  const config = loadConfig();
  const backupDir = resolveBackupDirectory();

  let dumpPath = options.dumpPath;
  if (!dumpPath) {
    const latest = getLatestDump(backupDir);
    dumpPath = latest.dumpPath;
    if (latest.metadataPath) {
      const meta = JSON.parse(fs.readFileSync(latest.metadataPath, 'utf8')) as { sha256: string };
      const computedHash = crypto
        .createHash('sha256')
        .update(fs.readFileSync(dumpPath))
        .digest('hex');
      if (meta.sha256 !== computedHash) {
        throw new Error(
          `Backup digest mismatch! Metadata: ${meta.sha256}, Actual file: ${computedHash}`
        );
      }
    }
  }

  const rawAdminUrl = options.adminDatabaseUrl || process.env.RESTORE_ADMIN_DATABASE_URL;
  let adminUrl: string;
  if (rawAdminUrl) {
    adminUrl = rawAdminUrl;
  } else {
    // Derive maintenance database URL from application DATABASE_URL
    const parsed = new URL(config.database.url);
    parsed.pathname = '/postgres';
    adminUrl = parsed.toString();
  }

  const dbInfo = parseDatabaseUrl(adminUrl);
  const rehearsalDbName = `rehearsal_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const adminPool = new pg.Pool({
    connectionString: adminUrl,
    connectionTimeoutMillis: 5000,
  });

  let rehearsalPool: pg.Pool | undefined;

  try {
    // 1. Create rehearsal database
    await adminPool.query(`CREATE DATABASE "${rehearsalDbName}"`);

    // 2. Run pg_restore
    const childEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      PGHOST: dbInfo.host,
      PGPORT: dbInfo.port,
      PGUSER: dbInfo.user,
      PGDATABASE: rehearsalDbName,
    };
    if (dbInfo.password !== undefined) {
      childEnv.PGPASSWORD = dbInfo.password;
    }

    execFileSync(
      'pg_restore',
      ['--exit-on-error', '--no-owner', '--no-privileges', '-d', rehearsalDbName, dumpPath],
      {
        env: childEnv,
        stdio: 'pipe',
        shell: false,
      }
    );

    // 3. Connect to restored database
    const rehearsalUrl = new URL(adminUrl);
    rehearsalUrl.pathname = `/${rehearsalDbName}`;
    rehearsalPool = new pg.Pool({
      connectionString: rehearsalUrl.toString(),
      connectionTimeoutMillis: 5000,
    });

    // 4. Verify exact 4-table schema
    const tablesVerified = await verifyExactSchemaBoundary(rehearsalPool);

    // 5. Verify row counts
    const rowCounts: Record<string, number> = {};
    for (const table of tablesVerified) {
      const res = await rehearsalPool.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "${table}"`);
      rowCounts[table] = parseInt(res.rows[0]?.count || '0', 10);
    }

    // 6. Verify refresh-token-hash unique constraint non-reusability
    let refreshHashConstraintVerified = false;
    const testHash = 'test_rehearsal_hash_' + crypto.randomUUID();
    const dummyAccId = crypto.randomUUID();

    // Create dummy account to test session insert
    await rehearsalPool.query(
      `INSERT INTO account (id, identity_subject, email, status) VALUES ($1, $2, $3, 'active')`,
      [dummyAccId, 'test_sub_' + dummyAccId, 'test_' + dummyAccId + '@example.com']
    );

    await rehearsalPool.query(
      `INSERT INTO session (id, account_id, device_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + interval '1 day')`,
      [crypto.randomUUID(), dummyAccId, 'dev-1', testHash]
    );

    try {
      // Duplicate insert with same refresh_token_hash must fail
      await rehearsalPool.query(
        `INSERT INTO session (id, account_id, device_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + interval '1 day')`,
        [crypto.randomUUID(), dummyAccId, 'dev-2', testHash]
      );
    } catch (err) {
      // Check for unique violation (PostgreSQL code 23505)
      const pgErr = err as { code?: string };
      if (pgErr.code === '23505') {
        refreshHashConstraintVerified = true;
      } else {
        throw err;
      }
    }

    if (!refreshHashConstraintVerified) {
      throw new Error('Verification failed: duplicate refresh_token_hash was unexpectedly permitted');
    }

    // 7. Verify absence of credential sentinels
    const forbiddenColumns = [
      'password',
      'secret',
      'access_token',
      'provider_token',
      'bearer_token',
      'command',
      'job',
      'ledger',
      'transcript',
    ];
    const colsRes = await rehearsalPool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'`
    );
    for (const col of colsRes.rows) {
      const colName = col.column_name.toLowerCase();
      if (colName === 'token' || colName === 'refresh_token') {
        throw new Error(`Credential sentinel violation: raw token column "${col.column_name}" found`);
      }
      for (const forbidden of forbiddenColumns) {
        if (colName.includes(forbidden)) {
          throw new Error(`Credential sentinel violation: forbidden column "${col.column_name}" found`);
        }
      }
    }

    return {
      rehearsalDatabase: rehearsalDbName,
      dumpFile: path.basename(dumpPath),
      tablesVerified,
      rowCounts,
      refreshHashConstraintVerified,
      credentialSentinelsClean: true,
    };
  } finally {
    if (rehearsalPool) {
      await rehearsalPool.end().catch(() => {});
    }

    // Drop the rehearsal database
    try {
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) 
         FROM pg_stat_activity 
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [rehearsalDbName]
      );
      await adminPool.query(`DROP DATABASE IF EXISTS "${rehearsalDbName}"`);
    } catch {
      // Cleanup best effort
    }
    await adminPool.end().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runRestoreRehearsal()
    .then(res => {
      process.stdout.write(
        `Restore rehearsal PASSED successfully:\n` +
          `  Rehearsal DB: ${res.rehearsalDatabase} (cleaned up)\n` +
          `  Dump: ${res.dumpFile}\n` +
          `  Tables verified: [${res.tablesVerified.join(', ')}]\n` +
          `  Refresh hash non-reusability: VERIFIED\n` +
          `  Credential sentinels: CLEAN\n`
      );
      process.exit(0);
    })
    .catch(err => {
      process.stderr.write(`Restore rehearsal FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
