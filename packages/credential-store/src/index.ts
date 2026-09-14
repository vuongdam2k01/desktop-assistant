export {
  CredentialStore,
  type CredentialStoreOptions,
  type CredentialPresence,
  type RendererCredentialPresence,
} from './credential-store.js';

export {
  CredentialStoreError,
  type CredentialStoreErrorCode,
  type CredentialStoreErrorOptions,
} from './errors.js';

export {
  parseCredentialKey,
  parseCredentialPrefix,
  type ParsedCredentialKey,
} from './key-parser.js';

export {
  CredentialClassRegistry,
} from './class-registry.js';

export {
  CONNECTOR_AUTHORISATION_DESCRIPTOR,
  BYO_AUTHORISATION_CLIENT_DESCRIPTOR,
  PROVIDER_CREDENTIAL_DESCRIPTOR,
  REPLICATION_MATERIAL_DESCRIPTOR,
  DEFAULT_CREDENTIAL_DESCRIPTORS,
} from './default-credential-classes.js';

export {
  type CipherGateway,
  type SafeStorageLike,
  ElectronSafeStorageCipherGateway,
} from './cipher-gateway.js';

export {
  type ErasureTrigger,
  type ErasureState,
  type ErasureOutcome,
} from './erasure-runner.js';

export {
  type RestorationRequest,
  type RestorationHook,
} from './restoration-coordinator.js';
