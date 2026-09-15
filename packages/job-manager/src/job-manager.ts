import { randomUUID } from 'node:crypto';
import type { LedgerStore } from '@desktop-assistant/ledger-store';
import type {
  CreateJobInput,
  Job,
  JobEventMap,
  JobManagerOptions,
  JobPriority,
  JobState,
} from './types.js';
import {
  ForeignDeviceExecutionError,
  JobCancelledError,
  JobManagerError,
  JobTimeoutError,
  TerminalStateError,
} from './errors.js';
import { JobStateMachine } from './state-machine.js';
import { JobScheduler } from './scheduler.js';
import { CancellationBarrier } from './cancellation.js';
import { TimeoutMonitor } from './timeout-monitor.js';
import { RetryPolicy } from './retry-policy.js';
import { PreFlightChecker } from './pre-flight.js';
import { RecoveryManager, type RecoveryOutcome } from './recovery-manager.js';
import { FailureReporter } from './failure-reporter.js';
import { JobEventBus } from './event-bus.js';
import { Reconciler } from './reconciler.js';

export class JobManager {
  readonly #ledgerStore: LedgerStore;
  readonly #currentDeviceId: string;
  readonly #stateMachine: JobStateMachine;
  readonly #scheduler: JobScheduler;
  readonly #cancellationBarrier: CancellationBarrier;
  readonly #timeoutMonitor: TimeoutMonitor;
  readonly #retryPolicy: RetryPolicy;
  readonly #preFlightChecker: PreFlightChecker;
  readonly #recoveryManager: RecoveryManager;
  readonly #failureReporter: FailureReporter;
  readonly #eventBus: JobEventBus;

  // In-memory registry of active jobs
  readonly #jobs = new Map<string, Job>();

  constructor(options: JobManagerOptions) {
    this.#ledgerStore = options.ledgerStore;
    this.#currentDeviceId = options.currentDeviceId || 'device:default';
    this.#stateMachine = new JobStateMachine(this.#ledgerStore);
    this.#scheduler = new JobScheduler(options.scheduler);
    this.#cancellationBarrier = new CancellationBarrier();
    this.#timeoutMonitor = new TimeoutMonitor(options.timeout);
    this.#retryPolicy = new RetryPolicy(this.#ledgerStore, options.retry);
    this.#preFlightChecker = new PreFlightChecker(
      options.statusProvider,
      options.tokenRenewer,
      options.preFlight
    );
    const reconciler = new Reconciler(options.reconcileReader);
    this.#recoveryManager = new RecoveryManager(
      this.#ledgerStore,
      this.#stateMachine,
      reconciler
    );
    this.#failureReporter = new FailureReporter(this.#ledgerStore);
    this.#eventBus = new JobEventBus();
  }

  get stateMachine(): JobStateMachine {
    return this.#stateMachine;
  }

  get scheduler(): JobScheduler {
    return this.#scheduler;
  }

  get cancellationBarrier(): CancellationBarrier {
    return this.#cancellationBarrier;
  }

  get timeoutMonitor(): TimeoutMonitor {
    return this.#timeoutMonitor;
  }

  get retryPolicy(): RetryPolicy {
    return this.#retryPolicy;
  }

  get preFlightChecker(): PreFlightChecker {
    return this.#preFlightChecker;
  }

  get recoveryManager(): RecoveryManager {
    return this.#recoveryManager;
  }

  get failureReporter(): FailureReporter {
    return this.#failureReporter;
  }

  get currentDeviceId(): string {
    return this.#currentDeviceId;
  }

  on<K extends keyof JobEventMap>(event: K, listener: JobEventMap[K]): () => void {
    return this.#eventBus.on(event, listener);
  }

  /**
   * Creates a new job in the store and registers it in the active set.
   * State starts at 'created'.
   */
  async createJob(input: CreateJobInput): Promise<Job> {
    const id = input.id || randomUUID();

    const approvalMode = input.approvalMode || 'smart';
    const priority: JobPriority = input.priority || 'background';
    const createdOnDevice = input.createdOnDevice || this.#currentDeviceId;

    const storedJob = await this.#ledgerStore.createJob({
      id,
      originalRequest: input.originalRequest,
      approvalMode,
      undoOf: input.undoOf || null,
      createdOnDevice,
      priority,
      connectorAccountId: input.connectorAccountId,
      requiredConnectors: input.requiredConnectors,
    });

    const job: Job = {
      id: storedJob.id,
      originalRequest: storedJob.originalRequest,
      state: storedJob.state,
      approvalMode: storedJob.approvalMode,
      priority: storedJob.priority,
      connectorAccountId: storedJob.connectorAccountId || undefined,
      requiredConnectors: storedJob.requiredConnectors,
      createdOnDevice: storedJob.createdOnDevice,
      summaryResult: storedJob.summaryResult,
      undoOf: storedJob.undoOf,
      createdAt: storedJob.createdAt,
      updatedAt: storedJob.updatedAt,
      stateChangedAt: storedJob.stateChangedAt,
    };

    this.#jobs.set(id, job);
    this.#eventBus.emit('job:created', job);
    return job;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const stored = await this.#ledgerStore.getJob(jobId);
    if (!stored) {
      return null;
    }

    const job: Job = {
      id: stored.id,
      originalRequest: stored.originalRequest,
      state: stored.state,
      approvalMode: stored.approvalMode,
      priority: stored.priority,
      connectorAccountId: stored.connectorAccountId || undefined,
      requiredConnectors: stored.requiredConnectors,
      createdOnDevice: stored.createdOnDevice,
      summaryResult: stored.summaryResult,
      undoOf: stored.undoOf,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      stateChangedAt: stored.stateChangedAt,
    };

    this.#jobs.set(jobId, job);
    return job;
  }

  async listActiveJobs(): Promise<Job[]> {
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

    const storedJobs = await this.#ledgerStore.listJobs({ states: nonTerminalStates });
    return storedJobs.map((stored) => ({
      id: stored.id,
      originalRequest: stored.originalRequest,
      state: stored.state,
      approvalMode: stored.approvalMode,
      priority: stored.priority,
      connectorAccountId: stored.connectorAccountId || undefined,
      requiredConnectors: stored.requiredConnectors,
      createdOnDevice: stored.createdOnDevice,
      summaryResult: stored.summaryResult,
      undoOf: stored.undoOf,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      stateChangedAt: stored.stateChangedAt,
    }));
  }

  /**
   * Submits a job for execution.
   * Checks device pin (Constitution VII / AC-28): job only executes on creating device.
   * Performs Pre-Flight checks, acquires a concurrency slot (queues if full), and transitions to 'running'.
   */
  async startJob(jobId: string): Promise<Job> {
    const job = await this.#assertJobExists(jobId);

    // 1. Device pinning enforcement
    if (job.createdOnDevice !== this.#currentDeviceId) {
      throw new ForeignDeviceExecutionError(
        job.id,
        job.createdOnDevice,
        this.#currentDeviceId
      );
    }

    // 2. Pre-flight authorisation check before admission
    await this.#preFlightChecker.establishAuthorisation(job);

    // 3. Move to 'queued' while awaiting admission slot
    let currentJob = job;
    if (currentJob.state === 'created') {
      currentJob = await this.#transitionJob(currentJob, 'queued', 'Queued for admission slot');
    }

    // 4. Acquire admission slot from Scheduler
    await this.#scheduler.acquireSlot(currentJob);

    // 5. Transition to 'running'
    currentJob = await this.#transitionJob(currentJob, 'running', 'Admitted to execution slot');

    // 6. Start active execution watchdog
    this.#timeoutMonitor.startRunning(currentJob.id, () => {
      this.failJob(currentJob.id, 'Execution timed out exceeding active 10-minute limit.', 'JOB_TIMEOUT').catch(
        (err) => {
          console.error(`Error failing timed-out job ${currentJob.id}:`, err);
        }
      );
    });

    return currentJob;
  }

  /**
   * Pauses a running job into a waiting state (waiting_approval, waiting_input, waiting_user_confirmation).
   * Releases its concurrency slot immediately so queued jobs can proceed.
   */
  async pauseJob(
    jobId: string,
    waitingState: 'waiting_approval' | 'waiting_input' | 'waiting_user_confirmation',
    reason?: string
  ): Promise<Job> {
    const job = await this.#assertJobExists(jobId);
    this.#timeoutMonitor.pauseRunning(job.id);

    const updatedJob = await this.#transitionJob(job, waitingState, reason);

    // If entering waiting_input, start the 30-minute watchdog to suspended
    if (waitingState === 'waiting_input') {
      this.#timeoutMonitor.startInquiryWatchdog(job.id, () => {
        this.suspendJob(
          job.id,
          'Inquiry timed out after 30 minutes without response; safely suspended.'
        ).catch((err) => {
          console.error(`Error suspending job ${job.id}:`, err);
        });
      });
    }

    return updatedJob;
  }

  /**
   * Resumes a waiting or suspended job when an answer/decision arrives.
   * Acquires a concurrency slot (or waits if full) and resumes to 'running'.
   */
  async resumeJob(jobId: string): Promise<Job> {
    const job = await this.#assertJobExists(jobId);

    // If resuming from waiting_input, clear the inquiry timer
    if (job.state === 'waiting_input') {
      this.#timeoutMonitor.clearInquiryWatchdog(job.id);
    }

    // Acquire admission slot again
    await this.#scheduler.acquireSlot(job);

    const updatedJob = await this.#transitionJob(
      job,
      'running',
      'Resumed execution from waiting/suspended state'
    );

    this.#timeoutMonitor.startRunning(updatedJob.id, () => {
      this.failJob(updatedJob.id, 'Execution timed out exceeding active 10-minute limit.', 'JOB_TIMEOUT').catch(
        (err) => {
          console.error(`Error failing timed-out job ${updatedJob.id}:`, err);
        }
      );
    });

    return updatedJob;
  }

  /**
   * Transitions a waiting_input job to suspended (e.g. on 30m timeout or user suspension).
   */
  async suspendJob(jobId: string, reason?: string): Promise<Job> {
    const job = await this.#assertJobExists(jobId);
    this.#timeoutMonitor.clearInquiryWatchdog(job.id);
    this.#timeoutMonitor.pauseRunning(job.id);
    return this.#transitionJob(job, 'suspended', reason || 'Suspended');
  }

  /**
   * Requests cooperative cancellation of a job.
   */
  async cancelJob(jobId: string, reason?: string): Promise<Job> {
    const job = await this.#assertJobExists(jobId);

    // If already terminal, throw error
    if (this.#stateMachine.isTerminal(job.state)) {
      throw new TerminalStateError(job.id, job.state, 'cancelled');
    }

    this.#cancellationBarrier.requestCancellation(jobId, reason);
    this.#scheduler.cancelQueued(jobId);
    // If job was queued or waiting, cancel it immediately
    if (
      job.state === 'created' ||
      job.state === 'queued' ||
      job.state === 'waiting_approval' ||
      job.state === 'waiting_input' ||
      job.state === 'waiting_user_confirmation' ||
      job.state === 'suspended'
    ) {
      return this.#finalizeCancellation(job);
    }

    return job;
  }

  /**
   * Marks a job as done.
   */
  async completeJob(jobId: string, summaryResult?: string): Promise<Job> {
    const job = await this.#assertJobExists(jobId);
    this.#cleanupJobExecution(job.id);

    const updated = await this.#transitionJob(job, 'done', 'Job completed successfully', summaryResult);
    this.#eventBus.emit('job:completed', updated);
    return updated;
  }

  /**
   * Marks a job as failed, compiling explanation and offering undo if reversible steps exist.
   */
  async failJob(
    jobId: string,
    reason: string,
    failureCode?: string,
    heldByJobId?: string
  ): Promise<Job> {
    const job = await this.#assertJobExists(jobId);
    this.#cleanupJobExecution(job.id);

    const updated = await this.#transitionJob(job, 'failed', reason, reason);
    const explanation = await this.#failureReporter.explainFailure(
      updated,
      reason,
      failureCode,
      heldByJobId
    );

    this.#eventBus.emit('job:failed', { job: updated, explanation });
    return updated;
  }

  /**
   * Performs Two-Phase Crash Recovery:
   * - Phase 1: Local synchronous classification at startup.
   */
  async performStartupRecovery(): Promise<string[]> {
    const recoveringIds = await this.#recoveryManager.classifyInterruptedWork();
    for (const id of recoveringIds) {
      const stored = await this.#ledgerStore.getJob(id);
      if (stored) {
        const cached = this.#jobs.get(id);
        if (cached) {
          this.#jobs.set(id, {
            ...cached,
            state: stored.state,
            stateChangedAt: stored.stateChangedAt,
          });
        }
      }
    }
    return recoveringIds;
  }

  /**
   * Reconciles a recovering job against the platform (Phase 2).
   */
  async reconcileJob(jobId: string): Promise<RecoveryOutcome> {
    const job = await this.#assertJobExists(jobId);
    const outcome = await this.#recoveryManager.reconcileJob(job);
    const stored = await this.#ledgerStore.getJob(jobId);
    if (stored) {
      this.#jobs.set(jobId, {
        ...job,
        state: stored.state,
        summaryResult: stored.summaryResult,
        stateChangedAt: stored.stateChangedAt,
      });
    }
    return outcome;
  }

  /**
   * Confirms outcome by user in waiting_user_confirmation.
   */
  async confirmUserOutcome(
    jobId: string,
    correlationId: string,
    userConfirmedPerformed: boolean
  ): Promise<Job> {
    const job = await this.#assertJobExists(jobId);
    const updated = await this.#recoveryManager.confirmOutcomeByUser(
      job,
      correlationId,
      userConfirmedPerformed
    );
    this.#jobs.set(updated.id, updated);
    return updated;
  }

  /**
   * Executes a step within the job loop, wrapped with:
   * 1. Cancellation check at boundary before start
   * 2. Retry policy with backoff and ledger error recording
   * 3. Cancellation check after in-flight call completes
   */
  async executeStep<T>(
    jobId: string,
    stepNumber: number,
    operationName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const currentJob = await this.#assertJobExists(jobId);
    if (currentJob.state === 'cancelled') {
      throw new JobCancelledError(jobId, stepNumber > 1 ? stepNumber - 1 : undefined);
    }
    if (this.#stateMachine.isTerminal(currentJob.state)) {
      throw new TerminalStateError(currentJob.id, currentJob.state, 'running');
    }

    // 1. Boundary check before starting tool call
    this.#cancellationBarrier.checkBoundary(jobId, stepNumber);
    let result: T;
    try {
      result = await this.#retryPolicy.executeWithRetry(
        jobId,
        operationName,
        async () => {
          return await fn();
        },
        (_attempt) => {
          this.#cancellationBarrier.checkBoundary(jobId, stepNumber);
          if (this.#timeoutMonitor.hasExceededExecutionTimeout(jobId)) {
            throw new JobTimeoutError(
              jobId,
              this.#timeoutMonitor.getActiveRunningTimeMs(jobId),
              this.#timeoutMonitor.executionTimeoutMs
            );
          }
        }
      );
    } catch (err: unknown) {
      if (err instanceof JobCancelledError) {
        const job = await this.#assertJobExists(jobId);
        await this.#finalizeCancellation(job, stepNumber);
        throw err;
      }
      throw err;
    }

    // 2. Boundary check after in-flight tool call completes
    try {
      this.#cancellationBarrier.onToolCallCompleted(jobId, stepNumber);
    } catch (err: unknown) {
      if (err instanceof JobCancelledError) {
        const job = await this.#assertJobExists(jobId);
        await this.#finalizeCancellation(job, stepNumber);
        throw err;
      }
      throw err;
    }

    this.#eventBus.emit('job:progress', {
      jobId,
      step: stepNumber,
      message: `Completed step ${stepNumber}: ${operationName}`,
    });

    return result;
  }

  async #finalizeCancellation(job: Job, stoppedAtStep?: number): Promise<Job> {
    this.#cleanupJobExecution(job.id);

    // 1. Ledger Before Act: append decision record before state transition
    await this.#ledgerStore.appendDecision({
      jobId: job.id,
      decision: 'cancel',
      decidedBy: 'user',
      scope: `Cancelled at tool-call boundary${stoppedAtStep !== undefined ? ` at step ${stoppedAtStep}` : ''}`,
    });

    // 2. Transition state
    const updated = await this.#transitionJob(job, 'cancelled', 'Job cancelled at tool boundary');

    const explanation = await this.#failureReporter.explainFailure(
      updated,
      'Job was cancelled by user'
    );

    this.#eventBus.emit('job:cancelled', {
      job: updated,
      stoppedAtStep,
      completedOperations: explanation.completedOperations,
      canUndo: explanation.canUndo,
    });

    return updated;
  }

  async #transitionJob(
    job: Job,
    toState: JobState,
    reason?: string,
    summaryResult?: string | null
  ): Promise<Job> {
    const fromState = job.state;
    const updated = await this.#stateMachine.transition(job, toState, {
      reason,
      summaryResult,
    });

    this.#jobs.set(updated.id, updated);
    this.#scheduler.onJobStateChanged(updated, fromState, toState);

    this.#eventBus.emit('job:state_changed', {
      job: updated,
      from: fromState,
      to: toState,
      changedAt: updated.stateChangedAt,
    });

    return updated;
  }

  #cleanupJobExecution(jobId: string): void {
    this.#timeoutMonitor.cleanup(jobId);
    this.#cancellationBarrier.clear(jobId);
    const job = this.#jobs.get(jobId);
    if (job) {
      this.#scheduler.releaseSlot(jobId, job.connectorAccountId);
    }
  }

  async #assertJobExists(jobId: string): Promise<Job> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new JobManagerError('JOB_NOT_FOUND', `Job "${jobId}" not found.`);
    }
    return job;
  }
}
