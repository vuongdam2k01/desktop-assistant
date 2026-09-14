import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import {
  CredentialStore,
  type CipherGateway,
  type RestorationRequest,
  CONNECTOR_AUTHORISATION_DESCRIPTOR,
  CredentialStoreError,
} from '@desktop-assistant/credential-store';
import {
  registerCredentialPresenceIpc,
  type IpcHandlerRegistrar,
} from '../main/credential-store/register-credential-presence-ipc.js';

class FakeIpcRegistrar implements IpcHandlerRegistrar {
  readonly handlers = new Map<
    string,
    (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
  >();

  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
  ): void {
    if (this.handlers.has(channel)) {
      throw new Error(`Handler already registered for ${channel}`);
    }
    this.handlers.set(channel, listener);
  }

  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`);
    }
    return handler({}, ...args);
  }
}

class SimpleCipherGateway implements CipherGateway {
  constructor(private available = true) {}

  isAvailable(): boolean {
    return this.available;
  }

  encrypt(value: string): Buffer {
    return Buffer.from(`ENC:${value}`, 'utf8');
  }

  decrypt(ciphertext: Buffer): string {
    const str = ciphertext.toString('utf8');
    if (!str.startsWith('ENC:')) {
      throw new Error('Malformed ciphertext');
    }
    return str.slice(4);
  }
}

describe('Desktop Credential Presence IPC & Redaction boundaries', () => {
  let tempDir: string;
  let dbPath: string;
  let store: CredentialStore;
  let fakeIpc: FakeIpcRegistrar;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-ipc-test-'));
    dbPath = path.join(tempDir, 'credentials.db');
    fakeIpc = new FakeIpcRegistrar();

    store = new CredentialStore({
      databasePath: dbPath,
      cipherGateway: new SimpleCipherGateway(),
    });
    store.registerClass(CONNECTOR_AUTHORISATION_DESCRIPTOR);
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

  it('registers only credentials:presence channel and rejects forbidden channels', () => {
    registerCredentialPresenceIpc(fakeIpc, store);

    // Verify exactly one channel registered
    const channels = Array.from(fakeIpc.handlers.keys());
    expect(channels).toEqual(['credentials:presence']);

    // Ensure get/put/list/erase are NOT registered
    expect(fakeIpc.handlers.has('credentials:get')).toBe(false);
    expect(fakeIpc.handlers.has('credentials:put')).toBe(false);
    expect(fakeIpc.handlers.has('credentials:list')).toBe(false);
    expect(fakeIpc.handlers.has('credentials:erase')).toBe(false);
  });

  it('observable presence returns strictly { present, lastUpdated } and never leaks secret or metadata', async () => {
    registerCredentialPresenceIpc(fakeIpc, store);

    const key = 'connector:notion:default:token';
    await store.put(key, 'super_secret_token_123', {
      workspaceName: 'Confidential Workspace',
    });

    const result = (await fakeIpc.invoke('credentials:presence', key)) as Record<string, unknown>;

    // Assert strictly exact shape
    expect(Object.keys(result).sort()).toEqual(['lastUpdated', 'present']);
    expect(result['present']).toBe(true);
    expect(typeof result['lastUpdated']).toBe('string');

    // Confirm neither value, metadata, nor classId is in result
    expect(result['value']).toBeUndefined();
    expect(result['metadata']).toBeUndefined();
    expect(result['classId']).toBeUndefined();
    expect(result['ciphertext']).toBeUndefined();
  });

  it('returns present: false and lastUpdated: null when key does not exist', async () => {
    registerCredentialPresenceIpc(fakeIpc, store);

    const result = (await fakeIpc.invoke(
      'credentials:presence',
      'connector:notion:nonexistent:token'
    )) as { present: boolean; lastUpdated: string | null };

    expect(result).toEqual({
      present: false,
      lastUpdated: null,
    });
  });

  it('rejects malformed key over IPC', async () => {
    registerCredentialPresenceIpc(fakeIpc, store);

    await expect(fakeIpc.invoke('credentials:presence', 'invalid_key')).rejects.toThrow();
    await expect(fakeIpc.invoke('credentials:presence', 12345)).rejects.toThrow();
  });

  it('keeps the renderer surface unchanged after a credential is marked unreadable', async () => {
    const failingDecrypt: CipherGateway = {
      isAvailable: () => true,
      encrypt: (value: string) => Buffer.from(`ENC:${value}`, 'utf8'),
      decrypt: () => {
        throw new Error('native cipher refused the ciphertext');
      },
    };

    const unreadableStore = new CredentialStore({
      databasePath: path.join(tempDir, 'unreadable.db'),
      cipherGateway: failingDecrypt,
    });
    unreadableStore.registerClass(CONNECTOR_AUTHORISATION_DESCRIPTOR);
    await unreadableStore.open();

    const key = 'connector:notion:default:token';
    await unreadableStore.put(key, 'a_secret_that_must_never_surface', {
      workspaceName: 'Confidential Workspace',
    });

    await expect(unreadableStore.get(key)).rejects.toMatchObject({
      code: 'CREDENTIAL_UNREADABLE',
    });

    const unreadableIpc = new FakeIpcRegistrar();
    registerCredentialPresenceIpc(unreadableIpc, unreadableStore);

    const result = (await unreadableIpc.invoke('credentials:presence', key)) as Record<
      string,
      unknown
    >;

    expect(Object.keys(result).sort()).toEqual(['lastUpdated', 'present']);
    expect(result['present']).toBe(true);
    expect(result['readable']).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('a_secret_that_must_never_surface');

    unreadableStore.close();
  });

  it('rejects over IPC rather than reporting absence when the store cannot be read', async () => {
    registerCredentialPresenceIpc(fakeIpc, store);

    const key = 'connector:notion:default:token';
    await store.put(key, 'super_secret_token_123', {});

    store.close();

    await expect(fakeIpc.invoke('credentials:presence', key)).rejects.toThrow();
  });

  it('redacts canary secret when native cipher throws exception containing canary', async () => {
    const CANARY_SECRET = 'CANARY_SENSITIVE_OAUTH_REFRESH_TOKEN_ABC123XYZ';
    const restorationCalls: RestorationRequest[] = [];

    // Leaky cipher that embeds the canary in its thrown error
    const leakyCipher: CipherGateway = {
      isAvailable: () => true,
      encrypt: () => {
        throw new Error(`CRITICAL_NATIVE_FAILURE: leaked ${CANARY_SECRET} in native stack`);
      },
      decrypt: () => {
        throw new Error(`CRITICAL_NATIVE_DECRYPT: leaked ${CANARY_SECRET} in native stack`);
      },
    };

    const leakyStore = new CredentialStore({
      databasePath: path.join(tempDir, 'leaky.db'),
      cipherGateway: leakyCipher,
      restorationHook: req => restorationCalls.push(req),
    });
    leakyStore.registerClass(CONNECTOR_AUTHORISATION_DESCRIPTOR);
    await leakyStore.open();

    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');

    // 1. Exercise leaky encrypt
    let thrownPutError: unknown;
    try {
      await leakyStore.put('connector:notion:test:token', CANARY_SECRET);
    } catch (err) {
      thrownPutError = err;
    }

    expect(thrownPutError).toBeInstanceOf(CredentialStoreError);
    const credPutErr = thrownPutError as CredentialStoreError;
    expect(credPutErr.message.includes(CANARY_SECRET)).toBe(false);
    if (credPutErr.stack) {
      expect(credPutErr.stack.includes(CANARY_SECRET)).toBe(false);
    }
    expect(JSON.stringify(credPutErr).includes(CANARY_SECRET)).toBe(false);

    // 2. Exercise leaky decrypt by seeding a row directly
    const directDb = new Database(path.join(tempDir, 'leaky.db'));
    directDb
      .prepare(
        `INSERT INTO credential_entry (key, class_id, ciphertext, updated_at, readable, metadata)
         VALUES (?, ?, ?, ?, 1, '{}')`
      )
      .run('connector:notion:test:token', 'connector_authorisation', Buffer.from('FAKE_CIPHERTEXT'), new Date().toISOString());
    directDb.close();

    let thrownGetError: unknown;
    try {
      await leakyStore.get('connector:notion:test:token');
    } catch (err) {
      thrownGetError = err;
    }

    expect(thrownGetError).toBeInstanceOf(CredentialStoreError);
    const credGetErr = thrownGetError as CredentialStoreError;
    expect(credGetErr.code).toBe('CREDENTIAL_UNREADABLE');
    expect(credGetErr.message.includes(CANARY_SECRET)).toBe(false);
    if (credGetErr.stack) {
      expect(credGetErr.stack.includes(CANARY_SECRET)).toBe(false);
    }
    expect(JSON.stringify(credGetErr).includes(CANARY_SECRET)).toBe(false);

    // Verify restoration request was dispatched and contains NO canary
    expect(restorationCalls).toHaveLength(1);
    expect(restorationCalls[0]!.key).toBe('connector:notion:test:token');
    expect(JSON.stringify(restorationCalls[0]).includes(CANARY_SECRET)).toBe(false);

    // Check captured logs
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call).includes(CANARY_SECRET)).toBe(false);
    }
    for (const call of errorSpy.mock.calls) {
      expect(JSON.stringify(call).includes(CANARY_SECRET)).toBe(false);
    }
    for (const call of warnSpy.mock.calls) {
      expect(JSON.stringify(call).includes(CANARY_SECRET)).toBe(false);
    }

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    leakyStore.close();
  });
});
