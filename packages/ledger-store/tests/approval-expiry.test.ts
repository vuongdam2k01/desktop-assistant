import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { LedgerStoreError } from '../src/errors.js';
import { createTestDir, makeDecisionInput, type TestDir } from './helpers/test-env.js';

/**
 * An approval request that outlives its deadline has to end up recorded as expired. The
 * gate reads the pending list to decide what still awaits a human, so a request that stays
 * pending after the store has already refused to resolve it is a row nothing can ever
 * clear: every attempt is rejected, and the list grows by one entry that no longer means
 * anything.
 */
describe('an approval request that outlives its deadline', () => {
  let testDir: TestDir;
  let store: LedgerStore;

  beforeEach(async () => {
    testDir = createTestDir('approval-expiry-');
    store = await openLedgerStore({ path: testDir.dbPath(), deviceId: 'dev_expiry' });
    await store.createJob({ id: 'job_expiry', originalRequest: 'Something that needs a decision' });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('is recorded as expired, and leaves the pending list', async () => {
    await store.createApprovalRequest({
      requestId: 'req_expired_1',
      jobId: 'job_expiry',
      tool: 'delete_database',
      matched: [{ ruleId: 'rule_hard_delete', verdict: 'require_approval' }],
      reason: 'Destructive deletion',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      appealable: true,
    });

    expect(await store.listPendingApprovalRequests()).toHaveLength(1);

    await expect(
      store.appendDecision(
        makeDecisionInput('job_expiry', {
          decision: 'approve',
          decidedBy: 'user',
          reason: 'Answering after the deadline',
          answers: 'req_expired_1',
        })
      )
    ).rejects.toThrow(LedgerStoreError);

    const stored = await store.getApprovalRequest('req_expired_1');
    expect(stored?.status).toBe('expired');
    expect(await store.listPendingApprovalRequests()).toHaveLength(0);
  });
});
