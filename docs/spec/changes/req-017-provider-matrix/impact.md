# Impact: req-017-provider-matrix

Triggers found in the proposal: a non-empty `### Modified Capabilities` (`agent`, `pet`, `uix`, `app`), three new
contracts, and persistent storage touched — the routing table, the price book and one usage record per model
request. The delta specs carry four `MODIFIED` requirement blocks and ten `ADDED` ones. No requirement is
`REMOVED`, and no contract owned by another change is edited: `agent/contracts/provider-profile@0.1.0` is
consumed, and everything this change needs from it already exists there.

## History Reviewed

| Capability | Archived Changes Read | Relevant Past Decisions | Historical Rationale |
| --- | --- | --- | --- |
| `agent` | None — `docs/spec/changes/archive/` is empty; nothing has been archived in this project | The living spec was seeded by `specdocs:harvest` from the PRD and then amended by `req-007-pi-sdk-harness`, whose deltas are synced into `capabilities/agent/spec.md`. Its provider requirement already corrects the PRD's interactive sign-in and states in as many words that "the role matrix itself is measured in `req-017-provider-matrix`" | This change is the deferred half of a decision already taken, not a reversal of one. The four-role list in that requirement was the PRD's; extending it to six is the first time measurement has been applied to it |
| `pet` | None | "All pet-visible text originates from the pet-agent" (FR-PET-10) was seeded from the PRD as UNVERIFIED, with a scenario forbidding a fixed string table | The clause protects the persona's single voice and stops system notifications bypassing it. The exception added here was written to preserve both, which is why it constrains the content of an acknowledgement rather than its source alone. Reversing FR-PET-10 outright was considered and rejected in `clarifications.md` |
| `uix` | None | The composer requirement was amended by `req-007-pi-sdk-harness` with the 14-pixel floor, decided as one product-wide floor rather than a per-provider one, with the explicit note that a provider demanding more is handled by *this* change raising the floor rather than by the composer branching | The gate added here is the same shape of decision one layer up: refuse at the composer, where the user is, rather than at the provider, where they are not. Nothing in the earlier decision is weakened |
| `app` | None | The job detail page was seeded from the PRD (FR-APP-03) as UNVERIFIED. `app` also carries the bring-your-own setup requirements from `req-014-byo-oauth-google`, which already establish that the product states costs before the user commits | Adding usage and cost to the job page continues that posture. `app` was not named in the original proposal's Modified Capabilities and is added here on the decision recorded in `clarifications.md` |
| `job`, `approval`, `sync`, `ledger`, `platform` | None | Read to enumerate consumers, not modified | `job` carries the retry and time-limit requirements that `ENDPOINT_UNREACHABLE` interacts with; `approval` owns the risk judge's fail-closed rule; `sync` governs what replicating this change's configuration entails; `ledger` owns the store usage records sit in; `platform` owns secure storage, reached only through the profile contract |

No archive exists to overturn. The two decisions this change is most at risk of contradicting are therefore in
active changes rather than in history — the four-role list in `req-007-pi-sdk-harness` and the persona text rule
seeded into `pet` — and both are handled explicitly below.

## Affected Components

| Type | Name | Current Version | Consumers | Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| requirement | `agent` — "Model provider and role routing are configured on the client" | living spec, unversioned | `app` (settings surface), `uix`, `pet`, `sync`, `platform` | **BREAKING** | The role list goes from four to six and the mapping becomes account-owned rather than application configuration. Any surface that enumerates roles must handle six, and the store it reads from changes. This is the one genuinely breaking item |
| requirement | `pet` — "All pet-visible text originates from the pet-agent" | living spec, unversioned | `uix`, `app` | compatible | Narrowed by an exception, not relaxed: both existing scenarios are preserved verbatim and two are added. A consumer relying on the old text — that meaning-bearing pet text is model-generated — still holds |
| requirement | `uix` — "Composer accepts text and images with declared limits" | living spec, unversioned | `pet`, `app`, `agent` | compatible | All five existing scenarios preserved verbatim; a capability clause and four scenarios added. An implementation meeting the old text refuses nothing it previously accepted except an image it could not have sent successfully anyway |
| requirement | `app` — "The job detail page carries the full account of one job" | living spec, unversioned | none beyond `app` itself | compatible | Additive: the page gains a section. No existing scenario changes |
| requirement | `agent` — seven added; `pet` — one added; `uix` — two added | new | as above | compatible | Additions only |
| contract | `agent/contracts/role-routing` | new at 0.1.0 | `agent`, `pet`, `uix`, `app`, `approval`, `undo`, `sync` | compatible | No prior surface existed. Referenced by no other change today, so publishing it creates no obligation elsewhere |
| contract | `agent/contracts/provider-failure` | new at 0.1.0 | `agent`, `uix`, `pet`, `app`, `job`, `approval` | compatible | No prior surface existed. `uix` already resolves unmatched conditions to a SYSTEM card, so the presentation this contract feeds is specified |
| contract | `agent/contracts/usage-accounting` | new at 0.1.0 | `agent`, `app`, `job`, `ledger`, `sync` | compatible, with an obligation | Usage records are written beside the job record that `req-013-sqlite-ledger` owns, and retention follows that store's rule. The obligation is recorded below rather than assumed |
| contract | `agent/contracts/provider-profile` | 0.1.0, owned by `req-007-pi-sdk-harness`, status draft | this change, plus `platform`, `app`, `uix`, `sync` | **not edited** | Everything needed — `ModelCapability`, `ModelOffer.capabilities`, `CREDENTIAL_MISSING`, `MODEL_LACKS_CAPABILITY`, `PROFILE_IN_USE` — already exists there. Deliberately consumed rather than extended, so two active changes do not edit one file |
| stored-data | Routing table, price book | new | every surface that resolves a role | compatible | No production data exists: the project has no application code and no users. The table is created when the user's first profile is saved |
| stored-data | Usage records | new | `app` job detail, and any later aggregate | compatible | Written beside job records; evicted with them. Volume is bounded by roughly four model requests per job (`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6) |
| cluster | `agent-runtime` (`pet`, `agent`, `job`) | — | — | — | Cross-cutting tests required: a routing failure mid-job, an assignment changed while a job runs, the acknowledgement against a job that never gets created |
| cluster | `desktop-shell` (`pet`, `app`, `uix`) | — | — | — | Cross-cutting tests required: the acknowledgement card before a job exists, attachment gating in the composer, the failure card alongside a job's ERROR card |
| cluster | `trust-chain` (`ledger`, `undo`, `approval`) | — | — | — | Reached through the risk-judge role: a routing failure in that role must fail closed exactly as a provider failure does |
| cluster | `account-sync` (`sync`, `ledger`, `backend`, `platform`) | — | — | — | Cross-cutting tests required: the routing table and price book as replicated stores, and a device holding the table without a credential |

## Decision: Merge or Split

**Split**, with one exception handled inside this change.

- **Handled here — `app`.** The job detail page is a single requirement in a capability this change already
  touches through the settings surface, and the display is meaningless without the records this change writes.
  It is a MODIFIED delta in `specs/app/spec.md`, not a dependent change.
- **Split — `req-007-pi-sdk-harness` carries a four-role statement in `model.md`.** Its model describes the agent
  role entity as "The product recognises exactly four", which this change makes six. That file is an artifact of
  an active change, not living truth, and editing another change's artifacts is not this change's business. The
  obligation is therefore sequencing, and it is stated in full in the next section rather than silently resolved.
- **Split — `req-006-agent-loop`, `req-004-rule-elicitation`, `req-010-undo-agent`, `req-011-risk-judge` consume
  the role catalogue.** Each owns one role's behaviour and the roadmap already sequences all four after this
  change (R15, R17, R18, R16 after R13). Each will reference `role-routing@0.1.0` rather than restating the
  matrix. No edit to those changes is needed now; the direction is correct and creates no cycle.
- **Split — `req-013-sqlite-ledger` owns where usage records live.** This change declares that usage records sit
  beside job records and are retained with them. That store's shape is owned by `req-013-sqlite-ledger`, which
  the roadmap sequences first (R4 before R13). If that change's record shape cannot carry the usage entry as
  specified, the reconciliation belongs there, not here.
- **Split — the persona specification owns the acknowledgement lines.** The content rule is specified here; the
  lines themselves depend on open question Q-OQ-3 in `req-001-mvp-product-definition`. This change specifies a
  set that may be empty at implementation time, which is why `specs/pet` states what happens when the line set is
  missing for a language.

`.change.yaml` now records `depends_on: [req-007-pi-sdk-harness]`, matching the roadmap's R13 → R8 edge. No new
dependency edge is introduced beyond that one; this change publishes three contracts and consumes one.

## Sequencing Obligation

`req-017-provider-matrix` writes `model.md` in full form because `capabilities/agent/model.md` does not exist
yet. `req-007-pi-sdk-harness` also writes a full `model.md` for `agent`, and the roadmap archives it first.
Whichever archives second must be restated in delta form against the merged file before it is archived, and the
"exactly four" role statement must read six at that point. Recorded here so the reconciliation happens as a
deliberate step in the archive of the later change rather than as a silent overwrite during `specdocs:sync`.

## Versioning

| Contract | From | To | Rationale (MAJOR/MINOR/PATCH) |
| --- | --- | --- | --- |
| `agent/contracts/role-routing` | — | 0.1.0 | New contract, status draft |
| `agent/contracts/provider-failure` | — | 0.1.0 | New contract, status draft |
| `agent/contracts/usage-accounting` | — | 0.1.0 | New contract, status draft |
| `agent/contracts/provider-profile` | 0.1.0 | 0.1.0 | Unchanged. Consumed only; no bump, no migration, no consumer update |

## Migration & Rollback Needed?

**Yes**, and `design.md` §Migration & Rollback carries it. The change introduces three kinds of persistent data
and migrates none, because none exists in the field. The one asymmetry worth naming: a routing table written by
a newer build is refused whole by an older one, while a usage record written by a newer build is read field by
field. The reason is stated in both contracts — misreading a routing table runs a role on a model the user
assigned elsewhere, while ignoring an unknown field in a usage record only omits a detail of a job that already
happened.

## Regression Scope (Copied to verification.md)

- `agent` — all scenarios
- `pet` — all scenarios
- `uix` — all scenarios
- `app` — all scenarios
- `job` — all scenarios (consumer: usage records, retry interaction with `ENDPOINT_UNREACHABLE`)
- `approval` — all scenarios (consumer: the risk-judge role must still fail closed)
- `sync` — all scenarios (consumer: two new replicated stores)
- cluster `agent-runtime` — cross-cutting integration tests
- cluster `desktop-shell` — cross-cutting integration tests
- cluster `trust-chain` — cross-cutting integration tests, through the risk-judge role
- cluster `account-sync` — cross-cutting integration tests, for the replicated table and price book
