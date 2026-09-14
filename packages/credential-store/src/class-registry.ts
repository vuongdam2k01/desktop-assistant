import type { CredentialClassDescriptor } from '@desktop-assistant/contracts/credential-class-descriptor';
import { CredentialStoreError } from './errors.js';
import { parseCredentialKey } from './key-parser.js';

const CLASS_ID_REGEX = /^[a-z][a-z0-9_]*$/;
const VERSION_REGEX = /^\d+\.\d+\.\d+$/;
const OWNER_REGEX = /^[a-z][a-z0-9-]*$/;
const WILDCARD_REGEX = /^<[a-z][a-z0-9_]*>$/;
const LITERAL_SEGMENT_REGEX = /^[a-z0-9_-]+$/;

const MANDATORY_TRIGGERS = [
  'sign_out',
  'device_revocation',
  'account_deletion',
  'uninstall',
] as const;

const ALLOWED_TRIGGERS: Record<string, true> = {
  connector_disconnect: true,
  sign_out: true,
  device_revocation: true,
  account_deletion: true,
  uninstall: true,
};

const ALLOWED_DESCRIPTOR_PROPERTIES: Record<string, true> = {
  class_id: true,
  version: true,
  name: true,
  key_pattern: true,
  owner: true,
  replicates: true,
  restoration_route: true,
  erase_on: true,
  metadata_fields: true,
  expected_size: true,
  notes: true,
};

function parsePatternSegments(pattern: string, classId: string): string[] {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    throw new CredentialStoreError({
      code: 'DESCRIPTOR_INVALID',
      classId,
    });
  }

  const segments = pattern.split(':');
  if (segments.length !== 3 && segments.length !== 4) {
    throw new CredentialStoreError({
      code: 'DESCRIPTOR_INVALID',
      classId,
    });
  }

  const domain = segments[0]!;
  if (!CLASS_ID_REGEX.test(domain)) {
    throw new CredentialStoreError({
      code: 'DESCRIPTOR_INVALID',
      classId,
    });
  }

  for (const seg of segments) {
    if (seg.length === 0) {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId,
      });
    }

    if (seg.startsWith('<') || seg.endsWith('>')) {
      if (!WILDCARD_REGEX.test(seg)) {
        throw new CredentialStoreError({
          code: 'DESCRIPTOR_INVALID',
          classId,
        });
      }
    } else if (!LITERAL_SEGMENT_REGEX.test(seg)) {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId,
      });
    }
  }

  return segments;
}

function arePatternsCompatible(p1Segments: string[], p2Segments: string[]): boolean {
  if (p1Segments.length !== p2Segments.length) {
    return false;
  }

  for (let i = 0; i < p1Segments.length; i++) {
    const s1 = p1Segments[i]!;
    const s2 = p2Segments[i]!;
    const isWildcard1 = WILDCARD_REGEX.test(s1);
    const isWildcard2 = WILDCARD_REGEX.test(s2);
    const compatible = isWildcard1 || isWildcard2 || s1 === s2;
    if (!compatible) {
      return false;
    }
  }

  return true;
}

function areDescriptorsEqual(
  d1: CredentialClassDescriptor,
  d2: CredentialClassDescriptor
): boolean {
  if (
    d1.class_id !== d2.class_id ||
    d1.version !== d2.version ||
    d1.name !== d2.name ||
    d1.key_pattern !== d2.key_pattern ||
    d1.owner !== d2.owner ||
    d1.replicates !== d2.replicates ||
    d1.restoration_route !== d2.restoration_route ||
    d1.expected_size !== d2.expected_size ||
    d1.notes !== d2.notes
  ) {
    return false;
  }

  if (d1.erase_on.length !== d2.erase_on.length) return false;
  const eraseSet1 = new Set(d1.erase_on);
  for (const trigger of d2.erase_on) {
    if (!eraseSet1.has(trigger)) return false;
  }

  if (d1.metadata_fields.length !== d2.metadata_fields.length) return false;
  const metaSet1 = new Set(d1.metadata_fields);
  for (const field of d2.metadata_fields) {
    if (!metaSet1.has(field)) return false;
  }

  return true;
}

function cloneAndFreezeDescriptor(
  descriptor: CredentialClassDescriptor
): CredentialClassDescriptor {
  const cloned: CredentialClassDescriptor = {
    class_id: descriptor.class_id,
    version: descriptor.version,
    name: descriptor.name,
    key_pattern: descriptor.key_pattern,
    owner: descriptor.owner,
    replicates: descriptor.replicates,
    restoration_route: descriptor.restoration_route,
    erase_on: Object.freeze([...descriptor.erase_on]) as unknown as CredentialClassDescriptor['erase_on'],
    metadata_fields: Object.freeze([...descriptor.metadata_fields]) as unknown as string[],
    ...(descriptor.expected_size !== undefined
      ? { expected_size: descriptor.expected_size }
      : {}),
    ...(descriptor.notes !== undefined ? { notes: descriptor.notes } : {}),
  };
  return Object.freeze(cloned);
}

export class CredentialClassRegistry {
  private readonly descriptorsById = new Map<string, CredentialClassDescriptor>();
  private readonly patternSegmentsById = new Map<string, string[]>();

  register(descriptor: CredentialClassDescriptor): void {
    this.validateDescriptor(descriptor);

    const existing = this.descriptorsById.get(descriptor.class_id);
    if (existing) {
      if (areDescriptorsEqual(existing, descriptor)) {
        return; // Idempotent duplicate registration
      }
      throw new CredentialStoreError({
        code: 'CLASS_ID_REUSED',
        classId: descriptor.class_id,
      });
    }

    const segments = parsePatternSegments(descriptor.key_pattern, descriptor.class_id);

    // Check for pattern conflict against all existing descriptors
    for (const [, existingSegments] of this.patternSegmentsById.entries()) {
      if (arePatternsCompatible(segments, existingSegments)) {
        throw new CredentialStoreError({
          code: 'CLASS_PATTERN_CONFLICT',
          classId: descriptor.class_id,
        });
      }
    }

    const frozen = cloneAndFreezeDescriptor(descriptor);
    this.descriptorsById.set(descriptor.class_id, frozen);
    this.patternSegmentsById.set(descriptor.class_id, segments);
  }

  get(classId: string): CredentialClassDescriptor | undefined {
    return this.descriptorsById.get(classId);
  }

  getAll(): CredentialClassDescriptor[] {
    return Array.from(this.descriptorsById.values());
  }

  resolveClass(key: string): CredentialClassDescriptor {
    const parsed = parseCredentialKey(key);
    const matches: CredentialClassDescriptor[] = [];

    for (const [classId, patternSegments] of this.patternSegmentsById.entries()) {
      if (patternSegments.length !== parsed.segments.length) {
        continue;
      }

      let matchesPattern = true;
      for (let i = 0; i < patternSegments.length; i++) {
        const patSeg = patternSegments[i]!;
        const isWildcard = WILDCARD_REGEX.test(patSeg);
        if (!isWildcard && patSeg !== parsed.segments[i]) {
          matchesPattern = false;
          break;
        }
      }

      if (matchesPattern) {
        matches.push(this.descriptorsById.get(classId)!);
      }
    }

    if (matches.length === 0) {
      throw new CredentialStoreError({
        code: 'KEY_UNCLASSIFIED',
        key,
      });
    }

    if (matches.length > 1) {
      throw new CredentialStoreError({
        code: 'CLASS_PATTERN_CONFLICT',
        key,
      });
    }

    return matches[0]!;
  }

  private validateDescriptor(descriptor: CredentialClassDescriptor): void {
    if (!descriptor || typeof descriptor !== 'object') {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
      });
    }

    // Reject additional/undeclared properties
    for (const prop of Object.keys(descriptor)) {
      if (!Object.hasOwn(ALLOWED_DESCRIPTOR_PROPERTIES, prop)) {
        throw new CredentialStoreError({
          code: 'DESCRIPTOR_INVALID',
          classId: descriptor.class_id,
        });
      }
    }

    const {
      class_id,
      version,
      name,
      owner,
      replicates,
      restoration_route,
      erase_on,
      metadata_fields,
      expected_size,
      notes,
    } = descriptor;

    if (!class_id || typeof class_id !== 'string' || !CLASS_ID_REGEX.test(class_id)) {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: typeof class_id === 'string' ? class_id : undefined,
      });
    }

    if (!version || typeof version !== 'string' || !VERSION_REGEX.test(version)) {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }

    if (!name || typeof name !== 'string') {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }

    if (!owner || typeof owner !== 'string' || !OWNER_REGEX.test(owner)) {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }

    if (typeof replicates !== 'boolean') {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }

    if (restoration_route !== 'replication' && restoration_route !== 'account_sign_in') {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }

    if (!replicates && restoration_route === 'replication') {
      throw new CredentialStoreError({
        code: 'CLASS_ROUTE_UNREACHABLE',
        classId: class_id,
      });
    }

    if (!Array.isArray(erase_on)) {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }

    for (const trigger of erase_on) {
      if (typeof trigger !== 'string' || !Object.hasOwn(ALLOWED_TRIGGERS, trigger)) {
        throw new CredentialStoreError({
          code: 'DESCRIPTOR_INVALID',
          classId: class_id,
        });
      }
    }

    for (const mandatory of MANDATORY_TRIGGERS) {
      if (!erase_on.includes(mandatory)) {
        throw new CredentialStoreError({
          code: 'CLASS_TRIGGERS_INCOMPLETE',
          classId: class_id,
        });
      }
    }

    if (!Array.isArray(metadata_fields)) {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }

    const seenMeta = new Set<string>();
    for (const field of metadata_fields) {
      if (typeof field !== 'string' || field.length === 0) {
        throw new CredentialStoreError({
          code: 'DESCRIPTOR_INVALID',
          classId: class_id,
        });
      }
      if (seenMeta.has(field)) {
        throw new CredentialStoreError({
          code: 'DESCRIPTOR_INVALID',
          classId: class_id,
        });
      }
      seenMeta.add(field);
    }

    if (expected_size !== undefined && typeof expected_size !== 'string') {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }

    if (notes !== undefined && typeof notes !== 'string') {
      throw new CredentialStoreError({
        code: 'DESCRIPTOR_INVALID',
        classId: class_id,
      });
    }
  }
}
