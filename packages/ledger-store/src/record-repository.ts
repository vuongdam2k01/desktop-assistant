import crypto from 'node:crypto';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { LedgerStoreError } from './errors.js';
import {
  validateLedgerRecord,
  validateSnapshot,
  validateReversibility,
  validateCompensatingAction,
  normalizeReconciliationDeclaration,
} from './record-validator.js';
import { renderRecordSummary } from './summary.js';
import type {
  TypedLedgerRecord,
  IntentRecord,
  ResultRecord,
  DecisionRecord,
  ErrorRecord,
  InformationRecord,
  RemovalAnnouncementRecord,
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
} from './types.js';

interface RawActionRecordRow {
  record_id: string;
  job_id: string;
  position: number;
  type: string;
  origin_device: string;
  origin_sequence: number;
  recorded_at: string;
  correlation_id: string | null;
  references_json: string | null;
  content: string;
}

export class RecordRepository {
  constructor(
    readonly db: Database.Database,
    readonly deviceId: string,
    readonly attachmentRoot?: string
  ) {}

  /**
   * Normalizes and validates an attachment path relative to configured root.
   */
  normalizeAttachmentPath(attachmentPath: string): string {
    if (!this.attachmentRoot) {
      throw new LedgerStoreError(
        'ATTACHMENT_PATH_INVALID',
        'Cannot register attachments when attachmentRoot is not configured.'
      );
    }

    if (!attachmentPath || typeof attachmentPath !== 'string' || attachmentPath.trim().length === 0) {
      throw new LedgerStoreError('ATTACHMENT_PATH_INVALID', 'Attachment path must be a non-empty string.');
    }

    if (attachmentPath.includes('\0')) {
      throw new LedgerStoreError('ATTACHMENT_PATH_INVALID', 'Attachment path cannot contain null bytes.');
    }

    const normalized = path.normalize(attachmentPath);
    if (path.isAbsolute(normalized) || normalized.startsWith('..') || normalized === '.') {
      throw new LedgerStoreError(
        'ATTACHMENT_PATH_INVALID',
        `Attachment path "${attachmentPath}" resolves outside configured root.`
      );
    }

    const resolved = path.resolve(this.attachmentRoot, normalized);
    const rootResolved = path.resolve(this.attachmentRoot);
    if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
      throw new LedgerStoreError(
        'ATTACHMENT_PATH_INVALID',
        `Attachment path "${attachmentPath}" resolves outside attachment root.`
      );
    }

    return normalized;
  }

  /**
   * Increments and reserves origin sequence for the local device.
   */
  private reserveDeviceSequence(): number {
    const row = this.db
      .prepare<[string], { last_sequence: number }>(
        'SELECT last_sequence FROM device_sequence WHERE device_id = ?'
      )
      .get(this.deviceId);

    const currentSeq = row !== undefined ? row.last_sequence : -1;
    const nextSeq = currentSeq + 1;

    if (nextSeq > Number.MAX_SAFE_INTEGER) {
      throw new LedgerStoreError(
        'SEQUENCE_EXHAUSTED',
        `Origin sequence exhausted for device "${this.deviceId}".`
      );
    }

    this.db
      .prepare('INSERT OR REPLACE INTO device_sequence (device_id, last_sequence) VALUES (?, ?)')
      .run(this.deviceId, nextSeq);

    return nextSeq;
  }

  /**
   * Calculates next position within a job: COALESCE(MAX(position), -1) + 1.
   */
  private getNextJobPosition(jobId: string): number {
    const row = this.db
      .prepare<[string], { next_pos: number }>(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM action_record WHERE job_id = ?'
      )
      .get(jobId);

    return row ? row.next_pos : 0;
  }

  /**
   * Asserts job exists in the database.
   */
  private assertJobExists(jobId: string): void {
    const row = this.db
      .prepare<[string], { id: string }>('SELECT id FROM job WHERE id = ?')
      .get(jobId);

    if (!row) {
      throw new LedgerStoreError('JOB_UNKNOWN', `Job "${jobId}" does not exist in store.`);
    }
  }

  /**
   * Converts a database row back to TypedLedgerRecord without mutation or defaults.
   */
  recordFromRow(row: RawActionRecordRow): TypedLedgerRecord {
    const references = row.references_json !== null ? (JSON.parse(row.references_json) as string[]) : undefined;
    const content = JSON.parse(row.content) as Record<string, unknown>;

    const base = {
      recordId: row.record_id,
      jobId: row.job_id,
      position: row.position,
      originDevice: row.origin_device,
      originSequence: row.origin_sequence,
      recordedAt: row.recorded_at,
      ...(references !== undefined ? { references } : {}),
    };

    if (row.type === 'intent') {
      return {
        ...base,
        type: 'intent',
        correlationId: row.correlation_id as string,
        content: content as unknown as IntentRecord['content'],
      };
    }
    if (row.type === 'result') {
      return {
        ...base,
        type: 'result',
        correlationId: row.correlation_id as string,
        content: content as unknown as ResultRecord['content'],
      };
    }
    if (row.type === 'decision') {
      return {
        ...base,
        type: 'decision',
        content: content as unknown as DecisionRecord['content'],
      };
    }
    if (row.type === 'error') {
      return {
        ...base,
        type: 'error',
        content: content as unknown as ErrorRecord['content'],
      };
    }
    if (row.type === 'information') {
      return {
        ...base,
        type: 'information',
        content: content as unknown as InformationRecord['content'],
      };
    }
    if (row.type === 'removal_announcement') {
      return {
        ...base,
        type: 'removal_announcement',
        content: content as unknown as RemovalAnnouncementRecord['content'],
      };
    }
    if (row.type === 'superseded_version') {
      return {
        ...base,
        type: 'superseded_version',
        content: content as unknown as SupersededVersionRecord['content'],
      };
    }

    throw new LedgerStoreError(
      'STORE_DAMAGED',
      `Unknown record type "${row.type}" encountered for record "${row.record_id}".`
    );
  }

  /**
   * Executes low-level INSERT on action_record and catches SQLite constraint errors.
   */
  private insertActionRecordRow(record: TypedLedgerRecord): void {
    const referencesJson =
      record.references !== undefined ? JSON.stringify(record.references) : null;
    const contentJson = JSON.stringify(record.content);
    const correlationId = 'correlationId' in record ? record.correlationId : null;
    try {
      this.db
        .prepare(
          `INSERT INTO action_record (
            record_id, job_id, position, type, origin_device, origin_sequence,
            recorded_at, correlation_id, references_json, content
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.recordId,
          record.jobId,
          record.position,
          record.type,
          record.originDevice,
          record.originSequence,
          record.recordedAt,
          correlationId,
          referencesJson,
          contentJson
        );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('APPEND_ONLY_VIOLATION') || msg.includes('RECORD_IMMUTABLE')) {
        throw new LedgerStoreError('RECORD_IMMUTABLE', msg, { cause: err });
      }
      if (msg.includes('UNIQUE constraint failed: action_record.record_id')) {
        throw new LedgerStoreError(
          'RECORD_IMMUTABLE',
          `Record ID "${record.recordId}" already exists and cannot be overwritten.`,
          { cause: err }
        );
      }
      if (msg.includes('UNIQUE constraint failed: action_record.correlation_id, action_record.type')) {
        throw new LedgerStoreError(
          'CORRELATION_REUSED',
          `Correlation ID "${correlationId}" already exists for record type "${record.type}".`,
          { cause: err }
        );
      }
      if (msg.includes('UNIQUE constraint failed: action_record.job_id, action_record.position')) {
        throw new LedgerStoreError(
          'LEDGER_WRITE_FAILED',
          `Position collision (${record.jobId}, ${record.position}).`,
          { cause: err }
        );
      }
      if (msg.includes('UNIQUE constraint failed: action_record.origin_device, action_record.origin_sequence')) {
        throw new LedgerStoreError(
          'LEDGER_WRITE_FAILED',
          `Device sequence collision (${record.originDevice}, ${record.originSequence}).`,
          { cause: err }
        );
      }
      throw new LedgerStoreError('LEDGER_WRITE_FAILED', `Failed to write action record: ${msg}`, { cause: err });
    }
  }

  // ── Append Convenience Methods ──────────────────────────────────────────

  appendIntent(input: AppendIntentInput): IntentRecord {
    return this.db.transaction(() => {
      this.assertJobExists(input.jobId);
      if (!input.connector || typeof input.connector !== 'string' || input.connector.trim().length === 0) {
        throw new LedgerStoreError('RECORD_REJECTED', 'Intent connector must be a non-empty string.');
      }
      if (!input.tool || typeof input.tool !== 'string' || input.tool.trim().length === 0) {
        throw new LedgerStoreError('RECORD_REJECTED', 'Intent tool must be a non-empty string.');
      }
      validateSnapshot(input.before);
      validateReversibility(input.reversibility);
      const reconciliation = normalizeReconciliationDeclaration(input.reconciliation);
      const correlationId = input.correlationId || crypto.randomUUID();

      // Enforce correlation uniqueness: cannot reuse existing correlationId for intent
      const existing = this.db
        .prepare<[string], { record_id: string }>(
          'SELECT record_id FROM action_record WHERE correlation_id = ?'
        )
        .get(correlationId);
      if (existing) {
        throw new LedgerStoreError(
          'CORRELATION_REUSED',
          `Correlation ID "${correlationId}" already exists in store.`
        );
      }

      const recordId = crypto.randomUUID();
      const originSequence = this.reserveDeviceSequence();
      const position = this.getNextJobPosition(input.jobId);
      const recordedAt = new Date().toISOString();

      const record: IntentRecord = {
        recordId,
        jobId: input.jobId,
        position,
        type: 'intent',
        originDevice: this.deviceId,
        originSequence,
        recordedAt,
        correlationId,
        content: {
          connector: input.connector,
          tool: input.tool,
          parameters: input.parameters,
          before: input.before,
          reversibility: input.reversibility,
          reconciliation,
        },
      };

      validateLedgerRecord(record);
      this.insertActionRecordRow(record);

      if (input.attachmentPaths && input.attachmentPaths.length > 0) {
        const stmt = this.db.prepare(
          'INSERT INTO record_attachment (record_id, attachment_path) VALUES (?, ?)'
        );
        for (const rawPath of input.attachmentPaths) {
          const norm = this.normalizeAttachmentPath(rawPath);
          stmt.run(recordId, norm);
        }
      }

      return record;
    })();
  }

  appendResult(input: AppendResultInput): ResultRecord {
    return this.db.transaction(() => {
      this.assertJobExists(input.jobId);

      if (!input.correlationId) {
        throw new LedgerStoreError('CORRELATION_MISSING', 'Result record must provide a correlationId.');
      }

      // Must match an existing unresolved intent in the same job
      const intentRow = this.db
        .prepare<[string], RawActionRecordRow>(
          "SELECT * FROM action_record WHERE correlation_id = ? AND type = 'intent'"
        )
        .get(input.correlationId);

      if (!intentRow) {
        throw new LedgerStoreError(
          'CORRELATION_UNMATCHED',
          `Result correlation ID "${input.correlationId}" does not match any existing intent record.`
        );
      }

      if (intentRow.job_id !== input.jobId) {
        throw new LedgerStoreError(
          'CORRELATION_UNMATCHED',
          `Result job ID "${input.jobId}" does not match intent job ID "${intentRow.job_id}".`
        );
      }

      // At most one result per correlation identifier
      const existingResult = this.db
        .prepare<[string], { record_id: string }>(
          "SELECT record_id FROM action_record WHERE correlation_id = ? AND type = 'result'"
        )
        .get(input.correlationId);

      if (existingResult) {
        throw new LedgerStoreError(
          'CORRELATION_REUSED',
          `A result record already exists for correlation ID "${input.correlationId}".`
        );
      }

      const intentContent = JSON.parse(intentRow.content) as IntentRecord['content'];
      validateCompensatingAction(input.compensatingAction, intentContent.reversibility, input.outcome);

      const recordId = crypto.randomUUID();
      const originSequence = this.reserveDeviceSequence();
      const position = this.getNextJobPosition(input.jobId);
      const recordedAt = new Date().toISOString();

      const record: ResultRecord = {
        recordId,
        jobId: input.jobId,
        position,
        type: 'result',
        originDevice: this.deviceId,
        originSequence,
        recordedAt,
        correlationId: input.correlationId,
        content: {
          outcome: input.outcome,
          establishedBy: input.establishedBy,
          ...(input.response !== undefined ? { response: input.response } : {}),
          ...(input.after !== undefined ? { after: input.after } : {}),
          ...(input.compensatingAction !== undefined ? { compensatingAction: input.compensatingAction } : {}),
          ...(input.failure !== undefined ? { failure: input.failure } : {}),
        },
      };

      validateLedgerRecord(record);
      this.insertActionRecordRow(record);

      if (input.attachmentPaths && input.attachmentPaths.length > 0) {
        const stmt = this.db.prepare(
          'INSERT INTO record_attachment (record_id, attachment_path) VALUES (?, ?)'
        );
        for (const rawPath of input.attachmentPaths) {
          const norm = this.normalizeAttachmentPath(rawPath);
          stmt.run(recordId, norm);
        }
      }

      return record;
    })();
  }

  appendDecision(input: AppendDecisionInput): DecisionRecord {
    return this.db.transaction(() => {
      this.assertJobExists(input.jobId);

      // If decision answers an approval request, validate and resolve the projection
      if (input.answers) {
        const approvalReq = this.db
          .prepare<[string], { request_id: string; job_id: string; status: string; expires_at: string }>(
            'SELECT request_id, job_id, status, expires_at FROM approval_request WHERE request_id = ?'
          )
          .get(input.answers);

        if (!approvalReq) {
          throw new LedgerStoreError(
            'APPROVAL_REQUEST_UNKNOWN',
            `Approval request "${input.answers}" does not exist.`
          );
        }

        if (approvalReq.job_id !== input.jobId) {
          throw new LedgerStoreError(
            'APPROVAL_REQUEST_UNKNOWN',
            `Approval request "${input.answers}" belongs to job "${approvalReq.job_id}", not "${input.jobId}".`
          );
        }

        if (input.decision !== 'approve' && input.decision !== 'deny' && input.decision !== 'cancel') {
          throw new LedgerStoreError(
            'APPROVAL_REQUEST_UNKNOWN',
            `Decision "${input.decision}" cannot resolve approval request "${input.answers}". Only approve, deny, or cancel are permitted.`
          );
        }

        if (approvalReq.status !== 'pending') {
          throw new LedgerStoreError(
            'APPROVAL_REQUEST_UNKNOWN',
            `Approval request "${input.answers}" is already resolved (status: ${approvalReq.status}).`
          );
        }

        const now = new Date().toISOString();
        if (new Date(approvalReq.expires_at).getTime() < Date.now()) {
          this.db
            .prepare("UPDATE approval_request SET status = 'expired' WHERE request_id = ? AND status = 'pending'")
            .run(input.answers);
          throw new LedgerStoreError(
            'APPROVAL_REQUEST_UNKNOWN',
            `Approval request "${input.answers}" has expired.`
          );
        }

        let newStatus: string = 'approved';
        if (input.decision === 'deny') newStatus = 'denied';
        else if (input.decision === 'cancel') newStatus = 'cancelled';

        this.db
          .prepare(
            "UPDATE approval_request SET status = ?, decided_at = ?, decided_by = ? WHERE request_id = ? AND status = 'pending'"
          )
          .run(newStatus, now, input.decidedBy, input.answers);
      }

      const recordId = crypto.randomUUID();
      const originSequence = this.reserveDeviceSequence();
      const position = this.getNextJobPosition(input.jobId);
      const recordedAt = new Date().toISOString();

      const record: DecisionRecord = {
        recordId,
        jobId: input.jobId,
        position,
        type: 'decision',
        originDevice: this.deviceId,
        originSequence,
        recordedAt,
        content: {
          decision: input.decision,
          decidedBy: input.decidedBy,
          ...(input.scope !== undefined ? { scope: input.scope } : {}),
          ...(input.reason !== undefined ? { reason: input.reason } : {}),
          ...(input.answers !== undefined ? { answers: input.answers } : {}),
        },
      };

      validateLedgerRecord(record);
      this.insertActionRecordRow(record);

      return record;
    })();
  }

  appendError(input: AppendErrorInput): ErrorRecord {
    return this.db.transaction(() => {
      this.assertJobExists(input.jobId);

      const recordId = crypto.randomUUID();
      const originSequence = this.reserveDeviceSequence();
      const position = this.getNextJobPosition(input.jobId);
      const recordedAt = new Date().toISOString();

      const record: ErrorRecord = {
        recordId,
        jobId: input.jobId,
        position,
        type: 'error',
        originDevice: this.deviceId,
        originSequence,
        recordedAt,
        ...(input.references && input.references.length > 0 ? { references: input.references } : {}),
        content: {
          code: input.code,
          message: input.message,
          ...(input.interrupted !== undefined ? { interrupted: input.interrupted } : {}),
        },
      };

      validateLedgerRecord(record);
      this.insertActionRecordRow(record);

      return record;
    })();
  }

  appendInformation(input: AppendInformationInput): InformationRecord {
    return this.db.transaction(() => {
      this.assertJobExists(input.jobId);

      const recordId = crypto.randomUUID();
      const originSequence = this.reserveDeviceSequence();
      const position = this.getNextJobPosition(input.jobId);
      const recordedAt = new Date().toISOString();

      const record: InformationRecord = {
        recordId,
        jobId: input.jobId,
        position,
        type: 'information',
        originDevice: this.deviceId,
        originSequence,
        recordedAt,
        ...(input.references && input.references.length > 0 ? { references: input.references } : {}),
        content: {
          summary: input.summary,
          ...(input.detail !== undefined ? { detail: input.detail } : {}),
        },
      };

      validateLedgerRecord(record);
      this.insertActionRecordRow(record);

      return record;
    })();
  }

  appendSupersededVersion(input: AppendSupersededVersionInput): SupersededVersionRecord {
    return this.db.transaction(() => {
      this.assertJobExists(input.jobId);

      const recordId = crypto.randomUUID();
      const originSequence = this.reserveDeviceSequence();
      const position = this.getNextJobPosition(input.jobId);
      const recordedAt = new Date().toISOString();

      const record: SupersededVersionRecord = {
        recordId,
        jobId: input.jobId,
        position,
        type: 'superseded_version',
        originDevice: this.deviceId,
        originSequence,
        recordedAt,
        ...(input.references && input.references.length > 0 ? { references: input.references } : {}),
        content: {
          supersededRecord: input.supersededRecord,
          supersedingRecord: input.supersedingRecord,
          supersededPayload: input.supersededPayload,
          supersededDevice: input.supersededDevice,
        },
      };

      validateLedgerRecord(record);
      this.insertActionRecordRow(record);

      return record;
    })();
  }

  // ── Raw Normative Append (Single & Many) ─────────────────────────────────

  append(record: TypedLedgerRecord): string {
    return this.db.transaction(() => {
      validateLedgerRecord(record);
      this.assertJobExists(record.jobId);
      if (!record.recordedAt || typeof record.recordedAt !== 'string' || isNaN(Date.parse(record.recordedAt))) {
        throw new LedgerStoreError(
          'RECORD_REJECTED',
          `Record recordedAt must be a valid ISO date string: "${record.recordedAt}".`
        );
      }
      if (!record.originDevice || typeof record.originDevice !== 'string' || record.originDevice.trim().length === 0) {
        throw new LedgerStoreError('RECORD_REJECTED', 'Record originDevice must be a non-empty string.');
      }
      const expectedPos = this.getNextJobPosition(record.jobId);
      if (record.position !== expectedPos) {
        throw new LedgerStoreError(
          'LEDGER_WRITE_FAILED',
          `Record position ${record.position} violates dense sequence; expected ${expectedPos} for job "${record.jobId}".`
        );
      }

      // Check if record_id already exists: immutability check
      const existing = this.db
        .prepare<[string], { record_id: string }>('SELECT record_id FROM action_record WHERE record_id = ?')
        .get(record.recordId);
      if (existing) {
        throw new LedgerStoreError(
          'RECORD_IMMUTABLE',
          `Record "${record.recordId}" already exists and cannot be overwritten.`
        );
      }
      if (record.type === 'intent') {
        const corrExists = this.db
          .prepare<[string], { record_id: string }>(
            'SELECT record_id FROM action_record WHERE correlation_id = ?'
          )
          .get(record.correlationId);
        if (corrExists) {
          throw new LedgerStoreError(
            'CORRELATION_REUSED',
            `Correlation ID "${record.correlationId}" already exists.`
          );
        }
      } else if (record.type === 'result') {
        const intentRow = this.db
          .prepare<[string], RawActionRecordRow>(
            "SELECT * FROM action_record WHERE correlation_id = ? AND type = 'intent'"
          )
          .get(record.correlationId);
        if (!intentRow) {
          throw new LedgerStoreError(
            'CORRELATION_UNMATCHED',
            `Result correlation ID "${record.correlationId}" does not match any existing intent.`
          );
        }
        if (intentRow.job_id !== record.jobId) {
          throw new LedgerStoreError(
            'CORRELATION_UNMATCHED',
            `Result job ID "${record.jobId}" does not match intent job ID "${intentRow.job_id}".`
          );
        }
        const resExists = this.db
          .prepare<[string], { record_id: string }>(
            "SELECT record_id FROM action_record WHERE correlation_id = ? AND type = 'result'"
          )
          .get(record.correlationId);
        if (resExists) {
          throw new LedgerStoreError(
            'CORRELATION_REUSED',
            `Result already recorded for correlation ID "${record.correlationId}".`
          );
        }

        const intentContent = JSON.parse(intentRow.content) as IntentRecord['content'];
        validateCompensatingAction(
          record.content.compensatingAction,
          intentContent.reversibility,
          record.content.outcome
        );
      }

      this.insertActionRecordRow(record);

      // If originDevice matches local device and sequence is higher, track it
      if (record.originDevice === this.deviceId) {
        this.db
          .prepare(
            `INSERT INTO device_sequence (device_id, last_sequence)
             VALUES (?, ?)
             ON CONFLICT(device_id) DO UPDATE SET last_sequence = MAX(last_sequence, excluded.last_sequence)`
          )
          .run(this.deviceId, record.originSequence);
      }

      return record.recordId;
    })();
  }

  appendMany(records: TypedLedgerRecord[]): string[] {
    return this.db.transaction(() => {
      const recordIds: string[] = [];
      const batchCorrelations = new Set<string>();
      const expectedPosByJob = new Map<string, number>();

      for (const record of records) {
        validateLedgerRecord(record);
        this.assertJobExists(record.jobId);

        const expectedPos = expectedPosByJob.get(record.jobId) ?? this.getNextJobPosition(record.jobId);
        if (record.position !== expectedPos) {
          throw new LedgerStoreError(
            'LEDGER_WRITE_FAILED',
            `Record position ${record.position} violates dense sequence; expected ${expectedPos} for job "${record.jobId}".`
          );
        }
        expectedPosByJob.set(record.jobId, expectedPos + 1);

        const existing = this.db
          .prepare<[string], { record_id: string }>('SELECT record_id FROM action_record WHERE record_id = ?')
          .get(record.recordId);
        if (existing) {
          throw new LedgerStoreError(
            'RECORD_IMMUTABLE',
            `Record "${record.recordId}" already exists and cannot be overwritten.`
          );
        }

        if (record.type === 'intent') {
          if (batchCorrelations.has(record.correlationId)) {
            throw new LedgerStoreError(
              'CORRELATION_REUSED',
              `Correlation ID "${record.correlationId}" duplicated in batch.`
            );
          }
          const corrExists = this.db
            .prepare<[string], { record_id: string }>(
              'SELECT record_id FROM action_record WHERE correlation_id = ?'
            )
            .get(record.correlationId);
          if (corrExists) {
            throw new LedgerStoreError(
              'CORRELATION_REUSED',
              `Correlation ID "${record.correlationId}" already exists.`
            );
          }
          batchCorrelations.add(record.correlationId);
        } else if (record.type === 'result') {
          const intentRow = this.db
            .prepare<[string], RawActionRecordRow>(
              "SELECT * FROM action_record WHERE correlation_id = ? AND type = 'intent'"
            )
            .get(record.correlationId);
          if (!intentRow) {
            throw new LedgerStoreError(
              'CORRELATION_UNMATCHED',
              `Result correlation ID "${record.correlationId}" does not match any existing intent.`
            );
          }
          if (intentRow.job_id !== record.jobId) {
            throw new LedgerStoreError(
              'CORRELATION_UNMATCHED',
              `Result job ID "${record.jobId}" does not match intent job ID "${intentRow.job_id}".`
            );
          }
          const resExists = this.db
            .prepare<[string], { record_id: string }>(
              "SELECT record_id FROM action_record WHERE correlation_id = ? AND type = 'result'"
            )
            .get(record.correlationId);
          if (resExists) {
            throw new LedgerStoreError(
              'CORRELATION_REUSED',
              `Result already recorded for correlation ID "${record.correlationId}".`
            );
          }

          const intentContent = JSON.parse(intentRow.content) as IntentRecord['content'];
          validateCompensatingAction(
            record.content.compensatingAction,
            intentContent.reversibility,
            record.content.outcome
          );
        }

        this.insertActionRecordRow(record);
        recordIds.push(record.recordId);

        if (record.originDevice === this.deviceId) {
          this.db
            .prepare(
              `INSERT INTO device_sequence (device_id, last_sequence)
               VALUES (?, ?)
               ON CONFLICT(device_id) DO UPDATE SET last_sequence = MAX(last_sequence, excluded.last_sequence)`
            )
            .run(this.deviceId, record.originSequence);
        }
      }

      return recordIds;
    })();
  }

  createJob(input: NewJob): StoredJob {
    return this.db.transaction(() => {
      if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
        throw new LedgerStoreError('RECORD_REJECTED', 'Job id must be a non-empty string.');
      }
      if (
        !input.originalRequest ||
        typeof input.originalRequest !== 'string' ||
        input.originalRequest.trim().length === 0
      ) {
        throw new LedgerStoreError('RECORD_REJECTED', 'Job originalRequest must be a non-empty string.');
      }
      const now = new Date().toISOString();
      const approvalMode = input.approvalMode || 'smart';
      const undoOf = input.undoOf || null;

      try {
        this.db
          .prepare(
            `INSERT INTO job (
              id, original_request, state, approval_mode, summary_result, undo_of,
              created_at, updated_at, state_changed_at
            ) VALUES (?, ?, 'created', ?, NULL, ?, ?, ?, ?)`
          )
          .run(input.id, input.originalRequest, approvalMode, undoOf, now, now, now);

        this.db
          .prepare(
            `INSERT INTO job_state_transition (
              job_id, sequence, from_state, to_state, changed_at
            ) VALUES (?, 0, NULL, 'created', ?)`
          )
          .run(input.id, now);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new LedgerStoreError('LEDGER_WRITE_FAILED', `Failed to create job "${input.id}": ${msg}`, {
          cause: err,
        });
      }

      return {
        id: input.id,
        originalRequest: input.originalRequest,
        state: 'created' as const,
        approvalMode,
        summaryResult: null,
        undoOf,
        createdAt: now,
        updatedAt: now,
        stateChangedAt: now,
      };
    })();
  }

  setJobState(jobId: string, state: JobState, changedAt?: string): StoredJob {
    return this.db.transaction(() => {
      const jobRow = this.db
        .prepare<[string], {
          id: string;
          original_request: string;
          state: JobState;
          approval_mode: string;
          summary_result: string | null;
          undo_of: string | null;
          created_at: string;
          updated_at: string;
          state_changed_at: string;
        }>('SELECT * FROM job WHERE id = ?')
        .get(jobId);

      if (!jobRow) {
        throw new LedgerStoreError('JOB_UNKNOWN', `Job "${jobId}" not found.`);
      }
      if (changedAt && (typeof changedAt !== 'string' || isNaN(Date.parse(changedAt)))) {
        throw new LedgerStoreError('RECORD_REJECTED', `Invalid changedAt date string: "${changedAt}".`);
      }
      const now = changedAt || new Date().toISOString();
      const seqRow = this.db
        .prepare<[string], { next_seq: number }>(
          'SELECT COALESCE(MAX(sequence), -1) + 1 AS next_seq FROM job_state_transition WHERE job_id = ?'
        )
        .get(jobId);
      const nextSeq = seqRow ? seqRow.next_seq : 0;

      this.db
        .prepare(
          'INSERT INTO job_state_transition (job_id, sequence, from_state, to_state, changed_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(jobId, nextSeq, jobRow.state, state, now);

      this.db
        .prepare('UPDATE job SET state = ?, updated_at = ?, state_changed_at = ? WHERE id = ?')
        .run(state, now, now, jobId);

      return {
        id: jobRow.id,
        originalRequest: jobRow.original_request,
        state,
        approvalMode: jobRow.approval_mode as StoredJob['approvalMode'],
        summaryResult: jobRow.summary_result,
        undoOf: jobRow.undo_of,
        createdAt: jobRow.created_at,
        updatedAt: now,
        stateChangedAt: now,
      };
    })();
  }

  getJob(jobId: string): StoredJob | null {
    const row = this.db
      .prepare<[string], {
        id: string;
        original_request: string;
        state: JobState;
        approval_mode: string;
        summary_result: string | null;
        undo_of: string | null;
        created_at: string;
        updated_at: string;
        state_changed_at: string;
      }>('SELECT * FROM job WHERE id = ?')
      .get(jobId);

    if (!row) return null;

    return {
      id: row.id,
      originalRequest: row.original_request,
      state: row.state,
      approvalMode: row.approval_mode as StoredJob['approvalMode'],
      summaryResult: row.summary_result,
      undoOf: row.undo_of,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stateChangedAt: row.state_changed_at,
    };
  }

  // ── Approval Request Primitives ─────────────────────────────────────────

  createApprovalRequest(input: ApprovalRequest): StoredApprovalRequest {
    return this.db.transaction(() => {
      this.assertJobExists(input.jobId);
      if (!input.requestId || typeof input.requestId !== 'string') {
        throw new LedgerStoreError('RECORD_REJECTED', 'ApprovalRequest requires a non-empty requestId.');
      }
      if (!input.tool || typeof input.tool !== 'string') {
        throw new LedgerStoreError('RECORD_REJECTED', 'ApprovalRequest requires a non-empty tool.');
      }
      if (!Array.isArray(input.matched) || input.matched.length === 0) {
        throw new LedgerStoreError('RECORD_REJECTED', 'ApprovalRequest requires at least one matched rule.');
      }
      for (const m of input.matched) {
        if (!m || typeof m !== 'object' || typeof m.ruleId !== 'string' || typeof m.verdict !== 'string') {
          throw new LedgerStoreError('RECORD_REJECTED', 'ApprovalRequest matched rule must contain ruleId and verdict.');
        }
      }
      if (!input.reason || typeof input.reason !== 'string') {
        throw new LedgerStoreError('RECORD_REJECTED', 'ApprovalRequest requires a non-empty reason.');
      }
      if (!input.expiresAt || typeof input.expiresAt !== 'string' || isNaN(Date.parse(input.expiresAt))) {
        throw new LedgerStoreError('RECORD_REJECTED', 'ApprovalRequest requires a valid ISO expiresAt date string.');
      }
      if (input.appealable !== true) {
        throw new LedgerStoreError('RECORD_REJECTED', 'ApprovalRequest must specify appealable: true.');
      }

      const now = new Date().toISOString();
      const payloadJson = JSON.stringify(input);
      try {
        this.db
          .prepare(
            `INSERT INTO approval_request (
              request_id, job_id, status, payload_json, created_at, expires_at, decided_at, decided_by
            ) VALUES (?, ?, 'pending', ?, ?, ?, NULL, NULL)`
          )
          .run(input.requestId, input.jobId, payloadJson, now, input.expiresAt);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new LedgerStoreError(
          'LEDGER_WRITE_FAILED',
          `Failed to create approval request "${input.requestId}": ${msg}`,
          { cause: err }
        );
      }
      return {
        ...input,
        status: 'pending' as const,
        createdAt: now,
        decidedAt: null,
        decidedBy: null,
      };
    })();
  }

  getApprovalRequest(requestId: string): StoredApprovalRequest | null {
    const row = this.db
      .prepare<[string], {
        request_id: string;
        job_id: string;
        status: StoredApprovalRequest['status'];
        payload_json: string;
        created_at: string;
        expires_at: string;
        decided_at: string | null;
        decided_by: 'user' | 'risk_judge' | null;
      }>('SELECT * FROM approval_request WHERE request_id = ?')
      .get(requestId);

    if (!row) return null;

    const payload = JSON.parse(row.payload_json) as ApprovalRequest;
    return {
      ...payload,
      status: row.status,
      createdAt: row.created_at,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
    };
  }

  listPendingApprovalRequests(): StoredApprovalRequest[] {
    const rows = this.db
      .prepare<[], {
        request_id: string;
        job_id: string;
        status: StoredApprovalRequest['status'];
        payload_json: string;
        created_at: string;
        expires_at: string;
        decided_at: string | null;
        decided_by: 'user' | 'risk_judge' | null;
      }>("SELECT * FROM approval_request WHERE status = 'pending' ORDER BY created_at ASC")
      .all();

    return rows.map((row) => {
      const payload = JSON.parse(row.payload_json) as ApprovalRequest;
      return {
        ...payload,
        status: row.status,
        createdAt: row.created_at,
        decidedAt: row.decided_at,
        decidedBy: row.decided_by,
      };
    });
  }

  // ── Reading Methods ─────────────────────────────────────────────────────

  readJob(jobId: string): TypedLedgerRecord[] {
    this.assertJobExists(jobId);
    const rows = this.db
      .prepare<[string], RawActionRecordRow>(
        'SELECT * FROM action_record WHERE job_id = ? ORDER BY position ASC'
      )
      .all(jobId);

    return rows.map((r) => this.recordFromRow(r));
  }

  read(query: RecordQuery): TypedLedgerRecord[] {
    if (typeof query.limit !== 'number' || !Number.isSafeInteger(query.limit) || query.limit <= 0) {
      throw new LedgerStoreError('QUERY_UNBOUNDED', 'RecordQuery requires a positive integer limit.');
    }

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (query.jobId) {
      whereClauses.push('job_id = ?');
      params.push(query.jobId);
    }

    if (query.types && query.types.length > 0) {
      const placeholders = query.types.map(() => '?').join(', ');
      whereClauses.push(`type IN (${placeholders})`);
      params.push(...query.types);
    }

    if (query.from) {
      if (isNaN(Date.parse(query.from))) {
        throw new LedgerStoreError('RECORD_REJECTED', `Invalid query.from date: "${query.from}".`);
      }
      whereClauses.push('recorded_at >= ?');
      params.push(query.from);
    }

    if (query.to) {
      if (isNaN(Date.parse(query.to))) {
        throw new LedgerStoreError('RECORD_REJECTED', `Invalid query.to date: "${query.to}".`);
      }
      whereClauses.push('recorded_at <= ?');
      params.push(query.to);
    }

    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
      throw new LedgerStoreError(
        'RECORD_REJECTED',
        `Inverted query date range: from "${query.from}" is after to "${query.to}".`
      );
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderSql = query.jobId
      ? 'ORDER BY position ASC'
      : 'ORDER BY recorded_at DESC, origin_sequence DESC, position ASC';

    if (!query.text) {
      // Non-text query: push LIMIT directly into SQL
      const sql = `SELECT * FROM action_record ${whereSql} ${orderSql} LIMIT ?`;
      const rows = this.db.prepare(sql).all(...params, query.limit) as RawActionRecordRow[];
      return rows.map((r) => this.recordFromRow(r));
    }

    // Text query: bounded scan to prevent unbounded memory allocation
    const boundedScanLimit = Math.min(Math.max(query.limit * 20, 500), 5000);
    const sql = `SELECT * FROM action_record ${whereSql} ${orderSql} LIMIT ?`;
    const rows = this.db.prepare(sql).all(...params, boundedScanLimit) as RawActionRecordRow[];

    const records = rows.map((r) => this.recordFromRow(r));
    const searchText = query.text.toLowerCase();
    const filtered = records.filter((rec) => renderRecordSummary(rec).toLowerCase().includes(searchText));
    return filtered.slice(0, query.limit);
  }
  unresolvedIntents(): UnresolvedIntent[] {
    const rows = this.db
      .prepare<[], {
        record_id: string;
        job_id: string;
        position: number;
        origin_device: string;
        origin_sequence: number;
        recorded_at: string;
        correlation_id: string;
        content: string;
      }>('SELECT * FROM unresolved_intent ORDER BY origin_sequence ASC')
      .all();

    const now = Date.now();
    return rows.map((row) => {
      const content = JSON.parse(row.content) as IntentRecord['content'];
      const intentRecord: IntentRecord = {
        recordId: row.record_id,
        jobId: row.job_id,
        position: row.position,
        type: 'intent',
        originDevice: row.origin_device,
        originSequence: row.origin_sequence,
        recordedAt: row.recorded_at,
        correlationId: row.correlation_id,
        content,
      };

      const recordedTime = new Date(row.recorded_at).getTime();
      const age = Math.max(0, now - recordedTime);

      return {
        intent: intentRecord,
        correlationId: row.correlation_id,
        jobId: row.job_id,
        age,
      };
    });
  }
}
