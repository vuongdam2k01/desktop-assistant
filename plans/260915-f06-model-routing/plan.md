# Implementation Plan: F6 — Model Provider Profiles & Role Routing

- **Date**: 2026-09-15
- **Feature Worktree**: `feat/f06-model-routing`
- **Ownership**: `packages/model-routing` (`@desktop-assistant/model-routing`)
- **Dependencies**: F3 (`@desktop-assistant/credential-store`), F1 (`@desktop-assistant/ledger-store`), `@desktop-assistant/contracts`
- **Status**: Completed & Verified (`/ak:cook --auto`)

---

## 1. Context & Architecture Review

`packages/model-routing` owns model provider profiles, role routing, provider failure classification, and usage accounting for Desktop Assistant:
- **Bring-Your-Own-Provider**: Users supply their own API keys or custom completion endpoints. No interactive CLI sign-in.
- **Role Routing**: 6 core roles (`pet-text`, `pet-image`, `worker`, `rule-elicitation`, `undo`, `risk-judge`). Keyed as extensible string registry (`role-routing@1.0.0`).
- **Capability Gating**: Checked at assignment time and request dispatch time (`pet-image` requires vision; `worker` and `undo` require tool calling; all require text).
- **Suitability Grounding**: Built-in suitability records from empirical spikes (`SP-2`, `SP-10`, `SP-17`). Cheap models are forbidden for `rule-elicitation`. Unmeasured models require explicit user acknowledgement.
- **Fail-Closed Resolution (INV-AG-23)**: If an assignment cannot run (missing capability, unassigned, or absent credential on current device), resolution fails naming the role; no silent substitution.
- **Job Routing Snapshots**: Resolution is frozen for running jobs in SQLite (`job_routing_snapshot`) so mid-job setting changes do not disrupt active execution.
- **Failure Classification**: Provider errors and empty streams (0 tokens, no content, no error) are classified into 6 closed causes (`CREDENTIAL_REFUSED`, `MODEL_UNAVAILABLE`, `QUOTA_EXHAUSTED`, `ENDPOINT_UNREACHABLE`, `RESPONSE_UNUSABLE`, `CONFIGURATION_AHEAD`) and mapped to remedies for F19 `SYSTEM` cards.
- **Usage Accounting**: Write-once immutable usage records per request with exact decimal pricing (at least 6 decimal places), currency, and cost basis. Unreported usage is flagged `reported: false` (not 0). Derived read-time totals per job and per role.

---

## 2. Implementation Phases

| Phase | Title | Scope & Objectives | Key Deliverables |
|---|---|---|---|
| **Phase 1** | Package Scaffolding & Types | Set up `packages/model-routing`, `package.json`, `tsconfig.json`, core types, errors, and SQLite schema DDL. | [DONE] `package.json`, `tsconfig.json`, `src/types.ts`, `src/errors.ts`, `src/schema.ts` |
| **Phase 2** | Suitability & Profile Store | Implement static suitability verdicts and SQLite-backed profile store validating declared capabilities and credential handles. | [DONE] `src/suitability.ts`, `src/profile-store.ts` |
| **Phase 3** | Role Routing Registry | Implement routing table storage, capability gating, unmeasured confirmation, default proposal, and SQLite job routing snapshots. | [DONE] `src/routing-registry.ts` |
| **Phase 4** | Failure Classifier & Notice Registry | Implement 6-cause classification, error mappings, and in-memory deduplicated standing failure notices. | [DONE] `src/failure-classifier.ts`, `src/failure-registry.ts` |
| **Phase 5** | Usage Accounting Store | Implement write-once usage records with decimal cost arithmetic, price book management, and derived job usage queries. | [DONE] `src/usage-accounting.ts` |
| **Phase 6** | Request Dispatcher & Pi Provider Adapter | Implement request dispatcher with pre-dispatch capability check, credential resolution via F3, stream monitoring, and empty-response failure detection. | [DONE] `src/dispatcher.ts` |
| **Phase 7** | IPC Integration & Desktop Main Wire-in | Implement IPC contract handlers (`routing/*`, `usage/*`, `provider-failure/*`) and register module in Electron main process. | [DONE] `src/ipc.ts`, `src/model-routing-module.ts`, `apps/desktop/main/model-routing/` |
| **Phase 8** | Comprehensive Tests & Verification | Implement unit and scenario test suites verifying all agent spec scenarios, empirical failure modes, and monorepo build checks. | [DONE] `packages/model-routing/tests/*.test.ts` (49/49 passed) |
- `pnpm typecheck` and `pnpm test` pass across the entire monorepo.
- `pnpm build:check` passes all 4 non-vacuous checks (harness, sqlite, packaging, bom).
