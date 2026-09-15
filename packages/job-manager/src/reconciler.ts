import type { ReconciliationDeclaration } from '@desktop-assistant/contracts/tool-reconciliation';
import type {
  ConnectorReconcileReader,
  ReconcileOutcome,
} from './types.js';

export interface ReconcileCandidate {
  readonly jobId: string;
  readonly correlationId: string;
  readonly connector: string;
  readonly tool: string;
  readonly declaration?: ReconciliationDeclaration | undefined;
  readonly beforeSnapshot?: unknown | undefined;
  readonly toolArguments?: Record<string, unknown> | undefined;
}

/**
 * Extracts a property by dot-separated path (e.g. "properties.Status.name" or "status")
 */
function getByPath(target: unknown, path: string): unknown {
  if (!target || typeof target !== 'object' || path.length === 0) {
    return undefined;
  }
  const segments = path.split('.');
  let current: unknown = target;

  for (const seg of segments) {
    if (current && typeof current === 'object' && seg in current) {
      current = (current as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }

  return current;
}

function valuesEqual(a: unknown, b: unknown, equality: 'exact' | 'normalised' = 'exact'): boolean {
  if (a === b) {
    return true;
  }
  if (equality === 'normalised') {
    const strA = typeof a === 'string' ? a.trim().toLowerCase() : JSON.stringify(a);
    const strB = typeof b === 'string' ? b.trim().toLowerCase() : JSON.stringify(b);
    return strA === strB;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Reconciles an unresolved intent against external live platform state
 * per tool-reconciliation contract and capabilities/job/spec.md
 */
export class Reconciler {
  readonly #reconcileReader?: ConnectorReconcileReader | undefined;

  constructor(reconcileReader?: ConnectorReconcileReader) {
    this.#reconcileReader = reconcileReader;
  }

  async reconcile(candidate: ReconcileCandidate): Promise<ReconcileOutcome> {
    const { declaration, beforeSnapshot, toolArguments } = candidate;

    // 1. If declaration is absent, malformed, or explicitly method "none" (e.g. sending messages)
    if (!declaration || declaration.method !== 'readback' || !declaration.read_operation) {
      return {
        conclusion: 'undetermined',
        reason: 'not_readable',
      };
    }

    if (!this.#reconcileReader) {
      return {
        conclusion: 'undetermined',
        reason: 'read_refused',
      };
    }

    // 2. Perform declared read operation through connector
    let readResult;
    try {
      readResult = await this.#reconcileReader.executeRead({
        connector: candidate.connector,
        operation: declaration.read_operation,
        args: toolArguments,
      });
    } catch {
      return {
        conclusion: 'unreachable',
      };
    }

    if (readResult.unreachable) {
      return {
        conclusion: 'unreachable',
      };
    }

    if (!readResult.ok || readResult.data === undefined) {
      return {
        conclusion: 'undetermined',
        reason: 'read_refused',
      };
    }

    const liveState = readResult.data;
    const comparison = declaration.comparison;

    // If no comparison rules specified, cannot determine automatically
    if (!comparison || !comparison.path) {
      return {
        conclusion: 'undetermined',
        reason: 'state_matches_neither',
        observedState: liveState,
      };
    }

    const liveValue = getByPath(liveState, comparison.path);

    let beforeValue: unknown;
    if (beforeSnapshot && typeof beforeSnapshot === 'object') {
      if ('state' in beforeSnapshot && beforeSnapshot.state && typeof beforeSnapshot.state === 'object') {
        beforeValue = getByPath(beforeSnapshot.state, comparison.path);
      }
      if (beforeValue === undefined) {
        beforeValue = getByPath(beforeSnapshot, comparison.path);
      }
    }

    let intendedValue: unknown;
    if (toolArguments && typeof toolArguments === 'object') {
      intendedValue = getByPath(toolArguments, comparison.path);
    }
    const equality = comparison.equality ?? 'exact';
    const against = comparison.against || ['before', 'intended'];
    const checkIntended = against.includes('intended');
    const checkBefore = against.includes('before');

    // 3. Compare with 'intended' state if declared in against
    if (checkIntended && intendedValue !== undefined && valuesEqual(liveValue, intendedValue, equality)) {
      return {
        conclusion: 'performed',
        observedState: liveState,
      };
    }

    // 4. Compare with 'before' state if declared in against
    if (checkBefore && beforeValue !== undefined && valuesEqual(liveValue, beforeValue, equality)) {
      return {
        conclusion: 'not_performed',
        observedState: liveState,
      };
    }

    // 5. Matches neither: check ambiguous_outcome policy
    if (declaration.ambiguous_outcome === 'treat_as_unperformed') {
      return {
        conclusion: 'not_performed',
        observedState: liveState,
      };
    }

    return {
      conclusion: 'undetermined',
      reason: 'state_matches_neither',
      observedState: liveState,
    };
  }
}
