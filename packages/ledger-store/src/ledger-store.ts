import type Database from 'better-sqlite3';
import { LedgerStoreError } from './errors.js';
import type { RecordRepository } from './record-repository.js';
import type { RemovalManager, ExpireOptions, DeleteByUserRange, UserDeletionConfirmation } from './removal-manager.js';
import type { MigrationManager } from './migration-manager.js';
import { ChangeStream, type RecordListener } from './change-stream.js';
import { registerInternalDatabase } from './internal-test.js';
import type {
  TypedLedgerRecord,
  IntentRecord,
  ResultRecord,
  DecisionRecord,
  ErrorRecord,
  InformationRecord,
  SupersededVersionRecord,
  AppendIntentInput,
  AppendResultInput,
  AppendDecisionInput,
  AppendErrorInput,
  AppendInformationInput,
  AppendSupersededVersionInput,
  NewJob,
  StoredJob,
  JobState,
  ApprovalRequest,
  StoredApprovalRequest,
  RecordQuery,
  UnresolvedIntent,
  ShapeState,
  RemovalRequest,
  RemovalOutcome,
  ReadOnlyLedgerStore,
} from './types.js';

export interface LedgerStore {
  // Normative record methods
  append(record: TypedLedgerRecord): Promise<string>;
  appendMany(records: TypedLedgerRecord[]): Promise<string[]>;
  read(query: RecordQuery): Promise<TypedLedgerRecord[]>;
  readJob(jobId: string): Promise<TypedLedgerRecord[]>;
  unresolvedIntents(): Promise<UnresolvedIntent[]>;
  shape(): Promise<ShapeState>;
  advanceShape(): Promise<ShapeState>;
  remove(request: RemovalRequest): Promise<RemovalOutcome>;
  close(): Promise<void>;

  // Convenience record appends
  appendIntent(input: AppendIntentInput): Promise<IntentRecord>;
  appendResult(input: AppendResultInput): Promise<ResultRecord>;
  appendDecision(input: AppendDecisionInput): Promise<DecisionRecord>;
  appendError(input: AppendErrorInput): Promise<ErrorRecord>;
  appendInformation(input: AppendInformationInput): Promise<InformationRecord>;
  appendSupersededVersion(input: AppendSupersededVersionInput): Promise<SupersededVersionRecord>;

  // Aliases & maintenance
  listUnresolvedIntents(): Promise<UnresolvedIntent[]>;
  expire(range?: ExpireOptions, reason?: string): Promise<RemovalOutcome>;
  deleteByUser(
    range: DeleteByUserRange,
    reason: string,
    confirmation: UserDeletionConfirmation
  ): Promise<RemovalOutcome>;

  // Job persistence primitives
  createJob(input: NewJob): Promise<StoredJob>;
  setJobState(jobId: string, state: JobState, changedAt?: string, summaryResult?: string | null): Promise<StoredJob>;
  getJob(jobId: string): Promise<StoredJob | null>;
  listJobs(filter?: { states?: readonly JobState[] }): Promise<StoredJob[]>;

  // Approval persistence primitives
  createApprovalRequest(input: ApprovalRequest): Promise<StoredApprovalRequest>;
  getApprovalRequest(id: string): Promise<StoredApprovalRequest | null>;
  listPendingApprovalRequests(): Promise<StoredApprovalRequest[]>;

  // Subscription & read-only facade
  subscribe(listener: RecordListener): () => void;
  readOnly(): ReadOnlyLedgerStore;
}

export class LedgerStoreImpl implements LedgerStore {
  #closed = false;
  readonly #changeStream = new ChangeStream();
  readonly #db: Database.Database;
  readonly #repository: RecordRepository;
  readonly #removalManager: RemovalManager;
  readonly #migrationManager: MigrationManager;

  constructor(
    db: Database.Database,
    repository: RecordRepository,
    removalManager: RemovalManager,
    migrationManager: MigrationManager
  ) {
    this.#db = db;
    this.#repository = repository;
    this.#removalManager = removalManager;
    this.#migrationManager = migrationManager;

    this.#removalManager.onAnnouncementCommitted = (rec) => {
      this.#changeStream.emit(rec);
    };

    registerInternalDatabase(this, db);
  }

  private assertOpen(): void {
    if (this.#closed) {
      throw new LedgerStoreError('STORE_UNAVAILABLE', 'Ledger store is closed.');
    }
  }

  async append(record: TypedLedgerRecord): Promise<string> {
    this.assertOpen();
    const id = this.#repository.append(record);
    this.#changeStream.emit(record);
    return id;
  }

  async appendMany(records: TypedLedgerRecord[]): Promise<string[]> {
    this.assertOpen();
    const ids = this.#repository.appendMany(records);
    this.#changeStream.emitMany(records);
    return ids;
  }

  async appendIntent(input: AppendIntentInput): Promise<IntentRecord> {
    this.assertOpen();
    const record = this.#repository.appendIntent(input);
    this.#changeStream.emit(record);
    return record;
  }

  async appendResult(input: AppendResultInput): Promise<ResultRecord> {
    this.assertOpen();
    const record = this.#repository.appendResult(input);
    this.#changeStream.emit(record);
    return record;
  }

  async appendDecision(input: AppendDecisionInput): Promise<DecisionRecord> {
    this.assertOpen();
    const record = this.#repository.appendDecision(input);
    this.#changeStream.emit(record);
    return record;
  }

  async appendError(input: AppendErrorInput): Promise<ErrorRecord> {
    this.assertOpen();
    const record = this.#repository.appendError(input);
    this.#changeStream.emit(record);
    return record;
  }

  async appendInformation(input: AppendInformationInput): Promise<InformationRecord> {
    this.assertOpen();
    const record = this.#repository.appendInformation(input);
    this.#changeStream.emit(record);
    return record;
  }

  async appendSupersededVersion(input: AppendSupersededVersionInput): Promise<SupersededVersionRecord> {
    this.assertOpen();
    const record = this.#repository.appendSupersededVersion(input);
    this.#changeStream.emit(record);
    return record;
  }

  async read(query: RecordQuery): Promise<TypedLedgerRecord[]> {
    this.assertOpen();
    return this.#repository.read(query);
  }

  async readJob(jobId: string): Promise<TypedLedgerRecord[]> {
    this.assertOpen();
    return this.#repository.readJob(jobId);
  }

  async unresolvedIntents(): Promise<UnresolvedIntent[]> {
    this.assertOpen();
    return this.#repository.unresolvedIntents();
  }

  async listUnresolvedIntents(): Promise<UnresolvedIntent[]> {
    return this.unresolvedIntents();
  }

  async shape(): Promise<ShapeState> {
    this.assertOpen();
    return this.#migrationManager.shape();
  }

  async advanceShape(): Promise<ShapeState> {
    this.assertOpen();
    return this.#migrationManager.advanceShape();
  }

  async remove(request: RemovalRequest): Promise<RemovalOutcome> {
    this.assertOpen();
    return this.#removalManager.remove(request);
  }

  async expire(range?: ExpireOptions, reason?: string): Promise<RemovalOutcome> {
    this.assertOpen();
    return this.#removalManager.expire(range, reason);
  }

  async deleteByUser(
    range: DeleteByUserRange,
    reason: string,
    confirmation: UserDeletionConfirmation
  ): Promise<RemovalOutcome> {
    this.assertOpen();
    return this.#removalManager.deleteByUser(range, reason, confirmation);
  }

  async createJob(input: NewJob): Promise<StoredJob> {
    this.assertOpen();
    return this.#repository.createJob(input);
  }

  async setJobState(jobId: string, state: JobState, changedAt?: string, summaryResult?: string | null): Promise<StoredJob> {
    this.assertOpen();
    return this.#repository.setJobState(jobId, state, changedAt, summaryResult);
  }

  async getJob(jobId: string): Promise<StoredJob | null> {
    this.assertOpen();
    return this.#repository.getJob(jobId);
  }

  async listJobs(filter?: { states?: readonly JobState[] }): Promise<StoredJob[]> {
    this.assertOpen();
    return this.#repository.listJobs(filter);
  }

  async createApprovalRequest(input: ApprovalRequest): Promise<StoredApprovalRequest> {
    this.assertOpen();
    return this.#repository.createApprovalRequest(input);
  }

  async getApprovalRequest(id: string): Promise<StoredApprovalRequest | null> {
    this.assertOpen();
    return this.#repository.getApprovalRequest(id);
  }

  async listPendingApprovalRequests(): Promise<StoredApprovalRequest[]> {
    this.assertOpen();
    return this.#repository.listPendingApprovalRequests();
  }

  subscribe(listener: RecordListener): () => void {
    this.assertOpen();
    return this.#changeStream.subscribe(listener);
  }

  readOnly(): ReadOnlyLedgerStore {
    this.assertOpen();
    return Object.freeze({
      read: (query: RecordQuery): Promise<TypedLedgerRecord[]> => {
        return this.read(query);
      },
      readJob: (jobId: string): Promise<TypedLedgerRecord[]> => {
        return this.readJob(jobId);
      },
      unresolvedIntents: (): Promise<UnresolvedIntent[]> => {
        return this.unresolvedIntents();
      },
      shape: (): Promise<ShapeState> => {
        return this.shape();
      },
      subscribe: (listener: RecordListener): (() => void) => {
        return this.subscribe(listener);
      },
    });
  }

  async close(): Promise<void> {
    if (!this.#closed) {
      this.#closed = true;
      this.#changeStream.clear();
      this.#db.close();
    }
  }
}
