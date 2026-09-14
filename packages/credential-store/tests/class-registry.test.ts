import { describe, it, expect } from 'vitest';
import { CredentialClassRegistry } from '../src/class-registry.js';
import { CredentialStoreError } from '../src/errors.js';
import {
  CONNECTOR_AUTHORISATION_DESCRIPTOR,
  BYO_AUTHORISATION_CLIENT_DESCRIPTOR,
  PROVIDER_CREDENTIAL_DESCRIPTOR,
  REPLICATION_MATERIAL_DESCRIPTOR,
} from '../src/default-credential-classes.js';
import type { CredentialClassDescriptor } from '@desktop-assistant/contracts/credential-class-descriptor';

describe('CredentialClassRegistry and pattern boundaries', () => {
  it('registers all 4 default descriptors successfully', () => {
    const registry = new CredentialClassRegistry();
    registry.register(CONNECTOR_AUTHORISATION_DESCRIPTOR);
    registry.register(BYO_AUTHORISATION_CLIENT_DESCRIPTOR);
    registry.register(PROVIDER_CREDENTIAL_DESCRIPTOR);
    registry.register(REPLICATION_MATERIAL_DESCRIPTOR);

    expect(registry.getAll()).toHaveLength(4);
    expect(registry.get('connector_authorisation')).toEqual(CONNECTOR_AUTHORISATION_DESCRIPTOR);
  });

  it('allows idempotent duplicate registration of identical descriptor', () => {
    const registry = new CredentialClassRegistry();
    registry.register(CONNECTOR_AUTHORISATION_DESCRIPTOR);
    expect(() => registry.register({ ...CONNECTOR_AUTHORISATION_DESCRIPTOR })).not.toThrow();
  });

  it('rejects duplicate registration with altered definition (CLASS_ID_REUSED)', () => {
    const registry = new CredentialClassRegistry();
    registry.register(CONNECTOR_AUTHORISATION_DESCRIPTOR);

    const altered: CredentialClassDescriptor = {
      ...CONNECTOR_AUTHORISATION_DESCRIPTOR,
      name: 'Altered Name',
    };

    expect(() => registry.register(altered)).toThrowError(CredentialStoreError);
    try {
      registry.register(altered);
    } catch (err) {
      expect((err as CredentialStoreError).code).toBe('CLASS_ID_REUSED');
    }
  });

  it('detects pattern conflict between two overlapping classes (CLASS_PATTERN_CONFLICT)', () => {
    const registry = new CredentialClassRegistry();
    registry.register(CONNECTOR_AUTHORISATION_DESCRIPTOR); // connector:<provider>:<identity>:token

    const conflicting: CredentialClassDescriptor = {
      class_id: 'conflicting_connector',
      version: '0.1.0',
      name: 'Conflicting Connector',
      key_pattern: 'connector:<service>:<user>:token', // same 4 segments, wildcard on 1 and 2, literal 'token' on 3
      owner: 'connector',
      replicates: true,
      restoration_route: 'replication',
      erase_on: [
        'connector_disconnect',
        'sign_out',
        'device_revocation',
        'account_deletion',
        'uninstall',
      ],
      metadata_fields: [],
    };

    expect(() => registry.register(conflicting)).toThrowError(CredentialStoreError);
    try {
      registry.register(conflicting);
    } catch (err) {
      expect((err as CredentialStoreError).code).toBe('CLASS_PATTERN_CONFLICT');
    }
  });

  it('prohibits replicates=false with restoration_route=replication (CLASS_ROUTE_UNREACHABLE)', () => {
    const registry = new CredentialClassRegistry();
    const invalid: CredentialClassDescriptor = {
      class_id: 'invalid_route',
      version: '0.1.0',
      name: 'Invalid Route',
      key_pattern: 'custom:<id>:secret',
      owner: 'platform',
      replicates: false,
      restoration_route: 'replication',
      erase_on: ['sign_out', 'device_revocation', 'account_deletion', 'uninstall'],
      metadata_fields: [],
    };

    expect(() => registry.register(invalid)).toThrowError(CredentialStoreError);
    try {
      registry.register(invalid);
    } catch (err) {
      expect((err as CredentialStoreError).code).toBe('CLASS_ROUTE_UNREACHABLE');
    }
  });

  it('rejects descriptors missing mandatory account-level erase triggers (CLASS_TRIGGERS_INCOMPLETE)', () => {
    const registry = new CredentialClassRegistry();
    const incomplete: CredentialClassDescriptor = {
      class_id: 'incomplete_triggers',
      version: '0.1.0',
      name: 'Incomplete Triggers',
      key_pattern: 'custom:<id>:secret',
      owner: 'platform',
      replicates: false,
      restoration_route: 'account_sign_in',
      // Missing uninstall
      erase_on: ['sign_out', 'device_revocation', 'account_deletion'] as unknown as CredentialClassDescriptor['erase_on'],
      metadata_fields: [],
    };

    expect(() => registry.register(incomplete)).toThrowError(CredentialStoreError);
    try {
      registry.register(incomplete);
    } catch (err) {
      expect((err as CredentialStoreError).code).toBe('CLASS_TRIGGERS_INCOMPLETE');
    }
  });

  it('rejects descriptors with duplicate metadata_fields (DESCRIPTOR_INVALID)', () => {
    const registry = new CredentialClassRegistry();
    const duplicateMeta: CredentialClassDescriptor = {
      class_id: 'duplicate_meta',
      version: '0.1.0',
      name: 'Duplicate Meta',
      key_pattern: 'custom:<id>:secret',
      owner: 'platform',
      replicates: false,
      restoration_route: 'account_sign_in',
      erase_on: ['sign_out', 'device_revocation', 'account_deletion', 'uninstall'],
      metadata_fields: ['field1', 'field2', 'field1'],
    };

    expect(() => registry.register(duplicateMeta)).toThrowError(CredentialStoreError);
    try {
      registry.register(duplicateMeta);
    } catch (err) {
      expect((err as CredentialStoreError).code).toBe('DESCRIPTOR_INVALID');
    }
  });

  it('rejects descriptors with additional undeclared properties (DESCRIPTOR_INVALID)', () => {
    const registry = new CredentialClassRegistry();
    const extraProp = {
      ...CONNECTOR_AUTHORISATION_DESCRIPTOR,
      uncontractedProperty: 'forbidden',
    } as unknown as CredentialClassDescriptor;

    expect(() => registry.register(extraProp)).toThrowError(CredentialStoreError);
  });

  it('rejects malformed wildcard segment grammar (DESCRIPTOR_INVALID)', () => {
    const registry = new CredentialClassRegistry();
    const badWildcard: CredentialClassDescriptor = {
      ...CONNECTOR_AUTHORISATION_DESCRIPTOR,
      class_id: 'bad_wildcard',
      key_pattern: 'connector:<provider><other>:default:token',
    };

    expect(() => registry.register(badWildcard)).toThrowError(CredentialStoreError);
  });

  it('freezes registered descriptor snapshots preventing post-registration mutation', () => {
    const registry = new CredentialClassRegistry();
    const mutableDescriptor: CredentialClassDescriptor = {
      class_id: 'mutable_class',
      version: '0.1.0',
      name: 'Mutable Class',
      key_pattern: 'test:<id>:token',
      owner: 'platform',
      replicates: true,
      restoration_route: 'replication',
      erase_on: ['sign_out', 'device_revocation', 'account_deletion', 'uninstall'],
      metadata_fields: ['field1'],
    };

    registry.register(mutableDescriptor);
    const registered = registry.get('mutable_class')!;
    expect(Object.isFrozen(registered)).toBe(true);
    expect(Object.isFrozen(registered.metadata_fields)).toBe(true);
    expect(Object.isFrozen(registered.erase_on)).toBe(true);

    // Mutating original input does not mutate registry state
    mutableDescriptor.metadata_fields.push('leakedField');
    expect(registry.get('mutable_class')!.metadata_fields).toEqual(['field1']);
  });
  it('resolves key to matching class or throws KEY_UNCLASSIFIED', () => {
    const registry = new CredentialClassRegistry();
    registry.register(CONNECTOR_AUTHORISATION_DESCRIPTOR);
    registry.register(BYO_AUTHORISATION_CLIENT_DESCRIPTOR);
    registry.register(PROVIDER_CREDENTIAL_DESCRIPTOR);
    registry.register(REPLICATION_MATERIAL_DESCRIPTOR);

    const desc1 = registry.resolveClass('connector:notion:default:token');
    expect(desc1.class_id).toBe('connector_authorisation');

    const desc2 = registry.resolveClass('connector:google:byo:client_credentials');
    expect(desc2.class_id).toBe('byo_authorisation_client');

    const desc3 = registry.resolveClass('llm:provider:anthropic:api_key');
    expect(desc3.class_id).toBe('provider_credential');

    const desc4 = registry.resolveClass('auth:session:device_123');
    expect(desc4.class_id).toBe('replication_material');

    expect(() => registry.resolveClass('unknown:domain:id')).toThrowError(CredentialStoreError);
    try {
      registry.resolveClass('unknown:domain:id');
    } catch (err) {
      expect((err as CredentialStoreError).code).toBe('KEY_UNCLASSIFIED');
    }
  });
});
