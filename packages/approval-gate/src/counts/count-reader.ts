import type {
  LedgerStore,
  IntentRecord,
  ResultRecord,
  TypedLedgerRecord,
} from '@desktop-assistant/ledger-store';
import type { Condition, CountLeaf, Rule } from '@desktop-assistant/contracts/rule-representation';
import type { EvaluationContext, SystemRule } from '../types.js';
import { normalizePropertyName } from '../evaluator/normalizer.js';
import { ApprovalGateError } from '../errors.js';

/**
 * Recursively extracts all CountLeaf nodes from a condition tree.
 */
export function extractCountLeaves(condition: Condition): CountLeaf[] {
  const leaves: CountLeaf[] = [];

  function traverse(node: Condition): void {
    if (node.kind === 'count') {
      leaves.push(node);
    } else if (node.kind === 'all' || node.kind === 'any') {
      for (const child of node.of) {
        traverse(child);
      }
    } else if (node.kind === 'not') {
      traverse(node.of);
    }
  }

  traverse(condition);
  return leaves;
}

/**
 * Computes ISO-8601 start of the current calendar day in the given timezone.
 */
export function getCalendarDayStartIso(nowIso: string, timezone: string): string {
  const targetDate = new Date(nowIso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(targetDate);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  const localIsoStr = `${year}-${month}-${day}T00:00:00`;
  const tempUtc = new Date(`${localIsoStr}Z`);
  const tzDate = new Date(tempUtc.toLocaleString('en-US', { timeZone: timezone || 'UTC' }));
  const utcDate = new Date(tempUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzOffsetMs = tzDate.getTime() - utcDate.getTime();
  const midnightUtc = new Date(tempUtc.getTime() - tzOffsetMs);
  return midnightUtc.toISOString();
}

/**
 * Queries the append-only LedgerStore for all metrics required by active CountLeaves.
 * Returns a dictionary mapping `${metric}_${boundary}[_${field}]` to numeric count.
 * Fails closed with COUNT_UNAVAILABLE if ledgerStore is missing or query fails.
 */
export async function fetchCountsForRules(
  rules: readonly (Rule | SystemRule)[],
  context: EvaluationContext,
  ledgerStore?: LedgerStore
): Promise<Record<string, number>> {
  // 1. Collect all unique count leaf descriptors
  const neededLeaves: CountLeaf[] = [];
  for (const rule of rules) {
    const leaves = extractCountLeaves(rule.condition);
    neededLeaves.push(...leaves);
  }

  if (neededLeaves.length === 0) {
    return {};
  }

  if (!ledgerStore) {
    throw new ApprovalGateError(
      'COUNT_UNAVAILABLE',
      'LedgerStore is required to evaluate CountLeaf rules.'
    );
  }

  const counts: Record<string, number> = {};
  const dayStartIso = getCalendarDayStartIso(context.now, context.timezone);

  for (const leaf of neededLeaves) {
    const normField = leaf.field ? normalizePropertyName(leaf.field) : undefined;
    const countKey = normField
      ? `${leaf.metric}_${leaf.boundary}_${normField}`
      : `${leaf.metric}_${leaf.boundary}`;

    if (typeof counts[countKey] === 'number') {
      continue; // already fetched
    }

    const fromTime = leaf.boundary === 'calendarDay' ? dayStartIso : undefined;
    const queryJobId = leaf.boundary === 'job' ? context.jobId : undefined;

    // Read intent and result records within boundary
    let records: TypedLedgerRecord[];
    try {
      records = await ledgerStore.read({
        jobId: queryJobId,
        from: fromTime,
        types: ['intent', 'result'],
        limit: 10000,
      });
    } catch (err) {
      throw new ApprovalGateError(
        'COUNT_UNAVAILABLE',
        `Failed to query LedgerStore for count metric '${countKey}': ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }

    let computed: number;

    switch (leaf.metric) {
      case 'writes': {
        // Count distinct tool intent calls that represent writes
        const writeIntents = records.filter(
          (r): r is IntentRecord => r.type === 'intent' && r.content.reversibility !== undefined
        );
        computed = writeIntents.length;
        break;
      }
      case 'creates': {
        const createIntents = records.filter(
          (r): r is IntentRecord =>
            r.type === 'intent' &&
            (r.content.tool.startsWith('create_') ||
              r.content.tool.includes('create') ||
              r.content.tool.includes('new') ||
              r.content.tool.includes('insert'))
        );
        computed = createIntents.length;
        break;
      }
      case 'distinctObjects': {
        const objectIds = new Set<string>();
        for (const r of records) {
          if (r.type === 'intent') {
            const before = r.content.before;
            if (before && 'target' in before && before.target) {
              objectIds.add(before.target);
            }
          } else if (r.type === 'result') {
            const after = (r as ResultRecord).content.after;
            if (after && 'target' in after && after.target) {
              objectIds.add(after.target);
            }
          }
        }
        computed = objectIds.size;
        break;
      }
      case 'fieldChanges': {
        if (!normField) {
          computed = 0;
          break;
        }
        let changeCount = 0;
        for (const r of records) {
          if (r.type === 'intent') {
            const params = r.content.parameters;
            if (params && typeof params === 'object') {
              const paramObj = params as Record<string, unknown>;
              const props =
                paramObj['properties'] && typeof paramObj['properties'] === 'object'
                  ? (paramObj['properties'] as Record<string, unknown>)
                  : paramObj;

              for (const k of Object.keys(props)) {
                if (normalizePropertyName(k) === normField) {
                  changeCount++;
                  break;
                }
              }
            }
          }
        }
        computed = changeCount;
        break;
      }
      default:
        computed = 0;
    }

    counts[countKey] = computed;
    // Also provide base key without field
    if (!counts[`${leaf.metric}_${leaf.boundary}`]) {
      counts[`${leaf.metric}_${leaf.boundary}`] = computed;
    }
  }

  return counts;
}
