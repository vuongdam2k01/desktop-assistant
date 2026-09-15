import { describe, it, expect, afterEach } from 'vitest';
import type { ErrorRecord } from '@desktop-assistant/ledger-store';
import { createTestHarness, type TestHarness } from './helpers/test-env.js';
import { ResourceHeldError } from '../src/errors.js';

describe('RetryPolicy & Error Classification (REQ-JOB-05)', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  it('Scenario: Rate limit clears on the second attempt', async () => {
    harness = await createTestHarness({
      retry: { baseDelayMs: 10, maxRetries: 3 },
    });
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Batch Notion read' });
    await jobManager.startJob(job.id);

    let attempts = 0;
    const result = await jobManager.executeStep(job.id, 1, 'query_database', async () => {
      attempts++;
      if (attempts === 1) {
        const err = new Error('HTTP 429 Rate limited');
        Object.assign(err, { code: 'RATE_LIMITED', retryAfterMs: 15 });
        throw err;
      }
      return { items: ['item1', 'item2'] };
    });

    expect(result.items.length).toBe(2);
    expect(attempts).toBe(2);

    // Verify ledger holds an error record for the failed attempt
    const records = await ledgerStore.readJob(job.id);
    const errorRecords = records.filter((r) => r.type === 'error');
    expect(errorRecords.length).toBe(1);
    const errRec = errorRecords[0] as ErrorRecord;
    expect(errRec.content.code).toBe('RATE_LIMITED');
  });

  it('Scenario: Retries are exhausted', async () => {
    harness = await createTestHarness({
      retry: { baseDelayMs: 5, maxRetries: 3 },
    });
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Persistent network issue' });
    await jobManager.startJob(job.id);

    let attempts = 0;
    const executePromise = jobManager.executeStep(job.id, 1, 'fetch_remote', async () => {
      attempts++;
      const err = new Error('Network timeout');
      Object.assign(err, { code: 'UNREACHABLE' });
      throw err;
    });

    await expect(executePromise).rejects.toThrowError('Network timeout');
    // Initial attempt + 3 retries = 4 total invocations
    expect(attempts).toBe(4);

    // Verify ledger holds 3 retry error records
    const records = await ledgerStore.readJob(job.id);
    const errorRecords = records.filter((r) => r.type === 'error');
    expect(errorRecords.length).toBe(3);
  });

  it('Scenario: A permanent error is not retried', async () => {
    harness = await createTestHarness({
      retry: { baseDelayMs: 5, maxRetries: 3 },
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Forbidden action' });
    await jobManager.startJob(job.id);

    let attempts = 0;
    const executePromise = jobManager.executeStep(job.id, 1, 'delete_database', async () => {
      attempts++;
      const err = new Error('Permission denied');
      Object.assign(err, { code: 'PERMISSION_DENIED' });
      throw err;
    });

    await expect(executePromise).rejects.toThrowError('Permission denied');
    // Failed immediately: exactly 1 attempt
    expect(attempts).toBe(1);
  });

  it('Scenario: The authorisation was withdrawn while the job was running', async () => {
    harness = await createTestHarness({
      retry: { baseDelayMs: 5, maxRetries: 3 },
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Revoked access' });
    await jobManager.startJob(job.id);

    let attempts = 0;
    const executePromise = jobManager.executeStep(job.id, 1, 'query_items', async () => {
      attempts++;
      const err = new Error('Authorisation withdrawn by user');
      Object.assign(err, { code: 'CONNECTOR_REVOKED' });
      throw err;
    });

    await expect(executePromise).rejects.toThrowError('Authorisation withdrawn by user');
    expect(attempts).toBe(1);
  });

  it('Scenario: A failure arrives with no declared code is treated as permanent', async () => {
    harness = await createTestHarness({
      retry: { baseDelayMs: 5, maxRetries: 3 },
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Undeclared error' });
    await jobManager.startJob(job.id);

    let attempts = 0;
    const executePromise = jobManager.executeStep(job.id, 1, 'raw_operation', async () => {
      attempts++;
      // Plain error without error code
      throw new Error('Some internal unclassified error');
    });

    await expect(executePromise).rejects.toThrowError('Some internal unclassified error');
    // No retry for undeclared error code
    expect(attempts).toBe(1);
  });

  it('Scenario: The resource was held by another job and names holder on exhaust', async () => {
    harness = await createTestHarness({
      retry: { baseDelayMs: 5, maxRetries: 3 },
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Resource collision task' });
    await jobManager.startJob(job.id);

    let attempts = 0;
    const executePromise = jobManager.executeStep(job.id, 1, 'write_locked_page', async () => {
      attempts++;
      const err = new Error('Resource is currently locked');
      Object.assign(err, { code: 'RESOURCE_HELD', heldByJobId: 'job-999-holder' });
      throw err;
    });

    await expect(executePromise).rejects.toThrowError(ResourceHeldError);
    expect(attempts).toBe(4); // 1 initial + 3 retries

    try {
      await jobManager.executeStep(job.id, 1, 'write_locked_page', async () => {
        const err = new Error('Locked');
        Object.assign(err, { code: 'RESOURCE_HELD', heldByJobId: 'job-999-holder' });
        throw err;
      });
    } catch (e: unknown) {
      const err = e as ResourceHeldError;
      expect(err.heldByJobId).toBe('job-999-holder');
      expect(err.message).toContain('job "job-999-holder"');
    }
  });
});
