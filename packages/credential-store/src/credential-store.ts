import type { CredentialClassDescriptor } from '@desktop-assistant/contracts/credential-class-descriptor';
import { CredentialClassRegistry } from './class-registry.js';
import { EntryTable } from './entry-table.js';
import {
  ErasureRunner,
  type ErasureOutcome,
  type ErasureState,
  type ErasureTrigger,
} from './erasure-runner.js';
import {
  RestorationCoordinator,
  type RestorationHook,
} from './restoration-coordinator.js';
import { type CipherGateway } from './cipher-gateway.js';
import { CredentialStoreError } from './errors.js';
import { parseCredentialKey, parseCredentialPrefix } from './key-parser.js';

export interface CredentialPresence {
  key: string;
  classId: string;
  updatedAt: string;
  readable: boolean;
  metadata: Record<string, string>;
}

export interface RendererCredentialPresence {
  present: boolean;
  lastUpdated: string | null;
}

export interface CredentialStoreOptions {
  databasePath: string;
  cipherGateway: CipherGateway;
  restorationHook?: RestorationHook;
  now?: () => string;
}

export class CredentialStore {
  private readonly classRegistry = new CredentialClassRegistry();
  private readonly entryTable: EntryTable;
  private readonly cipherGateway: CipherGateway;
  private readonly restorationCoordinator: RestorationCoordinator;
  private readonly erasureRunner: ErasureRunner;
  private readonly now: () => string;
  private opened = false;
  private everOpened = false;
  private erasureFailed = false;

  constructor(options: CredentialStoreOptions) {
    this.entryTable = new EntryTable(options.databasePath);
    this.cipherGateway = options.cipherGateway;
    this.restorationCoordinator = new RestorationCoordinator(options.restorationHook);
    this.now = options.now ?? (() => new Date().toISOString());

    // Wire live registry policy provider for connector_disconnect (fixes I5)
    this.erasureRunner = new ErasureRunner(
      this.entryTable,
      this.now,
      (trigger: ErasureTrigger) => {
        if (trigger === 'connector_disconnect') {
          return this.classRegistry
            .getAll()
            .filter(d => d.erase_on.includes('connector_disconnect'))
            .map(d => d.class_id);
        }
        return undefined;
      }
    );
  }

  registerClass(descriptor: CredentialClassDescriptor): void {
    if (this.everOpened) {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: descriptor?.class_id,
      });
    }
    this.classRegistry.register(descriptor);
  }

  async open(): Promise<void> {
    if (this.opened && !this.erasureFailed) {
      return;
    }

    this.everOpened = true;
    this.entryTable.open();
    try {
      // Resume any pending erasure before exposing store facade
      this.erasureRunner.resumeIfPending();
    } catch (err) {
      // A store that refuses to open must not keep the database file open. Holding it would
      // block whatever has to touch those files next — on Windows, including the deletion a
      // later erasure performs.
      try {
        this.entryTable.close();
      } catch {
        // The refusal is what the caller needs to see, not a failure to tidy up after it.
      }
      throw err;
    }
    this.erasureFailed = false;
    this.opened = true;
  }

  async isAvailable(): Promise<boolean> {
    return this.cipherGateway.isAvailable();
  }

  async put(key: string, value: string, metadata?: Record<string, string>): Promise<void> {
    this.ensureOpen();

    // 1. Validate key and resolve class
    const descriptor = this.classRegistry.resolveClass(key);

    // 2. Reject empty value before calling gateway
    if (typeof value !== 'string' || value.length === 0) {
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
        key,
        classId: descriptor.class_id,
      });
    }

    // 3. Validate metadata fields against class declaration
    const metadataObj: Record<string, string> = {};
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        throw new CredentialStoreError({
          code: 'METADATA_NOT_DECLARED',
          key,
          classId: descriptor.class_id,
        });
      }

      for (const [metaKey, metaVal] of Object.entries(metadata)) {
        if (!descriptor.metadata_fields.includes(metaKey)) {
          throw new CredentialStoreError({
            code: 'METADATA_NOT_DECLARED',
            key,
            classId: descriptor.class_id,
          });
        }
        if (typeof metaVal !== 'string') {
          throw new CredentialStoreError({
            code: 'METADATA_NOT_DECLARED',
            key,
            classId: descriptor.class_id,
          });
        }
        metadataObj[metaKey] = metaVal;
      }
    }

    // 4. Refuse reclassification if existing row class does not match
    const existing = this.entryTable.getEntry(key);
    if (existing && existing.class_id !== descriptor.class_id) {
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
        key,
        classId: descriptor.class_id,
      });
    }

    // 5. Require gateway availability
    if (!this.cipherGateway.isAvailable()) {
      throw new CredentialStoreError({
        code: 'SECURE_STORAGE_UNAVAILABLE',
        key,
        classId: descriptor.class_id,
      });
    }

    // 6. Encrypt once
    let ciphertext: Buffer;
    try {
      ciphertext = this.cipherGateway.encrypt(value);
      if (!Buffer.isBuffer(ciphertext) || ciphertext.length === 0) {
        throw new Error();
      }
    } catch (err) {
      if (err instanceof CredentialStoreError) {
        throw err;
      }
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
        key,
        classId: descriptor.class_id,
      });
    }

    // 7. Write atomically
    try {
      this.entryTable.upsertEntry({
        key,
        class_id: descriptor.class_id,
        ciphertext,
        updated_at: this.now(),
        readable: 1,
        metadata: JSON.stringify(metadataObj),
      });
    } catch (err) {
      if (err instanceof CredentialStoreError) {
        throw err;
      }
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
        key,
        classId: descriptor.class_id,
      });
    }
  }

  async get(key: string): Promise<string> {
    this.ensureOpen();

    // 1. Resolve descriptor for key
    const descriptor = this.classRegistry.resolveClass(key);

    // 2. Require availability
    if (!this.cipherGateway.isAvailable()) {
      throw new CredentialStoreError({
        code: 'SECURE_STORAGE_UNAVAILABLE',
        key,
        classId: descriptor.class_id,
      });
    }

    // 3. Look up entry
    const entry = this.entryTable.getEntry(key);
    if (!entry) {
      throw new CredentialStoreError({
        code: 'CREDENTIAL_NOT_FOUND',
        key,
        classId: descriptor.class_id,
      });
    }

    // Verify stored class matches resolved class (I8)
    if (entry.class_id !== descriptor.class_id) {
      try {
        this.entryTable.markUnreadable(key);
      } catch {
        this.erasureFailed = true;
      }
      this.restorationCoordinator.notify({
        key,
        classId: descriptor.class_id,
        restorationRoute: descriptor.restoration_route,
      });
      throw new CredentialStoreError({
        code: 'CREDENTIAL_UNREADABLE',
        key,
        classId: descriptor.class_id,
      });
    }

    // 4. Persisted unreadable check
    if (entry.readable === 0) {
      this.restorationCoordinator.notify({
        key,
        classId: entry.class_id,
        restorationRoute: descriptor.restoration_route,
      });
      throw new CredentialStoreError({
        code: 'CREDENTIAL_UNREADABLE',
        key,
        classId: entry.class_id,
      });
    }

    // 5. Decrypt exactly once
    try {
      const plaintext = this.cipherGateway.decrypt(entry.ciphertext);
      if (typeof plaintext !== 'string' || plaintext.length === 0) {
        throw new Error();
      }
      return plaintext;
    } catch (err) {
      // I1: Do not mark unreadable if safeStorage is unavailable!
      if (
        err instanceof CredentialStoreError &&
        err.code === 'SECURE_STORAGE_UNAVAILABLE'
      ) {
        throw err;
      }

      try {
        this.entryTable.markUnreadable(key);
      } catch {
        // Block facade if durable unreadable state could not be committed (I2)
        this.erasureFailed = true;
      }
      this.restorationCoordinator.notify({
        key,
        classId: entry.class_id,
        restorationRoute: descriptor.restoration_route,
      });
      throw new CredentialStoreError({
        code: 'CREDENTIAL_UNREADABLE',
        key,
        classId: entry.class_id,
      });
    }
  }

  async listByPrefix(prefix: string | '*'): Promise<CredentialPresence[]> {
    this.ensureOpen();
    const validatedPrefix = parseCredentialPrefix(prefix);
    const rows = this.entryTable.listByPrefix(validatedPrefix);

    const result: CredentialPresence[] = [];
    for (const r of rows) {
      let descriptor: CredentialClassDescriptor | undefined;
      try {
        descriptor = this.classRegistry.resolveClass(r.key);
      } catch {
        descriptor = undefined;
      }

      let readable = r.readable === 1;
      if (!descriptor || r.class_id !== descriptor.class_id) {
        readable = false;
      }

      const meta: Record<string, string> = {};
      try {
        const parsed = JSON.parse(r.metadata);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed)) {
            if (
              descriptor &&
              descriptor.metadata_fields.includes(k) &&
              typeof v === 'string'
            ) {
              meta[k] = v;
            }
          }
        } else {
          readable = false;
        }
      } catch {
        readable = false;
      }

      result.push({
        key: r.key,
        // Publish verified key-derived classId only (I8)
        classId: descriptor ? descriptor.class_id : r.class_id,
        updatedAt: r.updated_at,
        readable,
        metadata: meta,
      });
    }

    return result;
  }

  async presence(key: string): Promise<RendererCredentialPresence> {
    this.ensureOpen();
    parseCredentialKey(key);
    const row = this.entryTable.getPresence(key);
    if (!row) {
      return {
        present: false,
        lastUpdated: null,
      };
    }
    return {
      present: true,
      lastUpdated: row.updated_at,
    };
  }

  async eraseConnector(prefix: string): Promise<ErasureOutcome> {
    this.ensureOpen();
    const validatedPrefix = parseCredentialPrefix(prefix);
    if (!validatedPrefix.startsWith('connector:') || validatedPrefix === '*') {
      throw new CredentialStoreError({
        code: 'KEY_MALFORMED',
        key: prefix,
      });
    }

    // I5: derive allowed classes for connector_disconnect from registry
    const eligibleClasses = this.classRegistry
      .getAll()
      .filter(d => d.erase_on.includes('connector_disconnect'))
      .map(d => d.class_id);

    try {
      return this.erasureRunner.runErasure(
        'connector_disconnect',
        validatedPrefix,
        eligibleClasses
      );
    } catch (err) {
      this.erasureFailed = true;
      throw err;
    }
  }

  async eraseAccount(
    trigger: 'sign_out' | 'device_revocation' | 'account_deletion'
  ): Promise<ErasureOutcome> {
    this.ensureOpen();
    if (
      trigger !== 'sign_out' &&
      trigger !== 'device_revocation' &&
      trigger !== 'account_deletion'
    ) {
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }

    try {
      const outcome = this.erasureRunner.runErasure(trigger, '*');
      if (trigger === 'account_deletion') {
        this.opened = false;
      }
      return outcome;
    } catch (err) {
      this.erasureFailed = true;
      throw err;
    }
  }

  async eraseAll(): Promise<ErasureOutcome> {
    this.ensureOpen();
    try {
      const outcome = this.erasureRunner.runErasure('uninstall', '*');
      this.opened = false;
      return outcome;
    } catch (err) {
      this.erasureFailed = true;
      throw err;
    }
  }

  async pendingErasure(): Promise<ErasureState | null> {
    if (!this.opened || !this.entryTable.isOpen) {
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }
    return this.erasureRunner.getPendingErasure();
  }

  close(): void {
    try {
      this.entryTable.close();
    } catch (err) {
      if (err instanceof CredentialStoreError) throw err;
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    } finally {
      this.opened = false;
    }
  }

  private ensureOpen(): void {
    if (!this.opened || !this.entryTable.isOpen) {
      throw new CredentialStoreError({
        code: 'WRITE_FAILED',
      });
    }

    // C3: Gating operations when erasure failed or pending
    if (this.erasureFailed) {
      throw new CredentialStoreError({
        code: 'ERASURE_INCOMPLETE',
      });
    }

    const pending = this.entryTable.getPendingErasure();
    if (pending) {
      throw new CredentialStoreError({
        code: 'ERASURE_INCOMPLETE',
      });
    }
  }
}
