import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CredentialStore } from '@desktop-assistant/credential-store';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/schema.js';
import { ProfileStore } from '../src/profile-store.js';
import { RoutingRegistry } from '../src/routing-registry.js';
import { FailureClassifier } from '../src/failure-classifier.js';
import { FailureRegistry } from '../src/failure-registry.js';
import { UsageAccounting } from '../src/usage-accounting.js';
import {
  ModelRequestDispatcher,
  type ProviderRunner,
} from '../src/dispatcher.js';
import { ProviderFailureError, RoutingError } from '../src/errors.js';
import type { ProviderProfile } from '@desktop-assistant/contracts/provider-profile';

describe('ModelRequestDispatcher', () => {
  let db: Database.Database;
  let profileStore: ProfileStore;
  let routingRegistry: RoutingRegistry;
  let failureClassifier: FailureClassifier;
  let failureRegistry: FailureRegistry;
  let usageAccounting: UsageAccounting;

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
      { name: 'flash-text', label: 'Flash Text', capabilities: ['text'] },
      { name: 'pro-tools', label: 'Pro Tools', capabilities: ['text', 'tools'] },
      { name: 'seed-vision', label: 'Seed Vision', capabilities: ['text', 'images'] },
    ],
    builtIn: false,
  };

  const mockCredentialStore = {
    presence: async () => ({ present: true, lastUpdated: new Date().toISOString() }),
    get: async () => 'secret-test-api-key',
  } as unknown as CredentialStore;

  beforeEach(async () => {
    db = new Database(':memory:');
    initializeDatabase(db);
    profileStore = new ProfileStore({ db, credentialStore: mockCredentialStore });
    await profileStore.save(sampleProfile);

    routingRegistry = new RoutingRegistry({
      db,
      profileStore,
      credentialStore: mockCredentialStore,
    });

    // Assign roles
    await routingRegistry.assign('pet-text', 'ark-shared', 'flash-text');
    await routingRegistry.assign('worker', 'ark-shared', 'pro-tools');
    await routingRegistry.assign('pet-image', 'ark-shared', 'seed-vision');

    failureClassifier = new FailureClassifier();
    failureRegistry = new FailureRegistry();
    usageAccounting = new UsageAccounting({ db, profileStore });

    // Set price for pro-tools
    await usageAccounting.setPrice({
      profileId: 'ark-shared',
      model: 'pro-tools',
      inputPricePerMillion: '1.000000',
      outputPricePerMillion: '2.000000',
      currency: 'USD',
      enteredAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    db.close();
  });

  it('successfully dispatches request, returns text, and records usage with cost', async () => {
    const mockRunner: ProviderRunner = async (input) => {
      expect(input.apiKey).toBe('secret-test-api-key');
      expect(input.route.model).toBe('pro-tools');
      return {
        text: 'Hello from Pro Tools!',
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
        stopReason: 'stop',
        httpStatus: 200,
      };
    };

    const dispatcher = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      credentialStore: mockCredentialStore,
      runner: mockRunner,
    });

    const result = await dispatcher.dispatch({
      jobId: 'job-success',
      requestId: 'req-success-1',
      role: 'worker',
      context: {
        messages: [{ role: 'user', content: 'Do something' }],
      },
    });

    expect(result.text).toBe('Hello from Pro Tools!');
    expect(result.usage?.totalTokens).toBe(1500);

    // Verify usage record was written
    const jobUsage = await usageAccounting.forJob('job-success');
    expect(jobUsage.records).toHaveLength(1);
    expect(jobUsage.records[0]?.cost).toBeDefined();
    expect(jobUsage.records[0]?.cost?.amount).toBe('0.002000');
  });

  it('detects empty response stream as failure (RESPONSE_UNUSABLE)', async () => {
    // SP-17 §4: Empty stream with 0 tokens and no error
    const emptyRunner: ProviderRunner = async () => ({
      text: '',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      httpStatus: 200,
    });

    const dispatcher = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      credentialStore: mockCredentialStore,
      runner: emptyRunner,
    });

    await expect(
      dispatcher.dispatch({
        jobId: 'job-empty',
        requestId: 'req-empty-1',
        role: 'worker',
        context: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      })
    ).rejects.toThrow(ProviderFailureError);

    const standing = await failureRegistry.standing();
    expect(standing).toHaveLength(1);
    expect(standing[0]?.cause).toBe('RESPONSE_UNUSABLE');
    expect(standing[0]?.remedy.kind).toBe('role-assignment');
  });

  it('detects empty text with positive reported input tokens as failure (RESPONSE_UNUSABLE)', async () => {
    // C3: Empty text even with positive reported input tokens is an unusable response
    const emptyWithTokensRunner: ProviderRunner = async () => ({
      text: '   ', // whitespace only
      usage: { inputTokens: 50, outputTokens: 0, totalTokens: 50 },
      httpStatus: 200,
    });

    const dispatcher = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      credentialStore: mockCredentialStore,
      runner: emptyWithTokensRunner,
    });

    await expect(
      dispatcher.dispatch({
        jobId: 'job-empty-tokens',
        requestId: 'req-empty-tokens-1',
        role: 'worker',
        context: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      })
    ).rejects.toThrow(ProviderFailureError);

    const standing = await failureRegistry.standing();
    expect(standing[0]?.cause).toBe('RESPONSE_UNUSABLE');
  });

  it('accepts tool-call response with empty text as a successful turn', async () => {
    const toolCallRunner: ProviderRunner = async () => ({
      text: '', // empty text is allowed if tool calls exist
      toolCalls: [
        { id: 'call-123', name: 'notion_query', arguments: '{"filter":"test"}' },
      ],
      usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
      httpStatus: 200,
    });

    const dispatcher = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      credentialStore: mockCredentialStore,
      runner: toolCallRunner,
    });

    const result = await dispatcher.dispatch({
      jobId: 'job-tool',
      requestId: 'req-tool-1',
      role: 'worker',
      context: {
        messages: [{ role: 'user', content: 'Query notion' }],
      },
    });

    expect(result.text).toBe('');
    expect(result.usage?.totalTokens).toBe(130);
  });

  it('fails closed with PROFILE_CREDENTIAL_ABSENT when credential store is omitted', async () => {
    const dispatcherWithoutCredStore = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      // credentialStore omitted
      runner: async () => {
        throw new Error('Runner should not be called');
      },
    });

    await expect(
      dispatcherWithoutCredStore.dispatch({
        jobId: 'job-nocred',
        requestId: 'req-nocred-1',
        role: 'worker',
        context: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      })
    ).rejects.toThrow(RoutingError);

    await expect(
      dispatcherWithoutCredStore.dispatch({
        jobId: 'job-nocred',
        requestId: 'req-nocred-1',
        role: 'worker',
        context: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROFILE_CREDENTIAL_ABSENT',
    });
  });

  it('classifies provider HTTP 401 as CREDENTIAL_REFUSED', async () => {
    const errorRunner: ProviderRunner = async () => {
      const err = new Error('HTTP 401 Unauthorized: Invalid API Key') as Error & {
        status: number;
        code: string;
      };
      err.status = 401;
      err.code = 'AuthenticationError';
      throw err;
    };

    const dispatcher = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      credentialStore: mockCredentialStore,
      runner: errorRunner,
    });

    await expect(
      dispatcher.dispatch({
        jobId: 'job-401',
        requestId: 'req-401-1',
        role: 'worker',
        context: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      })
    ).rejects.toThrow(ProviderFailureError);

    const standing = await failureRegistry.standing();
    expect(standing).toHaveLength(1);
    expect(standing[0]?.cause).toBe('CREDENTIAL_REFUSED');
    expect(standing[0]?.remedy.kind).toBe('profile-credential');
  });

  it('classifies provider HTTP 404 / UnsupportedModel as MODEL_UNAVAILABLE', async () => {
    const errorRunner: ProviderRunner = async () => {
      const err = new Error('HTTP 404: UnsupportedModel') as Error & {
        status: number;
        code: string;
      };
      err.status = 404;
      err.code = 'UnsupportedModel';
      throw err;
    };

    const dispatcher = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      credentialStore: mockCredentialStore,
      runner: errorRunner,
    });

    await expect(
      dispatcher.dispatch({
        jobId: 'job-404',
        requestId: 'req-404-1',
        role: 'worker',
        context: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      })
    ).rejects.toThrow(ProviderFailureError);

    const standing = await failureRegistry.standing();
    expect(standing).toHaveLength(1);
    expect(standing[0]?.cause).toBe('MODEL_UNAVAILABLE');
    expect(standing[0]?.remedy.kind).toBe('role-assignment');
  });

  it('classifies provider HTTP 429 as QUOTA_EXHAUSTED', async () => {
    const errorRunner: ProviderRunner = async () => {
      const err = new Error('HTTP 429: RateLimit / Insufficient Quota') as Error & {
        status: number;
        code: string;
      };
      err.status = 429;
      err.code = 'RateLimit';
      throw err;
    };

    const dispatcher = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      credentialStore: mockCredentialStore,
      runner: errorRunner,
    });

    await expect(
      dispatcher.dispatch({
        jobId: 'job-429',
        requestId: 'req-429-1',
        role: 'worker',
        context: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      })
    ).rejects.toThrow(ProviderFailureError);

    const standing = await failureRegistry.standing();
    expect(standing).toHaveLength(1);
    expect(standing[0]?.cause).toBe('QUOTA_EXHAUSTED');
    expect(standing[0]?.remedy.kind).toBe('provider-account');
  });

  it('detects attached image in message content and rejects non-vision route before sending', async () => {
    const mockRunner: ProviderRunner = async () => {
      throw new Error('Should not be called because capability check fails first');
    };

    const dispatcher = new ModelRequestDispatcher({
      routingRegistry,
      failureClassifier,
      failureRegistry,
      usageAccounting,
      credentialStore: mockCredentialStore,
      runner: mockRunner,
    });

    // Worker role has 'pro-tools' which lacks 'images' capability.
    // When sending an image-bearing request to worker, dispatcher must fail before runner.
    await expect(
      dispatcher.dispatch({
        jobId: 'job-img',
        requestId: 'req-img-1',
        role: 'worker',
        context: {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Here is an image' },
                { type: 'image', data: 'fake-base64', mimeType: 'image/png' },
              ],
            },
          ],
        },
      })
    ).rejects.toThrow(RoutingError);

    await expect(
      dispatcher.dispatch({
        jobId: 'job-img',
        requestId: 'req-img-1',
        role: 'worker',
        context: {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Here is an image' },
                { type: 'image', data: 'fake-base64', mimeType: 'image/png' },
              ],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'ROLE_CAPABILITY_UNMET',
    });
  });
});
