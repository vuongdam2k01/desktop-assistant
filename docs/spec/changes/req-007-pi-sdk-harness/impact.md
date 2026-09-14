# Impact: req-007-pi-sdk-harness

Triggers found in the proposal: a non-empty `### Modified Capabilities` (`agent`, `approval`, `uix`), three new
contracts, and persistent storage touched — agent transcripts become a replicated store of their own. The delta
specs carry six `ADDED` requirement blocks and two `MODIFIED` ones. No `REMOVED` requirement, and no existing
contract is edited, because `docs/spec/capabilities/*/contracts/` is still empty: every contract this change
references is published by another change that is planned rather than archived.

## History Reviewed

| Capability | Archived Changes Read | Relevant Past Decisions | Historical Rationale |
| --- | --- | --- | --- |
| `agent` | None — `docs/spec/changes/archive/` is empty; nothing has been archived in this project | The living spec was seeded by `specdocs:harvest` from the product definition and already carries the wrapping obligation, the provider clause and the refusal-disclosure requirement that `req-009-rule-ir-hardgate` also states | The seeded wrapping requirement explicitly defers its mechanism to this change ("the wrapping mechanism is measured in `req-007-pi-sdk-harness`"). This change supplies that mechanism rather than overturning a decision. The seeded provider clause, by contrast, describes an interactive sign-in that the spike established cannot exist on the embedded path, and correcting it is the one place this change contradicts what was seeded |
| `approval` | None | Seeded from the product definition; extensively amended by `req-009-rule-ir-hardgate`, which publishes the gate contract, the strictest-wins rule, fail-closed evaluation and the rule that an expired approval is re-evaluated rather than executed | This change attaches at the point a verdict becomes an act and must not weaken any of it. The existing requirement "An unanswered approval pauses the job safely" is deliberately left untouched: this change adds what durable suspension means, and re-evaluation after expiry remains that requirement's business |
| `uix` | None | Seeded from the product definition; the composer's image count and size limits are marked as proposed in the source and are UNVERIFIED | The change narrows the composer's accepted input with the one limit that is measured. Nothing else in the composer requirement is altered |
| `job` | None; amended by `req-013-sqlite-ledger` | The lifecycle states, `recovering`, `waiting_user_confirmation`, and the rule that a job whose last call has no recorded outcome does not resume | This change's suspension defers to that recovery rather than defining a parallel one. A held call is an unresolved intent, which is a state `req-013` already classifies |
| `ledger` | None; amended by `req-013-sqlite-ledger` and `req-022-account-sync` | Two records per call joined by a correlation identifier; append is durable before return; one process opens the store for writing | The wrapping factory is one of the in-process callers `ledger-store@0.1.0` reserves appending to, and its suspension point reuses the correlation identifier rather than inventing a second index |
| `sync` | None | `req-022-account-sync` publishes the replicated store descriptor and already names a `transcripts` store in its examples, rejecting last-writer-wins for it | This change registers that store for real, with the resolution rule the earlier example established as the only admissible one |
| `platform`, `connector`, `app`, `pet`, `backend`, `undo` | None | Not modified here; read to enumerate consumers | `platform` supplies secure storage for provider credentials; `connector` will supply the tool declarations the factory requires; `app` and `uix` render transcripts and provider settings |

No archive exists to overturn. With no archived rationale to read, the seeded living specs, the sibling planned
changes and the constitution are the only history there is, and all three were read in full.

## Affected Components

| Type | Name | Current Version | Consumers | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| requirement | `agent` — "Model provider and role routing are configured on the client" | living spec, unversioned | `app` and `uix` (the settings surface), `platform` (credential storage), `req-017-provider-matrix` (the role matrix) | **BREAKING** | The interactive provider sign-in named in the seeded text is removed, because the embedded path does not have it — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q5). A consumer that built a sign-in affordance on the old text no longer holds. No such consumer exists yet, which is exactly why the correction belongs now |
| requirement | `uix` — "Composer accepts text and images with declared limits" | living spec, unversioned | `pet` and `app` (both host a composer), `agent` (receives the images) | **BREAKING** | A narrowing: images below 14 px in either dimension are now refused. Input previously accepted is now rejected, which is breaking in form even though every such image would have failed at the provider. Both existing scenarios are preserved verbatim and two are added |
| requirement | `agent` — "Every worker tool is wrapped by the gate and the ledger obligation" | living spec, unversioned | `connector`, `approval`, `ledger`, `job` | compatible, with an overlap to resolve | Not modified here. The new requirement "Tools reach the harness only through the wrapping factory" states obligations the existing one does not — a single factory, an empty default tool set, and independence from the engine's own interception facility — but the two now sit in one capability describing the same seam. `checklists/requirements.md` CHK015 puts that overlap to the reviewer rather than resolving it silently. Note also that `req-009-rule-ir-hardgate` carries a `MODIFIED` block for this requirement whose text is identical to the living spec; whichever change archives second must be re-read against the other |
| requirement | `agent` — three further additions; `approval` — two additions | new | as above | compatible | Additions only |
| contract | `agent/contracts/tool-wrapping` | new at 0.1.0 | `agent`, `approval`, `ledger`, `connector`, `job`, `undo` | compatible | No prior surface existed. It consumes `approval/contracts/gate-evaluation@0.1.0`, `ledger/contracts/ledger-record@0.1.0` and `job/contracts/tool-reconciliation@0.1.0`, all published by changes sequenced before this one |
| contract | `agent/contracts/agent-session` | new at 0.1.0 | `agent`, `job`, `approval`, `sync`, `ledger`, `app`, `uix` | compatible, with an obligation | Registers the `transcripts` store under `sync/contracts/replicated-store-descriptor@0.1.0`. The descriptor must be admitted by the validator that change owns |
| contract | `agent/contracts/provider-profile` | new at 0.1.0 | `agent`, `platform`, `app`, `uix`, `sync` | compatible, with an obligation | Requires a credential class for model-provider credentials under `platform/contracts/credential-class-descriptor@0.1.0`, which `req-012-secure-storage` already anticipates by naming a model-provider credential among its classes |
| stored-data | The `transcripts` store — turns, attached images, token usage, redaction markers | new | `agent`, `app`, `uix`, `sync` | compatible | No production data exists: the project has no application code and no users. The store is append-only with a 90-day retention floor matching the ledger's, so a job's conversation and its record expire together |
| cluster | `agent-runtime` (`pet`, `agent`, `job`) | — | — | — | Cross-cutting tests required: a command handed to the pet, a job created, a worker session started, a call held, a decision, a report |
| cluster | `trust-chain` (`ledger`, `undo`, `approval`) | — | — | — | Cross-cutting tests required: a failed ledger write at the wrapper, a refusal mid-job followed by undo of what completed, a decision recorded while a session is suspended |
| cluster | `desktop-shell` (`pet`, `app`, `uix`) | — | — | — | Cross-cutting tests required: the composer's new refusal on both hosts, and the read-only transcript surface |

## Decision: Merge or Split

**Split.** The three obligations this change creates are owned by other capabilities with their own planned
changes. Folding them in would widen an agent-runtime slice into a connector, storage and shell slice.

- **`connector` — carry the tool declarations the factory requires.** `agent/contracts/tool-wrapping@0.1.0`
  requires every tool declaration to state whether it writes, whether it is irreversible, whether it changes
  permission, how an interrupted call is reconciled and how its before state is read.
  `req-019-connector-framework` must carry all five in the manifest contract it freezes. The direction creates no
  cycle: this change states what it needs, that change supplies it. Until it lands, the factory is exercised with
  hand-written declarations of the same shape — recorded as task 2.7 rather than assumed.
- **`sync` — admit the `transcripts` store.** The descriptor in `agent/contracts/agent-session@0.1.0` §3 must be
  accepted by the validator `req-022-account-sync` owns. That change already names the store in its examples, so
  the work is registration rather than design. Whether a transcript replicates in full or in part is its open
  question and remains open; this change decides what a transcript contains, not how much of it travels.
- **`platform` — name the credential class for provider credentials.** `req-012-secure-storage` already
  enumerates a model-provider credential among its classes; this change fixes the key shape the profile declares,
  and the class descriptor must agree with it.

**Roadmap.** `.change.yaml` still records `depends_on: []`, matching the position `docs/spec/roadmap.md` takes in
its Ordering Rationale — that the edges are derived but not yet written into metadata, and that the
decision-maker should confirm the sequence first. This change does not write them unilaterally. When they are
written, this change's edges are R4 (`req-013-sqlite-ledger`) and R7 (`req-009-rule-ir-hardgate`), and the three
obligations above belong in the `Depends on` column of the consumer rows. `spec-check.mjs order` currently
reports three conflicts naming this change — R9, R13 and R14 declare dependencies on it in prose that the
topological order does not know about — and they resolve when those edges are recorded, not by an edit here.

## Versioning

| Contract | From | To | Rationale (MAJOR/MINOR/PATCH) |
| --- | --- | --- | --- |
| `agent/contracts/tool-wrapping` | — | 0.1.0 | First publication. `status: draft`; it freezes when the first connector implements against it |
| `agent/contracts/agent-session` | — | 0.1.0 | First publication, `status: draft` |
| `agent/contracts/provider-profile` | — | 0.1.0 | First publication, `status: draft` |

No bump is required anywhere else. `gate-evaluation@0.1.0`, `ledger-record@0.1.0`, `ledger-store@0.1.0`,
`tool-reconciliation@0.1.0`, `secure-storage@0.1.0`, `credential-class-descriptor@0.1.0` and
`replicated-store-descriptor@0.1.0` are consumed exactly as published; none is edited, and none is `frozen`.

## Migration & Rollback Needed?

**Yes**, and `design.md` carries it under `## Migration & Rollback`. There is nothing to migrate into: no user
data exists and no application code exists. What is recorded is the forward position for the two artifacts that
will outlive a build.

Transcripts replicate and are append-only, so a build meets turns written by another build; an unknown turn kind
is rendered as unreadable and retained rather than dropped, because a conversation with silent holes is worse
than one with a visible gap, and nothing is executed on the strength of a turn. Provider profiles also replicate
but are acted upon, so the opposite rule applies: a build meeting a profile written against a newer contract
version refuses to use it and says so, and the roles routed to it start no jobs. A rollback across a profile
MAJOR therefore stops jobs for those roles rather than sending a request somewhere the user did not intend.

The engine pin is the third migration surface. Raising or lowering it re-runs the bypass, resume-equivalence and
isolation suites before the pin is accepted, because the pin is what every measurement in `verification.md` is
attached to.

## Regression Scope (Copied to verification.md)

- `agent` — all scenarios
- `approval` — all scenarios
- `uix` — all scenarios
- `job` — all scenarios; the suspension states and the recovery classification are its
- `ledger` — all scenarios; every wrapped call writes two records
- `connector` — all scenarios; supplies the declarations the factory requires
- `platform` — all scenarios; holds the provider credentials
- `sync` — all scenarios; carries transcripts to the account
- `pet` and `app` — all scenarios; both host a composer and render a transcript
- cluster `agent-runtime` — cross-cutting integration tests
- cluster `trust-chain` — cross-cutting integration tests
- cluster `desktop-shell` — cross-cutting integration tests
