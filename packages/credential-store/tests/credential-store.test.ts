import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { CredentialStore } from '../src/credential-store.js';
import { EntryTable } from '../src/entry-table.js';
import { CredentialStoreError } from '../src/errors.js';
import {
  CONNECTOR_AUTHORISATION_DESCRIPTOR,
  BYO_AUTHORISATION_CLIENT_DESCRIPTOR,
  PROVIDER_CREDENTIAL_DESCRIPTOR,
  REPLICATION_MATERIAL_DESCRIPTOR,
} from '../src/default-credential-classes.js';
import { TestBindingCipherGateway } from './test-cipher.js';
import type { RestorationRequest } from '../src/restoration-coordinator.js';

describe('CredentialStore portable behavior and security', () => {
  let tempDir: string;
  let dbPath: string;
  let cipher: TestBindingCipherGateway;
  let restorationCalls: RestorationRequest[];
  let store: CredentialStore;
  let currentTime: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cred-store-test-'));
    dbPath = path.join(tempDir, 'credentials.db');
    cipher = new TestBindingCipherGateway('binding_machine_alpha');
    restorationCalls = [];
    currentTime = '2026-04-01T10:00:00.000Z';

    store = new CredentialStore({
      databasePath: dbPath,
      cipherGateway: cipher,
      restorationHook: req => restorationCalls.push(req),
      now: () => currentTime,
    });
    store.registerClass(CONNECTOR_AUTHORISATION_DESCRIPTOR);
    store.registerClass(BYO_AUTHORISATION_CLIENT_DESCRIPTOR);
    store.registerClass(PROVIDER_CREDENTIAL_DESCRIPTOR);
    store.registerClass(REPLICATION_MATERIAL_DESCRIPTOR);

    await store.open();
  });

  afterEach(() => {
    try {
      store.close();
    } catch {
      // Ignore cleanup error
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('stores two accounts on same provider without collision or overwrite', async () => {
    const key1 = 'connector:notion:account_1:token';
    const key2 = 'connector:notion:account_2:token';

    await store.put(key1, 'token_for_account_1', { workspaceName: 'Work 1' });
    await store.put(key2, 'token_for_account_2', { workspaceName: 'Work 2' });

    expect(await store.get(key1)).toBe('token_for_account_1');
    expect(await store.get(key2)).toBe('token_for_account_2');

    const p1 = await store.presence(key1);
    const p2 = await store.presence(key2);
    expect(p1.present).toBe(true);
    expect(p2.present).toBe(true);
  });

  it('refuses undeclared metadata fields and writes zero rows', async () => {
    const key = 'connector:notion:default:token';
    // 'unauthorizedSecret' is not declared in CONNECTOR_AUTHORISATION_DESCRIPTOR
    await expect(
      store.put(key, 'secret_token', { unauthorizedSecret: 'leak' })
    ).rejects.toThrowError(CredentialStoreError);

    // Verify presence is false and database has zero rows
    const presence = await store.presence(key);
    expect(presence.present).toBe(false);

    const directDb = new Database(dbPath);
    const count = directDb.prepare('SELECT count(*) as count FROM credential_entry').get() as {
      count: number;
    };
    directDb.close();
    expect(count.count).toBe(0);
  });

  it('replaces existing entry under same key and updates timestamp and ciphertext', async () => {
    const key = 'connector:notion:default:token';
    await store.put(key, 'initial_token', { workspaceName: 'Initial' });
    const presence1 = await store.presence(key);
    expect(presence1.present).toBe(true);
    const initialTimestamp = presence1.lastUpdated;
    // Advance deterministic time
    currentTime = '2026-04-01T10:05:00.000Z';
    await store.put(key, 'refreshed_token', { workspaceName: 'Refreshed' });
    const presence2 = await store.presence(key);
    expect(presence2.present).toBe(true);
    expect(presence2.lastUpdated).not.toBe(initialTimestamp);

    expect(await store.get(key)).toBe('refreshed_token');

    // List by prefix shows updated metadata and single entry
    const list = await store.listByPrefix('connector:notion:');
    expect(list).toHaveLength(1);
    expect(list[0]!.metadata['workspaceName']).toBe('Refreshed');
  });

  it('stores and reads back 3,073-byte value whole without chunking', async () => {
    const key = 'connector:google_drive:user_large:token';
    // Create distinct non-repeating 3,073-byte ASCII string
    let largeValue = '';
    for (let i = 0; i < 3073; i++) {
      largeValue += String.fromCharCode(33 + (i % 93)); // Printable ASCII
    }
    expect(largeValue.length).toBe(3073);

    await store.put(key, largeValue);
    const retrieved = await store.get(key);

    expect(retrieved.length).toBe(3073);
    expect(retrieved).toBe(largeValue);
  });

  it('ensures no raw plaintext canary appears anywhere in DB, WAL, or SHM files', async () => {
    const key = 'connector:notion:canary_user:token';
    const secretCanary = 'CANARY_SECRET_SUPER_SENSITIVE_NOTION_TOKEN_9876543210';

    await store.put(key, secretCanary, { workspaceName: 'CanaryWorkspace' });

    // Flush WAL to disk
    const directDb = new Database(dbPath);
    directDb.pragma('wal_checkpoint(TRUNCATE)');
    directDb.close();

    const dbFiles = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
    for (const f of dbFiles) {
      if (fs.existsSync(f)) {
        const fileBytes = fs.readFileSync(f);
        expect(fileBytes.includes(Buffer.from(secretCanary))).toBe(false);
      }
    }
  });

  it('refuses write when secure storage gateway is unavailable and writes zero rows', async () => {
    const key = 'connector:notion:default:token';
    cipher.setAvailable(false);

    await expect(store.put(key, 'token_value')).rejects.toThrowError(CredentialStoreError);
    try {
      await store.put(key, 'token_value');
    } catch (err) {
      expect((err as CredentialStoreError).code).toBe('SECURE_STORAGE_UNAVAILABLE');
    }

    const presence = await store.presence(key);
    expect(presence.present).toBe(false);
  });

  it('handles tampered ciphertext: marks readable=0, notifies restoration, throws CREDENTIAL_UNREADABLE', async () => {
    const key = 'connector:notion:tamper_test:token';
    await store.put(key, 'valid_token_value');

    // Tamper with the ciphertext blob in SQLite
    const directDb = new Database(dbPath);
    const row = directDb
      .prepare('SELECT ciphertext FROM credential_entry WHERE key = ?')
      .get(key) as { ciphertext: Buffer };
    const tampered = Buffer.from(row.ciphertext);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1]! ^ 0xff) & 0xff; // Flip bits in auth tag/body
    directDb
      .prepare('UPDATE credential_entry SET ciphertext = ? WHERE key = ?')
      .run(tampered, key);
    directDb.close();

    // First read fails and marks unreadable
    await expect(store.get(key)).rejects.toThrowError(CredentialStoreError);
    expect(restorationCalls).toHaveLength(1);
    expect(restorationCalls[0]).toEqual({
      key,
      classId: 'connector_authorisation',
      restorationRoute: 'replication',
    });

    // Verify row is marked readable = 0 in database
    const presenceList = await store.listByPrefix('connector:notion:');
    const entry = presenceList.find(e => e.key === key);
    expect(entry?.readable).toBe(false);

    // Second read throws CREDENTIAL_UNREADABLE without attempting decryption
    await expect(store.get(key)).rejects.toThrowError(CredentialStoreError);
    expect(restorationCalls).toHaveLength(2);
  });

  it('handles truncated ciphertext: marks readable=0 and throws CREDENTIAL_UNREADABLE', async () => {
    const key = 'connector:notion:truncate_test:token';
    await store.put(key, 'valid_token_value');

    const directDb = new Database(dbPath);
    directDb
      .prepare('UPDATE credential_entry SET ciphertext = substr(ciphertext, 1, 10) WHERE key = ?')
      .run(key);
    directDb.close();

    await expect(store.get(key)).rejects.toThrowError(CredentialStoreError);
    const presenceList = await store.listByPrefix('connector:notion:');
    const entry = presenceList.find(e => e.key === key);
    expect(entry?.readable).toBe(false);
  });

  it('foreign-binding fails closed: database opened on second machine fails decryption deterministically', async () => {
    const key = 'auth:session:user_session_1';
    await store.put(key, 'replicated_session_secret');
    store.close();

    // Second store instance on same DB file but with different machine binding key
    const foreignCipher = new TestBindingCipherGateway('binding_machine_beta');
    const foreignRestorationCalls: RestorationRequest[] = [];
    const storeBeta = new CredentialStore({
      databasePath: dbPath,
      cipherGateway: foreignCipher,
      restorationHook: req => foreignRestorationCalls.push(req),
    });
    storeBeta.registerClass(REPLICATION_MATERIAL_DESCRIPTOR);
    await storeBeta.open();

    await expect(storeBeta.get(key)).rejects.toThrowError(CredentialStoreError);
    expect(foreignRestorationCalls).toHaveLength(1);
    expect(foreignRestorationCalls[0]).toEqual({
      key,
      classId: 'replication_material',
      restorationRoute: 'account_sign_in',
    });

    storeBeta.close();
  });

  it('erases connector by prefix leaving unrelated connectors intact', async () => {
    await store.put('connector:notion:user1:token', 'notion_tok_1');
    await store.put('connector:notion:user2:token', 'notion_tok_2');
    await store.put('connector:gmail:user1:token', 'gmail_tok_1');
    await store.put('llm:provider:openai:api_key', 'sk-proj-12345');

    const outcome = await store.eraseConnector('connector:notion:');
    expect(outcome.trigger).toBe('connector_disconnect');
    expect(outcome.scope).toBe('connector:notion:');
    expect(outcome.entriesErased).toBe(2);
    expect(outcome.completed).toBe(true);

    // Notion entries are gone
    const notionPresence = await store.listByPrefix('connector:notion:');
    expect(notionPresence).toHaveLength(0);

    // Gmail and LLM provider remain intact
    expect(await store.get('connector:gmail:user1:token')).toBe('gmail_tok_1');
    expect(await store.get('llm:provider:openai:api_key')).toBe('sk-proj-12345');
  });

  it('empty erasure succeeds with entriesErased: 0', async () => {
    const outcome = await store.eraseConnector('connector:gmail:');
    expect(outcome.entriesErased).toBe(0);
    expect(outcome.completed).toBe(true);
  });

  it('destructive erasure (account_deletion and uninstall) closes store and unlinks files', async () => {
    await store.put('connector:notion:u:token', 'tok');
    await store.put('auth:session:dev', 'sess');

    const outcome = await store.eraseAll(); // trigger: uninstall
    expect(outcome.trigger).toBe('uninstall');
    expect(outcome.entriesErased).toBe(2);
    expect(outcome.completed).toBe(true);

    // Database file, -wal, and -shm are removed
    expect(fs.existsSync(dbPath)).toBe(false);
    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
    expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);
  });

  it('resumes interrupted non-destructive erasure on open()', async () => {
    await store.put('connector:notion:u1:token', 'tok1');
    await store.put('connector:notion:u2:token', 'tok2');
    await store.put('connector:gmail:u1:token', 'tok3');

    // Simulate crash before erasure: seed pending_erasure marker in SQLite directly
    const directDb = new Database(dbPath);
    directDb
      .prepare(
        'INSERT INTO pending_erasure (id, trigger, scope, started_at) VALUES (1, ?, ?, ?)'
      )
      .run('connector_disconnect', 'connector:notion:', new Date().toISOString());
    directDb.close();

    store.close();

    // Reopen store
    const restartedStore = new CredentialStore({
      databasePath: dbPath,
      cipherGateway: cipher,
    });
    restartedStore.registerClass(CONNECTOR_AUTHORISATION_DESCRIPTOR);
    await restartedStore.open();

    // Notice that open() completed the pending erasure: notion rows are gone
    const list = await restartedStore.listByPrefix('connector:notion:');
    expect(list).toHaveLength(0);
    // Gmail row survived
    expect(await restartedStore.get('connector:gmail:u1:token')).toBe('tok3');
    // Pending erasure marker is cleared
    expect(await restartedStore.pendingErasure()).toBeNull();

    restartedStore.close();
  });

  it('resumes destructive erasure on open() even when cipher gateway is unavailable', async () => {
    await store.put('connector:notion:u1:token', 'tok1');

    // Seed pending_erasure marker for account_deletion
    const directDb = new Database(dbPath);
    directDb
      .prepare(
        'INSERT INTO pending_erasure (id, trigger, scope, started_at) VALUES (1, ?, ?, ?)'
      )
      .run('account_deletion', '*', new Date().toISOString());
    directDb.close();

    store.close();

    // Cipher unavailable on reboot
    cipher.setAvailable(false);

    const restartedStore = new CredentialStore({
      databasePath: dbPath,
      cipherGateway: cipher,
    });
    restartedStore.registerClass(CONNECTOR_AUTHORISATION_DESCRIPTOR);
    // open() resumes and finishes erasure without decrypting
    await restartedStore.open();

    // Fresh empty store is available
    const list = await restartedStore.listByPrefix('*');
    expect(list).toHaveLength(0);
    expect(await restartedStore.pendingErasure()).toBeNull();

    restartedStore.close();
  });

  it('correctly matches and erases astral Unicode keys with emoji without code point mismatch', async () => {
    const astralKey = 'connector:notion:acc😀:token';
    const regularKey = 'connector:notion:account_regular:token';

    await store.put(astralKey, 'astral_secret_tok');
    await store.put(regularKey, 'regular_secret_tok');

    // List by astral prefix
    const list = await store.listByPrefix('connector:notion:acc😀:');
    expect(list).toHaveLength(1);
    expect(list[0]!.key).toBe(astralKey);

    // Erase specifically the astral prefix
    const outcome = await store.eraseConnector('connector:notion:acc😀:');
    expect(outcome.entriesErased).toBe(1);
    expect(outcome.completed).toBe(true);

    // Astral row is gone
    const astralPresence = await store.presence(astralKey);
    expect(astralPresence.present).toBe(false);

    // Regular row is completely untouched
    const regularPresence = await store.presence(regularKey);
    expect(regularPresence.present).toBe(true);
    expect(await store.get(regularKey)).toBe('regular_secret_tok');
  });

  it('transient cipher unavailability does not mark row unreadable', async () => {
    const key = 'connector:notion:transient_test:token';
    await store.put(key, 'valid_tok');

    // Temporarily disable cipher (e.g. locked keychain)
    cipher.setAvailable(false);

    await expect(store.get(key)).rejects.toThrowError(CredentialStoreError);
    expect(restorationCalls).toHaveLength(0); // Restoration not notified on unavailable

    // Re-enable cipher
    cipher.setAvailable(true);

    // Row is still valid and readable!
    expect(await store.get(key)).toBe('valid_tok');
    const presenceList = await store.listByPrefix('connector:notion:');
    const entry = presenceList.find(e => e.key === key);
    expect(entry?.readable).toBe(true);
  });

  it('gates all store operations when a pending erasure is present', async () => {
    await store.put('connector:notion:default:token', 'some_tok');

    // Simulate crash after marker commit
    const directDb = new Database(dbPath);
    directDb
      .prepare(
        'INSERT INTO pending_erasure (id, trigger, scope, started_at) VALUES (1, ?, ?, ?)'
      )
      .run('connector_disconnect', 'connector:notion:', new Date().toISOString());
    directDb.close();

    // Calling get, put, presence, or listByPrefix must throw ERASURE_INCOMPLETE
    await expect(store.get('connector:notion:default:token')).rejects.toThrowError(
      CredentialStoreError
    );
    await expect(
      store.put('connector:notion:default:token', 'new_tok')
    ).rejects.toThrowError(CredentialStoreError);
    await expect(
      store.presence('connector:notion:default:token')
    ).rejects.toThrowError(CredentialStoreError);
    await expect(store.listByPrefix('*')).rejects.toThrowError(CredentialStoreError);
  });

  it('preserves whole-store erasure scope when a second erasure trigger arrives', async () => {
    // Seed whole-store marker
    const directDb = new Database(dbPath);
    directDb
      .prepare(
        'INSERT INTO pending_erasure (id, trigger, scope, started_at) VALUES (1, ?, ?, ?)'
      )
      .run('sign_out', '*', new Date().toISOString());
    directDb.close();

    // Another scoped trigger arrives; marker joining must preserve '*'
    store.close();
    const directDb2 = new Database(dbPath);
    const entryTable = new EntryTable(dbPath);
    entryTable.open();
    entryTable.setPendingErasure('connector_disconnect', 'connector:notion:', new Date().toISOString());

    const marker = entryTable.getPendingErasure()!;
    expect(marker.scope).toBe('*'); // Scope '*' was NOT overwritten by scoped prefix!
    entryTable.close();
    directDb2.close();
  });

  it('permanently blocks registerClass after first open even after close()', async () => {
    // Store was already opened in beforeEach
    store.close();

    // Calling registerClass after close() must throw DESCRIPTOR_INVALID
    expect(() =>
      store.registerClass({
        class_id: 'late_class',
        version: '0.1.0',
        name: 'Late Class',
        key_pattern: 'late:<id>:token',
        owner: 'platform',
        replicates: true,
        restoration_route: 'replication',
        erase_on: ['sign_out', 'device_revocation', 'account_deletion', 'uninstall'],
        metadata_fields: [],
      })
    ).toThrowError(CredentialStoreError);
  });

  it('only erases classes declaring connector_disconnect during eraseConnector', async () => {
    // Notion declares connector_disconnect
    await store.put('connector:notion:u1:token', 'notion_tok');
    // LLM provider credential does not declare connector_disconnect
    await store.put('llm:provider:anthropic:api_key', 'anthropic_key');

    const outcome = await store.eraseConnector('connector:notion:');
    expect(outcome.entriesErased).toBe(1);
    expect(await store.get('llm:provider:anthropic:api_key')).toBe('anthropic_key');
  });
});
