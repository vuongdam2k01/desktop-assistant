import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { LedgerStoreError } from './errors.js';
import {
  SYSTEM_MAINTENANCE_JOB_ID,
  createImmutabilityTriggers,
  dropDeleteTrigger,
  verifyImmutabilityGuards,
} from './schema.js';
import { validateLedgerRecord } from './record-validator.js';
import type { RecordRepository } from './record-repository.js';
import type {
  RemovalOutcome,
  RemovalRequest,
  RemovalAnnouncementRecord,
} from './types.js';

export interface UserDeletionConfirmation {
  readonly confirmed: true;
  readonly warnedUndoWillBeLost: true;
  readonly confirmedAt: string;
}

export interface ExpireOptions {
  readonly olderThan?: string | undefined;
}

export interface DeleteByUserRange {
  readonly jobIds?: readonly string[] | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

export class RemovalManager {
  readonly retentionDays: number;
  onAnnouncementCommitted?: ((record: RemovalAnnouncementRecord) => void) | undefined;

  constructor(
    readonly db: Database.Database,
    readonly repository: RecordRepository,
    readonly deviceId: string,
    readonly attachmentRoot?: string | undefined,
    retentionDays?: number | undefined
  ) {
    this.retentionDays = retentionDays !== undefined && retentionDays > 0 ? retentionDays : 90;
  }

  /**
   * Resumes incomplete removal operations on database open.
   */
  resumeIncompleteRemovals(): void {
    const pendingOps = this.db
      .prepare<[], {
        operation_id: string;
        announcement_record_id: string;
        database_completed: number;
        completed: number;
      }>(
        `SELECT operation_id, announcement_record_id, database_completed, completed
         FROM removal_operation
         WHERE completed = 0
         ORDER BY created_at ASC`
      )
      .all();

    for (const op of pendingOps) {
      if (op.database_completed === 0) {
        this.executePhase2DatabaseDeletion(op.operation_id);
      }
      this.executePhase3AttachmentCleanup(op.operation_id);
    }
  }

  /**
   * Dispatches normative remove(request) to expire or deleteByUser.
   */
  async remove(request: RemovalRequest): Promise<RemovalOutcome> {
    if (request.reason === 'retention_expiry') {
      return this.expire({ olderThan: request.olderThan }, 'retention_expiry', request.requestedBy);
    }

    if (request.reason === 'user_deletion') {
      if (!request.confirmation) {
        throw new LedgerStoreError(
          'REMOVAL_SCOPE_INVALID',
          'User deletion requires explicit confirmation that undo will be lost.'
        );
      }

      return this.deleteByUser(
        { jobIds: request.jobIds, to: request.olderThan },
        'User-requested deletion',
        request.confirmation,
        request.requestedBy
      );
    }

    throw new LedgerStoreError(
      'REMOVAL_SCOPE_INVALID',
      `Unknown removal reason: ${(request as { reason: string }).reason}`
    );
  }

  /**
   * Removes records that have passed the retention period.
   */
  async expire(
    range?: ExpireOptions,
    reason = 'retention_expiry',
    requestedBy: 'system' | 'user' = 'system'
  ): Promise<RemovalOutcome> {
    let cutoffIso: string;
    if (range && range.olderThan) {
      if (isNaN(Date.parse(range.olderThan))) {
        throw new LedgerStoreError('REMOVAL_SCOPE_INVALID', `Invalid olderThan date: "${range.olderThan}".`);
      }
      cutoffIso = range.olderThan;
    } else {
      const cutoffMs = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
      cutoffIso = new Date(cutoffMs).toISOString();
    }

    // Phase 1: select targets and record announcement
    const op = this.executePhase1Announcement({
      reason,
      requestedBy,
      selectTargets: () => {
        return this.db
          .prepare<[string, string], { record_id: string; recorded_at: string }>(
            `SELECT record_id, recorded_at
             FROM action_record
             WHERE job_id != ? AND recorded_at < ?
             ORDER BY recorded_at ASC`
          )
          .all(SYSTEM_MAINTENANCE_JOB_ID, cutoffIso);
      },
    });

    if (op.targetCount === 0) {
      return {
        announcement: op.announcementId,
        recordsRemoved: 0,
        attachmentsRemoved: 0,
        completed: true,
      };
    }

    // Phase 2: delete targets atomically
    this.executePhase2DatabaseDeletion(op.operationId);

    // Phase 3: delete attachments and finalize
    const attachmentsRemoved = this.executePhase3AttachmentCleanup(op.operationId);

    this.passiveCheckpoint();

    return {
      announcement: op.announcementId,
      recordsRemoved: op.targetCount,
      attachmentsRemoved,
      completed: true,
    };
  }

  /**
   * Deliberately deletes ledger data requested by user.
   */
  async deleteByUser(
    range: DeleteByUserRange,
    reason: string,
    confirmation: UserDeletionConfirmation,
    requestedBy: 'system' | 'user' = 'user'
  ): Promise<RemovalOutcome> {
    if (!confirmation || confirmation.confirmed !== true || confirmation.warnedUndoWillBeLost !== true) {
      throw new LedgerStoreError(
        'REMOVAL_SCOPE_INVALID',
        'User deletion requires explicit confirmation that undo will be lost.'
      );
    }

    if (confirmation.confirmedAt && isNaN(Date.parse(confirmation.confirmedAt))) {
      throw new LedgerStoreError(
        'REMOVAL_SCOPE_INVALID',
        `Invalid confirmedAt date: "${confirmation.confirmedAt}".`
      );
    }

    if (
      (!range.jobIds || range.jobIds.length === 0) &&
      !range.from &&
      !range.to
    ) {
      throw new LedgerStoreError('REMOVAL_SCOPE_INVALID', 'User deletion range is empty.');
    }

    if (range.from && isNaN(Date.parse(range.from))) {
      throw new LedgerStoreError('REMOVAL_SCOPE_INVALID', `Invalid from date: "${range.from}".`);
    }

    if (range.to && isNaN(Date.parse(range.to))) {
      throw new LedgerStoreError('REMOVAL_SCOPE_INVALID', `Invalid to date: "${range.to}".`);
    }

    if (range.from && range.to && Date.parse(range.from) > Date.parse(range.to)) {
      throw new LedgerStoreError(
        'REMOVAL_SCOPE_INVALID',
        `Inverted date range: from "${range.from}" is after to "${range.to}".`
      );
    }
    if (range.jobIds && range.jobIds.includes(SYSTEM_MAINTENANCE_JOB_ID)) {
      throw new LedgerStoreError('REMOVAL_SCOPE_INVALID', 'Cannot delete system maintenance job.');
    }

    const op = this.executePhase1Announcement({
      reason: 'user_deletion',
      requestedBy,
      selectTargets: () => {
        const whereClauses: string[] = ['job_id != ?'];
        const params: unknown[] = [SYSTEM_MAINTENANCE_JOB_ID];

        if (range.jobIds && range.jobIds.length > 0) {
          const placeholders = range.jobIds.map(() => '?').join(', ');
          whereClauses.push(`job_id IN (${placeholders})`);
          params.push(...range.jobIds);
        }

        if (range.from) {
          whereClauses.push('recorded_at >= ?');
          params.push(range.from);
        }

        if (range.to) {
          whereClauses.push('recorded_at <= ?');
          params.push(range.to);
        }

        const sql = `SELECT record_id, recorded_at FROM action_record WHERE ${whereClauses.join(' AND ')} ORDER BY recorded_at ASC`;
        return this.db.prepare(sql).all(...params) as Array<{ record_id: string; recorded_at: string }>;
      },
    });

    if (op.targetCount === 0) {
      return {
        announcement: op.announcementId,
        recordsRemoved: 0,
        attachmentsRemoved: 0,
        completed: true,
      };
    }

    this.executePhase2DatabaseDeletion(op.operationId);
    const attachmentsRemoved = this.executePhase3AttachmentCleanup(op.operationId);
    this.passiveCheckpoint();

    return {
      announcement: op.announcementId,
      recordsRemoved: op.targetCount,
      attachmentsRemoved,
      completed: true,
    };
  }

  // ── Phase Implementations ────────────────────────────────────────────────

  private executePhase1Announcement(options: {
    reason: string;
    requestedBy: 'system' | 'user';
    selectTargets: () => Array<{ record_id: string; recorded_at: string }>;
  }): { operationId: string; announcementId: string; targetCount: number } {
    let committedAnnouncement: RemovalAnnouncementRecord | undefined;

    const result = this.db.transaction(() => {
      const targets = options.selectTargets();
      const operationId = crypto.randomUUID();
      const announcementId = crypto.randomUUID();
      const now = new Date().toISOString();

      const fromRecordedAt = targets.length > 0 ? targets[0]!.recorded_at : now;
      const toRecordedAt = targets.length > 0 ? targets[targets.length - 1]!.recorded_at : now;
      const targetCount = targets.length;

      // Position in system:ledger-maintenance
      const posRow = this.db
        .prepare<[string], { next_pos: number }>(
          'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM action_record WHERE job_id = ?'
        )
        .get(SYSTEM_MAINTENANCE_JOB_ID);
      const position = posRow ? posRow.next_pos : 0;

      // Device sequence with overflow protection
      const seqRow = this.db
        .prepare<[string], { last_sequence: number }>(
          'SELECT last_sequence FROM device_sequence WHERE device_id = ?'
        )
        .get(this.deviceId);
      const originSequence = (seqRow !== undefined ? seqRow.last_sequence : -1) + 1;
      if (originSequence > Number.MAX_SAFE_INTEGER) {
        throw new LedgerStoreError(
          'SEQUENCE_EXHAUSTED',
          `Origin sequence exhausted for device "${this.deviceId}".`
        );
      }
      this.db
        .prepare('INSERT OR REPLACE INTO device_sequence (device_id, last_sequence) VALUES (?, ?)')
        .run(this.deviceId, originSequence);

      const targetIds = targets.map((t) => t.record_id);

      const announcementRecord: RemovalAnnouncementRecord = {
        recordId: announcementId,
        jobId: SYSTEM_MAINTENANCE_JOB_ID,
        position,
        type: 'removal_announcement',
        originDevice: this.deviceId,
        originSequence,
        recordedAt: now,
        references: targetIds.length > 0 ? targetIds : undefined,
        content: {
          reason: options.reason as RemovalAnnouncementRecord['content']['reason'],
          requestedBy: options.requestedBy,
          range: {
            fromRecordedAt,
            toRecordedAt,
            recordCount: targetCount,
          },
        },
      };

      validateLedgerRecord(announcementRecord);

      // Insert announcement record
      this.db
        .prepare(
          `INSERT INTO action_record (
            record_id, job_id, position, type, origin_device, origin_sequence,
            recorded_at, correlation_id, references_json, content
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
        )
        .run(
          announcementRecord.recordId,
          announcementRecord.jobId,
          announcementRecord.position,
          announcementRecord.type,
          announcementRecord.originDevice,
          announcementRecord.originSequence,
          announcementRecord.recordedAt,
          targetIds.length > 0 ? JSON.stringify(targetIds) : null,
          JSON.stringify(announcementRecord.content)
        );

      // Insert removal operation tracking
      this.db
        .prepare(
          `INSERT INTO removal_operation (
            operation_id, announcement_record_id, reason, requested_by, target_count,
            database_completed, completed, created_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          operationId,
          announcementId,
          options.reason,
          options.requestedBy,
          targetCount,
          targetCount === 0 ? 1 : 0,
          targetCount === 0 ? 1 : 0,
          now,
          targetCount === 0 ? now : null
        );

      if (targetCount > 0) {
        const targetStmt = this.db.prepare(
          'INSERT INTO removal_target (operation_id, record_id) VALUES (?, ?)'
        );
        for (const targetId of targetIds) {
          targetStmt.run(operationId, targetId);
        }

        // Freeze affected attachments without unbounded placeholder lists
        const attachments = this.db
          .prepare<[string], { attachment_path: string }>(
            `SELECT DISTINCT ra.attachment_path
             FROM record_attachment ra
             JOIN removal_target rt ON ra.record_id = rt.record_id
             WHERE rt.operation_id = ?`
          )
          .all(operationId);

        const attachStmt = this.db.prepare(
          'INSERT INTO removal_attachment (operation_id, attachment_path, removed) VALUES (?, ?, 0)'
        );
        for (const att of attachments) {
          attachStmt.run(operationId, att.attachment_path);
        }
      }

      committedAnnouncement = announcementRecord;
      return { operationId, announcementId, targetCount };
    })();

    // Emit post-commit announcement to change stream
    if (committedAnnouncement && this.onAnnouncementCommitted) {
      try {
        this.onAnnouncementCommitted(committedAnnouncement);
      } catch {
        void 0;
      }
    }

    return result;
  }

  private executePhase2DatabaseDeletion(operationId: string): void {
    this.db.transaction(() => {
      // 1. Drop delete trigger
      dropDeleteTrigger(this.db);

      try {
        // 2. Delete all frozen targets in one statement
        this.db
          .prepare(
            `DELETE FROM action_record
             WHERE record_id IN (
               SELECT record_id FROM removal_target WHERE operation_id = ?
             )`
          )
          .run(operationId);

        // 3. Recreate immutability trigger
        createImmutabilityTriggers(this.db);
        verifyImmutabilityGuards(this.db);

        // 4. Mark database completed
        this.db
          .prepare('UPDATE removal_operation SET database_completed = 1 WHERE operation_id = ?')
          .run(operationId);
      } catch (err: unknown) {
        // Guarantee trigger restored even on unexpected error
        try {
          createImmutabilityTriggers(this.db);
        } catch {
          void 0;
        }
        throw err;
      }
    })();
  }

  private executePhase3AttachmentCleanup(operationId: string): number {
    const attachments = this.db
      .prepare<[string], { attachment_path: string; removed: number }>(
        'SELECT attachment_path, removed FROM removal_attachment WHERE operation_id = ? AND removed = 0'
      )
      .all(operationId);

    if (attachments.length > 0 && !this.attachmentRoot) {
      throw new LedgerStoreError(
        'REMOVAL_INCOMPLETE',
        'Cannot perform attachment cleanup: attachmentRoot is not configured.'
      );
    }

    const now = new Date().toISOString();
    let removedCount = 0;

    for (const att of attachments) {
      if (this.attachmentRoot) {
        const normalized = this.repository.normalizeAttachmentPath(att.attachment_path);
        const resolved = path.resolve(this.attachmentRoot, normalized);

        try {
          // Check if any surviving record still references this attachment
          const surviving = this.db
            .prepare<[string], { count: number }>(
              'SELECT COUNT(*) AS count FROM record_attachment WHERE attachment_path = ?'
            )
            .get(att.attachment_path);

          if (!surviving || surviving.count === 0) {
            if (fs.existsSync(resolved)) {
              fs.unlinkSync(resolved);
            }
          }
        } catch (err: unknown) {
          throw new LedgerStoreError(
            'REMOVAL_INCOMPLETE',
            `Failed to remove attachment file "${att.attachment_path}": ${err instanceof Error ? err.message : String(err)}`,
            { cause: err }
          );
        }
      }

      this.db
        .prepare(
          'UPDATE removal_attachment SET removed = 1, removed_at = ? WHERE operation_id = ? AND attachment_path = ?'
        )
        .run(now, operationId, att.attachment_path);

      removedCount++;
    }

    this.db
      .prepare('UPDATE removal_operation SET completed = 1, completed_at = ? WHERE operation_id = ?')
      .run(now, operationId);

    return removedCount;
  }

  private passiveCheckpoint(): void {
    try {
      this.db.pragma('wal_checkpoint(PASSIVE)');
    } catch {
      // Do not block or retry: automatic checkpointing remains enabled
    }
  }
}
