import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { CredentialStore } from '@desktop-assistant/credential-store';
import { initializeDatabase } from '../src/schema.js';
import { ProfileStore } from '../src/profile-store.js';
import { RoutingRegistry } from '../src/routing-registry.js';
import { RoutingError } from '../src/errors.js';
import type { FailureRegistry } from '../src/failure-registry.js';
import type { ProviderProfile } from '@desktop-assistant/contracts/provider-profile';

describe('RoutingRegistry', () => {
  let db: Database.Database;
  let profileStore: ProfileStore;
  let registry: RoutingRegistry;

  const mockProfileWithVision: ProviderProfile = {
    profileVersion: '0.1.0',
    id: 'profile-multi',
    displayName: 'Multi Model Provider',
    endpoint: {
      address: 'https://api.example.com/v1',
      dialect: 'openai-completions',
    },
    credential: 'llm:provider:profile-multi:api_key',
    models: [
      {
        name: 'model-cheap-flash',
        label: 'Cheap Flash',
        capabilities: ['text'],
      },
      {
        name: 'model-strong-pro',
        label: 'Strong Pro',
        capabilities: ['text', 'tools'],
      },
      {
        name: 'model-vision',
        label: 'Vision Model',
        capabilities: ['text', 'images'],
      },
    ],
    builtIn: false,
  };

  const mockProfileTextOnly: ProviderProfile = {
    profileVersion: '0.1.0',
    id: 'profile-text-only',
    displayName: 'Text Only Provider',
    endpoint: {
      address: 'https://api.example.com/v1',
      dialect: 'openai-completions',
    },
    credential: 'llm:provider:profile-text-only:api_key',
    models: [
      {
        name: 'model-text',
        label: 'Text Model',
        capabilities: ['text', 'tools'],
      },
    ],
    builtIn: false,
  };

  const mockShippedProfile: ProviderProfile = {
    profileVersion: '0.1.0',
    id: 'shipped:byteplus-ark',
    displayName: 'BytePlus Ark',
    endpoint: {
      address: 'https://api.example.com/v1',
      dialect: 'openai-completions',
    },
    credential: 'llm:provider:shipped-ark:api_key',
    models: [
      {
        name: 'deepseek-v4-flash',
        label: 'DeepSeek Flash',
        capabilities: ['text'],
      },
      {
        name: 'deepseek-v4-pro',
        label: 'DeepSeek Pro',
        capabilities: ['text', 'tools'],
      },
      {
        name: 'seed-2-0-pro',
        label: 'Seed 2.0 Pro',
        capabilities: ['text', 'images', 'tools'],
      },
    ],
    builtIn: true,
  };

  beforeEach(async () => {
    db = new Database(':memory:');
    initializeDatabase(db);
    profileStore = new ProfileStore({ db });
    await profileStore.save(mockProfileWithVision);
    await profileStore.save(mockProfileTextOnly);
    await profileStore.save(mockShippedProfile);

    registry = new RoutingRegistry({
      db,
      profileStore,
    });
  });

  afterEach(() => {
    db.close();
  });

  it('initializes with all six core roles in unassigned state', async () => {
    const table = await registry.table();
    expect(table.tableVersion).toBe('1.0.0');
    expect(table.assignments['pet-text'].state).toBe('unassigned');
    expect(table.assignments['pet-image'].state).toBe('unassigned');
    expect(table.assignments.worker.state).toBe('unassigned');
    expect(table.assignments['rule-elicitation'].state).toBe('unassigned');
    expect(table.assignments.undo.state).toBe('unassigned');
    expect(table.assignments['risk-judge'].state).toBe('unassigned');
  });

  describe('Capability Gating', () => {
    it('rejects assigning text-only model to pet-image with ROLE_CAPABILITY_UNMET', async () => {
      const outcome = await registry.assign(
        'pet-image',
        'profile-multi',
        'model-cheap-flash'
      );
      expect(outcome.ok).toBe(false);
      if (!outcome.ok && 'detail' in outcome) {
        expect(outcome.error).toBe('ROLE_CAPABILITY_UNMET');
        expect(outcome.detail).toContain("requires declared 'images' input capability");
      }
    });

    it('rejects assigning model without tools to worker or undo role', async () => {
      const outcome = await registry.assign(
        'worker',
        'profile-multi',
        'model-cheap-flash' // text-only, no tools
      );
      expect(outcome.ok).toBe(false);
      if (!outcome.ok && 'detail' in outcome) {
        expect(outcome.error).toBe('ROLE_CAPABILITY_UNMET');
        expect(outcome.detail).toContain("requires declared 'tools' capability");
      }
    });

    it('accepts assigning model satisfying capabilities', async () => {
      const outcome = await registry.assign(
        'pet-image',
        'profile-multi',
        'model-vision'
      );
      expect(outcome.ok).toBe(true);

      const table = await registry.table();
      expect(table.assignments['pet-image'].state).toBe('assigned');
      const petImage = table.assignments['pet-image'];
      if (petImage.state === 'assigned') {
        expect(petImage.model).toBe('model-vision');
      }
    });

    it('reports image-route as unavailable when profile is edited to lose image capability', async () => {
      await registry.assign('pet-image', 'profile-multi', 'model-vision');
      expect((await registry.imageRouteState()).available).toBe(true);

      // User edits profile so model-vision no longer declares images
      const modifiedProfile: ProviderProfile = {
        ...mockProfileWithVision,
        models: [
          {
            name: 'model-cheap-flash',
            label: 'Cheap Flash',
            capabilities: ['text'],
          },
          {
            name: 'model-strong-pro',
            label: 'Strong Pro',
            capabilities: ['text', 'tools'],
          },
          {
            name: 'model-vision',
            label: 'Vision Downgraded',
            capabilities: ['text'],
          },
        ],
      };
      await profileStore.save(modifiedProfile);

      const state = await registry.imageRouteState();
      expect(state.available).toBe(false);
      expect(state.reason).toBe('ROLE_CAPABILITY_UNMET');

      // Resolving pet-image also fails before request dispatch
      await expect(
        registry.resolve('pet-image', { carriesImages: true })
      ).rejects.toMatchObject({
        code: 'ROLE_CAPABILITY_UNMET',
      });
    });
  });

  describe('Suitability & Unmeasured Grounding', () => {
    it('refuses cheap model for rule-elicitation in shipped profile (MODEL_MEASURED_UNSUITABLE)', async () => {
      const outcome = await registry.assign(
        'rule-elicitation',
        'shipped:byteplus-ark',
        'deepseek-v4-flash'
      );
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error).toBe('MODEL_MEASURED_UNSUITABLE');
      }
    });

    it('filters out measured unsuitable models from choices in shipped profile', async () => {
      const choices = await registry.choices('rule-elicitation');
      const shippedChoices = choices.filter((c) => c.profileId === 'shipped:byteplus-ark');
      expect(shippedChoices.some((c) => c.model === 'deepseek-v4-flash')).toBe(false);
      expect(shippedChoices.some((c) => c.model === 'deepseek-v4-pro')).toBe(true);
    });

    it('requires acknowledgement for unmeasured custom models in rule-elicitation', async () => {
      // 1. Without acknowledgement -> returns UNMEASURED_NEEDS_ACKNOWLEDGEMENT
      const outcome1 = await registry.assign(
        'rule-elicitation',
        'profile-multi',
        'model-strong-pro'
      );
      expect(outcome1.ok).toBe(false);
      if (!outcome1.ok && 'measured' in outcome1) {
        expect(outcome1.error).toBe('UNMEASURED_NEEDS_ACKNOWLEDGEMENT');
        expect(outcome1.measured).toBeDefined();
      }

      // 2. With acknowledgement -> succeeds
      const outcome2 = await registry.assign(
        'rule-elicitation',
        'profile-multi',
        'model-strong-pro',
        true
      );
      expect(outcome2.ok).toBe(true);

      const table = await registry.table();
      const elicitation = table.assignments['rule-elicitation'];
      if (elicitation.state === 'assigned') {
        expect(elicitation.acknowledgedUnmeasured).toBe(true);
      }
    });
  });

  describe('Default Proposals', () => {
    it('proposes all 6 roles when profile offers a vision model', async () => {
      const proposed = await registry.proposeDefaults('profile-multi');
      expect(proposed.assignments['pet-text'].state).toBe('assigned');
      expect(proposed.assignments['pet-image'].state).toBe('assigned');
      expect(proposed.assignments.worker.state).toBe('assigned');
      expect(proposed.assignments['rule-elicitation'].state).toBe('assigned');
      expect(proposed.assignments.undo.state).toBe('assigned');
      expect(proposed.assignments['risk-judge'].state).toBe('assigned');

      const proposedPetImage = proposed.assignments['pet-image'];
      if (proposedPetImage.state === 'assigned') {
        expect(proposedPetImage.model).toBe('model-vision');
      }
    });

    it('proposes 5 text roles and leaves pet-image unassigned when profile lacks vision model', async () => {
      const proposed = await registry.proposeDefaults('profile-text-only');
      expect(proposed.assignments['pet-text'].state).toBe('assigned');
      expect(proposed.assignments.worker.state).toBe('assigned');
      expect(proposed.assignments['rule-elicitation'].state).toBe('assigned');
      expect(proposed.assignments.undo.state).toBe('assigned');
      expect(proposed.assignments['risk-judge'].state).toBe('assigned');

      expect(proposed.assignments['pet-image'].state).toBe('unassigned');
    });
  });

  describe('Job Routing Snapshot (Mid-job change immunity)', () => {
    it('freezes routing for a running job even if table assignment changes', async () => {
      await registry.assign('worker', 'shipped:byteplus-ark', 'deepseek-v4-pro');

      // 1. Job 1 resolves worker role -> deepseek-v4-pro
      const res1 = await registry.resolve(
        'worker',
        { carriesImages: false },
        'job-running-123'
      );
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        expect(res1.model).toBe('deepseek-v4-pro');
      }

      // 2. User reassigns worker role in settings to a different model
      await registry.assign('worker', 'profile-multi', 'model-strong-pro', true);

      // 3. Job 1 resolves worker role again -> STILL resolves to deepseek-v4-pro!
      const res1Again = await registry.resolve(
        'worker',
        { carriesImages: false },
        'job-running-123'
      );
      expect(res1Again.ok).toBe(true);
      if (res1Again.ok) {
        expect(res1Again.model).toBe('deepseek-v4-pro');
      }

      // 4. New Job 2 resolves worker role -> resolves to the NEW model
      const res2 = await registry.resolve(
        'worker',
        { carriesImages: false },
        'job-new-456'
      );
      expect(res2.ok).toBe(true);
      if (res2.ok) {
        expect(res2.model).toBe('model-strong-pro');
      }
    });
  });

  describe('Device Credential Absence (No Retargeting)', () => {
    it('throws PROFILE_CREDENTIAL_ABSENT and does not retarget when credential is missing locally', async () => {
      const mockCredentialStore = {
        presence: async (key: string) => {
          if (key.includes('profile-text-only')) {
            return { present: false, lastUpdated: null };
          }
          return { present: true, lastUpdated: new Date().toISOString() };
        },
      } as unknown as CredentialStore;

      const registryWithCreds = new RoutingRegistry({
        db,
        profileStore,
        credentialStore: mockCredentialStore,
      });

      await registryWithCreds.assign('worker', 'profile-text-only', 'model-text', true);

      // Resolving worker must fail citing absent credential; never retarget to shipped:byteplus-ark
      await expect(
        registryWithCreds.resolve('worker', { carriesImages: false })
      ).rejects.toThrow(RoutingError);

      await expect(
        registryWithCreds.resolve('worker', { carriesImages: false })
      ).rejects.toMatchObject({
        code: 'PROFILE_CREDENTIAL_ABSENT',
        role: 'worker',
        profileId: 'profile-text-only',
      });
    });
  });

  describe('Forward Version Rejection & Notice (I11)', () => {
    it('rejects forward version table and raises CONFIGURATION_AHEAD notice', async () => {
      const failureRegistry = {
        raise: vi.fn(),
      } as unknown as FailureRegistry;
      const aheadRegistry = new RoutingRegistry({
        db,
        profileStore,
        failureRegistry,
      });

      // Manually set table_version = 2.0.0
      db.prepare(`
        INSERT INTO routing_table (singleton, table_version, assignments_json, updated_at)
        VALUES (1, '2.0.0', '{}', ?)
        ON CONFLICT(singleton) DO UPDATE SET table_version = '2.0.0'
      `).run(new Date().toISOString());

      await expect(aheadRegistry.table()).rejects.toThrow(RoutingError);
      await expect(aheadRegistry.table()).rejects.toMatchObject({
        code: 'TABLE_VERSION_AHEAD',
      });

      expect(failureRegistry.raise).toHaveBeenCalledWith(
        expect.objectContaining({
          cause: 'CONFIGURATION_AHEAD',
          remedy: { kind: 'product-update' },
        })
      );
    });
  });
});
