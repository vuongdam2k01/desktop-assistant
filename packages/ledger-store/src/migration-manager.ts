import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { LedgerStoreError } from './errors.js';
import { verifyImmutabilityGuards } from './schema.js';
import type { ShapeState } from './types.js';

export interface MigrationStep {
  readonly version: number;
  readonly name: string;
  apply(db: Database.Database): void;
}

export const DEFAULT_MIGRATION_REGISTRY: readonly MigrationStep[] = [
  {
    version: 1,
    name: 'initial_ledger_schema',
    apply: () => {
      // Version 1 is applied during initial database schema initialization
    },
  },
];

interface ColumnMeta {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
  hidden: number;
}

interface TableMeta {
  name: string;
  sql: string | null;
  columns: Record<string, ColumnMeta>;
}

interface SchemaSnapshot {
  tables: Record<string, TableMeta>;
  views: Record<string, string | null>;
  indexes: Record<string, string | null>;
  triggers: Record<string, string | null>;
}

export class MigrationManager {
  readonly registry: readonly MigrationStep[];

  constructor(
    readonly db: Database.Database,
    registry?: readonly MigrationStep[] | undefined
  ) {
    this.registry = registry || DEFAULT_MIGRATION_REGISTRY;
  }

  /**
   * Reads current user_version from SQLite and computes pending migration steps.
   */
  shape(): ShapeState {
    const row = this.db.prepare<[], { user_version: number }>('PRAGMA user_version').get();
    const current = row ? row.user_version : 0;
    const target =
      this.registry.length > 0 ? this.registry[this.registry.length - 1]!.version : current;

    const pendingSteps = this.registry
      .filter((step) => step.version > current)
      .map((step) => step.version);

    return {
      current,
      target,
      pendingSteps,
    };
  }

  /**
   * Applies all pending migration steps in sequential order up to target.
   * Throws SHAPE_AHEAD if the database version is higher than supported.
   */
  migrateToTarget(): ShapeState {
    const currentShape = this.shape();
    if (currentShape.current > currentShape.target) {
      throw new LedgerStoreError(
        'SHAPE_AHEAD',
        `Database shape version ${currentShape.current} is newer than supported version ${currentShape.target}.`
      );
    }

    let shape = currentShape;
    while (shape.pendingSteps.length > 0) {
      shape = this.advanceShape();
    }

    return shape;
  }

  /**
   * Advances database shape by exactly one step inside a transaction.
   * Enforces byte-level immutability verification of existing records.
   */
  advanceShape(): ShapeState {
    const currentShape = this.shape();
    if (currentShape.current > currentShape.target) {
      throw new LedgerStoreError(
        'SHAPE_AHEAD',
        `Database shape version ${currentShape.current} is newer than supported version ${currentShape.target}.`
      );
    }

    if (currentShape.pendingSteps.length === 0) {
      return currentShape;
    }

    const nextVersion = currentShape.pendingSteps[0]!;
    const step = this.registry.find((s) => s.version === nextVersion);
    if (!step) {
      throw new LedgerStoreError(
        'SHAPE_STEP_FAILED',
        `Missing migration definition for version ${nextVersion}.`
      );
    }

    try {
      this.db.transaction(() => {
        // 1. Capture pre-migration schema and record checksums
        const preSchema = this.captureSchemaMeta();
        const preRecords = this.captureActionRecordDigest();

        // 2. Apply migration step
        step.apply(this.db);

        // 3. Capture post-migration schema and verify compatibility
        const postSchema = this.captureSchemaMeta();

        // Check: all pre-existing tables still exist with matching prior column definitions
        for (const [tableName, preTable] of Object.entries(preSchema.tables)) {
          const postTable = postSchema.tables[tableName];
          if (!postTable) {
            throw new LedgerStoreError(
              'SHAPE_WOULD_REWRITE',
              `Migration step ${step.version} dropped existing table "${tableName}".`
            );
          }

          for (const [colName, preCol] of Object.entries(preTable.columns)) {
            const postCol = postTable.columns[colName];
            if (!postCol) {
              throw new LedgerStoreError(
                'SHAPE_WOULD_REWRITE',
                `Migration step ${step.version} dropped column "${colName}" in table "${tableName}".`
              );
            }

            // Incompatible column constraint change
            if (
              preCol.type !== postCol.type ||
              preCol.notnull !== postCol.notnull ||
              preCol.dflt_value !== postCol.dflt_value ||
              preCol.pk !== postCol.pk ||
              preCol.hidden !== postCol.hidden
            ) {
              throw new LedgerStoreError(
                'SHAPE_WOULD_REWRITE',
                `Migration step ${step.version} altered constraints on column "${colName}" in table "${tableName}".`
              );
            }
          }
        }

        // Check: all pre-existing views still exist
        for (const [viewName, preSql] of Object.entries(preSchema.views)) {
          const postSql = postSchema.views[viewName];
          if (postSql === undefined || postSql !== preSql) {
            throw new LedgerStoreError(
              'SHAPE_WOULD_REWRITE',
              `Migration step ${step.version} dropped or altered view "${viewName}".`
            );
          }
        }

        // Check: all pre-existing triggers still exist
        for (const [triggerName, preSql] of Object.entries(preSchema.triggers)) {
          const postSql = postSchema.triggers[triggerName];
          if (postSql === undefined || postSql !== preSql) {
            throw new LedgerStoreError(
              'SHAPE_WOULD_REWRITE',
              `Migration step ${step.version} dropped or altered trigger "${triggerName}".`
            );
          }
        }

        // Check action_record additions: only nullable with no default and not generated
        const preActionCols = preSchema.tables['action_record']?.columns || {};
        const postActionCols = postSchema.tables['action_record']?.columns || {};

        for (const [colName, postCol] of Object.entries(postActionCols)) {
          if (!preActionCols[colName]) {
            // New column added to action_record
            if (postCol.notnull !== 0 || postCol.dflt_value !== null || postCol.hidden !== 0) {
              throw new LedgerStoreError(
                'SHAPE_WOULD_REWRITE',
                `New column "${colName}" on action_record must be nullable, no default, and not generated.`
              );
            }
          }
        }

        // 4. Verify existing record byte-level immutability
        const postRecords = this.captureActionRecordDigest();
        if (preRecords.count !== postRecords.count || preRecords.digest !== postRecords.digest) {
          throw new LedgerStoreError(
            'SHAPE_WOULD_REWRITE',
            `Migration step ${step.version} altered or deleted existing action records.`
          );
        }

        // 5. Verify immutability triggers still exist and are valid
        verifyImmutabilityGuards(this.db);

        // 6. Update user_version inside same transaction
        this.db.pragma(`user_version = ${step.version}`);
      })();
    } catch (err: unknown) {
      if (err instanceof LedgerStoreError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('APPEND_ONLY_VIOLATION') || msg.includes('RECORD_IMMUTABLE')) {
        throw new LedgerStoreError(
          'SHAPE_WOULD_REWRITE',
          `Migration step ${step.version} attempted to modify or delete immutable records: ${msg}`,
          { cause: err }
        );
      }
      throw new LedgerStoreError(
        'SHAPE_STEP_FAILED',
        `Migration step ${step.version} (${step.name}) failed: ${msg}`,
        { cause: err }
      );
    }

    return this.shape();
  }

  // ── Pre/Post Verification Helpers ────────────────────────────────────────

  private captureSchemaMeta(): SchemaSnapshot {
    const rows = this.db
      .prepare<[], { type: string; name: string; sql: string | null }>(
        "SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type ASC, name ASC"
      )
      .all();

    const tables: Record<string, TableMeta> = {};
    const views: Record<string, string | null> = {};
    const indexes: Record<string, string | null> = {};
    const triggers: Record<string, string | null> = {};

    for (const row of rows) {
      if (row.type === 'table') {
        const columns = this.db.prepare(`PRAGMA table_xinfo("${row.name}")`).all() as ColumnMeta[];
        const colMap: Record<string, ColumnMeta> = {};
        for (const col of columns) {
          colMap[col.name] = col;
        }
        tables[row.name] = {
          name: row.name,
          sql: row.sql,
          columns: colMap,
        };
      } else if (row.type === 'view') {
        views[row.name] = row.sql;
      } else if (row.type === 'index') {
        indexes[row.name] = row.sql;
      } else if (row.type === 'trigger') {
        triggers[row.name] = row.sql;
      }
    }

    return { tables, views, indexes, triggers };
  }

  private captureActionRecordDigest(): { count: number; digest: string } {
    const tableExists = this.db
      .prepare<[string], { name: string }>(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?"
      )
      .get('action_record');

    if (!tableExists) {
      return { count: 0, digest: 'no_table' };
    }

    const rows = this.db
      .prepare<[], {
        record_id: string;
        job_id: string;
        position: number;
        type: string;
        origin_device: string;
        origin_sequence: number;
        recorded_at: string;
        correlation_id: string | null;
        references_json: string | null;
        content: string;
      }>(
        `SELECT record_id, job_id, position, type, origin_device, origin_sequence,
                recorded_at, correlation_id, references_json, content
         FROM action_record
         ORDER BY record_id ASC`
      )
      .all();

    const hash = crypto.createHash('sha256');

    function encodeField(val: string | number | null): Buffer {
      if (val === null) {
        return Buffer.from([0xff, 0xff, 0xff, 0xff]);
      }
      const str = String(val);
      const buf = Buffer.from(str, 'utf8');
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32BE(buf.length);
      return Buffer.concat([lenBuf, buf]);
    }

    for (const r of rows) {
      hash.update(encodeField(r.record_id));
      hash.update(encodeField(r.job_id));
      hash.update(encodeField(r.position));
      hash.update(encodeField(r.type));
      hash.update(encodeField(r.origin_device));
      hash.update(encodeField(r.origin_sequence));
      hash.update(encodeField(r.recorded_at));
      hash.update(encodeField(r.correlation_id));
      hash.update(encodeField(r.references_json));
      hash.update(encodeField(r.content));
    }

    return {
      count: rows.length,
      digest: hash.digest('hex'),
    };
  }
}

/**
 * Creates a custom test migration registry for verification of shape step failures and rewrites.
 */
export function createTestMigrationRegistry(
  steps: readonly MigrationStep[]
): readonly MigrationStep[] {
  return [...steps];
}
