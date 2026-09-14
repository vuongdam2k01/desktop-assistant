# Impact: req-013-sqlite-ledger

Triggers found in the proposal: a non-empty `### Modified Capabilities` (`job`), and persistent storage touched
throughout — the local schema, its indexes, its guards and its migration procedure. The delta specs add two
`MODIFIED` requirement blocks. No `REMOVED` requirement and no existing contract is edited, because no contract
exists in `docs/spec/capabilities/*/contracts/` yet.

## History Reviewed

| Capability | Archived Changes Read | Relevant Past Decisions | Historical Rationale |
| --- | --- | --- | --- |
| `ledger` | None — `docs/spec/changes/archive/` is empty; no change has been archived in this project | The living spec was seeded by `specdocs:harvest` from the PRD and amended by `req-022-account-sync`, which is planned but not archived | Append-only and ledger-before-act come from constitution principle III and predate any change. `req-022-account-sync` added the device identifier, the per-device sequence and append-and-reconcile, and RISK-065 records why last-writer-wins is forbidden for this store. This change must not weaken any of it |
| `job` | None | The state list and the crash requirement were seeded from the PRD as UNVERIFIED, with the crash requirement explicitly deferring to `req-013-sqlite-ledger` for measurement | The living `job` spec already says recovery "determines whether the external operation happened before deciding to resume or fail" and already has the scenario for an effect that cannot be read back. This change supplies the mechanism the seeded text was written in anticipation of, rather than overturning a decision |
| `platform` | None | Seeded from the PRD and from `spikes/SP-0-gui-harness`; amended by `req-022-account-sync` for replication material in secure storage | The existing requirement that launching at login reconciles interrupted jobs before the pet window is shown is the seed of this change's classification requirement. Nothing here reverses it; the change splits the reconciliation into the part that must precede the window and the part that must not |
| `uix`, `app`, `undo`, `approval`, `connector`, `sync` | None | Not modified by this change; read to enumerate consumers | Read for impact only. `uix` fixes exactly seven card types and resolves unmatched conditions to a SYSTEM card, which matters for the new job state below |

No archive exists to overturn. The absence is the reason this table is longer than it would otherwise be: with
no archived rationale to read, the seeded living specs and the constitution are the only history there is, and
both were read in full.

## Affected Components

| Type | Name | Current Version | Consumers | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| requirement | `ledger` — "The ledger is append-only" | living spec, unversioned | `undo`, `approval`, `sync`, `app`, `uix` | compatible | Strengthened, not relaxed: enforcement moves into the store itself. The clause permitting removal by retention and deliberate deletion resolves a latent contradiction with the existing retention requirement rather than creating one — the living spec previously said records are never deleted and, four requirements later, that they are deleted after 90 days |
| requirement | `job` — "Job lifecycle states are fixed and timestamped" | living spec, unversioned | `app` (job list is filterable by state and pins `waiting_approval`), `uix` (cards reference job states) | **BREAKING** | Two states are added: `recovering` and `waiting_user_confirmation`. Any surface that enumerates states, filters by them, or maps them to a card must handle both. This is the one genuinely breaking item in this change |
| requirement | `job` — "No job is lost across a crash" | living spec, unversioned | `app`, `uix`, `undo` | compatible | Both existing scenarios are preserved verbatim; four are added and the statement is narrowed to forbid resuming past an unresolved intent. A consumer relying on the old text still holds |
| requirement | `ledger` — five new requirements; `platform` — three new requirements | new | as above | compatible | Additions only |
| contract | `ledger/contracts/ledger-record` | new at 0.1.0 | `ledger`, `job`, `undo`, `approval`, `connector`, `sync`, `app`, `uix`, `agent` | compatible | Already referenced without a version by `req-009-rule-ir-hardgate` (`model.md:224`, `design.md:46`) and `req-022-account-sync` (`model.md:236`). Publishing it at 0.1.0 satisfies those references; both changes are planned, neither is archived, so neither needs editing |
| contract | `ledger/contracts/ledger-store` | new at 0.1.0 | `ledger`, `job`, `approval`, `undo`, `connector`, `sync`, `platform`, `app`, `uix` | compatible | No prior surface existed |
| contract | `job/contracts/tool-reconciliation` | new at 0.1.0 | `job`, `ledger`, `connector`, `undo`, `app`, `uix` | compatible, with an obligation | Requires a field in the tool declaration that `connector/contracts/connector-manifest` carries. That contract is owned by `req-019-connector-framework`, which the roadmap sequences after this change; the obligation is recorded below rather than silently assumed |
| stored-data | The local store — jobs, approval requests, action records, indexes, guards | new | every capability that reads history | compatible | There is no existing production data: the project has no application code and no users. Migration machinery is introduced now because the first shape change after release will have data, not because this change migrates any |
| cluster | `trust-chain` (`ledger`, `undo`, `approval`) | — | — | — | Cross-cutting tests required: a crash during an undo, a crash while an approval decision is being recorded, a failed ledger write at the gate |
| cluster | `account-sync` (`sync`, `ledger`, `backend`, `platform`) | — | — | — | Cross-cutting tests required: a crash while a record was replicating; append-and-reconcile against records this change writes |

## Decision: Merge or Split

**Split.** The two consumer obligations this change creates are owned by other capabilities with their own
planned changes, and folding them in would widen a storage slice into a shell and connector slice.

- **`connector` — carry the reconciliation declaration.** `job/contracts/tool-reconciliation@0.1.0` defines the
  declaration's shape; `req-019-connector-framework` must carry it as a field of the tool declaration in the
  manifest contract it freezes. The direction is correct and creates no cycle: this change owns the contract,
  that change consumes it. Until it lands, every tool falls back to "cannot be read back", which is the safe
  reading and is specified, so this change is implementable before it.
- **`app` and `uix` — present two new job states.** The job list filters by state and must offer the new ones;
  the dialog surface must present a job in `waiting_user_confirmation` as a question the user can answer. The
  `uix` spec already answers how, without an eighth card type: a confirmation is a question with bounded
  options, which is what an ASK card is, and the fallback for anything that fits no type is a SYSTEM card. The
  choice between the two is a `uix` decision, not one this change should make on its behalf.

**Roadmap.** `.change.yaml` now records `depends_on: [req-022-account-sync]`, which matches the roadmap's R4
row and removes the ordering conflict `spec-check.mjs order` reported for it. The two obligations above should
be added to the `Depends on` column of the consumer rows — `req-019-connector-framework`, and the shell rows
that own the job list and the dialog surface — by `specdocs:roadmap`. That edit changes other changes'
sequencing, so it is recorded here as required rather than made from inside this change.

## Versioning

| Contract | From | To | Rationale (MAJOR/MINOR/PATCH) |
| --- | --- | --- | --- |
| `ledger/contracts/ledger-record` | — | 0.1.0 | First publication. `status: draft`; it freezes when the first consumer implements against it |
| `ledger/contracts/ledger-store` | — | 0.1.0 | First publication, `status: draft` |
| `job/contracts/tool-reconciliation` | — | 0.1.0 | First publication, `status: draft` |

No bump is required anywhere else: no existing contract is edited, because none exists yet in the living
capabilities.

## Migration & Rollback Needed?

**Yes**, and `design.md` carries both under `## Migration & Rollback`. Forward: a shape version on the store,
steps applied in order before any other use, additive steps that add fields without backfilling them, and
restructuring steps that copy records unchanged inside one transaction that also recreates the guard. A step
that would rewrite a record is refused. Rollback: an older product version refuses to open a newer shape rather
than misreading it; a copy is taken before a restructuring step and retained until the first successful start on
the new shape, and restoring it loses the records written since the step — which the product states before
restoring rather than after.

The requirement that makes this checkable rather than merely designed is
`specs/ledger/spec.md` — "A change to the store's shape leaves existing records as they were written".

## Regression Scope (Copied to verification.md)

- `ledger` — all scenarios
- `job` — all scenarios
- `platform` — all scenarios
- `undo` — all scenarios; consumer of `ledger/contracts/ledger-record@0.1.0`
- `approval` — all scenarios; every decision is a record, and the failed-write path is the fail-closed one
- `connector` — all scenarios; supplies the declaration and the read operation recovery calls
- `sync` — all scenarios; carries these records to the account
- `uix` — all scenarios; rebuilds the blocking queue from job state and the ledger
- `app` — all scenarios; renders job detail from records
- cluster `trust-chain` — cross-cutting integration tests
- cluster `account-sync` — cross-cutting integration tests
