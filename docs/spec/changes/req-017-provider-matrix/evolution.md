# Evolution: agent

This change introduces three contracts with different lifetimes and, deliberately, different compatibility
rules. The routing table is configuration the user edits and the account replicates, so it must never be
half-understood. A failure notice lives for minutes inside one running process, so it has no compatibility
problem at all. A usage record is a report about a job that already happened, so it must stay readable even by a
build that does not understand every field. Each rule below follows from which of those three a contract is.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `role-routing` | A role is added, removed or renamed; a role's meaning changes; resolution is allowed to substitute on failure; the unassigned state is removed; a channel is added that returns a resolved endpoint or names the resolved model to a window | An optional member is added to an assignment; an error code is added with its remedy; a suitability verdict is added or changed; a capability requirement is relaxed; a read-only channel is added | Wording, labels, and the evidence citations attached to a verdict |
| `provider-failure` | A cause is removed; a cause's remedy changes; the `dedupeKey` shape changes; a window is allowed to raise a notice; `providerDetail` becomes anything but text | A cause is added with its remedy and its place in the ordered classification rules; an optional member is added to a notice; a read-only channel is added | User-facing wording; the secondary provider vocabulary matched during classification |
| `usage-accounting` | The price unit changes away from per million tokens; a cost may be stored without its basis; records become mutable; money becomes a binary floating-point number; the unreported state is removed | An optional member is added to a record; an aggregate view is added; an `incompleteReason` value is added; accepted price precision is widened | Wording, display rounding, currency formatting |

Tightening a capability requirement — demanding a capability a role did not previously require — is MAJOR even
though the type does not change, because every existing assignment that fails the new requirement stops working
on the user's next command. It is treated as a role meaning change and carries a migration.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| No routing table | `role-routing@0.1.0` | Partly | None | Defaults are proposed from the user's first profile and applied only after the user sees them. A user who already configured a profile under `req-007-pi-sdk-harness` meets the proposal on first launch |
| `role-routing@0.x` with N roles | `@(x+1).0.0` with N+1 roles | No | Table is read; the new role reads as unassigned | The product asks the user to assign the new role. It never chooses a model for a role the user has never seen |
| `role-routing@0.x` with N roles | `@(x+1).0.0` with N−1 roles | Yes | The removed role's assignment is dropped | Recorded in the removing change's migration note. No other role inherits it, and no model is reassigned |
| `usage-accounting@0.1.0` records read by a newer build | any later version | Yes | Read field by field; unknown members ignored | A record is a report about the past; showing a job's tokens without a member the build does not understand beats showing the user nothing about a job they ran |
| `usage-accounting` records read by an older build | — | Yes | Unknown members ignored; an uninterpretable cost is shown as tokens with no cost | The deliberate opposite of the routing table's whole-table refusal |
| Any routing table read by an older build | — | No, by design | Table refused whole (`TABLE_VERSION_AHEAD`) | Reading around an unrecognised member would mean running a role on a model the user assigned elsewhere |
| Price unit change at a future MAJOR | — | Partly | The price book migrates; stored costs do not | Each recorded cost carries its basis, so old jobs keep explaining themselves in the terms they were priced under |

## Deprecation

A cause, a role or a price form is deprecated in three steps, and the second step is what makes it safe.

1. **Announce in the contract.** The member is marked deprecated with the version that will remove it and the
   replacement. Nothing changes at runtime.
2. **Find the consumers.** For a role, this is mechanical: every account's routing table names its roles, and
   the product can report how many assignments point at the deprecated one before anything is removed. For a
   cause, the consumers are the product's own surfaces and are found by reading them. For a price form, the
   price book is enumerable. No member is removed while this step has not been done, because the population
   affected is the only fact that decides whether removal is cheap or hostile.
3. **Remove at a MAJOR, with the migration above.** A user whose assignment named the removed role is asked once
   and never silently re-pointed.

Advance notice runs at least one release cycle between steps 1 and 3 for anything a user configured; a cause
they never see may be removed in the same cycle it is announced.

A suitability verdict is retired differently: it is evidence, and evidence does not deprecate. A verdict whose
model no longer exists stays in the record with its evidence citation, because it explains why a default was
chosen in an archived change; it simply stops matching any model a user can assign.

## Extension Procedure

**Adding a role.** The rarest and most expensive extension, and the catalogue is closed to make that visible.
Add the member to `Role` in `role-routing`, declare its capability requirement, decide its default in each of
the three profile shapes, add it to the routing table descriptor's `required` list, and state what happens when
it is unassigned — including whether the product may run at all without it. Verify with the routing table corpus
extended to cover the new role unassigned, unsatisfiable and unusable-here, and with the combination matrix in
`verification.md` extended by one row. MAJOR, plus a migration entry.

**Adding a failure cause.** Add the member to `FailureCause`, give it exactly one remedy, and place it in the
ordered classification rules — above `RESPONSE_UNUSABLE`, which is the floor and stays last. Add its user-facing
words in both languages. Verify by extending the unmatched failure corpus with real observations of the new
condition, not with synthetic ones: the corpus exists to prove the taxonomy covers reality. MINOR.

**Adding a supported provider as a shipped profile.** Owned by `provider-profile@0.1.0`, but it reaches this
contract through the defaults: add the profile's models, and add suitability verdicts only where a spike actually
measured that model in that role. A shipped profile whose models carry no verdicts is legitimate — it simply
means every assignment from it produces the unmeasured statement. Do not manufacture verdicts to avoid that
statement. MINOR here.

**Recording a new measurement.** When a spike measures a model in a role, add a `SuitabilityVerdict` with its
evidence citation and its one-line summary, and update the defaults if the verdict changes what should be
proposed. Update `verification.md`'s thresholds in the same change, so that the evidence and the behaviour it
justifies move together. MINOR, or PATCH when only the citation changes.

**Adding a currency or price form.** Currencies need no extension — any ISO 4217 code is accepted. A new price
*form*, such as a per-request charge or a cached-input rate, is a new optional member on `UnitPrice` and a new
term in the cost arithmetic; it is MINOR only if a record written without it remains computable, which means the
new term must default to zero rather than to unknown.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Remote update of shipped profile defaults and suitability verdicts | M2 | When a provider retires a model named in a profile the product ships, every user's default assignment stops resolving at the same moment, and a release is a slow remedy for a change the product did not make. The slot is reserved rather than built because the failure is currently repairable in one step by the user — `MODEL_UNAVAILABLE` points at the role's assignment | The first time a model named in a shipped profile stops resolving for users. Tracked as open question Q-2 in `clarifications.md` |

No other slot is reserved. In particular, no slot is held for cross-job cost aggregation, for a shipped price
table, or for automatic model substitution: the first is a question about the job list that this change's
records already answer, and the second and third are decisions this change made against, not decisions it
deferred.
