import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { LedgerStoreError } from '../src/errors.js';
import { createTestDir, makeIntentInput, type TestDir } from './helpers/test-env.js';

/**
 * `remove` is the entry point on the store's own interface, so whatever it enforces is
 * what the ledger actually enforces. Deleting by user request destroys history and the
 * material an undo would replay, which is why the lower-level call demands an explicit
 * acknowledgement that undo will be lost. That acknowledgement has to come from the
 * caller: a confirmation the ledger writes for itself records a human decision that
 * nobody made, in a store whose records can never be corrected by editing.
 */
describe('the removal entry point', () => {
  let testDir: TestDir;
  let store: LedgerStore;

  beforeEach(async () => {
    testDir = createTestDir('removal-gate-');
    store = await openLedgerStore({ path: testDir.dbPath(), deviceId: 'dev_removal_gate' });
    await store.createJob({ id: 'job_a', originalRequest: 'A request the user later withdraws' });
    await store.appendIntent(makeIntentInput('job_a'));
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('refuses a user deletion that carries no confirmation', async () => {
    await expect(
      store.remove({ reason: 'user_deletion', requestedBy: 'user', jobIds: ['job_a'] })
    ).rejects.toThrow(LedgerStoreError);

    const remaining = await store.readJob('job_a');
    expect(remaining.length).toBeGreaterThan(0);
  });

  it('accepts a user deletion that carries one', async () => {
    const outcome = await store.remove({
      reason: 'user_deletion',
      requestedBy: 'user',
      jobIds: ['job_a'],
      confirmation: {
        confirmed: true,
        warnedUndoWillBeLost: true,
        confirmedAt: new Date().toISOString(),
      },
    });

    expect(outcome.recordsRemoved).toBeGreaterThan(0);
  });

  it('records who asked rather than a fixed actor', async () => {
    const emitted: unknown[] = [];
    const unsubscribe = store.subscribe(record => emitted.push(record.content));

    await store.remove({
      reason: 'retention_expiry',
      requestedBy: 'user',
      olderThan: new Date(Date.now() + 60_000).toISOString(),
    });
    unsubscribe();

    expect(JSON.stringify(emitted)).toContain('"requestedBy":"user"');
    expect(JSON.stringify(emitted)).not.toContain('"requestedBy":"system"');
  });

  it('carries the age boundary into a user deletion instead of dropping it', async () => {
    const outcome = await store.remove({
      reason: 'user_deletion',
      requestedBy: 'user',
      olderThan: new Date(Date.now() + 60_000).toISOString(),
      confirmation: {
        confirmed: true,
        warnedUndoWillBeLost: true,
        confirmedAt: new Date().toISOString(),
      },
    });

    expect(outcome.recordsRemoved).toBeGreaterThan(0);
  });
});
