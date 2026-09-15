import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { AllowlistEntryRow } from '@desktop-assistant/contracts/rule-representation';
import { ApprovalGateError } from '../errors.js';
import type { HardGateEvaluator } from '../evaluator/evaluator.js';
import type { CallSubject, EvaluationContext } from '../types.js';

export interface AllowlistEntry {
  readonly id: string;
  readonly connector: string;
  readonly tool: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly addedAt: string;
}

export interface AddAllowlistEntryInput {
  readonly connector: string;
  readonly tool: string;
  readonly objectType: string;
  readonly objectId: string;
}

export class AllowlistStore {
  readonly #db: Database.Database;

  constructor(db: Database.Database) {
    this.#db = db;
  }

  /**
   * Adds an entry to the permanent allowlist.
   * Enforces APPROVAL_LEVEL_FORBIDDEN: If an evaluator is provided and a stopping rule
   * (refuse or hold) matches this exact operation, the allowlist request is rejected.
   */
  addEntry(
    input: AddAllowlistEntryInput,
    evaluator?: HardGateEvaluator,
    evalContext?: EvaluationContext
  ): AllowlistEntry {
    if (!input.connector || !input.tool || !input.objectType || !input.objectId) {
      throw new ApprovalGateError(
        'RULE_SCHEMA_INVALID',
        'All fields (connector, tool, objectType, objectId) are required for an allowlist entry.'
      );
    }

    // Check if a stopping rule matches
    if (evaluator && evalContext) {
      const syntheticSubject: CallSubject = {
        callId: `allowlist-check-${randomUUID()}`,
        connector: input.connector,
        tool: input.tool,
        arguments: {},
        object: {
          type: input.objectType,
          id: input.objectId,
          ancestorIds: [],
        },
        isIrreversible: false,
        changesPermission: false,
      };

      const decision = evaluator.evaluate(syntheticSubject, evalContext);
      if ('error' in decision) {
        throw new ApprovalGateError(
          decision.error,
          `Cannot verify allowlist entry against rules: ${decision.detail}`
        );
      }

      if (decision.verdict === 'refuse' || decision.verdict === 'hold') {
        const topRule = decision.matched[0];
        const ruleName = topRule ? `${topRule.name} (${topRule.ruleId})` : 'stopping rule';
        throw new ApprovalGateError(
          'APPROVAL_LEVEL_FORBIDDEN',
          `Cannot add permanent allowlist exception: operation is stopped by rule '${ruleName}'. Exceptions must be declared inside the rule itself.`
        );
      }
    }

    const id = `al-${randomUUID()}`;
    const now = new Date().toISOString();

    try {
      this.#db
        .prepare(`
          INSERT INTO allowlist_entry (id, connector, tool, object_type, object_id, added_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(id, input.connector, input.tool, input.objectType, input.objectId, now);

      return {
        id,
        connector: input.connector,
        tool: input.tool,
        objectType: input.objectType,
        objectId: input.objectId,
        addedAt: now,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed')) {
        // Idempotent: query and return existing
        const existing = this.#db
          .prepare<[string, string, string, string], AllowlistEntryRow>(
            'SELECT * FROM allowlist_entry WHERE connector = ? AND tool = ? AND object_type = ? AND object_id = ?'
          )
          .get(input.connector, input.tool, input.objectType, input.objectId);
        if (existing) {
          return {
            id: existing.id,
            connector: existing.connector,
            tool: existing.tool,
            objectType: existing.object_type,
            objectId: existing.object_id,
            addedAt: existing.added_at,
          };
        }
      }
      throw new ApprovalGateError(
        'EVALUATION_FAILED',
        `Failed to persist allowlist entry: ${msg}`,
        { cause: err }
      );
    }
  }

  listEntries(): readonly AllowlistEntry[] {
    try {
      const rows = this.#db
        .prepare<[], AllowlistEntryRow>(
          'SELECT id, connector, tool, object_type, object_id, added_at FROM allowlist_entry ORDER BY added_at DESC'
        )
        .all();

      return rows.map((r) => ({
        id: r.id,
        connector: r.connector,
        tool: r.tool,
        objectType: r.object_type,
        objectId: r.object_id,
        addedAt: r.added_at,
      }));
    } catch (err) {
      if (err instanceof ApprovalGateError) throw err;
      throw new ApprovalGateError(
        'EVALUATION_FAILED',
        `Failed to list allowlist entries: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
  }

  deleteEntry(id: string): void {
    try {
      const res = this.#db.prepare('DELETE FROM allowlist_entry WHERE id = ?').run(id);
      if (res.changes === 0) {
        throw new ApprovalGateError(
          'ALLOWLIST_ENTRY_UNKNOWN',
          `Allowlist entry '${id}' does not exist.`
        );
      }
    } catch (err) {
      if (err instanceof ApprovalGateError) throw err;
      throw new ApprovalGateError(
        'EVALUATION_FAILED',
        `Failed to delete allowlist entry '${id}': ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
  }

  isAllowlisted(connector: string, tool: string, objectType: string, objectId: string): boolean {
    try {
      const row = this.#db
        .prepare<[string, string, string, string], { id: string }>(
          'SELECT id FROM allowlist_entry WHERE connector = ? AND tool = ? AND object_type = ? AND object_id = ?'
        )
        .get(connector, tool, objectType, objectId);
      return row !== undefined;
    } catch {
      // Fail closed on store read errors
      return false;
    }
  }
}
