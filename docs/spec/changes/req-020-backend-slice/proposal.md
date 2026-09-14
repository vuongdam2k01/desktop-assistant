> **Constitution notice**: this change was the direct evidence for principle VII at constitution 1.0.0. `req-022-account-sync` redefined that principle at 2.0.0, and the demonstrated invariant — that the server holds no user work content — no longer holds. The change is retained because its schema, interface and load results remain valid; its privacy claim is superseded.

> **Amended 2026-09-12** by `req-022-account-sync`: the backend now stores the account's replicated data encrypted at rest, so the four-table schema is a floor rather than the whole server-side shape, and the "no work content on the server" invariant is withdrawn.

## Why

Harvested from `spikes/SP-20-backend-slice/REPORT.md`. The spike built a vertical slice of the backend and proved its privacy boundary by dumping the database.

## Problem

The backend's value depends entirely on a boundary that is easy to state and easy to erode: it authenticates the user, brokers connector authorisation, and serves update manifests — and it must never hold a connector token or see the content of the user's work. A boundary asserted in a document drifts; a boundary demonstrated against the live schema does not.

- A real database dump proves the server stores no connector token and holds no work content — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#0-ket-luan`).
- The authorisation broker generalises to a new provider in 19 lines of configuration — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#0-ket-luan`).
- The standard connect flow costs the user three clicks — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#0-ket-luan`).
- The slice held 200 concurrent connections, twice the planned beta scale, at a 0.00% error rate — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#0-ket-luan`).

## Cost of inaction

The boundary is what made a backend acceptable in a device-bound product. Since `req-022-account-sync`, the server does hold the account's data, so the original guarantee is gone and what replaces it is narrower: the server uses that content for nothing beyond serving replication back to the same account, with key access confined to that path and audited. That replacement is weaker and easier to erode, which is exactly why it has to be written down and checked rather than assumed.

## Options

### Option A — Specify the four-table schema and the interface, boundary included
- **Sketch**: the backend's persistent shape is fixed at account, device, session and invite allowlist. The interface description is a contract, and the absence of token and content storage is an invariant that can be tested against the schema.
- **Appetite**: medium (weeks).
- **Trade-offs**: makes the privacy claim checkable rather than aspirational; constrains future backend features to an explicit amendment.
- **Rabbit holes**: designing for scheduler features the current phase does not build.

### Option B — Minimum viable slice: no backend until it is needed
- **Sketch**: run the desktop client alone and defer authentication, brokering and updates.
- **Appetite**: small (days).
- **Trade-offs**: nothing to operate; contradicts the commitment that the first user exercises the real sign-in, connect and update flows, and defers every operational lesson.
- **Rabbit holes**: none.

## Recommendation

Option A. The boundary invariant is the reason to write the schema down now, while it is small enough to be obvious.

## What Changes

- The four verified tables — account, device, session, invite allowlist — remain the authentication and brokering core — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`). **SUPERSEDED** by `req-022-account-sync`: the measured property that no connector token or work content is stored — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#0-ket-luan`) — describes the architecture as it stood at constitution 1.0.0 and is no longer a design invariant. An encrypted replication store and a device registry sit alongside these four tables, and no spike has yet measured that arrangement.
- The interface specification produced by the spike becomes the backend contract — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- The authorisation provider configuration shape is the extension point for future providers — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Backend outage is a bounded failure: running jobs and existing connections continue because model calls go client-direct, so only new sign-in and new connector authorisation are blocked — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#2-tac-dong-len-adr-prd`).
- Production deployment requires connection pooling, and read/write separation if scale exceeds the beta, since 200 concurrent writers on a development machine pushed median latency to about 1.5 s — VERIFIED (`spikes/SP-20-backend-slice/REPORT.md#4-rui-ro-moi-phat-hien`).

## Capabilities

REQUIRES spec-impact — defines persistent server-side storage and the client-server interface contract.

### New Capabilities
- `backend`: authentication, authorisation broker, update manifest serving, four-table schema, privacy boundary invariant.

### Modified Capabilities
- `connector`: the connect flow routes through the broker while the token lands only on the client.

## Impact

Server schema and migrations, the client-server interface, deployment topology, and the degraded-mode behaviour the client shows during a backend outage.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle VII as redefined at 2.0.0 — this change no longer evidences it. The replication store and key custody it now implies are specified by `req-022-account-sync`; what survives here is the requirement that the backend execute no job business logic, which this change does evidence. Principle VIII — sign-in and connect are the official flows the first user exercises. No violation, but the privacy claim in this proposal is superseded rather than merely reworded.

## Assumptions

- Beta scale is the design point; the load result is a headroom measurement, not a capacity plan.
