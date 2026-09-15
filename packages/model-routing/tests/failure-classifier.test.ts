import { describe, it, expect, beforeEach } from 'vitest';
import { FailureClassifier } from '../src/failure-classifier.js';
import { FailureRegistry } from '../src/failure-registry.js';
import type { FailureObservation } from '../src/types.js';

describe('FailureClassifier & FailureRegistry', () => {
  let classifier: FailureClassifier;
  let registry: FailureRegistry;

  beforeEach(() => {
    classifier = new FailureClassifier();
    registry = new FailureRegistry();
  });

  describe('Classification', () => {
    it('classifies 401 / AuthenticationError as CREDENTIAL_REFUSED', () => {
      const observation: FailureObservation = {
        transport: 'answered',
        httpStatus: 401,
        providerCode: 'AuthenticationError',
        providerMessage: 'The API key format is incorrect',
        profileId: 'ark-shared',
        role: 'worker',
        model: 'deepseek-v4-pro',
      };

      const notice = classifier.classify(observation);
      expect(notice.cause).toBe('CREDENTIAL_REFUSED');
      expect(notice.remedy).toEqual({
        kind: 'profile-credential',
        profileId: 'ark-shared',
      });
      expect(notice.dedupeKey).toBe('ark-shared:CREDENTIAL_REFUSED');
      expect(notice.roles).toContain('worker');
    });

    it('classifies 404 / UnsupportedModel as MODEL_UNAVAILABLE', () => {
      const observation: FailureObservation = {
        transport: 'answered',
        httpStatus: 404,
        providerCode: 'UnsupportedModel',
        providerMessage: 'The requested model does not support the coding plan feature',
        profileId: 'ark-shared',
        role: 'undo',
        model: 'non-existent-model',
      };

      const notice = classifier.classify(observation);
      expect(notice.cause).toBe('MODEL_UNAVAILABLE');
      expect(notice.remedy).toEqual({
        kind: 'role-assignment',
        role: 'undo',
      });
      expect(notice.dedupeKey).toBe('ark-shared:MODEL_UNAVAILABLE');
    });

    it('classifies 429 / RateLimit as QUOTA_EXHAUSTED', () => {
      const observation: FailureObservation = {
        transport: 'answered',
        httpStatus: 429,
        providerCode: 'RateLimit',
        providerMessage: 'Insufficient quota or rate limit exceeded',
        profileId: 'ark-shared',
        role: 'pet-text',
        model: 'deepseek-v4-flash',
      };

      const notice = classifier.classify(observation);
      expect(notice.cause).toBe('QUOTA_EXHAUSTED');
      expect(notice.remedy).toEqual({
        kind: 'provider-account',
        profileId: 'ark-shared',
      });
      expect(notice.dedupeKey).toBe('ark-shared:QUOTA_EXHAUSTED');
    });

    it('classifies network unreachable / timeout as ENDPOINT_UNREACHABLE', () => {
      const observation: FailureObservation = {
        transport: 'unreachable',
        providerMessage: 'fetch failed: connect ECONNREFUSED 127.0.0.1:443',
        profileId: 'ark-shared',
        role: 'worker',
        model: 'deepseek-v4-pro',
      };

      const notice = classifier.classify(observation);
      expect(notice.cause).toBe('ENDPOINT_UNREACHABLE');
      expect(notice.remedy).toEqual({
        kind: 'network',
      });
      expect(notice.dedupeKey).toBe('ark-shared:ENDPOINT_UNREACHABLE');
    });

    it('classifies completedEmpty as RESPONSE_UNUSABLE', () => {
      const observation: FailureObservation = {
        transport: 'answered',
        completedEmpty: true,
        profileId: 'ark-shared',
        role: 'pet-image',
        model: 'deepseek-v4-pro',
      };

      const notice = classifier.classify(observation);
      expect(notice.cause).toBe('RESPONSE_UNUSABLE');
      expect(notice.remedy).toEqual({
        kind: 'role-assignment',
        role: 'pet-image',
      });
      expect(notice.dedupeKey).toBe('ark-shared:RESPONSE_UNUSABLE');
      expect(notice.providerDetail).toContain('zero tokens, no content, and no error');
    });

    it('classifies version ahead as CONFIGURATION_AHEAD', () => {
      const observation: FailureObservation = {
        transport: 'answered',
        providerCode: 'TABLE_VERSION_AHEAD',
        providerMessage: 'Version ahead of supported build',
        profileId: 'ark-shared',
        role: 'worker',
        model: 'deepseek-v4-pro',
      };

      const notice = classifier.classify(observation);
      expect(notice.cause).toBe('CONFIGURATION_AHEAD');
      expect(notice.remedy).toEqual({
        kind: 'product-update',
      });
    });

    it('sanitizes bearer tokens and API keys from providerDetail (I9)', () => {
      const observation: FailureObservation = {
        transport: 'answered',
        httpStatus: 401,
        providerMessage: 'Error with key sk-1234567890abcdefghijklmnop and Bearer eyJhbGciOiJIUzI1NiJ9.test and AIzaSyD123456789012345678901234567890',
        profileId: 'ark-shared',
        role: 'worker',
        model: 'deepseek-v4-pro',
      };

      const notice = classifier.classify(observation);
      expect(notice.providerDetail).not.toContain('sk-1234567890abcdefghijklmnop');
      expect(notice.providerDetail).toContain('sk-[REDACTED]');
      expect(notice.providerDetail).toContain('Bearer [REDACTED]');
      expect(notice.providerDetail).toContain('AIza[REDACTED]');
    });
  });

  describe('Standing Notice Registry & Deduplication', () => {
    it('deduplicates notices with the same dedupeKey and merges affected roles', async () => {
      const notice1 = classifier.classify({
        transport: 'answered',
        httpStatus: 401,
        providerMessage: 'Authentication failure',
        profileId: 'ark-shared',
        role: 'worker',
        model: 'model-a',
      });

      const notice2 = classifier.classify({
        transport: 'answered',
        httpStatus: 401,
        providerMessage: 'Authentication failure on another role',
        profileId: 'ark-shared',
        role: 'pet-text',
        model: 'model-b',
      });

      await registry.raise(notice1);
      expect(await registry.standing()).toHaveLength(1);

      // Second notice with same profile and cause updates the standing notice
      await registry.raise(notice2);
      const standing = await registry.standing();
      expect(standing).toHaveLength(1);
      expect(standing[0]?.roles).toContain('worker');
      expect(standing[0]?.roles).toContain('pet-text');
    });

    it('raises separate notices for different causes on the same profile', async () => {
      const noticeAuth = classifier.classify({
        transport: 'answered',
        httpStatus: 401,
        profileId: 'ark-shared',
        role: 'worker',
        model: 'model-a',
      });

      const noticeQuota = classifier.classify({
        transport: 'answered',
        httpStatus: 429,
        profileId: 'ark-shared',
        role: 'worker',
        model: 'model-a',
      });

      await registry.raise(noticeAuth);
      await registry.raise(noticeQuota);

      const standing = await registry.standing();
      expect(standing).toHaveLength(2);
      expect(standing.map((n) => n.cause).sort()).toEqual([
        'CREDENTIAL_REFUSED',
        'QUOTA_EXHAUSTED',
      ]);
    });

    it('withdraws notice when condition is repaired', async () => {
      const notice = classifier.classify({
        transport: 'answered',
        httpStatus: 401,
        profileId: 'ark-shared',
        role: 'worker',
        model: 'model-a',
      });

      await registry.raise(notice);
      expect(await registry.standing()).toHaveLength(1);

      await registry.withdraw(notice.dedupeKey);
      expect(await registry.standing()).toHaveLength(0);
    });

    it('withdraws all notices for a profile on profile repair', async () => {
      const notice1 = classifier.classify({
        transport: 'answered',
        httpStatus: 401,
        profileId: 'ark-shared',
        role: 'worker',
        model: 'model-a',
      });

      const notice2 = classifier.classify({
        transport: 'answered',
        httpStatus: 429,
        profileId: 'ark-shared',
        role: 'undo',
        model: 'model-a',
      });

      await registry.raise(notice1);
      await registry.raise(notice2);
      expect(await registry.standing()).toHaveLength(2);

      await registry.withdrawForProfile('ark-shared');
      expect(await registry.standing()).toHaveLength(0);
    });
  });
});
