import { query, getDb } from './index.js';
import fs from 'node:fs';
import path from 'node:path';

export async function dumpSchema(outputPath: string): Promise<string> {
  // Query all user tables in public schema
  const tables = await query<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  let ddl = `-- ==========================================================================\n`;
  ddl += `-- POSTGRESQL SCHEMA DUMP — Desktop Assistant Backend (SP-20)\n`;
  ddl += `-- Generated at: ${new Date().toISOString()}\n`;
  ddl += `-- Proof for Q4 / NFR-BE-05 (No connector tokens, prompts, or ledger)\n`;
  ddl += `-- ==========================================================================\n\n`;

  for (const table of tables) {
    const tableName = table.table_name;
    const columns = await query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);

    ddl += `CREATE TABLE public.${tableName} (\n`;
    const colDefs = columns.map(c => {
      let def = `  ${c.column_name} ${c.data_type.toUpperCase()}`;
      if (c.is_nullable === 'NO') def += ' NOT NULL';
      if (c.column_default) def += ` DEFAULT ${c.column_default}`;
      return def;
    });
    ddl += colDefs.join(',\n');
    ddl += `\n);\n\n`;
  }

  // Also query indexes
  const indexes = await query<{ tablename: string; indexname: string; indexdef: string }>(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);

  ddl += `-- Indexes\n`;
  for (const idx of indexes) {
    ddl += `${idx.indexdef};\n`;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, ddl, 'utf8');
  return ddl;
}

export async function dumpTableContents(outputPath: string): Promise<string> {
  const tables = ['account', 'device', 'session', 'invite_allowlist'];
  let output = `==========================================================================\n`;
  output += `POSTGRESQL TABLE CONTENTS AFTER FULL RUN — Desktop Assistant Backend (SP-20)\n`;
  output += `Generated at: ${new Date().toISOString()}\n`;
  output += `Proof for Q4: PROVING NO CONNECTOR TOKENS, NO USER COMMANDS, NO LEDGER\n`;
  output += `==========================================================================\n\n`;

  for (const tableName of tables) {
    output += `--------------------------------------------------------------------------\n`;
    output += `TABLE: public.${tableName}\n`;
    output += `--------------------------------------------------------------------------\n`;
    
    try {
      const rows = await query(`SELECT * FROM ${tableName} ORDER BY created_at ASC;`);
      output += `Total rows: ${rows.length}\n`;
      if (rows.length === 0) {
        output += `(empty table)\n\n`;
      } else {
        output += JSON.stringify(rows, null, 2) + `\n\n`;
      }
    } catch (err: any) {
      output += `Error querying table: ${err.message}\n\n`;
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf8');
  return output;
}
