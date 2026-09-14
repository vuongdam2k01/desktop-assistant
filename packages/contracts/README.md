# @desktop-assistant/contracts

Generated TypeScript interfaces and runtime schemas from the specification corpus (`docs/spec/**/contracts/`).

## Contract Catalog

<!-- CONTRACTS_TABLE_START -->
| Contract | Version | Descriptor Source | Eligible Artifacts | Superseded Versions |
| --- | --- | --- | --- | --- |
| `agent-session` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/agent-session.md` | agent-session.schema.json | 0.1.0 (docs/spec/changes/req-007-pi-sdk-harness/contracts/agent-session.md) |
| `ask-user` | `0.1.0` | `docs/spec/changes/req-021-ask-user-offline/contracts/ask-user.md` | ask-user.schema.json | *(None)* |
| `authorisation-broker-api` | `0.1.0` | `docs/spec/changes/req-020-backend-slice/contracts/authorisation-broker-api.md` | authorisation-broker-api.openapi.yaml | *(None)* |
| `authorisation-provider-descriptor` | `0.1.0` | `docs/spec/changes/req-020-backend-slice/contracts/authorisation-provider-descriptor.md` | authorisation-provider-descriptor.schema.json | *(None)* |
| `byo-authorisation-client` | `0.1.0` | `docs/spec/changes/req-014-byo-oauth-google/contracts/byo-authorisation-client.md` | byo-authorisation-client.schema.json | *(None)* |
| `byo-setup-guide` | `0.1.0` | `docs/spec/changes/req-014-byo-oauth-google/contracts/byo-setup-guide.md` | byo-setup-guide.schema.json | *(None)* |
| `capability-pack` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/capability-pack.md` | capability-pack.schema.json | *(None)* |
| `client-session-api` | `0.1.0` | `docs/spec/changes/req-020-backend-slice/contracts/client-session-api.md` | client-session-api.openapi.yaml, client-session-api.sql | *(None)* |
| `connector-adapter` | `1.0.0` | `docs/spec/changes/req-019-connector-framework/contracts/connector-adapter.md` | connector-adapter.schema.json | *(None)* |
| `connector-manifest` | `1.2.0` | `docs/spec/changes/req-015-concurrency-coordinator/contracts/connector-manifest.md` | connector-manifest.schema.json | 1.1.0 (docs/spec/changes/req-003-notion-compensation/contracts/connector-manifest.md); 1.0.0 (docs/spec/changes/req-019-connector-framework/contracts/connector-manifest.md); 0.1.0 (docs/spec/changes/req-001-mvp-product-definition/contracts/connector-manifest.md) |
| `context-assembly` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/context-assembly.md` | context-assembly.schema.json | *(None)* |
| `coordination-declaration` | `0.1.0` | `docs/spec/changes/req-015-concurrency-coordinator/contracts/coordination-declaration.md` | coordination-declaration.schema.json | *(None)* |
| `credential-class-descriptor` | `0.1.0` | `docs/spec/changes/req-012-secure-storage/contracts/credential-class-descriptor.md` | credential-class-descriptor.schema.json | *(None)* |
| `device-registry` | `0.1.0` | `docs/spec/changes/req-022-account-sync/contracts/device-registry.md` | device-registry.openapi.yaml | *(None)* |
| `drive-content-projection` | `0.1.0` | `docs/spec/changes/req-014-byo-oauth-google/contracts/drive-content-projection.md` | drive-content-projection.schema.json | *(None)* |
| `gate-evaluation` | `0.1.0` | `docs/spec/changes/req-009-rule-ir-hardgate/contracts/gate-evaluation.md` | *(None - code-level only)* | *(None)* |
| `job-delegation` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/job-delegation.md` | job-delegation.schema.json, job-delegation.sql | *(None)* |
| `ledger-record` | `0.1.0` | `docs/spec/changes/req-013-sqlite-ledger/contracts/ledger-record.md` | ledger-record.schema.json | *(None)* |
| `ledger-store` | `0.1.0` | `docs/spec/changes/req-013-sqlite-ledger/contracts/ledger-store.md` | ledger-store.sql | *(None)* |
| `localisation-resources` | `0.1.0` | `docs/spec/changes/req-001-mvp-product-definition/contracts/localisation-resources.md` | localisation-resources.schema.json | *(None)* |
| `native-window-manager` | `1.0.0` | `docs/spec/changes/req-008-pet-window-os/contracts/native-window-manager.md` | native-window-manager.schema.json | *(None)* |
| `notion-property-compensation` | `0.1.0` | `docs/spec/changes/req-003-notion-compensation/contracts/notion-property-compensation.md` | notion-property-compensation.schema.json | *(None)* |
| `offline-queue` | `0.1.0` | `docs/spec/changes/req-021-ask-user-offline/contracts/offline-queue.md` | offline-queue.sql, offline-queue.schema.json | *(None)* |
| `pet-pack-manifest` | `1.0.0` | `docs/spec/changes/req-024-pet-pack-framework/contracts/pet-pack-manifest.md` | pet-pack-manifest.schema.json, pet-pack-store.sql | *(None)* |
| `privacy-filter` | `1.0.0` | `docs/spec/changes/req-018-pet-liveness/contracts/privacy-filter.md` | privacy-filter.schema.json | *(None)* |
| `provider-configuration` | `0.1.0` | `docs/spec/changes/req-001-mvp-product-definition/contracts/provider-configuration.md` | provider-configuration.schema.json | *(None)* |
| `provider-failure` | `0.1.0` | `docs/spec/changes/req-017-provider-matrix/contracts/provider-failure.md` | provider-failure.schema.json | *(None)* |
| `provider-profile` | `0.1.0` | `docs/spec/changes/req-007-pi-sdk-harness/contracts/provider-profile.md` | provider-profile.schema.json | *(None)* |
| `public-service-endpoints` | `0.1.0` | `docs/spec/changes/req-020-backend-slice/contracts/public-service-endpoints.md` | public-service-endpoints.openapi.yaml | *(None)* |
| `replicated-store-descriptor` | `0.1.0` | `docs/spec/changes/req-022-account-sync/contracts/replicated-store-descriptor.md` | replicated-store-descriptor.schema.json | *(None)* |
| `replication-protocol` | `0.1.0` | `docs/spec/changes/req-022-account-sync/contracts/replication-protocol.md` | replication-protocol.openapi.yaml, replication-protocol.sql | *(None)* |
| `resource-coordinator` | `0.1.0` | `docs/spec/changes/req-015-concurrency-coordinator/contracts/resource-coordinator.md` | resource-coordinator.schema.json | *(None)* |
| `risk-judge` | `0.1.0` | `docs/spec/changes/req-011-risk-judge/contracts/risk-judge.md` | risk-judge.schema.json, risk-judge.request.schema.json | *(None)* |
| `rive-state-machine` | `2.0.0` | `docs/spec/changes/req-024-pet-pack-framework/contracts/rive-state-machine.md` | rive-state-machine.schema.json, rive-state-machine.set-state.schema.json | 1.0.0 (docs/spec/changes/req-005-electron-rive-pet-render/contracts/rive-state-machine.md) |
| `role-registry` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/role-registry.md` | role-registry.schema.json, agent-runtime-store.sql | *(None)* |
| `role-routing` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/role-routing.md` | role-routing.schema.json | 0.1.0 (docs/spec/changes/req-017-provider-matrix/contracts/role-routing.md) |
| `rule-elicitation` | `0.1.0` | `docs/spec/changes/req-004-rule-elicitation/contracts/rule-elicitation.md` | rule-elicitation.schema.json, rule-elicitation.turn.schema.json | *(None)* |
| `rule-representation` | `1.0.0` | `docs/spec/changes/req-009-rule-ir-hardgate/contracts/rule-representation.md` | rule-representation.schema.json, rule-representation.sql | 0.1.0 (docs/spec/changes/req-001-mvp-product-definition/contracts/rule-representation.md) |
| `runtime-lifecycle` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/runtime-lifecycle.md` | runtime-lifecycle.schema.json | *(None)* |
| `secret-redaction` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/secret-redaction.md` | secret-redaction.schema.json | *(None)* |
| `secure-storage` | `0.1.0` | `docs/spec/changes/req-012-secure-storage/contracts/secure-storage.md` | secure-storage.sql | *(None)* |
| `skill-manifest` | `1.0.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/skill-manifest.md` | skill-manifest.schema.json | *(None)* |
| `tool-reconciliation` | `0.1.0` | `docs/spec/changes/req-013-sqlite-ledger/contracts/tool-reconciliation.md` | tool-reconciliation.schema.json | *(None)* |
| `tool-wrapping` | `0.2.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/tool-wrapping.md` | tool-wrapping.schema.json | 0.1.0 (docs/spec/changes/req-007-pi-sdk-harness/contracts/tool-wrapping.md) |
| `undo-pipeline` | `1.0.0` | `docs/spec/changes/req-010-undo-agent/contracts/undo-pipeline.md` | undo-pipeline.schema.json, undo-pipeline.execute.schema.json | *(None)* |
| `update-feed` | `1.1.0` | `docs/spec/changes/req-023-macos-platform-baseline/contracts/update-feed.md` | update-feed.openapi.yaml, update-feed.schema.json | 1.0.0 (docs/spec/changes/req-016-signing-update/contracts/update-feed.md) |
| `usage-accounting` | `0.1.0` | `docs/spec/changes/req-017-provider-matrix/contracts/usage-accounting.md` | usage-accounting.schema.json, usage-accounting.unit-price.schema.json | *(None)* |
| `window-integration-module` | `1.0.0` | `docs/spec/changes/req-023-macos-platform-baseline/contracts/window-integration-module.md` | *(None - code-level only)* | *(None)* |
| `worker-loop` | `0.2.0` | `docs/spec/changes/req-025-pi-agent-system/contracts/worker-loop.md` | worker-loop.schema.json, worker-loop.prompt-context.schema.json | 0.1.0 (docs/spec/changes/req-006-agent-loop/contracts/worker-loop.md) |
<!-- CONTRACTS_TABLE_END -->
