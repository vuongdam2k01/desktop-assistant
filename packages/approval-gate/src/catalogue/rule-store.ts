import type Database from 'better-sqlite3';
import type { Rule, RuleRow } from '@desktop-assistant/contracts/rule-representation';
import { initializeRuleCatalogueSchema } from './schema.js';
import { validateRule } from '../ir/validator.js';
import { ApprovalGateError } from '../errors.js';
import { GateHealthTracker } from './health.js';

export class RuleStore {
  readonly #db: Database.Database;
  readonly #healthTracker: GateHealthTracker;
  #residentRules: readonly Rule[] = [];

  constructor(db: Database.Database, healthTracker?: GateHealthTracker) {
    this.#db = db;
    this.#healthTracker = healthTracker ?? new GateHealthTracker();
    try {
      initializeRuleCatalogueSchema(this.#db);
      this.loadCatalogue();
    } catch (err) {
      if (err instanceof ApprovalGateError) {
        this.#healthTracker.setStopped(err.code, err.message);
      } else {
        this.#healthTracker.setStopped(
          'RULE_CATALOGUE_UNREADABLE',
          err instanceof Error ? err.message : String(err)
        );
      }
      throw err;
    }
  }

  get healthTracker(): GateHealthTracker {
    return this.#healthTracker;
  }

  get rules(): readonly Rule[] {
    return this.#residentRules;
  }

  /**
   * Reads and validates the entire catalogue from SQLite.
   * Fails closed: if any rule fails validation or store is unreadable,
   * sets gate health to STOPPED and throws an ApprovalGateError.
   */
  loadCatalogue(): readonly Rule[] {
    let rows: RuleRow[];
    try {
      const stmt = this.#db.prepare<[], RuleRow>(
        'SELECT id, representation_version, name, restatement, origin, verdict, condition_json, confirmed_at, updated_at FROM rule ORDER BY confirmed_at DESC'
      );
      rows = stmt.all();
    } catch (err) {
      const errorMsg = `Failed to query rule table: ${err instanceof Error ? err.message : String(err)}`;
      this.#healthTracker.setStopped('RULE_CATALOGUE_UNREADABLE', errorMsg);
      throw new ApprovalGateError('RULE_CATALOGUE_UNREADABLE', errorMsg, { cause: err });
    }

    const loaded: Rule[] = [];

    for (const row of rows) {
      let parsedCondition: unknown;
      try {
        parsedCondition = JSON.parse(row.condition_json);
      } catch (parseErr) {
        const errorMsg = `Malformed condition_json in stored rule '${row.id}': ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`;
        this.#healthTracker.setStopped('RULE_CATALOGUE_INVALID', errorMsg);
        throw new ApprovalGateError('RULE_CATALOGUE_INVALID', errorMsg, { cause: parseErr });
      }

      const candidateRule = {
        representationVersion: row.representation_version,
        id: row.id,
        name: row.name,
        restatement: row.restatement,
        origin: row.origin,
        verdict: row.verdict,
        condition: parsedCondition,
        confirmedAt: row.confirmed_at,
      };

      try {
        validateRule(candidateRule);
        loaded.push(candidateRule);
      } catch (valErr) {
        if (valErr instanceof ApprovalGateError) {
          const mappedCode =
            valErr.code === 'RULE_VERSION_AHEAD'
              ? 'RULE_VERSION_AHEAD'
              : 'RULE_CATALOGUE_INVALID';
          this.#healthTracker.setStopped(mappedCode, valErr.detail);
          throw new ApprovalGateError(mappedCode, valErr.detail, { cause: valErr });
        }
        const errorMsg = `Invalid rule '${row.id}' in store: ${valErr instanceof Error ? valErr.message : String(valErr)}`;
        this.#healthTracker.setStopped('RULE_CATALOGUE_INVALID', errorMsg);
        throw new ApprovalGateError('RULE_CATALOGUE_INVALID', errorMsg, { cause: valErr });
      }
    }

    this.#residentRules = Object.freeze(loaded);
    this.#healthTracker.setOpen();
    return this.#residentRules;
  }

  /**
   * Persists a new or updated rule. Validates schema before write.
   */
  upsertRule(rule: Rule): void {
    validateRule(rule);

    const now = new Date().toISOString();
    const conditionJson = JSON.stringify(rule.condition);

    try {
      const tx = this.#db.transaction(() => {
        const stmt = this.#db.prepare(`
          INSERT INTO rule (
            id, representation_version, name, restatement, origin, verdict, condition_json, confirmed_at, updated_at
          ) VALUES (
            @id, @representation_version, @name, @restatement, @origin, @verdict, @condition_json, @confirmed_at, @updated_at
          )
          ON CONFLICT(id) DO UPDATE SET
            representation_version = excluded.representation_version,
            name = excluded.name,
            restatement = excluded.restatement,
            verdict = excluded.verdict,
            condition_json = excluded.condition_json,
            updated_at = excluded.updated_at
        `);

        stmt.run({
          id: rule.id,
          representation_version: rule.representationVersion,
          name: rule.name,
          restatement: rule.restatement,
          origin: rule.origin,
          verdict: rule.verdict,
          condition_json: conditionJson,
          confirmed_at: rule.confirmedAt,
          updated_at: now,
        });
      });
      tx();
      this.loadCatalogue();
    } catch (err) {
      if (err instanceof ApprovalGateError) throw err;
      throw new ApprovalGateError(
        'EVALUATION_FAILED',
        `Failed to persist rule '${rule.id}': ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
  }

  /**
   * Deletes a user rule by id.
   */
  deleteRule(id: string): void {
    const existing = this.getRule(id);
    if (!existing) {
      throw new ApprovalGateError('RULE_UNKNOWN', `Rule with id '${id}' does not exist.`);
    }

    try {
      const tx = this.#db.transaction(() => {
        this.#db.prepare('DELETE FROM rule WHERE id = ?').run(id);
      });
      tx();
      this.loadCatalogue();
    } catch (err) {
      if (err instanceof ApprovalGateError) throw err;
      throw new ApprovalGateError(
        'EVALUATION_FAILED',
        `Failed to delete rule '${id}': ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
  }

  getRule(id: string): Rule | null {
    const found = this.#residentRules.find((r) => r.id === id);
    return found ? structuredClone(found) : null;
  }

  listRules(): readonly Rule[] {
    return this.#residentRules.map((r) => structuredClone(r));
  }
}
