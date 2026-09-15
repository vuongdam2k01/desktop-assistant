import type Database from 'better-sqlite3';
import type {
  UsageRecord,
  UnitPrice,
} from '@desktop-assistant/contracts/usage-accounting';
import { UsageAccountingError } from './errors.js';
import { ProfileStore } from './profile-store.js';
import type { RoleKey, JobUsage, RecordedCost } from './types.js';

export function parseDecimalToMicro(val: string): bigint {
  const parts = val.trim().split('.');
  const intPart = BigInt(parts[0] || '0');
  const rawFrac = (parts[1] || '').padEnd(6, '0').slice(0, 6);
  const fracPart = BigInt(rawFrac);
  return intPart * 1_000_000n + fracPart;
}

export function formatPicoToDecimal(pico: bigint, minDecimals = 6): string {
  const isNegative = pico < 0n;
  const absPico = isNegative ? -pico : pico;
  const intPart = absPico / 1_000_000_000_000n;
  const fracPart = absPico % 1_000_000_000_000n;
  let fracStr = fracPart.toString().padStart(12, '0');
  while (fracStr.length > minDecimals && fracStr.endsWith('0')) {
    fracStr = fracStr.slice(0, -1);
  }
  return `${isNegative ? '-' : ''}${intPart.toString()}.${fracStr}`;
}

export function parseAmountToPico(amountStr: string): bigint {
  const [intPart = '0', rawFrac = ''] = amountStr.trim().split('.');
  const paddedFrac = rawFrac.padEnd(12, '0').slice(0, 12);
  return BigInt(intPart) * 1_000_000_000_000n + BigInt(paddedFrac);
}

export interface UsageAccountingOptions {
  db: Database.Database;
  profileStore?: ProfileStore | undefined;
  now?: (() => string) | undefined;
}


export class UsageAccounting {
  private readonly db: Database.Database;
  private readonly profileStore?: ProfileStore | undefined;
  private readonly now: () => string;

  constructor(options: UsageAccountingOptions) {
    this.db = options.db;
    this.profileStore = options.profileStore;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async record(entry: UsageRecord): Promise<void> {
    const existing = this.db
      .prepare('SELECT request_id FROM usage_record WHERE request_id = ?')
      .get(entry.requestId);

    if (existing) {
      throw new UsageAccountingError({
        code: 'RECORD_DUPLICATE',
        jobId: entry.jobId,
        requestId: entry.requestId,
        detail: `Usage record with requestId '${entry.requestId}' already exists`,
      });
    }

    const stmt = this.db.prepare(`
      INSERT INTO usage_record (
        request_id, job_id, role, profile_id, model, reported, input_tokens, output_tokens, duration_ms, cost_json, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.requestId,
      entry.jobId,
      entry.role,
      entry.profileId,
      entry.model,
      entry.reported ? 1 : 0,
      entry.inputTokens ?? null,
      entry.outputTokens ?? null,
      entry.durationMs,
      entry.cost ? JSON.stringify(entry.cost) : null,
      entry.recordedAt || this.now()
    );
  }

  async forJob(jobId: string): Promise<JobUsage> {
    const stmt = this.db.prepare(`
      SELECT request_id, job_id, role, profile_id, model, reported, input_tokens, output_tokens, duration_ms, cost_json, recorded_at
      FROM usage_record
      WHERE job_id = ?
      ORDER BY recorded_at ASC
    `);

    const rows = stmt.all(jobId) as Array<{
      request_id: string;
      job_id: string;
      role: string;
      profile_id: string;
      model: string;
      reported: number;
      input_tokens: number | null;
      output_tokens: number | null;
      duration_ms: number;
      cost_json: string | null;
      recorded_at: string;
    }>;

    const records: UsageRecord[] = rows.map((row) => ({
      jobId: row.job_id,
      requestId: row.request_id,
      role: row.role as UsageRecord['role'],
      profileId: row.profile_id,
      model: row.model,
      reported: row.reported === 1,
      ...(row.input_tokens !== null ? { inputTokens: row.input_tokens } : {}),
      ...(row.output_tokens !== null ? { outputTokens: row.output_tokens } : {}),
      durationMs: row.duration_ms,
      ...(row.cost_json ? { cost: JSON.parse(row.cost_json) } : {}),
      recordedAt: row.recorded_at,
    }));

    // Group by role
    const byRoleMap = new Map<
      string,
      {
        role: RoleKey;
        inputTokens: number;
        outputTokens: number;
        costPico: bigint;
        currency?: string;
        basis?: RecordedCost['basis'];
      }
    >();

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let hasUnreported = false;
    let hasMissingCost = false;
    const currencies = new Set<string>();
    let totalCostPico = 0n;

    for (const rec of records) {
      const roleKey = rec.role;
      let roleAgg = byRoleMap.get(roleKey);
      if (!roleAgg) {
        roleAgg = { role: roleKey, inputTokens: 0, outputTokens: 0, costPico: 0n };
        byRoleMap.set(roleKey, roleAgg);
      }

      if (rec.reported) {
        const inp = rec.inputTokens ?? 0;
        const out = rec.outputTokens ?? 0;
        roleAgg.inputTokens += inp;
        roleAgg.outputTokens += out;
        totalInputTokens += inp;
        totalOutputTokens += out;
      } else {
        hasUnreported = true;
      }

      if (rec.cost) {
        const costPico = parseAmountToPico(rec.cost.amount);
        roleAgg.costPico += costPico;
        roleAgg.currency = rec.cost.currency;
        roleAgg.basis = rec.cost.basis;
        currencies.add(rec.cost.currency);
        totalCostPico += costPico;
      } else {
        hasMissingCost = true;
      }
    }

    const byRole: JobUsage['byRole'] = Array.from(byRoleMap.values()).map((agg) => {
      let cost: RecordedCost | undefined = undefined;
      if (agg.currency && agg.basis) {
        cost = {
          amount: formatPicoToDecimal(agg.costPico, 6),
          currency: agg.currency,
          basis: agg.basis,
        };
      }
      return {
        role: agg.role as UsageRecord['role'],
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        ...(cost ? { cost } : {}),
      };
    });

    let incompleteReason: 'job-running' | 'usage-not-reported' | 'no-price-configured' | undefined = undefined;
    if (hasUnreported) {
      incompleteReason = 'usage-not-reported';
    } else if (hasMissingCost) {
      incompleteReason = 'no-price-configured';
    }

    let totalCost: RecordedCost | undefined = undefined;
    // Total cost exists only if all records had cost and all used the SAME single currency
    if (!hasMissingCost && currencies.size === 1 && records.length > 0) {
      const currency = Array.from(currencies)[0]!;
      const allBases = records.map((r) => r.cost?.basis).filter(Boolean);
      const firstBasis = allBases[0]!;
      const allSame = allBases.every(
        (b) =>
          b?.inputPricePerMillion === firstBasis.inputPricePerMillion &&
          b?.outputPricePerMillion === firstBasis.outputPricePerMillion
      );

      totalCost = {
        amount: formatPicoToDecimal(totalCostPico, 6),
        currency,
        basis: allSame
          ? firstBasis
          : {
              inputPricePerMillion: 'mixed',
              outputPricePerMillion: 'mixed',
              currency,
              priceEnteredAt: firstBasis.priceEnteredAt,
            },
      };
    }

    return {
      jobId,
      records,
      byRole,
      total: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        ...(totalCost ? { cost: totalCost } : {}),
        ...(incompleteReason ? { incompleteReason } : {}),
      },
    };
  }

  async setPrice(price: UnitPrice): Promise<void> {
    this.validatePrice(price);

    if (this.profileStore) {
      const offered = await this.profileStore.hasModel(price.profileId, price.model);
      if (!offered) {
        throw new UsageAccountingError({
          code: 'MODEL_NOT_OFFERED',
          detail: `Model '${price.model}' is not offered by profile '${price.profileId}'`,
        });
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO unit_price (
        profile_id, model, input_price_per_million, output_price_per_million, currency, entered_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id, model) DO UPDATE SET
        input_price_per_million = excluded.input_price_per_million,
        output_price_per_million = excluded.output_price_per_million,
        currency = excluded.currency,
        entered_at = excluded.entered_at
    `);

    stmt.run(
      price.profileId,
      price.model,
      price.inputPricePerMillion,
      price.outputPricePerMillion,
      price.currency,
      price.enteredAt || this.now()
    );
  }

  async clearPrice(profileId: string, model: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM unit_price WHERE profile_id = ? AND model = ?');
    stmt.run(profileId, model);
  }

  async getPrice(profileId: string, model: string): Promise<UnitPrice | null> {
    const stmt = this.db.prepare(
      'SELECT profile_id, model, input_price_per_million, output_price_per_million, currency, entered_at FROM unit_price WHERE profile_id = ? AND model = ?'
    );
    const row = stmt.get(profileId, model) as
      | {
          profile_id: string;
          model: string;
          input_price_per_million: string;
          output_price_per_million: string;
          currency: string;
          entered_at: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      profileId: row.profile_id,
      model: row.model,
      inputPricePerMillion: row.input_price_per_million,
      outputPricePerMillion: row.output_price_per_million,
      currency: row.currency,
      enteredAt: row.entered_at,
    };
  }

  async prices(): Promise<UnitPrice[]> {
    const stmt = this.db.prepare(
      'SELECT profile_id, model, input_price_per_million, output_price_per_million, currency, entered_at FROM unit_price ORDER BY entered_at ASC'
    );
    const rows = stmt.all() as Array<{
      profile_id: string;
      model: string;
      input_price_per_million: string;
      output_price_per_million: string;
      currency: string;
      entered_at: string;
    }>;

    return rows.map((row) => ({
      profileId: row.profile_id,
      model: row.model,
      inputPricePerMillion: row.input_price_per_million,
      outputPricePerMillion: row.output_price_per_million,
      currency: row.currency,
      enteredAt: row.entered_at,
    }));
  }

  calculateCost(
    inputTokens: number | undefined,
    outputTokens: number | undefined,
    price: UnitPrice | null
  ): RecordedCost | undefined {
    if (!price || inputTokens === undefined || outputTokens === undefined) {
      return undefined;
    }
    const inpPico = parseDecimalToMicro(price.inputPricePerMillion);
    const outPico = parseDecimalToMicro(price.outputPricePerMillion);

    const totalPico = BigInt(inputTokens) * inpPico + BigInt(outputTokens) * outPico;
    const amount = formatPicoToDecimal(totalPico, 6);
    return {
      amount,
      currency: price.currency,
      basis: {
        inputPricePerMillion: price.inputPricePerMillion,
        outputPricePerMillion: price.outputPricePerMillion,
        currency: price.currency,
        priceEnteredAt: price.enteredAt,
      },
    };
  }

  async deleteJobUsage(jobId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM usage_record WHERE job_id = ?');
    stmt.run(jobId);
  }

  private validatePrice(price: UnitPrice): void {
    const decimalPattern = /^\d+(\.\d{1,6})?$/;

    if (!price.inputPricePerMillion || !decimalPattern.test(price.inputPricePerMillion)) {
      throw new UsageAccountingError({
        code: 'PRICE_MALFORMED',
        detail: `inputPricePerMillion '${price.inputPricePerMillion}' is not a valid decimal string (up to 6 decimal places)`,
      });
    }

    if (!price.outputPricePerMillion || !decimalPattern.test(price.outputPricePerMillion)) {
      throw new UsageAccountingError({
        code: 'PRICE_MALFORMED',
        detail: `outputPricePerMillion '${price.outputPricePerMillion}' is not a valid decimal string (up to 6 decimal places)`,
      });
    }

    const currencyPattern = /^[A-Z]{3}$/;
    if (!price.currency || !currencyPattern.test(price.currency)) {
      throw new UsageAccountingError({
        code: 'CURRENCY_UNKNOWN',
        detail: `currency '${price.currency}' must be a 3-letter uppercase ISO 4217 code`,
      });
    }
  }
}
