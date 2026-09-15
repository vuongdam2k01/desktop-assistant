import { describe, it, expect } from 'vitest';
import {
  normalizePropertyName,
  extractPropertyValue,
  extractCallProperties,
} from '../src/evaluator/normalizer.js';

describe('Property Normalizer (RISK-036, RISK-037)', () => {
  it('normalizes field names across diverse casings and separators', () => {
    expect(normalizePropertyName('Due date')).toBe('due_date');
    expect(normalizePropertyName('dueDate')).toBe('due_date');
    expect(normalizePropertyName('due_date')).toBe('due_date');
    expect(normalizePropertyName('Due-Date')).toBe('due_date');
    expect(normalizePropertyName('  Status ')).toBe('status');
    expect(normalizePropertyName('assignedToUser')).toBe('assigned_to_user');
  });

  it('extracts nested values from complex platform payloads', () => {
    // Select / Status
    expect(extractPropertyValue({ name: 'Done' })).toBe('Done');
    expect(extractPropertyValue({ select: { name: 'High' } })).toBe('High');
    expect(extractPropertyValue({ status: { name: 'In Progress' } })).toBe('In Progress');

    // Date
    expect(extractPropertyValue({ date: { start: '2026-09-15' } })).toBe('2026-09-15');

    // Rich text and titles
    expect(extractPropertyValue([{ plain_text: 'Fix production issue' }])).toBe(
      'Fix production issue'
    );
    expect(
      extractPropertyValue([
        { text: { content: 'Part 1: ' } },
        { text: { content: 'Part 2' } },
      ])
    ).toBe('Part 1: Part 2');

    // Primitives
    expect(extractPropertyValue('Simple text')).toBe('Simple text');
    expect(extractPropertyValue(42)).toBe(42);
    expect(extractPropertyValue(true)).toBe(true);
    expect(extractPropertyValue(null)).toBe(null);
  });

  it('extracts changed properties from top-level arguments and nested properties maps', () => {
    const args1 = {
      database_id: 'db-1',
      properties: {
        'Due date': { date: { start: '2026-10-01' } },
        Status: { name: 'Done' },
      },
    };
    const extracted1 = extractCallProperties(args1);
    expect(extracted1.normalizedKeys.has('due_date')).toBe(true);
    expect(extracted1.normalizedKeys.has('status')).toBe(true);
    expect(extracted1.normalizedKeys.has('database_id')).toBe(false);
    expect(extracted1.valuesByNormalizedKey.get('due_date')).toBe('2026-10-01');
    expect(extracted1.valuesByNormalizedKey.get('status')).toBe('Done');

    // Top-level arguments with removal flags
    const args2 = {
      page_id: 'p-1',
      remove_property: 'Due date',
      archived: true,
    };
    const extracted2 = extractCallProperties(args2);
    expect(extracted2.hasPropertyRemoval).toBe(true);
    expect(extracted2.removedPropertyKeys.has('due_date')).toBe(true);
    expect(extracted2.normalizedKeys.has('archived')).toBe(true);
    expect(extracted2.valuesByNormalizedKey.get('archived')).toBe(true);
  });

  it('merges both top-level arguments and nested properties cleanly', () => {
    const args = {
      title: 'Top level title',
      properties: {
        Status: { name: 'Done' },
      },
    };
    const extracted = extractCallProperties(args);
    expect(extracted.normalizedKeys.has('title')).toBe(true);
    expect(extracted.normalizedKeys.has('status')).toBe(true);
    expect(extracted.valuesByNormalizedKey.get('title')).toBe('Top level title');
    expect(extracted.valuesByNormalizedKey.get('status')).toBe('Done');
  });

  it('rejects ambiguous normalized property collisions with conflicting values', () => {
    const collidingArgs = {
      dueDate: '2026-09-01',
      due_date: '2026-09-02',
    };
    expect(() => extractCallProperties(collidingArgs)).toThrowError(/FIELD_VALUE_UNEXTRACTABLE/);
  });
});
