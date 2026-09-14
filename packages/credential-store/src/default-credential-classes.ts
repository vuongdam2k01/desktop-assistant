import type { CredentialClassDescriptor } from '@desktop-assistant/contracts/credential-class-descriptor';

export const CONNECTOR_AUTHORISATION_DESCRIPTOR: CredentialClassDescriptor =
  Object.freeze({
    class_id: 'connector_authorisation',
    version: '0.1.0',
    name: 'Connector Authorisation',
    key_pattern: 'connector:<provider>:<identity>:token',
    owner: 'connector',
    replicates: true,
    restoration_route: 'replication',
    erase_on: Object.freeze([
      'connector_disconnect',
      'sign_out',
      'device_revocation',
      'account_deletion',
      'uninstall',
    ]) as unknown as CredentialClassDescriptor['erase_on'],
    metadata_fields: Object.freeze([
      'workspaceName',
      'scopeProfile',
      'accountLabel',
    ]) as unknown as string[],
  });

export const BYO_AUTHORISATION_CLIENT_DESCRIPTOR: CredentialClassDescriptor =
  Object.freeze({
    class_id: 'byo_authorisation_client',
    version: '0.1.0',
    name: 'BYO Authorisation Client',
    key_pattern: 'connector:<provider>:byo:client_credentials',
    owner: 'connector',
    replicates: true,
    restoration_route: 'replication',
    erase_on: Object.freeze([
      'connector_disconnect',
      'sign_out',
      'device_revocation',
      'account_deletion',
      'uninstall',
    ]) as unknown as CredentialClassDescriptor['erase_on'],
    metadata_fields: Object.freeze([]) as unknown as string[],
  });

export const PROVIDER_CREDENTIAL_DESCRIPTOR: CredentialClassDescriptor =
  Object.freeze({
    class_id: 'provider_credential',
    version: '0.1.0',
    name: 'Model Provider Credential',
    key_pattern: 'llm:provider:<identity>:api_key',
    owner: 'platform',
    replicates: false,
    restoration_route: 'account_sign_in',
    erase_on: Object.freeze([
      'sign_out',
      'device_revocation',
      'account_deletion',
      'uninstall',
    ]) as unknown as CredentialClassDescriptor['erase_on'],
    metadata_fields: Object.freeze([]) as unknown as string[],
  });

export const REPLICATION_MATERIAL_DESCRIPTOR: CredentialClassDescriptor =
  Object.freeze({
    class_id: 'replication_material',
    version: '0.1.0',
    name: 'Replication Material',
    key_pattern: 'auth:session:<identity>',
    owner: 'sync',
    replicates: true,
    restoration_route: 'account_sign_in',
    erase_on: Object.freeze([
      'sign_out',
      'device_revocation',
      'account_deletion',
      'uninstall',
    ]) as unknown as CredentialClassDescriptor['erase_on'],
    metadata_fields: Object.freeze(['deviceLabel']) as unknown as string[],
  });

export const DEFAULT_CREDENTIAL_DESCRIPTORS: readonly CredentialClassDescriptor[] =
  Object.freeze([
    CONNECTOR_AUTHORISATION_DESCRIPTOR,
    BYO_AUTHORISATION_CLIENT_DESCRIPTOR,
    PROVIDER_CREDENTIAL_DESCRIPTOR,
    REPLICATION_MATERIAL_DESCRIPTOR,
  ] as const);
