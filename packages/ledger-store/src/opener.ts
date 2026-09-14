import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { LedgerStoreError } from './errors.js';
import { initializeSchema, verifyImmutabilityGuards } from './schema.js';
import { RecordRepository } from './record-repository.js';
import { RemovalManager } from './removal-manager.js';
import { MigrationManager } from './migration-manager.js';
import { LedgerStoreImpl, type LedgerStore } from './ledger-store.js';

export interface DurabilitySettings {
  readonly journalMode: 'WAL';
  readonly foreignKeys: 'ON';
  readonly synchronous: 'FULL' | 'NORMAL';
  readonly fullfsync: 'ON' | 'OFF';
  readonly checkpointFullfsync: 'ON' | 'OFF';
  readonly walAutocheckpoint: number;
}

export interface OpenLedgerStoreOptions {
  readonly path: string;
  readonly deviceId: string;
  readonly attachmentRoot?: string | undefined;
  readonly retentionDays?: number | undefined;
}

export interface OpenAuxiliaryDatabaseOptions {
  readonly path: string;
  readonly readonly?: boolean | undefined;
}

/**
 * Pure helper determining durability settings based on platform and store kind.
 * Exported for internal test inspection.
 */
export function durabilityPolicy(
  platform: NodeJS.Platform,
  storeKind: 'authoritative' | 'auxiliary'
): DurabilitySettings {
  if (storeKind === 'auxiliary') {
    return {
      journalMode: 'WAL',
      foreignKeys: 'ON',
      synchronous: 'NORMAL',
      fullfsync: 'OFF',
      checkpointFullfsync: 'OFF',
      walAutocheckpoint: 1000,
    };
  }

  // Authoritative store
  if (platform === 'darwin') {
    return {
      journalMode: 'WAL',
      foreignKeys: 'ON',
      synchronous: 'FULL',
      fullfsync: 'ON',
      checkpointFullfsync: 'ON',
      walAutocheckpoint: 1000,
    };
  }

  // Linux and Windows
  return {
    journalMode: 'WAL',
    foreignKeys: 'ON',
    synchronous: 'NORMAL',
    fullfsync: 'OFF',
    checkpointFullfsync: 'OFF',
    walAutocheckpoint: 1000,
  };
}

function ensureParentDirAndPermissions(filePath: string): void {
  if (filePath === ':memory:' || filePath.startsWith('file::memory:')) {
    return;
  }

  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Best-effort directory chmod (e.g. if already created with different umask)
  }
}

function applyFilePermissions(filePath: string): void {
  if (
    filePath === ':memory:' ||
    filePath.startsWith('file::memory:') ||
    process.platform === 'win32'
  ) {
    return;
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.chmodSync(filePath, 0o600);
    }
  } catch {
    // Best-effort file chmod
  }
}

function applyPragmas(db: Database.Database, policy: DurabilitySettings): void {
  db.pragma(`journal_mode = ${policy.journalMode}`);
  db.pragma(`foreign_keys = ${policy.foreignKeys}`);
  db.pragma(`synchronous = ${policy.synchronous}`);
  db.pragma(`wal_autocheckpoint = ${policy.walAutocheckpoint}`);
  db.pragma(`fullfsync = ${policy.fullfsync}`);
  db.pragma(`checkpoint_fullfsync = ${policy.checkpointFullfsync}`);
}

function runIntegrityCheck(db: Database.Database): void {
  const result = db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>;
  if (result.length === 0 || result[0]?.integrity_check !== 'ok') {
    const message = result.map((r) => r.integrity_check).join('; ');
    throw new LedgerStoreError('STORE_DAMAGED', `Database integrity check failed: ${message}`);
  }
}

/**
 * Opens the authoritative ledger and job store file.
 * Applies migrations, validates device identity, verifies immutability guards,
 * and resumes any pending removal operations before returning the store.
 */
export async function openLedgerStore(options: OpenLedgerStoreOptions): Promise<LedgerStore> {
  ensureParentDirAndPermissions(options.path);

  let db: Database.Database;
  try {
    db = new Database(options.path);
  } catch (err: unknown) {
    throw new LedgerStoreError(
      'STORE_UNAVAILABLE',
      `Failed to open database at "${options.path}": ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }

  applyFilePermissions(options.path);

  try {
    const policy = durabilityPolicy(process.platform, 'authoritative');
    applyPragmas(db, policy);
    runIntegrityCheck(db);

    const versionRow = db.prepare<[], { user_version: number }>('PRAGMA user_version').get();
    const currentVersion = versionRow ? versionRow.user_version : 0;

    if (currentVersion === 0) {
      initializeSchema(db, options.deviceId);
      db.pragma('user_version = 1');
    } else {
      // Validate device identity on existing database
      const deviceRow = db
        .prepare<[], { device_id: string }>('SELECT device_id FROM local_device WHERE singleton = 1')
        .get();

      if (!deviceRow) {
        throw new LedgerStoreError(
          'STORE_DAMAGED',
          'Corrupted ledger store: local device identity missing.'
        );
      }

      if (deviceRow.device_id !== options.deviceId) {
        throw new LedgerStoreError(
          'DEVICE_ID_MISMATCH',
          `Local store belongs to device "${deviceRow.device_id}", cannot open with device "${options.deviceId}".`
        );
      }

      verifyImmutabilityGuards(db);
    }

    const migrationManager = new MigrationManager(db);
    migrationManager.migrateToTarget();

    const repository = new RecordRepository(db, options.deviceId, options.attachmentRoot);
    const removalManager = new RemovalManager(
      db,
      repository,
      options.deviceId,
      options.attachmentRoot,
      options.retentionDays
    );

    removalManager.resumeIncompleteRemovals();

    return new LedgerStoreImpl(db, repository, removalManager, migrationManager);
  } catch (err: unknown) {
    try {
      db.close();
    } catch {
      // Ignore close errors during rollback
    }
    throw err;
  }
}

/**
 * Opens a cache or scratch database without ledger schema or physical-flush pragmas.
 */
export function openAuxiliaryDatabase(options: OpenAuxiliaryDatabaseOptions): Database.Database {
  ensureParentDirAndPermissions(options.path);

  let db: Database.Database;
  try {
    db = new Database(options.path, { readonly: options.readonly === true });
  } catch (err: unknown) {
    throw new LedgerStoreError(
      'STORE_UNAVAILABLE',
      `Failed to open auxiliary database at "${options.path}": ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }

  applyFilePermissions(options.path);

  try {
    if (!options.readonly) {
      const policy = durabilityPolicy(process.platform, 'auxiliary');
      applyPragmas(db, policy);
    } else {
      db.pragma('foreign_keys = ON');
    }
    return db;
  } catch (err: unknown) {
    try {
      db.close();
    } catch {
      // Ignore close errors
    }
    throw err;
  }
}
