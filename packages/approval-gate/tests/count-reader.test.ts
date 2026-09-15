import { describe, it, expect } from 'vitest';
import type { LedgerStore, IntentRecord, ResultRecord } from '@desktop-assistant/ledger-store';
import type { Rule } from '@desktop-assistant/contracts/rule-representation';
import { fetchCountsForRules, getCalendarDayStartIso } from '../src/counts/count-reader.js';
import type { EvaluationContext } from '../src/types.js';

describe('Ledger CountReader Integration', () => {
  const mockIntent1: IntentRecord = {
    recordId: 'rec-1',
    position: 1,
    originSequence: 1,
    recordedAt: '2026-09-15T08:30:00.000Z',
    originDevice: 'dev-1',
    type: 'intent',
    correlationId: 'corr-1',
    jobId: 'job-alpha',
    content: {
      connector: 'notion',
      tool: 'create_page',
      parameters: { properties: { Status: 'Done', Title: 'Task 1' } },
      before: { captured: false, reason: 'unsupported' },
      reversibility: { kind: 'reversible', snapshotMethod: 'delete_page' },
      reconciliation: { method: 'none' },
    },
  };

  const mockIntent2: IntentRecord = {
    recordId: 'rec-2',
    position: 2,
    originSequence: 2,
    recordedAt: '2026-09-15T09:00:00.000Z',
    originDevice: 'dev-1',
    type: 'intent',
    correlationId: 'corr-2',
    jobId: 'job-alpha',
    content: {
      connector: 'notion',
      tool: 'update_page_properties',
      parameters: { properties: { Status: 'Done' } },
      before: { captured: true, target: 'page-101', state: {} },
      reversibility: { kind: 'reversible', snapshotMethod: 'restore_properties' },
      reconciliation: { method: 'none' },
    },
  };

  const mockResult2: ResultRecord = {
    recordId: 'rec-3',
    position: 3,
    originSequence: 3,
    recordedAt: '2026-09-15T09:01:00.000Z',
    originDevice: 'dev-1',
    type: 'result',
    correlationId: 'corr-2',
    jobId: 'job-alpha',
    content: {
      outcome: 'succeeded',
      establishedBy: 'observed',
      after: { captured: true, target: 'page-101', state: {} },
    },
  };

  // Another record from another job on same calendar day
  const mockIntentOtherJob: IntentRecord = {
    recordId: 'rec-4',
    position: 4,
    originSequence: 4,
    recordedAt: '2026-09-15T07:15:00.000Z',
    originDevice: 'dev-2',
    type: 'intent',
    correlationId: 'corr-3',
    jobId: 'job-beta',
    content: {
      connector: 'notion',
      tool: 'create_database',
      parameters: { title: 'Projects' },
      before: { captured: true, target: 'db-999', state: {} },
      reversibility: { kind: 'irreversible', reason: 'creation' },
      reconciliation: { method: 'none' },
    },
  };

  const allRecords = [mockIntent1, mockIntent2, mockResult2, mockIntentOtherJob];

  const mockLedgerStore = {
    read: async (query: { jobId?: string; from?: string }) => {
      let filtered = [...allRecords];
      if (query.jobId) {
        filtered = filtered.filter((r) => r.jobId === query.jobId);
      }
      if (query.from) {
        filtered = filtered.filter((r) => r.recordedAt >= query.from!);
      }
      return filtered;
    },
  } as unknown as LedgerStore;

  const countRules: Rule[] = [
    {
      representationVersion: '1.0.0',
      id: 'rule-job-writes',
      name: 'Stop after 5 writes in job',
      restatement: 'Stop after 5 writes in job',
      origin: 'user',
      verdict: 'hold',
      condition: {
        kind: 'count',
        metric: 'writes',
        boundary: 'job',
        operator: 'gt',
        value: 5,
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      representationVersion: '1.0.0',
      id: 'rule-day-creates',
      name: 'Stop after 10 creates in day',
      restatement: 'Stop after 10 creates in day',
      origin: 'user',
      verdict: 'hold',
      condition: {
        kind: 'count',
        metric: 'creates',
        boundary: 'calendarDay',
        operator: 'gt',
        value: 10,
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      representationVersion: '1.0.0',
      id: 'rule-status-changes',
      name: 'Stop after 3 status changes in job',
      restatement: 'Stop after 3 status changes in job',
      origin: 'user',
      verdict: 'hold',
      condition: {
        kind: 'count',
        metric: 'fieldChanges',
        boundary: 'job',
        field: 'Status',
        operator: 'gt',
        value: 3,
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      representationVersion: '1.0.0',
      id: 'rule-distinct-objects',
      name: 'Stop after 10 distinct objects in job',
      restatement: 'Stop after 10 distinct objects in job',
      origin: 'user',
      verdict: 'hold',
      condition: {
        kind: 'count',
        metric: 'distinctObjects',
        boundary: 'job',
        operator: 'gt',
        value: 10,
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  const context: EvaluationContext = {
    jobId: 'job-alpha',
    mode: 'smart',
    currentUser: 'alice',
    now: '2026-09-15T12:00:00.000Z',
    timezone: 'UTC',
  };

  it('fetches counts matching the required metrics from the ledger', async () => {
    const counts = await fetchCountsForRules(countRules, context, mockLedgerStore);

    // writes in job-alpha: mockIntent1 and mockIntent2 = 2
    expect(counts['writes_job']).toBe(2);

    // creates across calendarDay (job-alpha create_page + job-beta create_database) = 2
    expect(counts['creates_calendarDay']).toBe(2);

    // status changes in job-alpha: both mockIntent1 and mockIntent2 change Status = 2
    expect(counts['fieldChanges_job_status']).toBe(2);

    // distinct objects in job-alpha: page-101 = 1
    expect(counts['distinctObjects_job']).toBe(1);
  });

  it('returns empty counts when no count leaf is active in rules', async () => {
    const emptyRules: Rule[] = [
      {
        representationVersion: '1.0.0',
        id: 'rule-tool-only',
        name: 'Tool only',
        restatement: 'Tool only',
        origin: 'user',
        verdict: 'hold',
        condition: { kind: 'tool', tool: 'archive_page' },
        confirmedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const counts = await fetchCountsForRules(emptyRules, context, mockLedgerStore);
    expect(Object.keys(counts).length).toBe(0);
  });

  it('computes exact UTC instant for local calendar day midnight across timezones', () => {
    // Midnight for 2026-09-15 in Vietnam is 2026-09-15 00:00 +07:00 = 2026-09-14T17:00:00.000Z
    const midnightVn = getCalendarDayStartIso('2026-09-15T02:00:00.000Z', 'Asia/Ho_Chi_Minh');
    expect(midnightVn).toBe('2026-09-14T17:00:00.000Z');

    // In UTC, midnight for 2026-09-15 is 2026-09-15T00:00:00.000Z
    const midnightUtc = getCalendarDayStartIso('2026-09-15T14:30:00.000Z', 'UTC');
    expect(midnightUtc).toBe('2026-09-15T00:00:00.000Z');
  });
});
