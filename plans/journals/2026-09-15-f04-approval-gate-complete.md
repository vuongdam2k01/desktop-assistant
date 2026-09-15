---
title: F04 Approval Gate Implementation Complete
date: 2026-09-15
summary: "Implemented application-layer deterministic approval gate in packages/approval-gate with Rule IR, pure evaluator, hardline blocklist, 3 modes, and 0/20 adversarial leaks"
---

# F04 Approval Gate Implementation Complete

## What happened

Implemented `@desktop-assistant/approval-gate` at `packages/approval-gate` according to Constitution Principle II (Hard Gate Outside The LLM Loop) and specification `req-009-rule-ir-hardgate`.

Key deliverables:
1. **Rule IR & Validator**: Full schema validation with Ajv 2020 Draft conforming to `rule-representation@1.0.0`. Validates representation version, origin restrictions, and regex patterns.
2. **Hardline Blocklist (HL-01..03)**: Non-negotiable system rules evaluated before mode checks, returning `unappealable: true`.
3. **Pure Synchronous Evaluator**: Evaluates 8 predicate kinds (tool, scope with ancestor hierarchy, field changes/becomes/removes, ownership, count, time, irreversibility, permission) + and/or/not. Benchmark measured $p99 = 0.0440\text{ ms} \ll 1.0\text{ ms}$.
4. **Normalizer**: Canonical property name normalization (`due_date`, `dueDate`, `Due date`) and extraction of nested values from platform payloads (Notion select/status/rich_text).
5. **Rule & Allowlist SQLite Store**: Auxiliary SQLite database `rules.sqlite` managed via `better-sqlite3`, enforcing fail-closed write halting on corruption or schema invalidity.
6. **Decision API & Scoped Grants**: 4 decision levels (`once`, `job`, `allowlist`, `deny`). Scoped grant strictly bound to `(jobId, ruleId, tool, objectScope)` with automatic purge on job termination.
7. **Suspension & Late Approval Re-check**: Durable suspension manager with 30-minute timeout and pluggable `StateRecheckHook` fail-closed check.
8. **Ledger Count Reader**: Asynchronously queries `LedgerStore` for `CountLeaf` conditions (`writes`, `creates`, `distinctObjects`, `fieldChanges`) across `job` and `calendarDay` boundaries.
9. **Refusal Disclosure**: `RefusalRegister` tracks stopped operations and attaches disclosures to subsequent questions within the same job.
10. **Test Coverage & SP-8 Port**: 7 test files, 50 automated tests passing, with 100% interception (0/20 leakage) across all 20 adversarial cases ported from SP-8.

## Decision

- **Q-OQ-2 Ratified**: Irreversible write operations default to requiring approval in `smart` and `on` modes.
- **Auxiliary Rule Database**: Stored in `rules.sqlite` separate from append-only ledger to uphold `INV-APPROVAL-07`.
- **Pre-fetch Ledger Counts**: Pre-fetched in context builder to maintain synchronous purity of `evaluate()`.
- **Tier 2 Smart Fallback**: Fails closed to `hold` when F15 risk judge model is unattached.
- **Late Approval Re-check**: Fails closed with `BEFORE_STATE_DRIFTED` if object state changed or cannot be re-acquired.

## Next steps

- F05: Integrate approval gate wrapper into Pi SDK Agent Harness.
- F15: Implement Tier 2 LLM Risk Judge hook for smart mode.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
