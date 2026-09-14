import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { pathToFileURL } from 'node:url';
import { resolveBackupDirectory } from './backup-location.js';

export interface BackupResult {
  dumpPath: string;
  metadataPath: string;
  sha256: string;
  sizeBytes: number;
  timestamp: string;
  prunedCount: number;
}

export interface BackupMetadata {
  filename: string;
  timestamp: string;
  sha256: string;
  sizeBytes: number;
}

export function parseDatabaseUrl(databaseUrl: string): {
  host: string;
  port: string;
  user: string;
  password?: string | undefined;
  database: string;
} {
  const parsed = new URL(databaseUrl);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username || 'postgres'),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname.replace(/^\//, ''),
  };
}

export function pruneOldBackups(backupDir: string, retentionDays: number = 30): number {
  if (!fs.existsSync(backupDir)) return 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let pruned = 0;

  const files = fs.readdirSync(backupDir);
  for (const file of files) {
    if ((file.startsWith('backup-') && file.endsWith('.dump')) || (file.startsWith('backup-') && file.endsWith('.json'))) {
      const fullPath = path.join(backupDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
        pruned++;
      }
    }
  }

  return pruned;
}

export async function createDatabaseBackup(options: {
  databaseUrl?: string | undefined;
  backupDir?: string | undefined;
} = {}): Promise<BackupResult> {
  const config = loadConfig();
  const url = options.databaseUrl || config.database.url;
  const dbInfo = parseDatabaseUrl(url);

  const backupDir = resolveBackupDirectory({ requested: options.backupDir });
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  }
  const tempFilename = `.tmp-backup-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.dump`;
  const tempPath = path.join(backupDir, tempFilename);

  // Mode 0600
  fs.writeFileSync(tempPath, '', { mode: 0o600 });

  const childEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    PGHOST: dbInfo.host,
    PGPORT: dbInfo.port,
    PGUSER: dbInfo.user,
    PGDATABASE: dbInfo.database,
  };
  if (dbInfo.password !== undefined) {
    childEnv.PGPASSWORD = dbInfo.password;
  }

  try {
    execFileSync(
      'pg_dump',
      ['-Fc', '--no-owner', '--no-privileges', '-f', tempPath],
      {
        env: childEnv,
        stdio: 'pipe',
        shell: false,
      }
    );

    const fileBuffer = fs.readFileSync(tempPath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const sizeBytes = fileBuffer.length;
    const timestampStr = new Date().toISOString();
    const cleanTs = timestampStr.replace(/[:.]/g, '-');

    const finalDumpName = `backup-${cleanTs}-${sha256.slice(0, 8)}.dump`;
    const finalDumpPath = path.join(backupDir, finalDumpName);

    fs.renameSync(tempPath, finalDumpPath);
    fs.chmodSync(finalDumpPath, 0o600);

    const metadataName = `backup-${cleanTs}-${sha256.slice(0, 8)}.json`;
    const metadataPath = path.join(backupDir, metadataName);
    const metadata: BackupMetadata = {
      filename: finalDumpName,
      timestamp: timestampStr,
      sha256,
      sizeBytes,
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });

    // Prune artifacts older than 30 days only after successful backup
    const prunedCount = pruneOldBackups(backupDir, 30);

    return {
      dumpPath: finalDumpPath,
      metadataPath,
      sha256,
      sizeBytes,
      timestamp: timestampStr,
      prunedCount,
    };
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Best-effort cleanup of temporary dump file
      }
    }
    throw err;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  createDatabaseBackup()
    .then(res => {
      process.stdout.write(`Backup successful: ${res.dumpPath} (SHA256: ${res.sha256}, Size: ${res.sizeBytes} bytes)\n`);
      process.exit(0);
    })
    .catch(err => {
      process.stderr.write(`Backup failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
