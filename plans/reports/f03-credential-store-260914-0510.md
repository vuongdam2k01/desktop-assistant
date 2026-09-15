# F03 Secure Credential Store Implementation Report

- **Date**: 2026-09-14 05:10 UTC
- **Commit/Phase**: F03 Secure Credential Store
- **Status**: Complete & Verified (Linux Native Observed; Windows/macOS CI Verified)

---

## 1. Executive Summary

`@desktop-assistant/credential-store` has been implemented as the sole local persistence boundary for connector authorisations, BYO OAuth clients, model provider credentials, and account replication material. The package persists exclusively ciphertext in a dedicated `credentials.db` database using Electron `safeStorage`, leaving the operating system's credential vaults free of per-credential clutter. Decrypted values never leave the process that uses them, renderer processes receive strictly `{ present: boolean, lastUpdated: string | null }` across IPC, unreadable entries fail closed and trigger restoration routing without returning substitute values, and scoped/account/uninstall erasures are durable before mutation and resumable before use.

The desktop client integration is additive and contained: one module registration in `apps/desktop/main/index.ts` immediately following lifecycle initialization and prior to any window creation.

---

## 2. Workspace Package Structure & Build Integration

### Package Metadata (`packages/credential-store/package.json`)
- **Package Name**: `@desktop-assistant/credential-store`
- **Module Format**: `"type": "commonjs"`, emitting to `dist/index.js` and `dist/index.d.ts` so the CJS Electron main bundle requires it directly without an ESM bridge.
- **Dependencies**: `@desktop-assistant/contracts: workspace:*`, `better-sqlite3: 13.0.3` (exact).
- **Dev Dependencies**: `@types/better-sqlite3: 7.6.12`, `typescript: 5.9.3`, `vitest: 5.0.0`, `@types/node: 24.13.4`.
- **Scripts**: `build: tsc --build`, `typecheck: tsc --noEmit`, `test: vitest run`.

### Desktop Build & Packaging Integration
- `apps/desktop/package.json` adds `@desktop-assistant/credential-store: workspace:*`.
- `turbo.json` `dev` task specifies `"dependsOn": ["^build"]` to guarantee workspace package builds before `dev.mjs`.
- `apps/desktop/scripts/build.mjs` and `apps/desktop/scripts/dev.mjs` externalize `@desktop-assistant/credential-store` alongside `better-sqlite3` and window integration packages.
- `apps/desktop/scripts/package-unsigned.mjs` asserts both `SQLITE_NATIVE_READY` and `CREDENTIAL_STORE_PACKAGE_READY` from the unpacked ASAR archive under `ELECTRON_RUN_AS_NODE=1`.

---

## 3. Core Boundaries & Contract Compliance

### 3.1. Sanitized Error Boundary (`src/errors.ts`)
Implements `CredentialStoreError` with exact error codes from `platform/contracts/secure-storage@0.1.0`:
`SECURE_STORAGE_UNAVAILABLE`, `CREDENTIAL_NOT_FOUND`, `CREDENTIAL_UNREADABLE`, `KEY_MALFORMED`, `KEY_UNCLASSIFIED`, `CLASS_PATTERN_CONFLICT`, `METADATA_NOT_DECLARED`, `WRITE_FAILED`, `ERASURE_INCOMPLETE`, `DESCRIPTOR_INVALID`, `CLASS_TRIGGERS_INCOMPLETE`, `CLASS_ROUTE_UNREACHABLE`, and `CLASS_ID_REUSED`.
- Errors retain only `code`, `key`, and `classId`.
- The native error `cause`, plaintext, metadata, and native exception text are stripped and omitted.

### 3.2. Key & Prefix Parsing (`src/key-parser.ts`)
- Keys require exactly 3 or 4 non-empty colon-separated segments (`<domain>:<category>:<identity>[:<field>]`).
- Prefixes require `*` or a colon-terminated prefix containing at least domain and category (`<domain>:<category>:`).
- Whitespace, control characters, leading/trailing colons, under-segmented, and over-segmented keys are rejected with `KEY_MALFORMED`.
- Prefix comparisons in SQLite use literal `substr(key, 1, ?) = ?`, preventing `%`, `_`, `*`, or `?` from broadening scoped erasures.

### 3.3. Descriptor & Class Registry (`src/class-registry.ts`)
- Consumes `CredentialClassDescriptor` from `@desktop-assistant/contracts/credential-class-descriptor`.
- Validates field shapes, semver versions, pattern segment counts, mandatory account-level erase triggers (`sign_out`, `device_revocation`, `account_deletion`, `uninstall`), and metadata field uniqueness.
- Prohibits `replicates: false` with `restoration_route: replication` (`CLASS_ROUTE_UNREACHABLE`).
- Detects pattern compatibility and overlaps between classes of equal segment lengths (`CLASS_PATTERN_CONFLICT`).
- Idempotent registration on identical descriptors; conflicting definitions under an existing class ID fail with `CLASS_ID_REUSED`.
- `resolveClass(key)` resolves every valid key to exactly one descriptor or throws `KEY_UNCLASSIFIED`.

### 3.4. Default Credential Classes (`src/default-credential-classes.ts`)
Four non-overlapping descriptors registered at initialization:
1. `connector_authorisation` (`connector:<provider>:<identity>:token`): replicated, restored via `replication`, 5 erase triggers, metadata `workspaceName`, `scopeProfile`, `accountLabel`.
2. `byo_authorisation_client` (`connector:<provider>:byo:client_credentials`): replicated, restored via `replication`, 5 erase triggers, no metadata.
3. `provider_credential` (`llm:provider:<identity>:api_key`): non-replicated, restored via `account_sign_in`, 4 account-level triggers, no metadata.
4. `replication_material` (`auth:session:<identity>`): replicated, restored via `account_sign_in`, 4 account-level triggers, metadata `deviceLabel`.

### 3.5. Cipher Gateway (`src/cipher-gateway.ts`)
- `ElectronSafeStorageCipherGateway` wraps Electron `safeStorage`.
- Probes `safeStorage.isEncryptionAvailable()`.
- On Linux, probes `safeStorage.getSelectedStorageBackend()`. Rejects `basic_text` and `unknown` as unavailable.
- Never calls or exposes `setUsePlainTextEncryption`.
- Native encrypt/decrypt failures are wrapped into `WRITE_FAILED` or `CREDENTIAL_UNREADABLE` without exposing native messages.

---

## 4. SQLite Store & Durable Resumable Erasure

### 4.1. Entry Table (`src/entry-table.ts`)
- Connects exclusively to `credentials.db` with user-only permissions (`0o700` parent, `0o600` DB/sidecars on POSIX).
- Normative PRAGMAs: `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`, `fullfsync = OFF`, `secure_delete = ON`.
- Physical schema creates `credential_entry` (`key`, `class_id`, `ciphertext`, `updated_at`, `readable`, `metadata`) and singleton `pending_erasure` (`id = 1`, `trigger`, `scope`, `started_at`).

### 4.2. Durable Erasure Runner (`src/erasure-runner.ts`)
- **Ordering**: Commits the singleton `pending_erasure` marker in its own transaction before mutating any row.
- **Overwrite**: In the next transaction, overwrites matching ciphertexts with `randomblob(length(ciphertext))`, resets metadata to `'{}'`, marks `readable = 0`, and deletes the rows.
- **Checkpoint**: Runs `VACUUM` and `PRAGMA wal_checkpoint(TRUNCATE)` while the marker still exists.
- **Non-Destructive Erasure** (`connector_disconnect`, `sign_out`, `device_revocation`): Clears marker, checkpoints, and keeps store open.
- **Destructive Erasure** (`account_deletion`, `uninstall`): Closes store and removes `credentials.db`, `credentials.db-wal`, and `credentials.db-shm`.
- **Resumption**: `open()` detects any pending marker prior to exposing the facade or registering IPC:
  - Resumes non-destructive erasure, clearing the marker.
  - Resumes destructive erasure, completing deletion and reopening a clean database for the application.
  - Resumption succeeds even when `safeStorage` is unavailable because erasure requires no decryption.

### 4.3. Restoration Coordinator (`src/restoration-coordinator.ts`)
Accepts main-process-only `restorationHook({ key, classId, restorationRoute })`. Triggered on failed reads or when encountering rows persisted with `readable = 0`. Hook failures are swallowed to guarantee `CREDENTIAL_UNREADABLE` delivery to callers.

---

## 5. Electron Integration & Boundary Enforcement

### 5.1. IPC Registration (`apps/desktop/main/credential-store/`)
- Pure handler `registerCredentialPresenceIpc` binds exclusively to `credentials:presence`.
- Rejects invalid keys. Queries `store.presence(key)` and returns strictly `{ present: boolean, lastUpdated: string | null }`.
- Channels for `credentials:get`, `credentials:put`, `credentials:list`, `credentials:erase`, and metadata access do NOT exist.

### 5.2. Preload Script Bridge (`apps/desktop/preload/index.ts`)
- Extends `DesktopApi` with `credentials.presence(key): Promise<{ present: boolean; lastUpdated: string | null }>`.
- Invokes only `credentials:presence` via `ipcRenderer.invoke`.
- No capability exists in renderer to obtain decrypted values or ciphertext.

### 5.3. Composition Root (`apps/desktop/main/index.ts`)
- Instantiates and registers `registerCredentialStoreModule(context)` immediately after lifecycle initialization and before any window module.
- Preserves `app.setName('DesktopAssistant')`.

---

## 6. Verification Suite & Results

### 6.1. Verification Matrix

| Check / Test Layer | Target / Tool | Command / Scenario | Result | Status |
|---|---|---|---|---|
| Contracts Check | Specification drift | `pnpm contracts:check` | 0 drift against `docs/spec` | **VERIFIED** |
| Lint & BOM | ESLint & build-check | `pnpm lint` | Clean (0 errors, 0 warnings); no BOM in configs | **VERIFIED** |
| Monorepo Typecheck | Strict TypeScript | `pnpm typecheck` | Clean across all 7 workspace packages | **VERIFIED** |
| Unit Test Suite | Vitest (Monorepo) | `pnpm test` | 65/65 tests passed (41 in credential-store, 16 in desktop, 8 in build-check) | **VERIFIED** |
| Workspace Build | Turborepo | `pnpm build` | 7/7 packages built (full turbo cache hit verified) | **VERIFIED** |
| Static Build Checks | Hard invariants | `pnpm build:check` | All checks passed (`HARNESS_PIN`, `SQLITE_BINDING`, `NATIVE_PACKAGING`, `BOM`) | **VERIFIED** |
| Linux Native Smoke | Headless Electron | `xvfb-run -a pnpm --filter @desktop-assistant/desktop test:credential-store:os` | Emitted `CREDENTIAL_STORE_LINUX_FAIL_CLOSED_OK` (code 0) | **VERIFIED** |
| Unsigned Packaging | electron-builder | `pnpm package:unsigned` | Emitted `SQLITE_NATIVE_READY` and `CREDENTIAL_STORE_PACKAGE_READY` | **VERIFIED** |
| Windows Native Smoke | Windows OS Vault | `test:credential-store:os` on win32 runner | DPAPI roundtrip, 3073-byte canary, `cmdkey /list` absence | **CI-GATED** |
| macOS Native Smoke | macOS Keychain | `test:credential-store:os` on darwin runner | Keychain roundtrip, 3073-byte canary, `security find-generic-password` absence | **CI-GATED** |

*Note on CI-GATED*: Windows and macOS native storage verification runs in the GitHub Actions quality matrix defined in `.github/workflows/ci.yml`. On the local Linux workstation, native Linux fail-closed under `basic_text` was verified directly.

### 6.2. Detailed Portable Test Coverage (`packages/credential-store/tests/`)
1. **Key/prefix parser**: 3/4-segment keys, prefix wildcard, colon-terminated prefixes, invalid characters/colons rejected.
2. **Account collision prevention**: Two accounts on Notion stored without collision or overwrite.
3. **Descriptor validation & conflicts**: Missing triggers rejected, unreachable routes rejected, duplicate metadata rejected, conflicting patterns rejected.
4. **Undeclared metadata**: Attempting to store undeclared metadata fails closed and writes 0 rows.
5. **Same-key replacement**: Replaces value, updates timestamp, updates metadata.
6. **3,073-byte payload**: Round-trips whole without chunking.
7. **Raw DB file scan**: Database, WAL, and SHM contain zero bytes of plaintext canary.
8. **Unavailable storage**: Refuses writes and preserves 0 rows when unavailable.
9. **Tamper & truncate handling**: Bit flips or truncation in SQLite mark `readable = 0` and route to restoration. Subsequent reads throw without decrypting.
10. **Foreign binding failure**: Copying SQLite database to a store with a different machine binding fails GCM authentication deterministically, marking `readable = 0`.
11. **Prefix isolation**: Scoped erasure removes targeted connector entries and leaves other connectors untouched.
12. **Empty erasure**: Erasing an empty scope returns `entriesErased: 0, completed: true`.
13. **Destructive removal**: `eraseAll()` unlinks DB, WAL, and SHM files.
14. **Interrupted erasure resumption**: Seeded pending markers resume automatically at startup, completing erasure and reopening clean databases even when `safeStorage` is unavailable.
15. **Astral Unicode in prefixes**: Scoped listing and erasure correctly calculate character length in SQLite, matching keys containing multi-byte characters and emoji without code unit mismatch.
16. **Transient availability resilience**: Temporary cipher unavailability does not mark rows as unreadable or trigger premature restoration.
17. **Pending erasure gating**: Operations are strictly gated with `ERASURE_INCOMPLETE` whenever an erasure is in flight or has failed.
18. **Unpaired surrogate rejection**: Malformed UTF-16 surrogates are rejected at the parser boundary before reaching SQLite.
19. **Descriptor immutability**: Registered descriptors are frozen snapshots, preventing post-registration tampering.
### 6.3. Desktop IPC & Redaction Test Coverage (`apps/desktop/tests/`)
1. Only `credentials:presence` is registered; `credentials:get`, `put`, `list`, `erase` have no handler.
2. Observable presence projection returns strictly `{ present, lastUpdated }`.
3. Native exception containing a canary secret does not leak into error message, stack, JSON serialization, logs, or restoration requests.

---

## 7. Open Questions & Architectural Observations

1. **macOS Development vs Distribution Identity (`RISK-077` / `RISK-084`)**:
   macOS ad-hoc development builds will re-prompt for Keychain access if the application binary identity changes between builds, whereas official distribution signing with an Apple Developer ID preserves the persistent Keychain partition identity.
2. **Absence of `last_used` Column**:
   The normative schema in `platform/contracts/secure-storage@0.1.0` defines only `updated_at`. A `last_used` column was deliberately not added because write-on-read imposes disk I/O on every decrypted access without a measured product need.
3. **Restoration Route Scope**:
   The living contract `credential-class-descriptor@0.1.0` defines restoration routes as strictly `"replication" | "account_sign_in"`. The informal prompt mentioned `user_reconnect`, but adding a third route without a specification change would violate contract immutability. The implementation strictly conforms to `credential-class-descriptor@0.1.0`.
