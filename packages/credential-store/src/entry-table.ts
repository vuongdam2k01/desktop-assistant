import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import { CredentialStoreError } from './errors.js';

export interface StoredEntryRow {
  key: string;
  class_id: string;
  ciphertext: Buffer;
  updated_at: string;
  readable: number;
  metadata: string;
}

export interface StoredPresenceRow {
  key: string;
  class_id: string;
  updated_at: string;
  readable: number;
  metadata: string;
}

export interface PendingErasureRow {
  id: number;
  trigger: string;
  scope: string;
  started_at: string;
  /**
   * The credential classes the erasure was allowed to reach, as JSON, decided when the
   * erasure began. It is recorded rather than recomputed on resumption, because the set of
   * classes a later launch happens to have registered is not the set the erasure was for.
   */
  allowed_classes: string | null;
}

function setPosixPermissions(filePath: string): void {
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(filePath, 0o600);
    } catch (err: unknown) {
      const nodeErr = err as { code?: string };
      if (
        nodeErr &&
        (nodeErr.code === 'ENOENT' ||
          nodeErr.code === 'ENOTSUP' ||
          nodeErr.code === 'EOPNOTSUPP')
      ) {
        return;
      }
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }

    try {
      const stats = fs.statSync(filePath);
      // Verify no permissions for group and others
      if ((stats.mode & 0o077) !== 0) {
        // Mode could not be restricted; fail closed on standard POSIX filesystems
        fs.chmodSync(filePath, 0o600);
      }
    } catch (err: unknown) {
      const nodeErr = err as { code?: string };
      if (
        nodeErr &&
        (nodeErr.code === 'ENOENT' ||
          nodeErr.code === 'ENOTSUP' ||
          nodeErr.code === 'EOPNOTSUPP')
      ) {
        return;
      }
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }
}

export class EntryTable {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor(databasePath: string) {
    this.dbPath = databasePath;
  }

  open(): void {
    if (this.db) {
      return;
    }

    let localDb: Database.Database | null = null;
    try {
      const parentDir = path.dirname(this.dbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true, mode: 0o700 });
      }

      localDb = new Database(this.dbPath);

      // 1. Verify WAL journal mode
      const journalMode = localDb.pragma('journal_mode = WAL', { simple: true });
      if (journalMode !== 'wal') {
        throw new CredentialStoreError({
          code: 'WRITE_FAILED',
        });
      }

      localDb.pragma('synchronous = NORMAL');
      localDb.pragma('foreign_keys = ON');
      localDb.pragma('fullfsync = OFF');
      localDb.pragma('secure_delete = ON');

      // Create schema
      localDb.exec(`
        CREATE TABLE IF NOT EXISTS credential_entry (
            key         TEXT    PRIMARY KEY,
            class_id    TEXT    NOT NULL,
            ciphertext  BLOB    NOT NULL,
            updated_at  TEXT    NOT NULL,
            readable    INTEGER NOT NULL DEFAULT 1,
            metadata    TEXT    NOT NULL DEFAULT '{}',
            CONSTRAINT credential_entry_key_named CHECK (key GLOB '?*:?*:?*'),
            CONSTRAINT credential_entry_readable_flag CHECK (readable IN (0, 1))
        );

        CREATE INDEX IF NOT EXISTS credential_entry_class ON credential_entry (class_id);

        CREATE TABLE IF NOT EXISTS pending_erasure (
            id         INTEGER PRIMARY KEY,
            trigger    TEXT    NOT NULL,
            scope      TEXT    NOT NULL,
            started_at TEXT    NOT NULL,
            allowed_classes TEXT,
            CONSTRAINT pending_erasure_single CHECK (id = 1),
            CONSTRAINT pending_erasure_trigger_closed CHECK (trigger IN (
                'connector_disconnect', 'sign_out', 'device_revocation', 'account_deletion', 'uninstall'
            )),
            CONSTRAINT pending_erasure_scope_named CHECK (scope = '*' OR scope GLOB '?*:?*')
        );
      `);

      // A database written before the column existed still has to finish its erasure.
      const pendingColumns = localDb
        .prepare(`SELECT name FROM pragma_table_info('pending_erasure')`)
        .all() as { name: string }[];
      if (!pendingColumns.some(column => column.name === 'allowed_classes')) {
        localDb.exec('ALTER TABLE pending_erasure ADD COLUMN allowed_classes TEXT');
      }

      // Protect database files
      setPosixPermissions(this.dbPath);
      setPosixPermissions(`${this.dbPath}-wal`);
      setPosixPermissions(`${this.dbPath}-shm`);

      this.db = localDb;
    } catch (err) {
      if (localDb) {
        try {
          localDb.close();
        } catch {
          // Ignore cleanup error
        }
      }
      if (err instanceof CredentialStoreError) {
        throw err;
      }
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  get isOpen(): boolean {
    return this.db !== null && this.db.open;
  }

  private getDb(): Database.Database {
    if (!this.db || !this.db.open) {
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
    return this.db;
  }

  private updateSidecarPermissions(): void {
    setPosixPermissions(this.dbPath);
    setPosixPermissions(`${this.dbPath}-wal`);
    setPosixPermissions(`${this.dbPath}-shm`);
  }

  getEntry(key: string): StoredEntryRow | undefined {
    try {
      const db = this.getDb();
      return db
        .prepare(
          'SELECT key, class_id, ciphertext, updated_at, readable, metadata FROM credential_entry WHERE key = ?'
        )
        .get(key) as StoredEntryRow | undefined;
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
        key,
      });
    }
  }

  getPresence(key: string): StoredPresenceRow | undefined {
    try {
      const db = this.getDb();
      return db
        .prepare(
          'SELECT key, class_id, updated_at, readable, metadata FROM credential_entry WHERE key = ?'
        )
        .get(key) as StoredPresenceRow | undefined;
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
        key,
      });
    }
  }

  listByPrefix(prefix: string): StoredPresenceRow[] {
    try {
      const db = this.getDb();
      if (prefix === '*') {
        return db
          .prepare(
            'SELECT key, class_id, updated_at, readable, metadata FROM credential_entry ORDER BY key ASC'
          )
          .all() as StoredPresenceRow[];
      }

      // Compute character length inside SQLite to support astral Unicode / surrogate pairs
      return db
        .prepare(
          'SELECT key, class_id, updated_at, readable, metadata FROM credential_entry WHERE substr(key, 1, length(?)) = ? ORDER BY key ASC'
        )
        .all(prefix, prefix) as StoredPresenceRow[];
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  upsertEntry(entry: {
    key: string;
    class_id: string;
    ciphertext: Buffer;
    updated_at: string;
    readable: number;
    metadata: string;
  }): void {
    try {
      const db = this.getDb();
      db.prepare(
        `INSERT INTO credential_entry (key, class_id, ciphertext, updated_at, readable, metadata)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           class_id = excluded.class_id,
           ciphertext = excluded.ciphertext,
           updated_at = excluded.updated_at,
           readable = excluded.readable,
           metadata = excluded.metadata`
      ).run(
        entry.key,
        entry.class_id,
        entry.ciphertext,
        entry.updated_at,
        entry.readable,
        entry.metadata
      );
      this.updateSidecarPermissions();
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
        key: entry.key,
        classId: entry.class_id,
      });
    }
  }

  markUnreadable(key: string): void {
    try {
      const db = this.getDb();
      db.prepare('UPDATE credential_entry SET readable = 0 WHERE key = ?').run(key);
      this.updateSidecarPermissions();
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
        key,
      });
    }
  }

  getPendingErasure(): PendingErasureRow | undefined {
    try {
      const db = this.getDb();
      return db
        .prepare(
          'SELECT id, trigger, scope, started_at, allowed_classes FROM pending_erasure WHERE id = 1'
        )
        .get() as PendingErasureRow | undefined;
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  setPendingErasure(
    trigger: string,
    scope: string,
    startedAt: string,
    allowedClasses?: readonly string[]
  ): { trigger: string; scope: string; started_at: string; allowedClasses?: readonly string[] } {
    try {
      const db = this.getDb();
      const existing = this.getPendingErasure();
      if (existing) {
        // Whole-store scope '*' cannot be narrowed to a scoped prefix
        const finalScope = existing.scope === '*' ? '*' : scope;
        // Destructive triggers cannot be downgraded to non-destructive
        const isExistingDestructive =
          existing.trigger === 'account_deletion' || existing.trigger === 'uninstall';
        const finalTrigger = isExistingDestructive ? existing.trigger : trigger;

        // A joined erasure widens; it never narrows what an earlier one was allowed to reach.
        const existingClasses = existing.allowed_classes
          ? (JSON.parse(existing.allowed_classes) as string[])
          : undefined;
        const finalClasses =
          existingClasses === undefined || allowedClasses === undefined
            ? undefined
            : [...new Set([...existingClasses, ...allowedClasses])];

        db.prepare(
          `UPDATE pending_erasure SET trigger = ?, scope = ?, started_at = ?, allowed_classes = ? WHERE id = 1`
        ).run(
          finalTrigger,
          finalScope,
          startedAt,
          finalClasses === undefined ? null : JSON.stringify(finalClasses)
        );
        this.updateSidecarPermissions();
        return {
          trigger: finalTrigger,
          scope: finalScope,
          started_at: startedAt,
          ...(finalClasses === undefined ? {} : { allowedClasses: finalClasses }),
        };
      }

      db.prepare(
        `INSERT INTO pending_erasure (id, trigger, scope, started_at, allowed_classes)
         VALUES (1, ?, ?, ?, ?)`
      ).run(
        trigger,
        scope,
        startedAt,
        allowedClasses === undefined ? null : JSON.stringify(allowedClasses)
      );
      this.updateSidecarPermissions();
      return {
        trigger,
        scope,
        started_at: startedAt,
        ...(allowedClasses === undefined ? {} : { allowedClasses }),
      };
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  clearPendingErasure(): void {
    try {
      const db = this.getDb();
      db.prepare('DELETE FROM pending_erasure WHERE id = 1').run();
      this.updateSidecarPermissions();
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  countEntriesByScope(scope: string, allowedClasses?: readonly string[]): number {
    try {
      const db = this.getDb();
      if (scope === '*') {
        const row = db.prepare('SELECT count(*) as count FROM credential_entry').get() as {
          count: number;
        };
        return row.count;
      }

      if (allowedClasses !== undefined) {
        if (allowedClasses.length === 0) {
          return 0; // Explicitly empty allowlist matches nothing
        }
        const placeholders = allowedClasses.map(() => '?').join(',');
        const row = db
          .prepare(
            `SELECT count(*) as count FROM credential_entry WHERE substr(key, 1, length(?)) = ? AND class_id IN (${placeholders})`
          )
          .get(scope, scope, ...allowedClasses) as { count: number };
        return row.count;
      }

      const row = db
        .prepare(
          'SELECT count(*) as count FROM credential_entry WHERE substr(key, 1, length(?)) = ?'
        )
        .get(scope, scope) as { count: number };
      return row.count;
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  /**
   * Securely overwrites ciphertext with random blobs, clears metadata,
   * marks rows unreadable, and deletes matching rows inside a single transaction.
   * Returns exact count of rows deleted.
   */
  overwriteAndDeleteEntriesByScope(
    scope: string,
    allowedClasses?: readonly string[]
  ): number {
    try {
      const db = this.getDb();
      let deleteChanges = 0;

      const tx = db.transaction(() => {
        if (scope === '*') {
          db.prepare(
            `UPDATE credential_entry
             SET ciphertext = randomblob(length(ciphertext)),
                 metadata = '{}',
                 readable = 0`
          ).run();
          const info = db.prepare('DELETE FROM credential_entry').run();
          deleteChanges = Number(info.changes);
        } else if (allowedClasses !== undefined) {
          if (allowedClasses.length === 0) {
            deleteChanges = 0; // Explicitly empty allowlist deletes nothing
            return;
          }
          const placeholders = allowedClasses.map(() => '?').join(',');
          db.prepare(
            `UPDATE credential_entry
             SET ciphertext = randomblob(length(ciphertext)),
                 metadata = '{}',
                 readable = 0
             WHERE substr(key, 1, length(?)) = ? AND class_id IN (${placeholders})`
          ).run(scope, scope, ...allowedClasses);
          const info = db
            .prepare(
              `DELETE FROM credential_entry
               WHERE substr(key, 1, length(?)) = ? AND class_id IN (${placeholders})`
            )
            .run(scope, scope, ...allowedClasses);
          deleteChanges = Number(info.changes);
        } else {
          db.prepare(
            `UPDATE credential_entry
             SET ciphertext = randomblob(length(ciphertext)),
                 metadata = '{}',
                 readable = 0
             WHERE substr(key, 1, length(?)) = ?`
          ).run(scope, scope);
          const info = db
            .prepare('DELETE FROM credential_entry WHERE substr(key, 1, length(?)) = ?')
            .run(scope, scope);
          deleteChanges = Number(info.changes);
        }
      });

      tx();
      this.updateSidecarPermissions();
      return deleteChanges;
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  checkpoint(): void {
    try {
      const db = this.getDb();
      const rows = db.pragma('wal_checkpoint(TRUNCATE)') as Array<{
        busy: number;
        log: number;
        checkpointed: number;
      }>;
      if (!rows || rows.length === 0 || rows[0] === undefined || rows[0].busy !== 0) {
        throw new CredentialStoreError({
          code: 'ERASURE_INCOMPLETE',
        });
      }
      this.updateSidecarPermissions();
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'ERASURE_INCOMPLETE',
      });
    }
  }

  vacuum(): void {
    try {
      const db = this.getDb();
      db.exec('VACUUM');
      this.updateSidecarPermissions();
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
  }

  close(): void {
    if (this.db) {
      try {
        if (this.db.open) {
          this.db.close();
        }
      } catch (err) {
        if (err instanceof CredentialStoreError) throw err;
        throw new CredentialStoreError({
          code: 'WRITE_FAILED',
        });
      } finally {
        this.db = null;
      }
    }
  }

  deleteDatabaseFiles(): void {
    this.close();
    const files = [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`];

    // Unconditionally unlink every file, accepting only ENOENT
    for (const f of files) {
      try {
        fs.unlinkSync(f);
      } catch (err: unknown) {
        const nodeErr = err as { code?: string };
        if (nodeErr && nodeErr.code !== 'ENOENT') {
          throw new CredentialStoreError({
            code: 'ERASURE_INCOMPLETE',
          });
        }
      }
    }

    // Verify all files are absent with lstatSync (proves absence without check/use race)
    for (const f of files) {
      try {
        fs.lstatSync(f);
        // If lstat succeeds, the file still exists
        throw new CredentialStoreError({
          code: 'ERASURE_INCOMPLETE',
        });
      } catch (err: unknown) {
        if (err instanceof CredentialStoreError) throw err;
        const nodeErr = err as { code?: string };
        if (nodeErr && nodeErr.code !== 'ENOENT') {
          throw new CredentialStoreError({
            code: 'ERASURE_INCOMPLETE',
          });
        }
        // ENOENT confirms absence
      }
    }
  }
}
