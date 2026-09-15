import type Database from 'better-sqlite3';
import type { RoutingTable, Assignment } from '@desktop-assistant/contracts/role-routing';
import type { CredentialStore } from '@desktop-assistant/credential-store';
import type { FailureRegistry } from './failure-registry.js';
import {
  CORE_ROLES,
  type RoleKey,
  type InputShape,
  type AssignOutcome,
  type Resolution,
  type ImageRouteState,
  type SuitabilityVerdict,
} from './types.js';
import { ProfileStore, type ModelOffer } from './profile-store.js';
import { RoutingError } from './errors.js';
import {
  isModelMeasuredUnsuitable,
  findSuitabilityVerdict,
  getMeasuredVerdictsForRole,
} from './suitability.js';

export interface RoutingRegistryOptions {
  db: Database.Database;
  profileStore: ProfileStore;
  credentialStore?: CredentialStore | undefined;
  failureRegistry?: FailureRegistry | undefined;
  now?: (() => string) | undefined;
}

export class RoutingRegistry {
  private readonly db: Database.Database;
  private readonly profileStore: ProfileStore;
  private readonly credentialStore?: CredentialStore | undefined;
  private readonly failureRegistry?: FailureRegistry | undefined;
  private readonly now: () => string;
  constructor(options: RoutingRegistryOptions) {
    this.db = options.db;
    this.profileStore = options.profileStore;
    this.credentialStore = options.credentialStore;
    this.failureRegistry = options.failureRegistry;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async table(): Promise<RoutingTable> {
    const stmt = this.db.prepare(
      'SELECT table_version, assignments_json FROM routing_table WHERE singleton = 1'
    );
    const row = stmt.get() as
      | { table_version: string; assignments_json: string }
      | undefined;

    if (!row) {
      return this.createEmptyTable();
    }

    if (row.table_version > '1.0.0') {
      if (this.failureRegistry) {
        await this.failureRegistry.raise({
          cause: 'CONFIGURATION_AHEAD',
          profileId: 'system:configuration',
          roles: ['worker'],
          remedy: { kind: 'product-update' },
          providerDetail: `Routing table version ${row.table_version} is ahead of this build (1.0.0). Please update the application.`,
          observedAt: this.now(),
          dedupeKey: 'system:configuration:CONFIGURATION_AHEAD',
        });
      }
      throw new RoutingError({
        code: 'TABLE_VERSION_AHEAD',
        detail: `Routing table version ${row.table_version} is ahead of supported 1.0.0`,
      });
    }

    let assignments: Record<string, Assignment>;
    try {
      assignments = JSON.parse(row.assignments_json) as Record<string, Assignment>;
    } catch {
      throw new RoutingError({
        code: 'ROLE_UNASSIGNED',
        detail: 'Stored routing table JSON corrupted or invalid',
      });
    }

    // Invariant: every core role must be present in the assignments map
    for (const role of CORE_ROLES) {
      if (!assignments[role]) {
        assignments[role] = { state: 'unassigned' };
      }
    }

    return {
      tableVersion: row.table_version,
      assignments: assignments as RoutingTable['assignments'],
    };
  }

  async assign(
    role: RoleKey,
    profileId: string,
    model: string,
    acknowledgeUnmeasured?: boolean
  ): Promise<AssignOutcome> {
    const profile = await this.profileStore.get(profileId);
    if (!profile) {
      return {
        ok: false,
        error: 'PROFILE_UNKNOWN',
        detail: `Profile '${profileId}' does not exist`,
      };
    }

    const offer = await this.profileStore.getModelOffer(profileId, model);
    if (!offer) {
      return {
        ok: false,
        error: 'MODEL_NOT_OFFERED',
        detail: `Model '${model}' is not offered by profile '${profileId}'`,
      };
    }

    // 1. Enforce declared capability requirement
    if (role === 'pet-image') {
      if (!offer.capabilities.includes('images')) {
        return {
          ok: false,
          error: 'ROLE_CAPABILITY_UNMET',
          detail: `Role 'pet-image' requires declared 'images' input capability, but model '${model}' offers [${offer.capabilities.join(', ')}]`,
        };
      }
    }

    if (role === 'worker' || role === 'undo') {
      if (!offer.capabilities.includes('tools')) {
        return {
          ok: false,
          error: 'ROLE_CAPABILITY_UNMET',
          detail: `Role '${role}' requires declared 'tools' capability, but model '${model}' offers [${offer.capabilities.join(', ')}]`,
        };
      }
    }

    // All roles require text
    if (!offer.capabilities.includes('text')) {
      return {
        ok: false,
        error: 'ROLE_CAPABILITY_UNMET',
        detail: `Role '${role}' requires declared 'text' capability, but model '${model}' offers [${offer.capabilities.join(', ')}]`,
      };
    }

    // 2. Suitability check
    if (isModelMeasuredUnsuitable(role, profileId, model)) {
      if (profileId.startsWith('shipped:')) {
        return {
          ok: false,
          error: 'MODEL_MEASURED_UNSUITABLE',
          detail: `Model '${model}' is measured as unsuitable for role '${role}' and cannot be assigned in a shipped profile`,
        };
      }
    }

    // 3. Unmeasured requirement acknowledgement for rule-elicitation and undo
    if (role === 'rule-elicitation' || role === 'undo') {
      const verdict = findSuitabilityVerdict(role, profileId, model);
      if (!verdict) {
        if (!acknowledgeUnmeasured) {
          return {
            ok: false,
            error: 'UNMEASURED_NEEDS_ACKNOWLEDGEMENT',
            measured: getMeasuredVerdictsForRole(role),
          };
        }
      }
    }

    // 4. Save assignment in a transaction to prevent concurrent update races
    const saveTx = this.db.transaction(() => {
      const currentStmt = this.db.prepare(
        'SELECT table_version, assignments_json FROM routing_table WHERE singleton = 1'
      );
      const row = currentStmt.get() as { table_version: string; assignments_json: string } | undefined;
      const currentAssignments = row ? JSON.parse(row.assignments_json) : {};
      const newAssignments = {
        ...currentAssignments,
        [role]: {
          state: 'assigned' as const,
          profileId,
          model,
          setAt: this.now(),
          ...(acknowledgeUnmeasured ? { acknowledgedUnmeasured: true } : {}),
        },
      };

      const stmt = this.db.prepare(`
        INSERT INTO routing_table (singleton, table_version, assignments_json, updated_at)
        VALUES (1, '1.0.0', ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          table_version = excluded.table_version,
          assignments_json = excluded.assignments_json,
          updated_at = excluded.updated_at
      `);
      stmt.run(JSON.stringify(newAssignments), this.now());
    });

    saveTx();
    return { ok: true };
  }
  async clear(role: RoleKey): Promise<void> {
    const clearTx = this.db.transaction(() => {
      const currentStmt = this.db.prepare(
        'SELECT table_version, assignments_json FROM routing_table WHERE singleton = 1'
      );
      const row = currentStmt.get() as { table_version: string; assignments_json: string } | undefined;
      const currentAssignments = row ? JSON.parse(row.assignments_json) : {};
      const newAssignments = {
        ...currentAssignments,
        [role]: {
          state: 'unassigned' as const,
        },
      };

      const stmt = this.db.prepare(`
        INSERT INTO routing_table (singleton, table_version, assignments_json, updated_at)
        VALUES (1, '1.0.0', ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          assignments_json = excluded.assignments_json,
          updated_at = excluded.updated_at
      `);
      stmt.run(JSON.stringify(newAssignments), this.now());
    });
    clearTx();
  }

  async resolve(role: RoleKey, shape: InputShape, jobId?: string): Promise<Resolution> {
    // 1. Check job routing snapshot first (freeze assignment mid-job)
    if (jobId) {
      const snapshot = this.getJobSnapshot(jobId, role);
      if (snapshot) {
        return this.resolveAssignment(role, snapshot.profileId, snapshot.model, shape);
      }
    }

    // 2. Resolve from routing table
    const currentTable = await this.table();
    const assignment = currentTable.assignments[role];

    if (!assignment || assignment.state !== 'assigned' || !assignment.profileId || !assignment.model) {
      throw new RoutingError({
        code: 'ROLE_UNASSIGNED',
        role,
        detail: `Role '${role}' is unassigned. Please configure model routing in Settings.`,
      });
    }

    const res = await this.resolveAssignment(role, assignment.profileId, assignment.model, shape);

    // 3. Persist job routing snapshot atomically if jobId provided
    if (jobId && res.ok) {
      const snapTx = this.db.transaction(() => {
        const existing = this.getJobSnapshot(jobId, role);
        if (!existing) {
          this.recordJobSnapshot(jobId, role, res.profileId, res.model);
        }
      });
      snapTx();

      // Re-read snapshot in case a concurrent request won the write race
      const committed = this.getJobSnapshot(jobId, role);
      if (committed && (committed.profileId !== res.profileId || committed.model !== res.model)) {
        return this.resolveAssignment(role, committed.profileId, committed.model, shape);
      }
    }

    return res;
  }

  async imageRouteState(): Promise<ImageRouteState> {
    const currentTable = await this.table();
    const assignment = currentTable.assignments['pet-image'];

    if (!assignment || assignment.state !== 'assigned' || !assignment.profileId || !assignment.model) {
      return { available: false, reason: 'ROLE_UNASSIGNED' };
    }

    const profile = await this.profileStore.get(assignment.profileId);
    if (!profile) {
      return { available: false, reason: 'PROFILE_UNKNOWN' };
    }

    const offer = await this.profileStore.getModelOffer(assignment.profileId, assignment.model);
    if (!offer) {
      return { available: false, reason: 'MODEL_NOT_OFFERED' };
    }

    if (!offer.capabilities.includes('images')) {
      return { available: false, reason: 'ROLE_CAPABILITY_UNMET' };
    }

    if (this.credentialStore) {
      const presence = await this.credentialStore.presence(profile.credential);
      if (!presence.present) {
        return { available: false, reason: 'PROFILE_CREDENTIAL_ABSENT' };
      }
    }

    return { available: true };
  }

  async proposeDefaults(profileId: string): Promise<RoutingTable> {
    const profile = await this.profileStore.get(profileId);
    if (!profile) {
      throw new RoutingError({
        code: 'PROFILE_UNKNOWN',
        profileId,
        detail: `Profile '${profileId}' not found`,
      });
    }

    const models = profile.models;
    const visionModel = models.find((m: ModelOffer) => m.capabilities.includes('images'));
    const toolModel = models.find((m: ModelOffer) => m.capabilities.includes('tools')) ?? models[0]!;
    const cheapModel =
      models.find(
        (m: ModelOffer) =>
          m.name.toLowerCase().includes('flash') ||
          m.name.toLowerCase().includes('haiku') ||
          m.name.toLowerCase().includes('mini') ||
          m.name.toLowerCase().includes('cheap')
      ) ?? models[0]!;
    const strongModel =
      models.find(
        (m: ModelOffer) =>
          m.name.toLowerCase().includes('pro') ||
          m.name.toLowerCase().includes('sonnet') ||
          m.name.toLowerCase().includes('opus') ||
          m.name.toLowerCase().includes('strong')
      ) ?? toolModel;

    const nowIso = this.now();
    const assignments: Record<string, Assignment> = {
      'pet-text': {
        state: 'assigned',
        profileId,
        model: cheapModel.name,
        setAt: nowIso,
      },
      'pet-image': visionModel
        ? {
            state: 'assigned',
            profileId,
            model: visionModel.name,
            setAt: nowIso,
          }
        : {
            state: 'unassigned',
          },
      worker: {
        state: 'assigned',
        profileId,
        model: strongModel.name,
        setAt: nowIso,
      },
      'rule-elicitation': {
        state: 'assigned',
        profileId,
        model: strongModel.name,
        setAt: nowIso,
      },
      undo: {
        state: 'assigned',
        profileId,
        model: strongModel.name,
        setAt: nowIso,
      },
      'risk-judge': {
        state: 'assigned',
        profileId,
        model: cheapModel.name,
        setAt: nowIso,
      },
    };

    return {
      tableVersion: '1.0.0',
      assignments: assignments as RoutingTable['assignments'],
    };
  }
  async applyDefaults(profileId: string): Promise<RoutingTable> {
    const proposed = await this.proposeDefaults(profileId);
    const saveTx = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO routing_table (singleton, table_version, assignments_json, updated_at)
        VALUES (1, '1.0.0', ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          table_version = excluded.table_version,
          assignments_json = excluded.assignments_json,
          updated_at = excluded.updated_at
      `);
      stmt.run(JSON.stringify(proposed.assignments), this.now());
    });
    saveTx();
    return proposed;
  }

  async hasAnyAssignment(): Promise<boolean> {
    const table = await this.table();
    return Object.values(table.assignments).some((a) => a.state === 'assigned');
  }

  async choices(role: RoleKey): Promise<
    Array<{
      profileId: string;
      profileName: string;
      model: string;
      label: string;
      capabilities: string[];
      suitability: SuitabilityVerdict | null;
    }>
  > {
    const profiles = await this.profileStore.list();
    const result: Array<{
      profileId: string;
      profileName: string;
      model: string;
      label: string;
      capabilities: string[];
      suitability: SuitabilityVerdict | null;
    }> = [];

    for (const profile of profiles) {
      for (const model of profile.models) {
        // Filter out models missing required capabilities
        if (role === 'pet-image' && !model.capabilities.includes('images')) {
          continue;
        }
        if ((role === 'worker' || role === 'undo') && !model.capabilities.includes('tools')) {
          continue;
        }
        if (!model.capabilities.includes('text')) {
          continue;
        }

        const verdict = findSuitabilityVerdict(role, profile.id, model.name);

        // If shipped profile and measured unsuitable, do NOT offer
        if (profile.id.startsWith('shipped:') && verdict && verdict.verdict === 'unsuitable') {
          continue;
        }

        result.push({
          profileId: profile.id,
          profileName: profile.displayName,
          model: model.name,
          label: model.label,
          capabilities: model.capabilities,
          suitability: verdict,
        });
      }
    }

    return result;
  }

  recordJobSnapshot(jobId: string, role: RoleKey, profileId: string, model: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO job_routing_snapshot (job_id, role, profile_id, model, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(job_id, role) DO NOTHING
    `);
    stmt.run(jobId, role, profileId, model, this.now());
  }

  clearJobSnapshots(jobId: string): void {
    const stmt = this.db.prepare('DELETE FROM job_routing_snapshot WHERE job_id = ?');
    stmt.run(jobId);
  }

  private getJobSnapshot(
    jobId: string,
    role: RoleKey
  ): { profileId: string; model: string } | null {
    const stmt = this.db.prepare(
      'SELECT profile_id, model FROM job_routing_snapshot WHERE job_id = ? AND role = ?'
    );
    const row = stmt.get(jobId, role) as { profile_id: string; model: string } | undefined;
    return row ? { profileId: row.profile_id, model: row.model } : null;
  }

  private async resolveAssignment(
    role: RoleKey,
    profileId: string,
    model: string,
    shape: InputShape
  ): Promise<Resolution> {
    const profile = await this.profileStore.get(profileId);
    if (!profile) {
      throw new RoutingError({
        code: 'PROFILE_UNKNOWN',
        role,
        profileId,
        detail: `Assigned profile '${profileId}' no longer exists`,
      });
    }

    const offer = await this.profileStore.getModelOffer(profileId, model);
    if (!offer) {
      throw new RoutingError({
        code: 'MODEL_NOT_OFFERED',
        role,
        profileId,
        model,
        detail: `Model '${model}' is no longer offered by profile '${profileId}'`,
      });
    }

    // Check capability against shape and role
    if (shape.carriesImages || role === 'pet-image') {
      if (!offer.capabilities.includes('images')) {
        throw new RoutingError({
          code: 'ROLE_CAPABILITY_UNMET',
          role,
          profileId,
          model,
          detail: `Request carries images or role is pet-image, but model '${model}' does not declare 'images' capability`,
        });
      }
    }

    if (role === 'worker' || role === 'undo') {
      if (!offer.capabilities.includes('tools')) {
        throw new RoutingError({
          code: 'ROLE_CAPABILITY_UNMET',
          role,
          profileId,
          model,
          detail: `Role '${role}' requires 'tools' capability, but model '${model}' does not declare it`,
        });
      }
    }

    // Check local credential presence on this device
    if (this.credentialStore) {
      const presence = await this.credentialStore.presence(profile.credential);
      if (!presence.present) {
        throw new RoutingError({
          code: 'PROFILE_CREDENTIAL_ABSENT',
          role,
          profileId,
          model,
          detail: `Profile '${profileId}' has no credential on this device. Role '${role}' is unusable on this device until configured.`,
        });
      }
    }

    return {
      ok: true,
      profileId,
      model,
      credentialKey: profile.credential,
      endpoint: profile.endpoint,
    };
  }

  private createEmptyTable(): RoutingTable {
    const assignments: Record<string, Assignment> = {};
    for (const role of CORE_ROLES) {
      assignments[role] = { state: 'unassigned' };
    }
    return {
      tableVersion: '1.0.0',
      assignments: assignments as RoutingTable['assignments'],
    };
  }
}
