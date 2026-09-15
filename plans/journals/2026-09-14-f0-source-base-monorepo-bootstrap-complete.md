---
title: F0 Source Base Monorepo Bootstrap Complete
date: 2026-09-14
summary: "Established pnpm monorepo, contracts generator, Electron desktop shell, Fastify service, native skeletons, and 4 build checks"
---

# F0 Source Base Monorepo Bootstrap Complete

## What happened

Bootstrapped the initial Desktop Assistant monorepo structure from scratch according to the architectural specifications and locked bootstrap decisions.

Key deliverables:
1. Root workspace configuration with exact pinned toolchain (Node 24.21.0, pnpm 12.4.1, TypeScript 5.9.3, Turborepo 2.10.12).
2. Contracts package (`@desktop-assistant/contracts`) discovering 49 logical contracts, 47 with eligible artifacts (61 eligible inputs: 46 JSON Schema, 6 OpenAPI, 9 SQL), resolving highest-version winners and generating TypeScript types and runtime schemas.
3. Tooling build check package (`@desktop-assistant/build-check`) enforcing 4 non-vacuous invariants: harness pins, SQLite bundled prebuilds, packaging asar unpack rules, and UTF-8 BOM absence.
4. Backend Fastify service (`@desktop-assistant/backend`) with PostgreSQL connection pool probing, rate-limiting, and public endpoints.
5. Target-only native capability skeletons (`win32-window` and `macos-window`) with cross-platform dispatcher `tooling/native-target.mjs`.
6. Electron desktop shell (`@desktop-assistant/desktop`) with two windows (transparent topmost pet window and React/Tailwind management window), additive extension seams, and unsigned packaging verification (`SQLITE_NATIVE_READY`).
7. Cross-platform CI workflow (`.github/workflows/ci.yml`) including clean-machine proof without C++ toolchain.

## Decision

- Enforced exact package versions without ranges across manifests and lockfile.
- Kept native module compilation opt-in via `pnpm native:build` to preserve clean-machine build guarantees.
- Selected highest semantic version for all contract descriptors while documenting superseded versions in `packages/contracts/README.md`.
- Implemented composition roots with strict one-line-per-module registration.

## Next steps

- F01: Implement SQLite Local Store and Action Ledger (`better-sqlite3`).
- F02: Implement Job Manager for worker agent coordination.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
