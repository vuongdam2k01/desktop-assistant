import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadConfig } from '../config.js';
import { pathToFileURL } from 'node:url';

const MIGRATION_ADVISORY_LOCK_ID = 428901234;

export async function runMigrations(databaseUrl?: string): Promise<string[]> {
  const config = loadConfig();
  const url = databaseUrl || config.database.url;
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: config.database.connectTimeoutMs,
  });

  const client = await pool.connect();
  const applied: string[] = [];

  try {
    // Acquire PostgreSQL session-level advisory lock
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_ID]);

    const migrationsDir = path.resolve(
      fs.existsSync(path.resolve(process.cwd(), 'migrations'))
        ? path.resolve(process.cwd(), 'migrations')
        : path.resolve(process.cwd(), 'apps/backend/migrations')
    );

    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    await client.query('BEGIN');
    try {
      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        applied.push(file);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_ID]);
    } catch {
      // ignore unlock error if connection was dropped
    }
    client.release();
    await pool.end();
  }

  return applied;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runMigrations()
    .then(applied => {
      process.stdout.write(`Migrations applied successfully:\n${applied.map(f => `  - ${f}`).join('\n')}\n`);
      process.exit(0);
    })
    .catch(err => {
      process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
