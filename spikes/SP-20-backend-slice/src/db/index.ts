import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

let dbInstance: PGlite | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getDb(): Promise<PGlite> {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure data directory exists if using persistent storage
  const dataDir = config.dbDataDir;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize PGlite (PostgreSQL 18 WebAssembly Engine)
  dbInstance = new PGlite(dataDir);
  await dbInstance.waitReady;

  // Run initial schema migration
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await dbInstance.exec(schemaSql);

  return dbInstance;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const res = await db.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function exec(sql: string): Promise<void> {
  const db = await getDb();
  await db.exec(sql);
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
