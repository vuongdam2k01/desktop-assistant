import type { LedgerStore } from '@desktop-assistant/ledger-store';
import type { Rule } from '@desktop-assistant/contracts/rule-representation';
import type {
  CallSubject,
  EvaluationContext,
  SystemRule,
  ScopedApproval,
} from '../types.js';
import { fetchCountsForRules } from '../counts/count-reader.js';

export interface BuildCallSubjectInput {
  readonly callId: string;
  readonly connector: string;
  readonly tool: string;
  readonly rawArguments: Record<string, unknown>;
  /** Manifest declaration: does this tool have irreversible effects? */
  readonly isIrreversible: boolean;
  /** Manifest declaration: does this tool modify permissions or sharing? */
  readonly changesPermission: boolean;
  /** True if snapshot retrieval failed before call execution */
  readonly isSnapshotUnavailable?: boolean | undefined;
  /** Canonical platform metadata for the target object */
  readonly platformObject?: {
    readonly type: string;
    readonly id: string;
    readonly ancestorIds?: readonly string[] | undefined;
    readonly createdBy?: string | undefined;
    readonly assignedTo?: readonly string[] | undefined;
  } | undefined;
  readonly affectedObjects?: readonly { readonly type: string; readonly id: string }[] | undefined;
  readonly scopeAuthorization?: 'within' | 'outside' | 'unknown' | undefined;
}

export interface BuildEvaluationContextInput {
  readonly jobId: string;
  readonly mode: 'on' | 'smart' | 'off';
  readonly currentUser: string;
  readonly nowIso?: string | undefined;
  readonly timezone?: string | undefined;
  readonly activeGrants?: readonly ScopedApproval[] | undefined;
}

/**
 * Builds the canonical CallSubject.
 * Enforces Constitutional Principle II & "External Content Is Data":
 * Target identity, ancestry, ownership, irreversibility, and permission flags
 * are sourced exclusively from manifest declarations and platform records,
 * NEVER from model arguments.
 */
export function buildCallSubject(input: BuildCallSubjectInput): CallSubject {
  return {
    callId: input.callId,
    connector: input.connector,
    tool: input.tool,
    arguments: input.rawArguments,
    object: input.platformObject
      ? {
          type: input.platformObject.type,
          id: input.platformObject.id,
          ancestorIds: input.platformObject.ancestorIds ?? [],
          createdBy: input.platformObject.createdBy,
          assignedTo: input.platformObject.assignedTo,
        }
      : undefined,
    isIrreversible: input.isIrreversible,
    changesPermission: input.changesPermission,
    isSnapshotUnavailable: input.isSnapshotUnavailable,
    affectedObjects: input.affectedObjects,
    scopeAuthorization: input.scopeAuthorization,
  };
}

/**
 * Builds the EvaluationContext, pre-fetching required counts from LedgerStore
 * if any CountLeaf is active in the rule set.
 */
export async function buildEvaluationContext(
  input: BuildEvaluationContextInput,
  activeRules: readonly (Rule | SystemRule)[],
  ledgerStore?: LedgerStore
): Promise<EvaluationContext> {
  const now = input.nowIso ?? new Date().toISOString();
  const timezone = input.timezone ?? 'UTC';

  const baseContext: EvaluationContext = {
    jobId: input.jobId,
    mode: input.mode,
    currentUser: input.currentUser,
    now,
    timezone,
    activeGrants: input.activeGrants,
  };

  if (ledgerStore) {
    const counts = await fetchCountsForRules(activeRules, baseContext, ledgerStore);
    return {
      ...baseContext,
      counts,
    };
  }

  return baseContext;
}
