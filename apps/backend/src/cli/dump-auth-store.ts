import pg from 'pg';
import { loadConfig } from '../config.js';
import { pathToFileURL } from 'node:url';

export const NORMATIVE_TABLES = ['account', 'device', 'invitation', 'session'] as const;

export interface DumpResult {
  tables: string[];
  columns: Record<string, Array<{ column_name: string; data_type: string; is_nullable: string }>>;
  rows: Record<string, Array<Record<string, unknown>>>;
}

export async function verifyExactSchemaBoundary(clientOrPool: pg.Pool | pg.PoolClient): Promise<string[]> {
  const result = await clientOrPool.query<{ table_name: string }>(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
     ORDER BY table_name ASC`
  );

  const foundTables = result.rows.map(r => r.table_name).sort();
  const expectedTables = [...NORMATIVE_TABLES].sort();

  const isExactMatch =
    foundTables.length === expectedTables.length &&
    foundTables.every((name, idx) => name === expectedTables[idx]);

  if (!isExactMatch) {
    throw new Error(
      `Schema boundary violation! Expected exactly [${expectedTables.join(', ')}], but found [${foundTables.join(', ')}]`
    );
  }

  return foundTables;
}

export async function dumpAuthStore(databaseUrl?: string, options: { raw?: boolean } = {}): Promise<DumpResult> {
  const config = loadConfig();
  const url = databaseUrl || config.database.url;
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: config.database.connectTimeoutMs,
  });

  try {
    const tables = await verifyExactSchemaBoundary(pool);
    const columns: DumpResult['columns'] = {};
    const rows: DumpResult['rows'] = {};

    for (const table of tables) {
      const colRes = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(
        `SELECT column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 
         ORDER BY ordinal_position ASC`,
        [table]
      );
      columns[table] = colRes.rows;

      const rowRes = await pool.query<Record<string, unknown>>(`SELECT * FROM "${table}"`);
      if (options.raw) {
        rows[table] = rowRes.rows;
      } else {
        rows[table] = rowRes.rows.map(row => {
          const sanitized = { ...row };
          if ('refresh_token_hash' in sanitized) {
            sanitized.refresh_token_hash = '[REDACTED_HASH]';
          }
          return sanitized;
        });
      }
    }

    return {
      tables,
      columns,
      rows,
    };
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const isRaw = process.argv.includes('--raw');
  dumpAuthStore(undefined, { raw: isRaw })
    .then(dump => {
      process.stdout.write(JSON.stringify(dump, null, 2) + '\n');
      process.exit(0);
    })
    .catch(err => {
      process.stderr.write(`Schema boundary verification failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
