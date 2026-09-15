import type Database from 'better-sqlite3';
import type { ProviderProfile } from '@desktop-assistant/contracts/provider-profile';
import type { CredentialStore } from '@desktop-assistant/credential-store';
import { ProfileStoreError } from './errors.js';

export type ModelOffer = ProviderProfile['models'][number];

export interface ProfileStoreOptions {
  db: Database.Database;
  credentialStore?: CredentialStore | undefined;
  now?: (() => string) | undefined;
}

export class ProfileStore {
  private readonly db: Database.Database;
  private readonly credentialStore?: CredentialStore | undefined;
  private readonly now: () => string;

  constructor(options: ProfileStoreOptions) {
    this.db = options.db;
    this.credentialStore = options.credentialStore;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async save(profile: ProviderProfile): Promise<void> {
    this.validate(profile);

    const nowIso = this.now();
    const existing = await this.get(profile.id);
    const createdAt = existing ? this.getCreatedAt(profile.id) : nowIso;

    const stmt = this.db.prepare(`
      INSERT INTO provider_profile (
        id, profile_version, display_name, endpoint_json, credential_key, models_json, built_in, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        profile_version = excluded.profile_version,
        display_name = excluded.display_name,
        endpoint_json = excluded.endpoint_json,
        credential_key = excluded.credential_key,
        models_json = excluded.models_json,
        built_in = excluded.built_in,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      profile.id,
      profile.profileVersion,
      profile.displayName,
      JSON.stringify(profile.endpoint),
      profile.credential,
      JSON.stringify(profile.models),
      profile.builtIn ? 1 : 0,
      createdAt,
      nowIso
    );
  }

  async get(id: string): Promise<ProviderProfile | null> {
    const stmt = this.db.prepare(
      'SELECT id, profile_version, display_name, endpoint_json, credential_key, models_json, built_in FROM provider_profile WHERE id = ?'
    );
    const row = stmt.get(id) as
      | {
          id: string;
          profile_version: string;
          display_name: string;
          endpoint_json: string;
          credential_key: string;
          models_json: string;
          built_in: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    try {
      return {
        profileVersion: row.profile_version,
        id: row.id,
        displayName: row.display_name,
        endpoint: JSON.parse(row.endpoint_json),
        credential: row.credential_key,
        models: JSON.parse(row.models_json),
        builtIn: row.built_in === 1,
      };
    } catch {
      throw new ProfileStoreError({
        code: 'PROFILE_INVALID',
        profileId: row.id,
        detail: 'Stored profile JSON corrupted or invalid',
      });
    }
  }

  async list(): Promise<ProviderProfile[]> {
    const stmt = this.db.prepare(
      'SELECT id, profile_version, display_name, endpoint_json, credential_key, models_json, built_in FROM provider_profile ORDER BY created_at ASC'
    );
    const rows = stmt.all() as Array<{
      id: string;
      profile_version: string;
      display_name: string;
      endpoint_json: string;
      credential_key: string;
      models_json: string;
      built_in: number;
    }>;

    return rows.map((row) => ({
      profileVersion: row.profile_version,
      id: row.id,
      displayName: row.display_name,
      endpoint: JSON.parse(row.endpoint_json),
      credential: row.credential_key,
      models: JSON.parse(row.models_json),
      builtIn: row.built_in === 1,
    }));
  }

  async delete(id: string): Promise<void> {
    // I8: Prevent deleting profile while in use by routing table
    const row = this.db
      .prepare('SELECT assignments_json FROM routing_table WHERE singleton = 1')
      .get() as { assignments_json: string } | undefined;

    if (row) {
      try {
        const assignments = JSON.parse(row.assignments_json) as Record<
          string,
          { state: string; profileId?: string }
        >;
        const inUseRoles = Object.entries(assignments)
          .filter(([_, a]) => a.state === 'assigned' && a.profileId === id)
          .map(([role]) => role);

        if (inUseRoles.length > 0) {
          throw new ProfileStoreError({
            code: 'PROFILE_IN_USE',
            profileId: id,
            detail: `Cannot delete profile '${id}' while it is assigned to roles: ${inUseRoles.join(', ')}`,
          });
        }
      } catch (err) {
        if (err instanceof ProfileStoreError) throw err;
      }
    }

    const deleteTx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM provider_profile WHERE id = ?').run(id);
      this.db.prepare('DELETE FROM unit_price WHERE profile_id = ?').run(id);
    });
    deleteTx();
  }

  async getModelOffer(profileId: string, modelName: string): Promise<ModelOffer | null> {
    const profile = await this.get(profileId);
    if (!profile) {
      return null;
    }
    const offer = profile.models.find(
      (m: ModelOffer) => m.name.toLowerCase() === modelName.toLowerCase()
    );
    return offer ?? null;
  }

  async hasModel(profileId: string, modelName: string): Promise<boolean> {
    const offer = await this.getModelOffer(profileId, modelName);
    return offer !== null;
  }

  private getCreatedAt(id: string): string {
    const stmt = this.db.prepare('SELECT created_at FROM provider_profile WHERE id = ?');
    const row = stmt.get(id) as { created_at: string } | undefined;
    return row?.created_at ?? this.now();
  }

  private validate(profile: ProviderProfile): void {
    const PROFILE_ID_PATTERN = /^[a-z0-9:-]{1,64}$/;
    if (!profile.id || typeof profile.id !== 'string' || !PROFILE_ID_PATTERN.test(profile.id)) {
      throw new ProfileStoreError({
        code: 'PROFILE_INVALID',
        detail: `Profile ID must be a lowercase alphanumeric identifier with dashes/colons (1-64 chars)`,
      });
    }

    if (!profile.displayName || typeof profile.displayName !== 'string' || profile.displayName.trim().length === 0 || profile.displayName.length > 256) {
      throw new ProfileStoreError({
        code: 'PROFILE_INVALID',
        profileId: profile.id,
        detail: 'Display name must be a non-empty string up to 256 characters',
      });
    }

    if (profile.profileVersion !== '0.1.0') {
      if (profile.profileVersion > '0.1.0') {
        throw new ProfileStoreError({
          code: 'PROFILE_VERSION_AHEAD',
          profileId: profile.id,
          detail: `Profile version ${profile.profileVersion} is ahead of supported 0.1.0`,
        });
      }
      throw new ProfileStoreError({
        code: 'PROFILE_INVALID',
        profileId: profile.id,
        detail: `Unsupported profile version: ${profile.profileVersion}`,
      });
    }

    if (!profile.endpoint || typeof profile.endpoint !== 'object') {
      throw new ProfileStoreError({
        code: 'PROFILE_INVALID',
        profileId: profile.id,
        detail: 'Profile endpoint descriptor is required',
      });
    }

    try {
      const parsedUrl = new URL(profile.endpoint.address);
      if (parsedUrl.protocol !== 'https:') {
        throw 0;
      }
    } catch {
      throw new ProfileStoreError({
        code: 'PROFILE_INVALID',
        profileId: profile.id,
        detail: 'Endpoint address must be an absolute https:// URL',
      });
    }

    if (profile.endpoint.headers) {
      for (const [key, val] of Object.entries(profile.endpoint.headers)) {
        if (key.toLowerCase() === 'authorization') {
          throw new ProfileStoreError({
            code: 'PROFILE_INVALID',
            profileId: profile.id,
            detail: 'Custom headers cannot override the Authorization header',
          });
        }
        if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') {
          throw new ProfileStoreError({
            code: 'PROFILE_INVALID',
            profileId: profile.id,
            detail: `Invalid header value for key '${key}'`,
          });
        }
      }
    }

    const supportedDialects = ['openai-completions', 'anthropic-messages', 'google-generative'];
    if (!supportedDialects.includes(profile.endpoint.dialect)) {
      throw new ProfileStoreError({
        code: 'DIALECT_UNSUPPORTED',
        profileId: profile.id,
        detail: `Unsupported completion dialect: ${profile.endpoint.dialect}`,
      });
    }

    if (!profile.credential || typeof profile.credential !== 'string') {
      throw new ProfileStoreError({
        code: 'CREDENTIAL_KEY_INVALID',
        profileId: profile.id,
        detail: 'Credential reference key is required',
      });
    }

    // Invariant: credential MUST match normative secure storage key pattern (INV-AG-08)
    const CREDENTIAL_KEY_PATTERN = /^(?:llm:provider:[a-z0-9-]+:api_key|provider:[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+)$/;
    if (!CREDENTIAL_KEY_PATTERN.test(profile.credential)) {
      throw new ProfileStoreError({
        code: 'CREDENTIAL_KEY_INVALID',
        profileId: profile.id,
        detail: `Credential '${profile.credential}' must match the secure storage key pattern (e.g. llm:provider:<identity>:api_key)`,
      });
    }

    if (!Array.isArray(profile.models) || profile.models.length === 0) {
      throw new ProfileStoreError({
        code: 'PROFILE_INVALID',
        profileId: profile.id,
        detail: 'Profile must offer at least one model',
      });
    }

    const modelNames = new Set<string>();
    const VALID_CAPABILITIES = new Set(['text', 'images', 'reasoning', 'tools']);

    for (const model of profile.models) {
      if (!model.name || typeof model.name !== 'string') {
        throw new ProfileStoreError({
          code: 'PROFILE_INVALID',
          profileId: profile.id,
          detail: 'Each model must have a valid name identifier',
        });
      }
      const lower = model.name.toLowerCase();
      if (modelNames.has(lower)) {
        throw new ProfileStoreError({
          code: 'PROFILE_INVALID',
          profileId: profile.id,
          detail: `Duplicate model name '${model.name}' in profile`,
        });
      }
      modelNames.add(lower);
      if (!model.label || typeof model.label !== 'string' || model.label.trim().length === 0 || model.label.length > 256) {
        throw new ProfileStoreError({
          code: 'PROFILE_INVALID',
          profileId: profile.id,
          detail: `Model '${model.name}' label must be a non-empty string up to 256 characters`,
        });
      }

      if (model.minimumImagePixels !== undefined) {
        if (!Number.isInteger(model.minimumImagePixels) || model.minimumImagePixels < 14) {
          throw new ProfileStoreError({
            code: 'PROFILE_INVALID',
            profileId: profile.id,
            detail: `minimumImagePixels for model '${model.name}' must be an integer >= 14`,
          });
        }
      }

      if (!Array.isArray(model.capabilities) || model.capabilities.length === 0) {
        throw new ProfileStoreError({
          code: 'PROFILE_INVALID',
          profileId: profile.id,
          detail: `Model ${model.name} must declare at least one capability`,
        });
      }
      const uniqueCaps = new Set<string>();
      for (const cap of model.capabilities) {
        if (uniqueCaps.has(cap)) {
          throw new ProfileStoreError({
            code: 'PROFILE_INVALID',
            profileId: profile.id,
            detail: `Duplicate capability '${cap}' declared by model '${model.name}'`,
          });
        }
        uniqueCaps.add(cap);
        if (!VALID_CAPABILITIES.has(cap)) {
          throw new ProfileStoreError({
            code: 'PROFILE_INVALID',
            profileId: profile.id,
            detail: `Unknown capability '${cap}' declared by model '${model.name}'`,
          });
        }
      }
    }
}
}
