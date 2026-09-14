> **Constitution notice**: this change is the source document behind every ratified principle (I–VIII). Any edit to its scope must be checked against `docs/spec/constitution.md` before adoption.

> **Amended 2026-09-12** by `req-022-account-sync`: the PRD describes a device-bound, local-first product. That is superseded — data is account-owned and replicates to every signed-in device — and a twelfth capability, `sync`, now exists.

## Why

Harvested from `docs/raw-idea/prd-mvp.md` — the frozen PRD v2.1 that defines the Desktop Assistant MVP. This change carries that definition into the spec system as capability baselines, a risk ledger and a clarification queue.

## Problem

The whole product intent lives in one 128 KB narrative document covering eleven modules, fifteen risks and fifteen open questions. Nothing in it is addressable: a requirement cannot be cited, a risk cannot be tracked to closure, and an open question cannot block the artifact it actually blocks. Every contributor must re-read the whole document to learn what one capability owes.

- The MVP is a desktop client holding all product logic paired with a peer backend doing authentication, OAuth brokering and update manifests only — UNVERIFIED (`docs/raw-idea/prd-mvp.md#1-tong-quan`). **SUPERSEDED** by `req-022-account-sync`: the backend additionally stores the account's replicated data encrypted at rest.
- Four architectural decisions are locked by the product owner and bind every requirement: decentralized pet-agent, ledger + compensating undo + three approval modes, three separated functional dimensions, dual-channel scheduling — UNVERIFIED (`docs/raw-idea/prd-mvp.md#6-cac-quyet-dinh-kien-truc-da-khoa`).
- Eleven functional modules are specified: PET, AG, NT, LG, UD, AP, APP, BE, INT, CF, GM/DR — UNVERIFIED (`docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr`).

## Cost of inaction

The twenty spike reports already contradict or refine PRD statements in ways nobody is tracking (rate-limit numbers, `NFR-SEC-01` wording, the `ADR-005` and `ADR-009` identifier collisions recorded in this harvest). Without a spec baseline those corrections stay scattered across reports, and the PRD silently ages into a document everyone cites and nobody trusts.

## Options

### Option A — Seed all eleven capabilities, then sequence per-capability changes
- **Sketch**: every domain gets a `spec.md` whose `## Purpose` comes from its PRD module. Later changes fill requirements domain by domain, each citing spikes for anything numeric.
- **Appetite**: large (months, spread across the roadmap).
- **Trade-offs**: the full product becomes addressable and traceable; costs a long authoring runway before any capability is complete.
- **Rabbit holes**: re-litigating frozen PRD decisions while transcribing them; letting `## Purpose` grow into a second copy of the PRD.

### Option B — Minimum viable slice: specify the trust chain only
- **Sketch**: specify `ledger`, `undo` and `approval` first; leave the other eight capabilities as `TBD — ` placeholders until the trust chain is proven.
- **Appetite**: medium (weeks).
- **Trade-offs**: fastest route to the surfaces that carry the most risk; leaves the pet, connector and backend work without a spec while they are being designed.
- **Rabbit holes**: the trust chain reaches into connector manifests and job lifecycle, so the "slice" quietly widens.

## Recommendation

Option A. The eleven domains were already ratified as `specdocs.domains` during init, and the roadmap needs every one of them present — even as a stub — before it can sequence anything.

## What Changes

- Eleven capability directories seeded with `## Purpose` derived from the corresponding PRD module; a twelfth, `sync`, was added by `req-022-account-sync`.
- Fifteen PRD risks (`R-1`..`R-15`) recorded in `docs/spec/risks.md`.
- Seven still-open PRD questions recorded in `clarifications.md`; the eight already marked closed in the PRD are not re-opened.

## Capabilities

REQUIRES spec-impact — this change touches persistent storage design, contracts and every capability.

### New Capabilities
- `pet`, `agent`, `job`, `connector`, `approval`, `ledger`, `undo`, `app`, `backend`, `uix`, `platform`: seeded from PRD §10 modules.
- `sync`: added by `req-022-account-sync`; it has no PRD module, because the PRD predates the decision.

### Modified Capabilities
None — no capability exists yet.

## Impact

Every subsystem. The eleven seeded capabilities become the merge destinations for the twenty spike-derived changes in this harvest, so their names and boundaries are load-bearing from here on.

## Refs

None. This project declares no upstream traceability anchor; `docs/raw-idea/prd-mvp.md` is background material, cited by section slug rather than by requirement ID.

## Constitution check

The PRD was the source of all eight principles ratified at constitution 1.0.0: principle I from §6 QĐ-1, principles II and IV from §6 QĐ-2, principle III from §10.4, principle V from §10.2, principle VI from §10.10, principles VII and VIII from §1. Principle VII no longer derives from the PRD — `req-022-account-sync` redefined it at 2.0.0 from a decision-maker directive, and the PRD's local-first framing in §1 is superseded. The other seven still transcribe rather than revise. No violation.

## Assumptions

- PRD sections marked `[Đề xuất]` (proposed) are treated as unratified and are not carried into capability Purpose text.
- PRD open questions marked `ĐÃ CHỐT`, `ĐÓNG` or `ĐÃ THAY THẾ` are closed and are not re-queued for clarification.
