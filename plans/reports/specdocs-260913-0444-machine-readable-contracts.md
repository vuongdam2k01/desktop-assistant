# specdocs — machine-readable contracts (v0.3.0)

**Date**: 2026-09-13 · **Scope**: `plugins/specdocs/` only · **Result**: dual-compatible, all existing
documentation still validates 100%.

## 1. Phase 1 was already done — nothing to remove

The brief's first phase (remove `tasks.md`, `instructions apply`, `scaffold-tests`, the Greenfield Bootstrap
Check, code-flavoured lifecycle states) had already been carried out by the plugin's 0.2.0 migration, which is
documented in `plugins/specdocs/README.md` under *Migration 0.1.0 → 0.2.0*. Verified on disk before touching
anything:

- `schemas/design/schema.yaml` declares nine artifacts, none of them `tasks`.
- `bin/specdocs.mjs` exposes no `apply` and no `scaffold-tests`; `statusOf()` already emits
  `All planning artifacts complete; ready for review, sync or archive`.
- `references/workflow.md` defines the lifecycle as `planned · specified · approved · archived · blocked`, and
  states that a repository-structure decision is recorded as a design document, never as a request to build a
  skeleton.
- `find docs/spec -name tasks.md` → 0 results. Every skill lists "writing code" as out of scope.

Phase 1 therefore contributed a regression guard rather than edits: the baseline below had to survive the
Phase 2 work unchanged.

## 2. Files changed and why

| File | Change | Rationale |
| --- | --- | --- |
| `schemas/design/schema.yaml` | `contracts` artifact gains optional `companions` (four globs); instruction teaches the ownership rule; `model` instruction points physical data schemas at `contracts/` | `generates` stays `contracts/**/*.md`, so every existing change matches exactly as before and the drafter's output path stays Markdown. A separate list avoids brace globs, which the engine's `globToRegex()` deliberately does not support |
| `bin/specdocs.mjs` | `matchCompanions()`; `companions` accepted by `validateSchema()`; artifact completion is `generates` OR `companions`; `status`/`instructions` expose `companionGlobs` + `existingCompanionPaths`; new machine-file validators; `contract-test` accepts a linked `.json` schema | Recognition, progress and validation for machine-readable contracts. The existing `.md` front-matter loop is untouched, so Markdown contracts validate byte-identically |
| `scripts/spec-check.mjs` | Contract names strip machine suffixes; `surfaces` resolves a variability point to a machine file and reports `SURF_CONTRACT_UNOWNED`; `contractIndex` records each contract's machine files; `consumers` reports `CONS_MACHINE_ORPHAN` | Without this a machine-first contract would be invisible to the living-spec health checks after sync |
| `schemas/design/templates/contract.md` | Optional `schema_files` front-matter + `## Machine-Readable Artifacts` section; "link, do not transcribe" guidance | The document remains the carrier of version/status/owner/consumers; the machine file is the normative surface |
| `schemas/design/templates/model.md` | New `### 2. Physical Storage & Data Schema` (table linking DDL / JSON Schema held in `contracts/`) | Storage shape becomes a real artifact instead of prose, without duplicating DDL into the conceptual model |
| `schemas/design/templates/verification.md` | New `## Contract Conformance` section | Judges a frozen contract by an observable condition, never by a tool invocation — keeps the acceptance plan implementation-free |
| `references/machine-readable-contracts.md` | **New** — formats, ownership rule, severity table, authoring steps, lifecycle | Single place the skills and the drafter agent link to |
| `references/merge-rules.md`, `skills/sync/SKILL.md` | Machine files merge with their document as one unit; preserved old versions keep the whole set; unowned files are not merged | A contract must not reach `capabilities/` without its metadata carrier |
| `references/level-rules.md`, `references/workflow.md`, `skills/continue/SKILL.md`, `agents/drafter.md` | Authoring rules and drafting guidance | Freezing a contract in OpenAPI/DDL is specification, not implementation — stated explicitly so the boundary is not blurred |
| `README.md`, `plugin.json`, `.claude-plugin/plugin.json` | New section + *Migration 0.2.0 → 0.3.0*; version bump to 0.3.0 | `CONTRIBUTING.md` requires a bump and a migration note for schema/engine-contract changes |

### Validation severities

The engine is builtins-only and ships no YAML library, so it never pretends to be an OpenAPI validator:

| Finding | Level |
| --- | --- |
| `.json` failing `JSON.parse` | ERROR |
| JSON Schema structural fault | WARNING (ERROR under `--schema-validate`) |
| `.yaml` empty / tab-indented / quote unterminated at EOF | ERROR |
| OpenAPI/AsyncAPI missing `info`, `paths`/`channels`, malformed version | WARNING |
| `.yaml` the minimal reader cannot parse (anchors, flow collections) | INFO — never fails, not even `--strict` |
| `.sql` empty | ERROR |
| `.sql` unbalanced parentheses / no statement terminator | WARNING |
| machine file referenced by no contract document | WARNING (ERROR under `--strict`) |

## 3. Evidence — existing documentation is untouched

| Check | Before | After |
| --- | --- | --- |
| `specdocs doctor` | ✓ healthy · 12 capabilities · 22 changes · exit 0 | identical |
| `specdocs validate --all --strict` | 34/34 passed, exit 0 | **34/34 passed, exit 0** |
| `specdocs validate --all --strict --schema-validate` | 24/34 (pre-existing JSON Schema warnings in contract documents) | 24/34 — identical, and identical to the engine at `HEAD` |
| `specdocs schema validate design` / `lite` | valid | valid |
| `status --all` | every change `isPlanningComplete` | identical; **0 companion files matched** in the whole repository |
| `spec-check rtm` | 2 info · CLEAN | 2 info · CLEAN, `git diff docs/spec/rtm.md` empty |
| `spec-check surfaces` | 1 info · CLEAN | identical |
| `spec-check xcut` | 11 medium | identical |
| `spec-check evidence` | 1 medium · 1016 info | identical |
| `spec-check consumers` | 1 info · CLEAN | identical |
| `spec-check order` | 1 critical · 2 medium | identical |
| `spec-check depth` | 39 medium | identical |

The zero-companion-match result is the structural reason nothing could break: all 44 contract files in this
repository are `.md`, and the 22 `.change.yaml` files sit at change root, outside `contracts/`.

The `xcut`, `order` (dependency cycle across req-003/007/009/012/013/014/015/017/019) and `depth` findings are
pre-existing authoring debt in `docs/spec/`, unchanged by this work and out of its scope.

## 4. Evidence — a greenfield project can use the new formats

Built in a throwaway root (`specdocs init --root <scratch>`) so the repository was never mutated. Change
`sample-api` with `contracts/payments-api.md` owning `payments-api.openapi.yaml` (OpenAPI 3.1),
`payments-api.schema.json` (JSON Schema 2020-12) and `payments-store.sql` (DDL):

```
status   → done  contracts  contracts/**/*.md  (+3 machine-readable)
validate → ✓ change sample-api · 1/1 passed (also under --strict)
contract-test → ✓ payments-api v1.0.0 (1 error codes, 0 channels,
                  machine-readable: payments-api.openapi.yaml payments-api.schema.json payments-store.sql)
                ✓ JSON Schema structurally valid  ✓ Error codes unique  ✓ Front-matter complete
```

Negative cases, same root:

```
ERROR   broken.schema.json        invalid JSON: Expected ',' or '}' …
ERROR   tabbed.openapi.yaml:3     YAML: tab character used for indentation (YAML forbids tabs)
WARNING noinfo.openapi.yaml       OpenAPI document has no 'info' object
WARNING unbalanced.sql            SQL: parentheses are unbalanced (net 1) · no statement terminator (;) found
WARNING unbalanced.sql            Machine-readable contract is referenced by no contract document   [ERROR under --strict]
INFO    exotic.openapi.yaml       not readable by the built-in minimal YAML reader …; structure not checked
                                  → change still passes, including --strict
```

After copying the contract into `capabilities/payments/contracts/` with a `model.md` declaring an open
variability point linked to the `.yaml`: `surfaces` resolves the point through the machine file; removing the
document yields `SURF_CONTRACT_UNOWNED`; breaking the reference yields `CONS_MACHINE_ORPHAN`.

## 5. How a new change adds OpenAPI and SQL DDL

```
docs/spec/changes/<change>/contracts/
  payments-api.md                  version · status · owner · consumers · semantics · errors · compatibility
  payments-api.openapi.yaml        normative wire surface
  payments-api.schema.json         normative payload shape
  payments-store.sql               normative storage shape
```

1. Draft `contracts/<name>.md` as usual; list the files under `schema_files:` in front-matter and describe
   them under `## Machine-Readable Artifacts`.
2. Write each machine file beside it and link it from `## Schema / Surface` — every file must be referenced by
   its document, otherwise it has no owner, version or consumers and validation rejects it.
3. Link a storage schema from `model.md` under *Physical Storage & Data Schema*; the model keeps ownership,
   retention and migration posture, the file keeps the columns.
4. Record the observable conformance condition in `verification.md` under *Contract Conformance*.
5. Run `specdocs validate <change> --strict` and `specdocs contract-test <change>`.

Markdown-only contracts continue to work exactly as before; nothing in the 22 open changes needs editing.
Full rules: `plugins/specdocs/references/machine-readable-contracts.md`.

## Unresolved questions

None for this change. Separately, the `order` dependency cycle across nine changes and the 39 `depth` findings
remain open authoring debt in `docs/spec/`.
