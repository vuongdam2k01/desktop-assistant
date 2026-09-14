import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { CredentialStore } from '../src/credential-store.js';
import { CredentialStoreError } from '../src/errors.js';
import {
  CONNECTOR_AUTHORISATION_DESCRIPTOR,
  PROVIDER_CREDENTIAL_DESCRIPTOR,
} from '../src/default-credential-classes.js';
import { TestBindingCipherGateway } from './test-cipher.js';

/**
 * An erasure that is interrupted leaves a marker so the next launch finishes it. What the
 * marker has to carry is the set of credential classes the erasure was allowed to touch:
 * recomputing that set from whatever the running process happens to have registered means a
 * launch that registers fewer classes erases nothing, clears the marker, and reports the
 * disconnect as complete while the credential is still readable.
 */
describe('an erasure interrupted before it finished', () => {
  let tempDir: string;
  let dbPath: string;

  function makeStore(classes: readonly { classId: string }[]): CredentialStore {
    const store = new CredentialStore({
      databasePath: dbPath,
      cipherGateway: new TestBindingCipherGateway('binding_machine_alpha'),
      restorationHook: () => {},
      now: () => '2026-04-01T10:00:00.000Z',
    });
    for (const descriptor of classes) {
      store.registerClass(descriptor as never);
    }
    return store;
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cred-erasure-resume-'));
    dbPath = path.join(tempDir, 'credentials.db');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('does not report completion when the next launch cannot reconstruct what to erase', async () => {
    const first = makeStore([CONNECTOR_AUTHORISATION_DESCRIPTOR, PROVIDER_CREDENTIAL_DESCRIPTOR]);
    await first.open();
    await first.put('connector:notion:u1:token', 'a value that must not survive a disconnect');

    // The marker is committed before anything is erased; the process ends there.
    const db = new Database(dbPath);
    db.prepare(
      `INSERT INTO pending_erasure (id, trigger, scope, started_at) VALUES (1, ?, ?, ?)`
    ).run('connector_disconnect', 'connector:notion:', '2026-04-01T10:00:00.000Z');
    db.close();
    first.close();

    // The next launch does not register the class the erasure was meant to reach.
    const second = makeStore([PROVIDER_CREDENTIAL_DESCRIPTOR]);
    let resumeError: unknown;
    try {
      await second.open();
    } catch (err) {
      resumeError = err;
    }
    // Every handle is closed before the directory is removed: on Windows an open one
    // keeps the file locked and the cleanup fails. A store that refused to open has
    // already released its own.
    const inspection = new Database(dbPath);
    const survived = inspection
      .prepare(`SELECT COUNT(*) AS n FROM credential_entry WHERE key LIKE 'connector:notion:%'`)
      .get() as { n: number };
    const marker = inspection.prepare('SELECT trigger FROM pending_erasure WHERE id = 1').get();
    inspection.close();

    // The credential is still there, so the store must not have declared the work done.
    expect(survived.n).toBe(1);
    expect(resumeError).toBeInstanceOf(CredentialStoreError);
    expect((resumeError as CredentialStoreError).code).toBe('ERASURE_INCOMPLETE');
    expect(marker).toBeDefined();
  });

  it('finishes the erasure on the first launch that can reach what it names', async () => {
    const first = makeStore([CONNECTOR_AUTHORISATION_DESCRIPTOR, PROVIDER_CREDENTIAL_DESCRIPTOR]);
    await first.open();
    await first.put('connector:notion:u1:token', 'a value that must not survive a disconnect');
    first.close();

    const db = new Database(dbPath);
    db.prepare(
      `INSERT INTO pending_erasure (id, trigger, scope, started_at, allowed_classes)
       VALUES (1, ?, ?, ?, ?)`
    ).run(
      'connector_disconnect',
      'connector:notion:',
      '2026-04-01T10:00:00.000Z',
      JSON.stringify([CONNECTOR_AUTHORISATION_DESCRIPTOR.class_id])
    );
    db.close();

    const second = makeStore([CONNECTOR_AUTHORISATION_DESCRIPTOR, PROVIDER_CREDENTIAL_DESCRIPTOR]);
    await second.open();
    second.close();

    const inspection = new Database(dbPath);
    const remaining = inspection
      .prepare(`SELECT COUNT(*) AS n FROM credential_entry WHERE key LIKE 'connector:notion:%'`)
      .get() as { n: number };
    const marker = inspection.prepare('SELECT trigger FROM pending_erasure WHERE id = 1').get();
    inspection.close();

    expect(remaining.n).toBe(0);
    expect(marker).toBeUndefined();
  });
});
