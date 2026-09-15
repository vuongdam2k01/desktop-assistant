import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/schema.js';
import { UsageAccounting } from '../src/usage-accounting.js';
import { ProfileStore } from '../src/profile-store.js';
import { UsageAccountingError } from '../src/errors.js';
import type { UsageRecord, UnitPrice } from '@desktop-assistant/contracts/usage-accounting';
import type { ProviderProfile } from '@desktop-assistant/contracts/provider-profile';

describe('UsageAccounting', () => {
  let db: Database.Database;
  let profileStore: ProfileStore;
  let usage: UsageAccounting;

  const sampleProfile: ProviderProfile = {
    profileVersion: '0.1.0',
    id: 'ark-shared',
    displayName: 'BytePlus Ark',
    endpoint: {
      address: 'https://api.example.com/v1',
      dialect: 'openai-completions',
    },
    credential: 'llm:provider:ark:api_key',
    models: [
      { name: 'cheap-fast', label: 'Cheap', capabilities: ['text'] },
      { name: 'strong-pro', label: 'Pro', capabilities: ['text', 'tools'] },
    ],
    builtIn: false,
  };

  beforeEach(async () => {
    db = new Database(':memory:');
    initializeDatabase(db);
    profileStore = new ProfileStore({ db });
    await profileStore.save(sampleProfile);

    usage = new UsageAccounting({
      db,
      profileStore,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('Write-Once Record Constraint', () => {
    it('stores a usage record and refuses duplicate requestId writes (RECORD_DUPLICATE)', async () => {
      const entry: UsageRecord = {
        jobId: 'job-101',
        requestId: 'req-001',
        role: 'worker',
        profileId: 'ark-shared',
        model: 'strong-pro',
        reported: true,
        inputTokens: 100,
        outputTokens: 50,
        durationMs: 1200,
        recordedAt: new Date().toISOString(),
      };

      await usage.record(entry);

      // Second write with identical requestId must be rejected
      await expect(usage.record(entry)).rejects.toThrow(UsageAccountingError);
      await expect(usage.record(entry)).rejects.toMatchObject({
        code: 'RECORD_DUPLICATE',
        requestId: 'req-001',
      });
    });
  });

  describe('Unit Price Management', () => {
    it('sets, retrieves, and clears unit prices', async () => {
      const price: UnitPrice = {
        profileId: 'ark-shared',
        model: 'cheap-fast',
        inputPricePerMillion: '0.110000',
        outputPricePerMillion: '0.110000',
        currency: 'USD',
        enteredAt: new Date().toISOString(),
      };

      await usage.setPrice(price);

      const retrieved = await usage.getPrice('ark-shared', 'cheap-fast');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.inputPricePerMillion).toBe('0.110000');
      expect(retrieved?.currency).toBe('USD');

      const all = await usage.prices();
      expect(all).toHaveLength(1);

      await usage.clearPrice('ark-shared', 'cheap-fast');
      expect(await usage.getPrice('ark-shared', 'cheap-fast')).toBeNull();
    });

    it('rejects malformed decimal prices and invalid currency codes', async () => {
      const malformedPrice: UnitPrice = {
        profileId: 'ark-shared',
        model: 'cheap-fast',
        inputPricePerMillion: '$0.11', // invalid format
        outputPricePerMillion: '0.110000',
        currency: 'USD',
        enteredAt: new Date().toISOString(),
      };

      await expect(usage.setPrice(malformedPrice)).rejects.toMatchObject({
        code: 'PRICE_MALFORMED',
      });

      const invalidCurrency: UnitPrice = {
        ...malformedPrice,
        inputPricePerMillion: '0.110000',
        currency: 'usd', // lowercase invalid
      };

      await expect(usage.setPrice(invalidCurrency)).rejects.toMatchObject({
        code: 'CURRENCY_UNKNOWN',
      });
    });

    it('rejects prices for models not offered by the profile', async () => {
      const unofferedModelPrice: UnitPrice = {
        profileId: 'ark-shared',
        model: 'unknown-model',
        inputPricePerMillion: '1.000000',
        outputPricePerMillion: '2.000000',
        currency: 'USD',
        enteredAt: new Date().toISOString(),
      };

      await expect(usage.setPrice(unofferedModelPrice)).rejects.toMatchObject({
        code: 'MODEL_NOT_OFFERED',
      });
    });
  });

  describe('Cost Calculation & Precision', () => {
    it('computes exact decimal cost held to 6 decimal places with basis', () => {
      const price: UnitPrice = {
        profileId: 'ark-shared',
        model: 'cheap-fast',
        inputPricePerMillion: '0.110000',
        outputPricePerMillion: '0.110000',
        currency: 'USD',
        enteredAt: '2026-09-10T08:00:00Z',
      };

      // 1638 input tokens + 200 output tokens at $0.11/M
      const cost = usage.calculateCost(1638, 200, price);
      expect(cost).toBeDefined();
      expect(cost?.currency).toBe('USD');
      expect(cost?.amount).toBe('0.00020218');
      expect(cost?.basis.inputPricePerMillion).toBe('0.110000');
      expect(cost?.basis.outputPricePerMillion).toBe('0.110000');
      expect(cost?.basis.priceEnteredAt).toBe('2026-09-10T08:00:00Z');
    });

    it('retains exact fractional digits without rounding low-volume tokens to zero (INV-AG-25)', () => {
      const price: UnitPrice = {
        profileId: 'ark-shared',
        model: 'cheap-fast',
        inputPricePerMillion: '0.000001',
        outputPricePerMillion: '0.000001',
        currency: 'USD',
        enteredAt: '2026-09-10T08:00:00Z',
      };

      // 1 token at $0.000001/M -> exact cost $0.000000000001 (not 0.000000)
      const cost = usage.calculateCost(1, 0, price);
      expect(cost?.amount).toBe('0.000000000001');
    });
  });
  describe('Job Aggregation (forJob)', () => {
    it('aggregates usage across 3 distinct roles for one job', async () => {
      const pricePro: UnitPrice = {
        profileId: 'ark-shared',
        model: 'strong-pro',
        inputPricePerMillion: '1.000000',
        outputPricePerMillion: '2.000000',
        currency: 'USD',
        enteredAt: new Date().toISOString(),
      };
      const priceCheap: UnitPrice = {
        profileId: 'ark-shared',
        model: 'cheap-fast',
        inputPricePerMillion: '0.110000',
        outputPricePerMillion: '0.110000',
        currency: 'USD',
        enteredAt: new Date().toISOString(),
      };
      await usage.setPrice(pricePro);
      await usage.setPrice(priceCheap);

      // Role 1: pet-text (cheap-fast)
      const cost1 = usage.calculateCost(350, 25, priceCheap)!;
      await usage.record({
        jobId: 'job-multi',
        requestId: 'req-1',
        role: 'pet-text',
        profileId: 'ark-shared',
        model: 'cheap-fast',
        reported: true,
        inputTokens: 350,
        outputTokens: 25,
        durationMs: 1900,
        cost: cost1,
        recordedAt: '2026-09-15T10:00:00Z',
      });

      // Role 2: worker (strong-pro)
      const cost2 = usage.calculateCost(18708, 4677, pricePro)!;
      await usage.record({
        jobId: 'job-multi',
        requestId: 'req-2',
        role: 'worker',
        profileId: 'ark-shared',
        model: 'strong-pro',
        reported: true,
        inputTokens: 18708,
        outputTokens: 4677,
        durationMs: 8500,
        cost: cost2,
        recordedAt: '2026-09-15T10:00:05Z',
      });

      // Role 3: risk-judge (cheap-fast)
      const cost3 = usage.calculateCost(1838, 150, priceCheap)!;
      await usage.record({
        jobId: 'job-multi',
        requestId: 'req-3',
        role: 'risk-judge',
        profileId: 'ark-shared',
        model: 'cheap-fast',
        reported: true,
        inputTokens: 1838,
        outputTokens: 150,
        durationMs: 3100,
        cost: cost3,
        recordedAt: '2026-09-15T10:00:10Z',
      });

      const jobUsage = await usage.forJob('job-multi');
      expect(jobUsage.records).toHaveLength(3);
      expect(jobUsage.byRole).toHaveLength(3);

      expect(jobUsage.total.inputTokens).toBe(350 + 18708 + 1838);
      expect(jobUsage.total.outputTokens).toBe(25 + 4677 + 150);
      expect(jobUsage.total.cost).toBeDefined();
      expect(jobUsage.total.incompleteReason).toBeUndefined();
    });

    it('marks total incomplete with usage-not-reported when provider omits tokens', async () => {
      await usage.record({
        jobId: 'job-unreported',
        requestId: 'req-unrep',
        role: 'worker',
        profileId: 'ark-shared',
        model: 'strong-pro',
        reported: false, // Provider did not report tokens
        durationMs: 1200,
        recordedAt: new Date().toISOString(),
      });

      const jobUsage = await usage.forJob('job-unreported');
      expect(jobUsage.records[0]?.reported).toBe(false);
      expect(jobUsage.total.incompleteReason).toBe('usage-not-reported');
      // Unreported tokens are not counted as zero in total
      expect(jobUsage.total.inputTokens).toBe(0);
    });

    it('marks total incomplete with no-price-configured when a model has no price', async () => {
      await usage.record({
        jobId: 'job-noprice',
        requestId: 'req-noprice',
        role: 'worker',
        profileId: 'ark-shared',
        model: 'strong-pro',
        reported: true,
        inputTokens: 1000,
        outputTokens: 500,
        durationMs: 2000,
        // No cost provided because no price exists
        recordedAt: new Date().toISOString(),
      });

      const jobUsage = await usage.forJob('job-noprice');
      expect(jobUsage.total.cost).toBeUndefined();
      expect(jobUsage.total.incompleteReason).toBe('no-price-configured');
    });

    it('omits total cost when records contain mixed currencies without exchange rates', async () => {
      const priceUSD: UnitPrice = {
        profileId: 'ark-shared',
        model: 'cheap-fast',
        inputPricePerMillion: '0.110000',
        outputPricePerMillion: '0.110000',
        currency: 'USD',
        enteredAt: new Date().toISOString(),
      };
      const priceEUR: UnitPrice = {
        profileId: 'ark-shared',
        model: 'strong-pro',
        inputPricePerMillion: '1.000000',
        outputPricePerMillion: '1.000000',
        currency: 'EUR',
        enteredAt: new Date().toISOString(),
      };

      const costUsd = usage.calculateCost(1000, 100, priceUSD)!;
      await usage.record({
        jobId: 'job-mixed',
        requestId: 'req-usd',
        role: 'pet-text',
        profileId: 'ark-shared',
        model: 'cheap-fast',
        reported: true,
        inputTokens: 1000,
        outputTokens: 100,
        durationMs: 1000,
        cost: costUsd,
        recordedAt: '2026-09-15T10:00:00Z',
      });

      const costEur = usage.calculateCost(2000, 200, priceEUR)!;
      await usage.record({
        jobId: 'job-mixed',
        requestId: 'req-eur',
        role: 'worker',
        profileId: 'ark-shared',
        model: 'strong-pro',
        reported: true,
        inputTokens: 2000,
        outputTokens: 200,
        durationMs: 2000,
        cost: costEur,
        recordedAt: '2026-09-15T10:00:05Z',
      });

      const jobUsage = await usage.forJob('job-mixed');
      expect(jobUsage.byRole).toHaveLength(2);
      expect(jobUsage.byRole[0]?.cost?.currency).toBe('USD');
      expect(jobUsage.byRole[1]?.cost?.currency).toBe('EUR');
      // Mixed currencies must NOT produce a single total cost
      expect(jobUsage.total.cost).toBeUndefined();
    });
  });
});
