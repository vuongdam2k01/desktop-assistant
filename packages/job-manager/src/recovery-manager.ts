import type {
  IntentRecord,
  LedgerStore,
  TypedLedgerRecord,
} from '@desktop-assistant/ledger-store';
import type { Job } from './types.js';
import type { JobStateMachine } from './state-machine.js';
import { Reconciler, type ReconcileCandidate } from './reconciler.js';

export interface RecoveryOutcome {
  readonly jobId: string;
  readonly resolution: 'done' | 'failed' | 'waiting_user_confirmation' | 'recovering';
  readonly explanation?: string | undefined;
}

/**
 * Two-phase crash recovery manager:
 * - Phase 1: Local-only, synchronous offline classification before the first window appears
 *   (capabilities/platform/spec.md / INV-PLT-01 / SP-12).
 * - Phase 2: Per-job asynchronous reconciliation against live platform when network is available.
 */
export class RecoveryManager {
  readonly #ledgerStore: LedgerStore;
  readonly #stateMachine: JobStateMachine;
  readonly #reconciler: Reconciler;

  constructor(
    ledgerStore: LedgerStore,
    stateMachine: JobStateMachine,
    reconciler?: Reconciler
  ) {
    this.#ledgerStore = ledgerStore;
    this.#stateMachine = stateMachine;
    this.#reconciler = reconciler ?? new Reconciler();
  }

  /**
   * Phase 1: Local classification.
   * Reads unresolved intents from local SQLite store, marks jobs as 'recovering',
   * and prevents duplicate tool calls. Runs without network access.
   */
  async classifyInterruptedWork(): Promise<string[]> {
    const nonTerminalStates = [
      'created',
      'queued',
      'running',
      'waiting_approval',
      'waiting_input',
      'suspended',
      'recovering',
      'waiting_user_confirmation',
    ] as const;

    const nonTerminalJobs = await this.#ledgerStore.listJobs({ states: nonTerminalStates });
    const unresolved = await this.#ledgerStore.unresolvedIntents();
    const unresolvedJobIds = new Set<string>(unresolved.map((u) => u.jobId));
    const recoveringJobIds: string[] = [];

    for (const jobRow of nonTerminalJobs) {
      const jobDomain: Job = {
        id: jobRow.id,
        originalRequest: jobRow.originalRequest,
        state: jobRow.state,
        approvalMode: jobRow.approvalMode,
        priority: jobRow.priority,
        createdOnDevice: jobRow.createdOnDevice,
        connectorAccountId: jobRow.connectorAccountId || undefined,
        requiredConnectors: jobRow.requiredConnectors,
        summaryResult: jobRow.summaryResult,
        undoOf: jobRow.undoOf,
        createdAt: jobRow.createdAt,
        updatedAt: jobRow.updatedAt,
        stateChangedAt: jobRow.stateChangedAt,
      };

      // 1. Unresolved intent -> mark recovering if not already recovering or waiting_user_confirmation
      if (unresolvedJobIds.has(jobRow.id)) {
        if (jobRow.state !== 'recovering' && jobRow.state !== 'waiting_user_confirmation') {
          await this.#stateMachine.transition(jobDomain, 'recovering', {
            reason: 'Crash recovery Phase 1: unresolved intent detected at startup',
          });
        }
        recoveringJobIds.push(jobRow.id);
        continue;
      }

      // 2. Point 5 Crash Recovery: result was committed before job state could update to done/failed
      const records = await this.#ledgerStore.readJob(jobRow.id);
      if (records.length > 0) {
        const lastRecord = records[records.length - 1];
        if (lastRecord && lastRecord.type === 'result') {
          if (lastRecord.content.outcome === 'succeeded') {
            await this.#stateMachine.transition(jobDomain, 'done', {
              summaryResult: 'Completed (result recovered from ledger)',
              reason: 'Point 5 crash recovery: result committed before job status update',
            });
            continue;
          }
          if (lastRecord.content.outcome === 'failed') {
            await this.#stateMachine.transition(jobDomain, 'failed', {
              summaryResult: 'Failed (recovered from ledger result)',
              reason: 'Point 5 crash recovery: failure result committed before job status update',
            });
            continue;
          }
        }
      }
    }

    return recoveringJobIds;
  }

  /**
   * Phase 2: Per-job reconciliation against live platform.
   */
  async reconcileJob(job: Job): Promise<RecoveryOutcome> {
    const records = await this.#ledgerStore.readJob(job.id);
    const unresolvedIntentRecord = this.#findUnresolvedIntentRecord(records);

    // If no unresolved intent found, job can safely continue or complete
    if (!unresolvedIntentRecord) {
      return { jobId: job.id, resolution: 'recovering', explanation: 'No unresolved intent found.' };
    }

    const storedJob = await this.#ledgerStore.getJob(job.id);
    const currentJob: Job = storedJob ? { ...job, state: storedJob.state } : job;
    const candidate = this.#buildCandidate(job.id, unresolvedIntentRecord);
    const outcome = await this.#reconciler.reconcile(candidate);

    if (outcome.conclusion === 'unreachable') {
      // Device has no network: keep job in recovering
      return {
        jobId: job.id,
        resolution: 'recovering',
        explanation: 'Platform unreachable. Job stays recovering until network restores.',
      };
    }

    if (outcome.conclusion === 'performed') {
      let afterSnapshot:
        | { captured: true; target: string; state: unknown }
        | { captured: false; reason: string }
        | undefined;

      if (outcome.observedState !== undefined) {
        let targetId = candidate.jobId;
        const args = candidate.toolArguments;
        if (args && 'id' in args && typeof args.id === 'string') {
          targetId = args.id;
        } else if (
          candidate.beforeSnapshot &&
          typeof candidate.beforeSnapshot === 'object' &&
          'target' in candidate.beforeSnapshot &&
          typeof candidate.beforeSnapshot.target === 'string'
        ) {
          targetId = candidate.beforeSnapshot.target;
        }
        afterSnapshot = {
          captured: true,
          target: targetId,
          state: outcome.observedState,
        };
      }

      let compensatingAction: { connector: string; tool: string; parameters: unknown } | undefined;
      if (unresolvedIntentRecord.content.reversibility.kind === 'reversible') {
        compensatingAction = {
          connector: candidate.connector,
          tool: 'undo_' + candidate.tool,
          parameters:
            candidate.beforeSnapshot &&
            typeof candidate.beforeSnapshot === 'object' &&
            'state' in candidate.beforeSnapshot
              ? candidate.beforeSnapshot.state
              : {},
        };
      }

      // External call already happened: append correlated result record ("reconciled") and mark done
      await this.#ledgerStore.appendResult({
        jobId: job.id,
        correlationId: candidate.correlationId,
        outcome: 'succeeded',
        establishedBy: 'reconciled',
        after: afterSnapshot,
        compensatingAction,
      });

      await this.#stateMachine.transition(currentJob, 'done', {
        summaryResult: 'Completed (established by reconciliation)',
        reason: 'Platform confirmed call was performed before interruption.',
      });

      return {
        jobId: job.id,
        resolution: 'done',
        explanation: 'Call confirmed executed on platform. Result appended.',
      };
    }

    if (outcome.conclusion === 'not_performed') {
      // 1. Append error record for diagnostic traceability
      await this.#ledgerStore.appendError({
        jobId: job.id,
        code: 'OPERATION_INTERRUPTED',
        message: 'External operation was not performed before process interruption.',
        interrupted: true,
      });

      // 2. Resolve intent with correlated failed result
      await this.#ledgerStore.appendResult({
        jobId: job.id,
        correlationId: candidate.correlationId,
        outcome: 'failed',
        establishedBy: 'reconciled',
        failure: {
          code: 'OPERATION_INTERRUPTED',
          message: 'External operation was not performed before process interruption.',
          retriable: false,
        },
      });

      await this.#stateMachine.transition(currentJob, 'failed', {
        summaryResult: 'Interrupted before external call executed',
        reason: 'Platform confirmed call was not performed before interruption.',
      });

      return {
        jobId: job.id,
        resolution: 'failed',
        explanation: 'Call confirmed unperformed. Safely failed with completed operations preserved.',
      };
    }

    // Undetermined: method none, state matches neither, or read refused -> ask user
    await this.#stateMachine.transition(currentJob, 'waiting_user_confirmation', {
      reason: `Outcome undetermined (${outcome.reason}). Waiting for user confirmation.`,
    });

    return {
      jobId: job.id,
      resolution: 'waiting_user_confirmation',
      explanation: `Outcome could not be determined automatically (${outcome.reason}). User confirmation required.`,
    };
  }

  /**
   * Confirms the outcome of a job in waiting_user_confirmation based on user input.
   * Persists the decision record FIRST (Constitution III), then resolves the intent with a correlated ResultRecord.
   */
  async confirmOutcomeByUser(
    job: Job,
    correlationId: string,
    userConfirmedPerformed: boolean
  ): Promise<Job> {
    // 1. Ledger Before Act: append human decision record first
    await this.#ledgerStore.appendDecision({
      jobId: job.id,
      decision: 'confirm_outcome',
      decidedBy: 'user',
      scope: userConfirmedPerformed
        ? 'Outcome confirmed performed by user'
        : 'Outcome confirmed not performed by user',
    });

    // 2. Resolve intent with correlated ResultRecord
    if (userConfirmedPerformed) {
      await this.#ledgerStore.appendResult({
        jobId: job.id,
        correlationId,
        outcome: 'succeeded',
        establishedBy: 'user_confirmed',
      });

      return this.#stateMachine.transition(job, 'done', {
        summaryResult: 'Completed (confirmed by user)',
      });
    }

    await this.#ledgerStore.appendResult({
      jobId: job.id,
      correlationId,
      outcome: 'failed',
      establishedBy: 'user_confirmed',
      failure: {
        code: 'USER_CONFIRMED_FAILED',
        message: 'User confirmed operation did not complete successfully.',
        retriable: false,
      },
    });

    return this.#stateMachine.transition(job, 'failed', {
      summaryResult: 'Failed (confirmed unperformed by user)',
    });
  }

  #findUnresolvedIntentRecord(records: TypedLedgerRecord[]): IntentRecord | undefined {
    const resultCorrelations = new Set<string>();
    for (const rec of records) {
      if (rec.type === 'result' && rec.correlationId) {
        resultCorrelations.add(rec.correlationId);
      }
    }

    for (const rec of records) {
      if (rec.type === 'intent' && rec.correlationId && !resultCorrelations.has(rec.correlationId)) {
        return rec as IntentRecord;
      }
    }
    return undefined;
  }

  #buildCandidate(jobId: string, intent: IntentRecord): ReconcileCandidate {
    const params = intent.content.parameters;
    const toolArguments =
      params && typeof params === 'object' && !Array.isArray(params)
        ? (params as Record<string, unknown>)
        : undefined;

    return {
      jobId,
      correlationId: intent.correlationId,
      connector: intent.content.connector,
      tool: intent.content.tool,
      declaration: intent.content.reconciliation,
      beforeSnapshot: intent.content.before,
      toolArguments,
    };
  }
}
