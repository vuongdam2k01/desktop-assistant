import type {
  Condition,
  ToolLeaf,
  ScopeLeaf,
  FieldLeaf,
  OwnershipLeaf,
  CountLeaf,
  TimeLeaf,
  IrreversibleLeaf,
  PermissionLeaf,
  StringOrStrings,
  JsonValue,
  Principal,
} from '@desktop-assistant/contracts/rule-representation';
import type { CallSubject, EvaluationContext } from '../types.js';
import {
  normalizePropertyName,
  extractCallProperties,
  type NormalizedCallProperties,
} from './normalizer.js';

function matchStringOrStrings(expected: StringOrStrings | undefined, actual: string | undefined): boolean {
  if (expected === undefined) return true;
  if (!actual) return false;
  if (typeof expected === 'string') {
    return expected === actual;
  }
  return expected.includes(actual);
}

function normalizePrincipal(p: Principal, currentUser: string): string {
  if (p === 'current_user' || p === 'user_self' || p === 'currentUser') {
    return currentUser;
  }
  return p;
}

export function evaluateToolLeaf(leaf: ToolLeaf, subject: CallSubject): boolean {
  if (!matchStringOrStrings(leaf.connector, subject.connector)) {
    return false;
  }
  if (!matchStringOrStrings(leaf.tool, subject.tool)) {
    return false;
  }
  return true;
}

export function evaluateScopeLeaf(leaf: ScopeLeaf, subject: CallSubject): boolean {
  const obj = subject.object;

  if (leaf.objectType !== undefined) {
    if (!obj || !matchStringOrStrings(leaf.objectType, obj.type)) {
      return false;
    }
  }

  if (leaf.objectId !== undefined) {
    if (!obj) return false;
    if (typeof leaf.objectId === 'string') {
      if (obj.id !== leaf.objectId) return false;
    } else if (leaf.objectId.in) {
      if (!leaf.objectId.in.includes(obj.id)) return false;
    }
  }

  if (leaf.ancestor !== undefined) {
    if (!obj || !obj.ancestorIds || obj.ancestorIds.length === 0) {
      return false;
    }
    if ('contains' in leaf.ancestor) {
      if (!obj.ancestorIds.includes(leaf.ancestor.contains)) {
        return false;
      }
    } else if ('containsAny' in leaf.ancestor) {
      const containsAny = leaf.ancestor.containsAny;
      const found = containsAny.some((a) => obj.ancestorIds.includes(a));
      if (!found) return false;
    }
  }

  return true;
}

function jsonValuesEqual(a: unknown, b: JsonValue | undefined): boolean {
  if (b === undefined) return true;
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }
  return String(a) === String(b);
}

export function evaluateFieldLeaf(
  leaf: FieldLeaf,
  subject: CallSubject,
  cachedProps?: NormalizedCallProperties
): boolean {
  const props = cachedProps ?? extractCallProperties(subject.arguments);

  // 1. Changes
  if (leaf.changes) {
    if (leaf.changes.includes) {
      const target = normalizePropertyName(leaf.changes.includes);
      if (!props.normalizedKeys.has(target)) {
        return false;
      }
    }
    if (leaf.changes.includesAny) {
      const targets = leaf.changes.includesAny.map(normalizePropertyName);
      const hasAny = targets.some((t) => props.normalizedKeys.has(t));
      if (!hasAny) return false;
    }
    if (leaf.changes.remainderNotEmpty) {
      const excluded = new Set(leaf.changes.remainderNotEmpty.map(normalizePropertyName));
      let remainingCount = 0;
      for (const k of props.normalizedKeys) {
        if (!excluded.has(k)) {
          remainingCount++;
        }
      }
      if (remainingCount === 0) {
        return false;
      }
    }
  }

  // 2. Becomes
  if (leaf.becomes) {
    const targetField = normalizePropertyName(leaf.becomes.field);
    const valuePresent = props.normalizedKeys.has(targetField);
    if (!valuePresent) {
      return false;
    }
    const val = props.valuesByNormalizedKey.get(targetField);

    if (leaf.becomes.equals !== undefined) {
      if (!jsonValuesEqual(val, leaf.becomes.equals)) {
        return false;
      }
    }

    if (leaf.becomes.oneOf !== undefined) {
      const matched = leaf.becomes.oneOf.some((target) => jsonValuesEqual(val, target));
      if (!matched) return false;
    }

    if (leaf.becomes.noneOf !== undefined) {
      const matched = leaf.becomes.noneOf.some((target) => jsonValuesEqual(val, target));
      if (matched) return false;
    }

    if (leaf.becomes.matches !== undefined) {
      const rawText = val === null || val === undefined ? '' : String(val);
      const textToMatch = rawText.length > 4096 ? rawText.slice(0, 4096) : rawText;
      const regex = new RegExp(leaf.becomes.matches, 'i');
      if (!regex.test(textToMatch)) {
        return false;
      }
    }
  }

  // 3. Removes
  if (leaf.removes !== undefined) {
    if (leaf.removes === true) {
      if (!props.hasPropertyRemoval && props.removedPropertyKeys.size === 0) {
        return false;
      }
    } else if (typeof leaf.removes === 'string') {
      const target = normalizePropertyName(leaf.removes);
      if (!props.removedPropertyKeys.has(target)) {
        return false;
      }
    } else if (leaf.removes.in) {
      const targets = leaf.removes.in.map(normalizePropertyName);
      const found = targets.some((t) => props.removedPropertyKeys.has(t));
      if (!found) return false;
    }
  }

  return true;
}

export function evaluateOwnershipLeaf(
  leaf: OwnershipLeaf,
  subject: CallSubject,
  context: EvaluationContext
): boolean {
  const obj = subject.object;
  if (leaf.createdBy) {
    if (!obj) {
      return false;
    }
    const creator = obj.createdBy ? normalizePrincipal(obj.createdBy, context.currentUser) : 'unknown';

    if (leaf.createdBy.in) {
      const allowed = leaf.createdBy.in.map((p) => normalizePrincipal(p, context.currentUser));
      if (!allowed.includes(creator)) {
        return false;
      }
    }
    if (leaf.createdBy.notIn) {
      const forbidden = leaf.createdBy.notIn.map((p) => normalizePrincipal(p, context.currentUser));
      if (forbidden.includes(creator)) {
        return false;
      }
      return true;
    }
  }

  if (leaf.assignedTo) {
    if (!obj || !obj.assignedTo || obj.assignedTo.length === 0) {
      return false;
    }
    const assigned = obj.assignedTo.map((p) => normalizePrincipal(p, context.currentUser));

    if (leaf.assignedTo.includes) {
      const target = normalizePrincipal(leaf.assignedTo.includes, context.currentUser);
      if (!assigned.includes(target)) return false;
    }
    if (leaf.assignedTo.excludes) {
      const target = normalizePrincipal(leaf.assignedTo.excludes, context.currentUser);
      if (assigned.includes(target)) return false;
    }
    if (leaf.assignedTo.in) {
      const targets = leaf.assignedTo.in.map((p) => normalizePrincipal(p, context.currentUser));
      const hasAny = assigned.some((a) => targets.includes(a));
      if (!hasAny) return false;
    }
    if (leaf.assignedTo.notIn) {
      const targets = leaf.assignedTo.notIn.map((p) => normalizePrincipal(p, context.currentUser));
      const hasAny = assigned.some((a) => targets.includes(a));
      if (hasAny) return false;
    }
  }
  return true;
}

export function evaluateCountLeaf(
  leaf: CountLeaf,
  subject: CallSubject,
  context: EvaluationContext
): boolean {
  let count = 0;
  const countKey = leaf.field
    ? `${leaf.metric}_${leaf.boundary}_${normalizePropertyName(leaf.field)}`
    : `${leaf.metric}_${leaf.boundary}`;

  if (context.counts && typeof context.counts[countKey] === 'number') {
    count = context.counts[countKey] ?? 0;
  } else if (context.counts && typeof context.counts[`${leaf.metric}_${leaf.boundary}`] === 'number') {
    count = context.counts[`${leaf.metric}_${leaf.boundary}`] ?? 0;
  }

  // Factor in current call's affected objects if distinctObjects metric
  if (leaf.metric === 'distinctObjects') {
    if (subject.affectedObjects && subject.affectedObjects.length > 0) {
      count = Math.max(count, subject.affectedObjects.length);
    }
    if (Array.isArray(subject.arguments['page_ids'])) {
      count = Math.max(count, (subject.arguments['page_ids'] as unknown[]).length);
    }
  }

  switch (leaf.operator) {
    case 'gt':
      return count > leaf.value;
    case 'gte':
      return count >= leaf.value;
    case 'eq':
      return count === leaf.value;
    default:
      return false;
  }
}

const DAY_NAME_MAP: Record<string, 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

export function evaluateTimeLeaf(leaf: TimeLeaf, context: EvaluationContext): boolean {
  const date = new Date(context.now);
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: context.timezone || 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: context.timezone || 'UTC',
    weekday: 'short',
  });

  const formattedTime = timeFormatter.format(date); // "HH:MM"
  const formattedDay = dayFormatter.format(date); // "Mon", "Tue", ...
  const canonicalDay = DAY_NAME_MAP[formattedDay];

  if (leaf.onDays && leaf.onDays.length > 0) {
    if (!canonicalDay || !leaf.onDays.includes(canonicalDay)) {
      return false;
    }
  }

  if (leaf.outside) {
    const [startTime, endTime] = leaf.outside;
    if (startTime && endTime) {
      // Normal work window: e.g. 08:00 to 18:00. Outside means < 08:00 OR >= 18:00
      if (startTime <= endTime) {
        const isInside = formattedTime >= startTime && formattedTime < endTime;
        if (isInside) return false;
      } else {
        // Window crosses midnight: e.g. 22:00 to 06:00
        const isInside = formattedTime >= startTime || formattedTime < endTime;
        if (isInside) return false;
      }
    }
  }

  return true;
}

export function evaluateIrreversibleLeaf(leaf: IrreversibleLeaf, subject: CallSubject): boolean {
  const actual = subject.isIrreversible || subject.isSnapshotUnavailable === true;
  return actual === leaf.is;
}

export function evaluatePermissionLeaf(leaf: PermissionLeaf, subject: CallSubject): boolean {
  return subject.changesPermission === leaf.changes;
}

/**
 * Recursively evaluates an arbitrary Condition node against subject and context.
 */
export function evaluateCondition(
  condition: Condition,
  subject: CallSubject,
  context: EvaluationContext,
  cachedProps?: NormalizedCallProperties
): boolean {
  switch (condition.kind) {
    case 'all': {
      for (const child of condition.of) {
        if (!evaluateCondition(child, subject, context, cachedProps)) {
          return false;
        }
      }
      return true;
    }
    case 'any': {
      for (const child of condition.of) {
        if (evaluateCondition(child, subject, context, cachedProps)) {
          return true;
        }
      }
      return false;
    }
    case 'not': {
      return !evaluateCondition(condition.of, subject, context, cachedProps);
    }
    case 'tool':
      return evaluateToolLeaf(condition, subject);
    case 'scope':
      return evaluateScopeLeaf(condition, subject);
    case 'field':
      return evaluateFieldLeaf(condition, subject, cachedProps);
    case 'ownership':
      return evaluateOwnershipLeaf(condition, subject, context);
    case 'count':
      return evaluateCountLeaf(condition, subject, context);
    case 'time':
      return evaluateTimeLeaf(condition, context);
    case 'irreversible':
      return evaluateIrreversibleLeaf(condition, subject);
    case 'permission':
      return evaluatePermissionLeaf(condition, subject);
    default:
      return false;
  }
}
