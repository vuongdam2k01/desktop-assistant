# F10 Peer-Backend Slice Implementation & Verification Report

- **Date**: 2026-09-14 04:54 UTC
- **Slice**: F10 — Production Peer-Backend Slice (`apps/backend`)
- **Status**: Complete & Verified
- **Living Specs**: `docs/spec/changes/req-020-backend-slice`, `docs/spec/constitution.md` (v2.0.0)

---

## 1. Executive Summary

The production peer-backend slice in `apps/backend` has been fully implemented and verified against real PostgreSQL 18 and Redis 8 instances. The implementation strictly respects the peer-backend architectural boundaries defined in Constitution Principle VII, ADR-005..008, and req-020:
- **No Control Plane**: The backend exposes zero job, agent, approval, ledger, undo, or connector-execution endpoints. Arbitrary probe requests to `/v1/jobs`, `/v1/agents`, `/v1/ledger`, `/v1/undo`, or `/v1/commands` return HTTP `404 Not Found`.
- **Zero Token Retention**: The backend acts solely as an ephemeral OAuth broker and never retains provider access/refresh tokens, client secrets, or user platform content. Raw database table dumps and Redis key inspections prove zero credentials or transcripts exist server-side.
- **Exact Four-Table Store**: The relational store contains exactly four tables: `account`, `device`, `invitation`, and `session`. No token tables, audit logs, command queues, or migration metadata tables exist.
- **Hard Pre-Guard Rate Limiting**: Distributed rate limiting (`@fastify/rate-limit` backed by Redis) runs at `onRequest`, strictly before signature verification, session loading, or database queries.
- **Fail-Closed Operations**: Plain HTTP requests receive HTTP `426 HTTPS_REQUIRED`. Account deletion fails closed with `503` if replicated account destruction fails, retaining PostgreSQL rows for retry.
- **Disaster Recovery Rehearsal**: Forward-only migrations, `pg_dump -Fc` with mode `0600` libpq environment authentication, and automated isolated restore rehearsal with constraint and credential sentinel verification are fully functional.

---

## 2. Store Boundary & Retention Proof

### 2.1. Normative Four-Table Schema Verification
PostgreSQL schema is established via `migrations/0001-auth-broker-store.sql` run through forward-only migration runner `src/cli/migrate.ts` with session-level advisory lock (`428901234`). Obsolete F0 `pgmigrations` table was dropped.

`dump-auth-store.ts` queries `information_schema.tables` and verifies that the schema contains exactly the four normative relations:

```json
{
  "tables": [
    "account",
    "device",
    "invitation",
    "session"
  ]
}
```

### 2.2. Zero-Retention Evidence
A complete end-to-end integration flow (`tests/integration/full-flow-store-boundary.test.ts`) exercised:
1. Allowlist invitation creation.
2. Sign-in from Device 1 (`MacBook`).
3. Sign-in from Device 2 (`Windows Desktop`).
4. OAuth authorize-url, code exchange, and token refresh for **Notion** (using Basic header client authentication).
5. OAuth authorize-url, code exchange with PKCE S256, and token refresh for **Google** (using body client authentication).
6. Full inspection of raw PostgreSQL rows and all Redis keys before deletion:
   - **Issued Session Tokens**: Raw access tokens and refresh tokens do not appear in the database; only one-way SHA-256 hashes exist in `session.refresh_token_hash`.
   - **Provider Tokens**: The issued Notion and Google access/refresh tokens were completely absent from all database tables and Redis keys.
   - **Client Secrets**: `dev-notion-client-secret` and `dev-google-oauth-client-secret` were absent from all database tables and Redis keys.
   - **User Content & Ledger**: Zero records relating to tasks, jobs, tools, or ledger exist.
   - **Redis Content**: Stored keys were strictly ephemeral rate limit counters and consumed OAuth bindings (`oauth:binding:<hash>`).

---

## 3. Identity, Admission & Session Lifecycle

### 3.1. Identity Verification Before Admission
- `GoogleIdentityVerifier` validates Google ID tokens via `google-auth-library` against `GOOGLE_SIGN_IN_CLIENT_ID`.
- Requires verified email (`email_verified === true`) and subject (`sub`).
- Identity verification occurs **before** any account lookup; an invalid token always yields `401 IDENTITY_INVALID` without revealing account existence.

### 3.2. Closed-Beta Allowlist & Invitation Transitions
- Managed via `src/cli/allowlist.ts` (`add`, `list`, `revoke`).
- An active invitation admits exactly one address and transitions to `redeemed` upon first sign-in, binding `activated_account_id`.
- Re-opening redeemed or revoked invitations is rejected.
- Revoking an invitation transactionally revokes all active sessions for that account and clears `activated_account_id` to satisfy the constraint `((status = 'redeemed') = (activated_account_id IS NOT NULL))`.
- Empty, missing, expired, or withdrawn invitations consistently return `403 EMAIL_NOT_IN_ALLOWLIST`.

### 3.3. Two-Phase JWT Signing Key Rotation
- `SessionTokenService` signs tokens with HS256 using `jose`.
- Key ring format: `{ "currentKid": "k2", "keys": { "k1": "...", "k2": "..." } }`.
- All keys validated as $\ge 256$ bits (32 bytes).
- Headers carry `kid`; payloads carry issuer, audience, account `sub`, session ID, device ID, `tokenUse`, and expiry.
- Verified in `session-token-service.test.ts`: tokens signed with `k1` continue to verify while new sessions are signed with `k2`.

### 3.4. Session Token Lifecycle & Atomic Rotation
- Access tokens expire in 15 minutes (900s).
- Refresh tokens expire in 30 days (2,592,000s) and include a random UUID nonce.
- `POST /v1/auth/refresh`: atomically rotates refresh token and hash in PostgreSQL within `FOR UPDATE OF s`.
- Replaying a prior refresh token is rejected with `401 TOKEN_INVALID`.
- `POST /v1/auth/logout`: revokes only the calling device's session; returns `otherSessionsRetained` count.
- Deleted accounts return `410 ACCOUNT_DELETED` for both access and refresh tokens.

---

## 4. Distributed Rate Limiting & Denial Ordering

- Plugin `src/plugins/rate-limit.ts` is backed by Redis and registered globally off, installed per route at `onRequest`.
- Route classes:
  - `public`: `/v1/health`, `/v1/app/version`, `/updates/*`
  - `authentication`: `/v1/auth/google`, `/v1/auth/refresh`, `/v1/auth/logout`, `/v1/account`
  - `brokering`: `/v1/oauth/:provider/authorize-url`, `/v1/oauth/:provider/exchange`, `/v1/oauth/:provider/refresh`
- **Execution Order**: When rate limit is exceeded, `@fastify/rate-limit` intercepts at `onRequest` and returns `429 RATE_LIMITED` with `Retry-After` header and `retryAfterSeconds` body field. This occurs strictly before `authenticateSession` runs at `preHandler`, before any cryptographic signature verification, and before any PostgreSQL query.

---

## 5. Provider-Descriptor OAuth Broker

### 5.1. Data-Only Descriptors
- Located at `apps/backend/config/providers/notion.json` and `google.json`.
- Validated at startup using Ajv against `authorisation-provider-descriptor@0.1.0` JSON schema.
- **Notion**: Header client authentication (`credentials-in-header`), no PKCE, no revoke endpoint, extra param `owner: "user"`.
- **Google**: Body client authentication (`credentials-in-body`), PKCE S256 (`usesProofKey: true`), revoke endpoint `https://oauth2.googleapis.com/revoke`, extra param `access_type: "offline"`.
- Descriptors declare secret references (`clientIdRef`, `clientSecretRef`), never raw credentials.

### 5.2. Atomic Single-Use Bindings
- `AuthorizationBindingStore` generates 256-bit base64url binding; stores key as `oauth:binding:<sha256>`.
- Active TTL: 10 minutes; tombstone retention: 10 minutes.
- Evaluated via atomic Redis Lua script:
  - Different session/provider: returns `BINDING_UNKNOWN` without consuming victim's binding.
  - Redirect URI mismatch: consumes binding and returns `REDIRECT_MISMATCH`.
  - Concurrent double exchange: first request atomically sets status to `consumed` and proceeds to provider; second request receives `BINDING_CONSUMED` without contacting provider.

### 5.3. Outbound Provider Calls & Error Mapping
- Provider calls bound by 10-second timeout.
- Network/timeout errors mapped to `424 PROVIDER_UNREACHABLE`.
- Provider 4xx errors mapped to `424 PROVIDER_REJECTED` with sanitized `providerReason`.
- Provider response bodies are never logged.
- Unknown response fields forwarded under `providerExtras` without server interpretation or caching.

---

## 6. Public Health, Version & Static Update Feed

- `GET /v1/health`: Probes store reachable via `SELECT 1`; returns `healthy/storeReachable: true` with `uptimeSeconds`. Discloses zero account details.
- `GET /v1/app/version`: Returns current version, minimum supported version, mandatory update boolean, and optional manifest/release notes URIs.
- `GET /updates/*`: Serves from dedicated configurable `UPDATE_FEED_ROOT` via `@fastify/static`.
  - Manifests (`.yml`, `.yaml`): `text/yaml; charset=utf-8` and `Cache-Control: no-cache, must-revalidate`.
  - Artifacts (`.dmg`, `.exe`, `.blockmap`, `.zip`): `application/octet-stream` and `Cache-Control: public, max-age=31536000, immutable`.
  - Supports flat files (`latest.yml`) and F24 nested paths (`darwin/arm64/latest.yml`).
  - Supports RFC 7233 range requests: full 200, resumable 206 with `Accept-Ranges: bytes` and `Content-Range`, unsatisfiable 416, and missing 404.

---

## 7. Irreversible Account Deletion

- Interface `AccountDataLifecycle` provides the port for F22 encrypted replication.
- When `REPLICATION_ENABLED=false`, `EmptyAccountDataLifecycle` is installed.
- Flow on `DELETE /v1/account`:
  1. Ephemeral provider revocation: visits provider authorizations and invokes RFC 7009 revoke endpoint for providers that declare it (e.g. Google); returns `withdrawn`, `failed`, or `no-revocation-endpoint` per provider.
  2. Calls `destroyReplicatedAccount`: if this fails, deletion aborts with `503 SERVICE_UNAVAILABLE`, retaining PostgreSQL account and session rows so authenticated retry is preserved.
  3. Deletes activated invitation and deletes the account in a single transaction (cascading device and session rows).
  4. Response returns `accountDeleted: true`, `devicesRemoved`, `sessionsRevoked`, and `providerWithdrawals`.
  5. Subsequent calls with any token for that account immediately return `410 ACCOUNT_DELETED`.

---

## 8. Operations, Security, Backup & Load Tooling

### 8.1. Secret Scanning Gate
- `scripts/scan-secrets.ts` scans source, config, dist, and logs for private keys, Google client secrets, client IDs, raw JWTs, and bearer tokens.
- Never prints matched secret values.
- Integrated directly into `pnpm build` (`tsup src/server.ts --format esm --out-dir dist && tsx scripts/scan-secrets.ts`).

### 8.2. Database Backup & Restore Rehearsal
- `src/cli/backup-database.ts`: invokes `pg_dump -Fc` without shell; passes credentials via child process environment; writes mode `0600`; atomically renames; writes SHA-256 metadata JSON; prunes backups older than 30 days.
- `src/cli/restore-rehearsal.ts`: restores dump into randomly generated `rehearsal_<timestamp>_<random>` database; validates 4-table schema, row counts, constraints, refresh hash non-reusability, and absence of credential sentinels; drops rehearsal database in `finally`.
- Both CLIs tested and verified against real Docker PostgreSQL.

### 8.3. Load & Capacity Benchmark Evidence
Ran `scripts/run-load-test.ts` with `autocannon` at 200 concurrent connections for 10 seconds against the running service:

| Endpoint | Connections | Requests/sec | Latency p50 | Latency p99 | Error Rate | Notes |
|----------|-------------|--------------|-------------|-------------|------------|-------|
| `GET /v1/health` | 200 | 2,006.50 | 95 ms | 155 ms | 0.00% | Probes real PostgreSQL `SELECT 1` on every request |
| `GET /v1/app/version` | 200 | 3,908.30 | 49 ms | 76 ms | 0.00% | In-memory configuration response |

*Note: The local development machine numbers serve as comparative capacity evidence and are explicitly not claimed as production release thresholds.*

---

## 9. Open Questions & Integration Status

- **OQ-11 (AWS Placement Baseline)**: The operational runbook specifies AWS Singapore (`ap-southeast-1`) with ALB, RDS PostgreSQL, and ElastiCache Redis as the engineering baseline. OQ-11 remains labeled `OPEN` in the living specification pending formal product/compliance sign-off.
- **OQ-8 (Availability Target)**: The 99.5% monthly availability target is noted as an operational baseline and labeled `UNVERIFIED` until empirical staging/production telemetry is gathered.
- **Deferred Pre-requisite (F7 Client Connect Outage)**: Because `connectors/` is currently `.gitkeep` and F7 is not yet merged, the end-to-end scenario of client connect interruption during an external job is recorded as `DEFERRED: F7 integration prerequisite`. F10 proves backend-side sign-in and connect operations are fail-closed and leave no partial state.

---

## 10. Complete Verification Matrix

All gates executed and passing 100%:

| Verification Command | Scope | Result | Details |
|----------------------|-------|--------|---------|
| `pnpm contracts:check` | `@desktop-assistant/contracts` | **PASS** | Contracts in sync with `docs/spec` |
| `pnpm lint` | Workspace root | **PASS** | ESLint clean (0 errors, 0 warnings); BOM check clean |
| `pnpm typecheck` | Workspace (6 packages) | **PASS** | Strict TypeScript clean across all packages |
| `pnpm --filter @desktop-assistant/backend test:unit` | Backend unit tests | **PASS** | 20/20 tests passed in 4 test files |
| `pnpm --filter @desktop-assistant/backend test:integration` | Backend integration tests | **PASS** | 28/28 tests passed in 5 test files |
| `pnpm test` | All workspace tests | **PASS** | 48 backend + 10 contracts + 11 desktop + 8 build-check |
| `pnpm --filter @desktop-assistant/backend build` | Backend bundling + secret scan | **PASS** | `dist/server.js` 69.72 KB; secret scan clean |
| `pnpm build` | All workspace builds | **PASS** | Turborepo build clean |
| `pnpm --filter @desktop-assistant/backend db:dump` | Database store boundary | **PASS** | Exactly 4 tables; zero credential or work records |
| `pnpm --filter @desktop-assistant/backend backup:create` | Database backup CLI | **PASS** | Custom format dump + SHA-256 metadata generated |
| `pnpm --filter @desktop-assistant/backend backup:restore-rehearsal` | Disaster recovery CLI | **PASS** | Temporary DB created, verified, and dropped cleanly |
| `node plugins/specdocs/bin/specdocs.mjs validate req-020-backend-slice --strict` | Specdocs delta validation | **PASS** | Delta specs validated strictly |
| `node plugins/specdocs/scripts/spec-check.mjs all` | Specdocs integrity suite | **PASS** | Total: 1220 (0 critical, 0 high, 0 medium, 0 low) -> CLEAN |
