import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/schema.js';
import { ProfileStore } from '../src/profile-store.js';
import { ProfileStoreError } from '../src/errors.js';
import type { ProviderProfile } from '@desktop-assistant/contracts/provider-profile';

describe('ProfileStore', () => {
  let db: Database.Database;
  let store: ProfileStore;

  const validProfile: ProviderProfile = {
    profileVersion: '0.1.0',
    id: 'test-provider',
    displayName: 'Test Provider',
    endpoint: {
      address: 'https://api.example.com/v1',
      dialect: 'openai-completions',
    },
    credential: 'llm:provider:test-provider:api_key',
    models: [
      {
        name: 'model-a',
        label: 'Model A',
        capabilities: ['text', 'tools'],
      },
      {
        name: 'model-vision',
        label: 'Model Vision',
        capabilities: ['text', 'images'],
      },
    ],
    builtIn: false,
  };

  beforeEach(() => {
    db = new Database(':memory:');
    initializeDatabase(db);
    store = new ProfileStore({ db });
  });

  afterEach(() => {
    db.close();
  });

  it('saves, gets, and lists provider profiles', async () => {
    await store.save(validProfile);

    const retrieved = await store.get('test-provider');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('test-provider');
    expect(retrieved?.displayName).toBe('Test Provider');
    expect(retrieved?.endpoint.address).toBe('https://api.example.com/v1');
    expect(retrieved?.endpoint.dialect).toBe('openai-completions');
    expect(retrieved?.models).toHaveLength(2);
    expect(retrieved?.builtIn).toBe(false);

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('test-provider');

    expect(await store.hasModel('test-provider', 'model-a')).toBe(true);
    expect(await store.hasModel('test-provider', 'non-existent')).toBe(false);
  });

  it('updates an existing profile', async () => {
    await store.save(validProfile);

    const updated: ProviderProfile = {
      ...validProfile,
      displayName: 'Updated Display Name',
      builtIn: true,
    };
    await store.save(updated);

    const retrieved = await store.get('test-provider');
    expect(retrieved?.displayName).toBe('Updated Display Name');
    expect(retrieved?.builtIn).toBe(true);
  });

  it('deletes an unassigned profile and cascades unit prices', async () => {
    await store.save(validProfile);
    expect(await store.get('test-provider')).not.toBeNull();

    await store.delete('test-provider');
    expect(await store.get('test-provider')).toBeNull();
    expect(await store.list()).toHaveLength(0);
  });

  it('rejects deleting a profile while in use by routing table (PROFILE_IN_USE)', async () => {
    await store.save(validProfile);

    // Assign role to this profile in routing_table
    const assignments = {
      worker: { state: 'assigned', profileId: 'test-provider', model: 'model-a' },
    };
    db.prepare(`
      INSERT INTO routing_table (singleton, table_version, assignments_json, updated_at)
      VALUES (1, '1.0.0', ?, ?)
    `).run(JSON.stringify(assignments), new Date().toISOString());

    await expect(store.delete('test-provider')).rejects.toThrow(ProfileStoreError);
    await expect(store.delete('test-provider')).rejects.toMatchObject({
      code: 'PROFILE_IN_USE',
      profileId: 'test-provider',
    });
  });

  it('rejects profiles with invalid endpoint URLs', async () => {
    const invalidEndpoint: ProviderProfile = {
      ...validProfile,
      endpoint: {
        address: 'http://insecure.example.com',
        dialect: 'openai-completions',
      },
    };

    await expect(store.save(invalidEndpoint)).rejects.toThrow(ProfileStoreError);
    await expect(store.save(invalidEndpoint)).rejects.toMatchObject({
      code: 'PROFILE_INVALID',
    });
  });

  it('rejects unsupported completion dialects', async () => {
    const invalidDialect = {
      ...validProfile,
      endpoint: {
        address: 'https://api.example.com',
        dialect: 'unsupported-dialect' as unknown as ProviderProfile['endpoint']['dialect'],
      },
    };

    await expect(store.save(invalidDialect)).rejects.toThrow(ProfileStoreError);
    await expect(store.save(invalidDialect)).rejects.toMatchObject({
      code: 'DIALECT_UNSUPPORTED',
    });
  });

  it('rejects raw API keys/secrets placed in credential field (INV-AG-08)', async () => {
    const rawKeys = [
      'sk-proj-1234567890abcdef',
      'AIzaSyB1234567890abcdef',
      'ghp_1234567890abcdef',
      'xoxb-1234567890',
      'raw-secret-string',
    ];

    for (const key of rawKeys) {
      const rawSecretProfile: ProviderProfile = {
        ...validProfile,
        credential: key,
      };
      await expect(store.save(rawSecretProfile)).rejects.toThrow(ProfileStoreError);
      await expect(store.save(rawSecretProfile)).rejects.toMatchObject({
        code: 'CREDENTIAL_KEY_INVALID',
      });
    }
  });

  it('rejects custom headers attempting to override Authorization', async () => {
    const overrideHeaderProfile: ProviderProfile = {
      ...validProfile,
      endpoint: {
        ...validProfile.endpoint,
        headers: {
          Authorization: 'Bearer attacker-injected-token',
        },
      },
    };

    await expect(store.save(overrideHeaderProfile)).rejects.toThrow(ProfileStoreError);
    await expect(store.save(overrideHeaderProfile)).rejects.toMatchObject({
      code: 'PROFILE_INVALID',
    });
  });

  it('rejects profile version ahead of current build', async () => {
    const aheadProfile: ProviderProfile = {
      ...validProfile,
      profileVersion: '0.2.0',
    };

    await expect(store.save(aheadProfile)).rejects.toThrow(ProfileStoreError);
    await expect(store.save(aheadProfile)).rejects.toMatchObject({
      code: 'PROFILE_VERSION_AHEAD',
    });
  });

  it('rejects profiles with empty models list', async () => {
    const noModelsProfile = {
      ...validProfile,
      models: [] as unknown as ProviderProfile['models'],
    };

    await expect(store.save(noModelsProfile)).rejects.toThrow(ProfileStoreError);
    await expect(store.save(noModelsProfile)).rejects.toMatchObject({
      code: 'PROFILE_INVALID',
    });
  });
});
