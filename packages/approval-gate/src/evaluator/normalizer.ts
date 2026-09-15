import { ApprovalGateError } from '../errors.js';

/**
 * Normalizes property/field names to a canonical token.
 * Handles casing differences (camelCase, PascalCase, snake_case, kebab-case, spaces).
 * Examples: "Due date", "dueDate", "due_date", "Due-Date" -> "due_date".
 */
export function normalizePropertyName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

/**
 * Extracts primitive scalar or simple array from nested platform structures (Notion/Drive).
 * Handles:
 * - { name: "..." }
 * - { select: { name: "..." } }
 * - { status: { name: "..." } }
 * - { title: [{ plain_text: "..." }] } or { rich_text: [{ text: { content: "..." } }] }
 * - { date: { start: "..." } }
 */
export function extractPropertyValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') return val;

  // Arrays
  if (Array.isArray(val)) {
    if (val.length === 0) return [];
    const textPieces: string[] = [];
    for (const item of val) {
      if (typeof item === 'string') {
        textPieces.push(item);
      } else if (item && typeof item === 'object') {
        const itemObj = item as Record<string, unknown>;
        if (typeof itemObj['plain_text'] === 'string') {
          textPieces.push(itemObj['plain_text']);
        } else if (typeof itemObj['content'] === 'string') {
          textPieces.push(itemObj['content']);
        } else if (itemObj['text'] && typeof itemObj['text'] === 'object') {
          const innerText = itemObj['text'] as Record<string, unknown>;
          if (typeof innerText['content'] === 'string') {
            textPieces.push(innerText['content']);
          }
        } else if (typeof itemObj['name'] === 'string') {
          textPieces.push(itemObj['name']);
        } else if (typeof itemObj['id'] === 'string') {
          textPieces.push(itemObj['id']);
        }
      }
    }
    if (textPieces.length > 0 && textPieces.length === val.length) {
      return textPieces.join('');
    }
    return val.map(extractPropertyValue);
  }

  const obj = val as Record<string, unknown>;

  // Notion select / status / relation / user
  if (typeof obj['name'] === 'string') {
    return obj['name'];
  }
  if (obj['select'] && typeof obj['select'] === 'object') {
    return extractPropertyValue(obj['select']);
  }
  if (obj['status'] && typeof obj['status'] === 'object') {
    return extractPropertyValue(obj['status']);
  }
  if (obj['date'] && typeof obj['date'] === 'object') {
    const dateObj = obj['date'] as Record<string, unknown>;
    return dateObj['start'] ?? dateObj;
  }
  if (Array.isArray(obj['title'])) {
    return extractPropertyValue(obj['title']);
  }
  if (Array.isArray(obj['rich_text'])) {
    return extractPropertyValue(obj['rich_text']);
  }
  if (typeof obj['id'] === 'string' && Object.keys(obj).length === 1) {
    return obj['id'];
  }

  return val;
}

/**
 * Normalized representation of fields/properties changed in a call.
 */
export interface NormalizedCallProperties {
  readonly normalizedKeys: ReadonlySet<string>;
  readonly valuesByNormalizedKey: ReadonlyMap<string, unknown>;
  readonly rawKeys: readonly string[];
  readonly hasPropertyRemoval: boolean;
  readonly removedPropertyKeys: ReadonlySet<string>;
}

const RESERVED_IDENTIFIER_KEYS = new Set(['page_id', 'database_id', 'block_id', 'workspace_id', 'file_id']);

/**
 * Parses raw tool arguments to extract changed fields and values.
 * Merges both top-level arguments and nested `properties` map.
 * Enforces fail-closed validation on colliding ambiguous normalized keys.
 */
export function extractCallProperties(args: Record<string, unknown>): NormalizedCallProperties {
  const normalizedKeys = new Set<string>();
  const valuesByNormalizedKey = new Map<string, unknown>();
  const rawKeys: string[] = [];
  let hasPropertyRemoval = false;
  const removedPropertyKeys = new Set<string>();

  function registerEntry(rawKey: string, rawVal: unknown): void {
    if (RESERVED_IDENTIFIER_KEYS.has(rawKey) || rawKey === 'properties') {
      return;
    }

    rawKeys.push(rawKey);
    const normalizedKey = normalizePropertyName(rawKey);
    const extractedVal = extractPropertyValue(rawVal);

    if (normalizedKeys.has(normalizedKey)) {
      const existingVal = valuesByNormalizedKey.get(normalizedKey);
      // Check collision: if values differ, this is an ambiguous collision attack
      if (existingVal !== extractedVal && JSON.stringify(existingVal) !== JSON.stringify(extractedVal)) {
        throw new ApprovalGateError(
          'FIELD_VALUE_UNEXTRACTABLE',
          `Ambiguous normalized property collision for key '${normalizedKey}' with conflicting values.`
        );
      }
    }

    normalizedKeys.add(normalizedKey);
    valuesByNormalizedKey.set(normalizedKey, extractedVal);
  }

  // 1. Process top-level arguments
  for (const [rawKey, rawVal] of Object.entries(args)) {
    registerEntry(rawKey, rawVal);
  }

  // 2. Process nested properties map if present (Notion-style)
  if (args['properties'] && typeof args['properties'] === 'object' && !Array.isArray(args['properties'])) {
    const propMap = args['properties'] as Record<string, unknown>;
    for (const [rawKey, rawVal] of Object.entries(propMap)) {
      registerEntry(rawKey, rawVal);
    }
  }

  // 3. Check explicit removal flags or schema property removals
  if (args['remove_property'] || args['delete_property']) {
    hasPropertyRemoval = true;
    const removed = args['remove_property'] || args['delete_property'];
    if (typeof removed === 'string') {
      removedPropertyKeys.add(normalizePropertyName(removed));
    } else if (Array.isArray(removed)) {
      for (const item of removed) {
        if (typeof item === 'string') {
          removedPropertyKeys.add(normalizePropertyName(item));
        }
      }
    }
  }

  // 4. Also check top-level archived: true
  if (args['archived'] === true) {
    normalizedKeys.add('archived');
    valuesByNormalizedKey.set('archived', true);
  }

  return {
    normalizedKeys,
    valuesByNormalizedKey,
    rawKeys,
    hasPropertyRemoval,
    removedPropertyKeys,
  };
}
