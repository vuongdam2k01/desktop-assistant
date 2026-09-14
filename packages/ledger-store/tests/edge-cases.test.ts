import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { LedgerStoreError } from '../src/errors.js';
import {
  validateSnapshot,
  validateReversibility,
  validateCompensatingAction,
} from '../src/record-validator.js';
import {
  createTestDir,
  makeIntentInput,
  type TestDir,
} from './helpers/test-env.js';

describe('Edge Cases and Input Hardening', () => {
  let testDir: TestDir;
  let dbPath: string;
  let attachmentRoot: string;
  let store: LedgerStore;
  const deviceId = 'dev_edge_test';

  beforeEach(async () => {
    testDir = createTestDir('edge-cases-');
    dbPath = testDir.dbPath();
    attachmentRoot = path.join(testDir.path, 'attachments');
    store = await openLedgerStore({ path: dbPath, deviceId, attachmentRoot });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  describe('normalizeAttachmentPath', () => {
    it('rejects empty or whitespace-only paths', async () => {
      await store.createJob({ id: 'job_att_ws', originalRequest: 'Whitespace attachment' });

      await expect(
        store.appendIntent(
          makeIntentInput('job_att_ws', 'corr_ws', {
            attachmentPaths: ['   '],
          })
        )
      ).rejects.toThrow(LedgerStoreError);

      try {
        await store.appendIntent(
          makeIntentInput('job_att_ws', 'corr_ws_2', {
            attachmentPaths: [''],
          })
        );
      } catch (err) {
        expect((err as LedgerStoreError).code).toBe('ATTACHMENT_PATH_INVALID');
      }
    });

    it('rejects paths containing null bytes', async () => {
      await store.createJob({ id: 'job_att_null', originalRequest: 'Null byte path' });

      await expect(
        store.appendIntent(
          makeIntentInput('job_att_null', 'corr_null', {
            attachmentPaths: ['screenshots/image\0.png'],
          })
        )
      ).rejects.toThrow(LedgerStoreError);
    });

    it('rejects paths normalizing to bare current directory', async () => {
      await store.createJob({ id: 'job_att_dot', originalRequest: 'Dot path' });

      await expect(
        store.appendIntent(
          makeIntentInput('job_att_dot', 'corr_dot', {
            attachmentPaths: ['.'],
          })
        )
      ).rejects.toThrow(LedgerStoreError);
    });

    it('rejects attachment registration when attachmentRoot is not configured', async () => {
      const noRootPath = testDir.dbPath('no_root.db');
      const storeNoRoot = await openLedgerStore({ path: noRootPath, deviceId });

      try {
        await storeNoRoot.createJob({ id: 'job_no_root', originalRequest: 'No root job' });
        await expect(
          storeNoRoot.appendIntent(
            makeIntentInput('job_no_root', 'corr_no_root', {
              attachmentPaths: ['valid/file.png'],
            })
          )
        ).rejects.toThrow(/attachmentRoot is not configured/);
      } finally {
        await storeNoRoot.close();
      }
    });
  });

  describe('Job and State Validation', () => {
    it('rejects empty or whitespace-only job ID and originalRequest', async () => {
      await expect(store.createJob({ id: '   ', originalRequest: 'valid' })).rejects.toThrow(
        LedgerStoreError
      );
      await expect(store.createJob({ id: 'job_empty_req', originalRequest: '   ' })).rejects.toThrow(
        LedgerStoreError
      );
    });

    it('rejects invalid changedAt date strings in setJobState', async () => {
      await store.createJob({ id: 'job_invalid_date', originalRequest: 'Test state change' });

      await expect(
        store.setJobState('job_invalid_date', 'running', 'not-a-valid-date')
      ).rejects.toThrow(LedgerStoreError);
    });
  });

  describe('Query and Deletion Date Range Validation', () => {
    it('rejects invalid ISO dates in read query', async () => {
      await expect(store.read({ limit: 10, from: 'invalid-date' })).rejects.toThrow(LedgerStoreError);
      await expect(store.read({ limit: 10, to: 'invalid-date' })).rejects.toThrow(LedgerStoreError);
    });

    it('rejects inverted date ranges in read query', async () => {
      await expect(
        store.read({
          limit: 10,
          from: '2026-05-01T00:00:00.000Z',
          to: '2026-01-01T00:00:00.000Z',
        })
      ).rejects.toThrow(/Inverted query date range/);
    });

    it('rejects inverted date ranges in deleteByUser', async () => {
      await expect(
        store.deleteByUser(
          {
            from: '2026-05-01T00:00:00.000Z',
            to: '2026-01-01T00:00:00.000Z',
          },
          'Inverted date test',
          { confirmed: true, warnedUndoWillBeLost: true, confirmedAt: new Date().toISOString() }
        )
      ).rejects.toThrow(/Inverted date range/);
    });
  });

  describe('Validator Whitespace Checks', () => {
    it('rejects whitespace-only target and reason in validateSnapshot', () => {
      expect(() => {
        validateSnapshot({ captured: true, target: '   ', state: {} });
      }).toThrow(/non-empty target/);

      expect(() => {
        validateSnapshot({ captured: false, reason: '   ' });
      }).toThrow(/non-empty reason/);
    });

    it('rejects whitespace-only fields in validateReversibility', () => {
      expect(() => {
        validateReversibility({ kind: 'reversible', snapshotMethod: '   ' });
      }).toThrow(/non-empty snapshotMethod/);

      expect(() => {
        validateReversibility({ kind: 'irreversible', reason: '   ' });
      }).toThrow(/non-empty reason/);
    });

    it('rejects whitespace-only fields in validateCompensatingAction', () => {
      expect(() => {
        validateCompensatingAction(
          { connector: '   ', tool: 'test', parameters: {} },
          { kind: 'reversible', snapshotMethod: 'read' },
          'succeeded'
        );
      }).toThrow(/non-empty connector/);

      expect(() => {
        validateCompensatingAction(
          { connector: 'notion', tool: '   ', parameters: {} },
          { kind: 'reversible', snapshotMethod: 'read' },
          'succeeded'
        );
      }).toThrow(/non-empty connector, tool, and parameters/);
    });

    it('rejects whitespace-only connector or tool in appendIntent', async () => {
      await store.createJob({ id: 'job_ws_intent', originalRequest: 'ws intent' });

      await expect(
        store.appendIntent(
          makeIntentInput('job_ws_intent', 'corr_ws_conn', {
            connector: '   ',
          })
        )
      ).rejects.toThrow(/Intent connector must be a non-empty string/);

      await expect(
        store.appendIntent(
          makeIntentInput('job_ws_intent', 'corr_ws_tool', {
            tool: '   ',
          })
        )
      ).rejects.toThrow(/Intent tool must be a non-empty string/);
    });

    it('rejects invalid recordedAt in append', async () => {
      await store.createJob({ id: 'job_invalid_rec_at', originalRequest: 'test' });

      await expect(
        store.append({
          recordId: 'rec_inv_1',
          jobId: 'job_invalid_rec_at',
          position: 0,
          type: 'information',
          originDevice: deviceId,
          originSequence: 0,
          recordedAt: 'not-an-iso-date',
          content: { summary: 'invalid date test' },
        })
      ).rejects.toThrow(/recordedAt: must match format "date-time"/);
    });
  });
});
