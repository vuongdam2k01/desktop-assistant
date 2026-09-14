# Evolution: approval

Two contracts are introduced here, and they evolve on quite different clocks. The rule representation is written
to the user's disk and replicated between devices that update at different times, so its versioning is a
compatibility problem with real consequences for people. The gate evaluation contract is internal to one build,
where both ends update together, so its versioning is a discipline for reviewers rather than a runtime concern —
which is exactly why its MAJOR conditions are written in terms of the security argument rather than the shape of
a payload.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `rule-representation` | A leaf kind, a metric, a boundary or a verdict is removed; an existing member changes meaning; conflict resolution stops being strictest-wins; any priority, weight or ordering member is added; an optional member becomes required. Catalogues written against the previous major do not load. | A leaf kind, a metric, a boundary or an optional member is added. Older catalogues keep loading unchanged; a catalogue written against a *newer* minor still halts writes on an older build, because the added leaf may be the one that stops something. | Wording, examples and clarifications that change neither what is accepted nor what is rejected. |
| `gate-evaluation` | A channel is removed, or its direction or meaning changes; any channel is added by which a window could obtain a verdict, supply a call subject, or reach a tool implementation; the wrapper's obligatory order changes; what an evaluation failure implies for execution changes. Each of these alters the security argument rather than the interface. | A channel that only presents information or only carries a human decision is added; an optional payload member is added; an error code is added whose handling is already covered by the rule that failure never executes. | Wording and examples. |

The asymmetry in the rule representation's MINOR row is deliberate and is the single most important sentence in
this file. Backward compatibility is ordinary: a new build reads an old catalogue. Forward compatibility is
refused: an old build meeting a new catalogue halts writes and asks to be updated, rather than reading around
what it does not recognise. Reading around an unknown member is fail-open by construction, and in an account that
replicates to several machines the older machine meets the newer catalogue routinely rather than exceptionally.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `rule-representation@0.1.0` (the draft in `req-001-mvp-product-definition`) | `rule-representation@1.0.0` | Not applicable | None. No catalogue exists in the field and no application code exists yet. | A migration of documents rather than of data; the contract's Migration section lists what changed and why. The spike's catalogue of twenty user rules is test material for the verification suites, not a default catalogue for users. |
| `rule-representation@N.x` | `rule-representation@N.y` (MINOR, y > x) | Yes, by loading | Catalogue loads unchanged; rules written against the older minor keep their meaning. | The reverse direction is not a migration: an older build halts writes and prompts for the update. |
| `rule-representation@N.x` | `rule-representation@(N+1).0` (MAJOR) | Depends on the change | Every stored rule must be rewritten into the new major before the release ships, by a conversion that runs once on the device and writes a new catalogue. A rule that cannot be converted is presented to the user for re-elicitation rather than dropped. | A MAJOR bump must fill in the Migration section of the contract itself and re-run the frozen adversarial corpus, because a representation change is a change to what can be expressed and therefore to what can be protected. |
| Any version, rolling back | An earlier build | No | Every existing catalogue is a future catalogue to the reverted build, so writes halt account-wide until the account rolls forward. | Rolling back after users have written rules requires exporting the catalogue into the target build's version, or accepting a read-only account meanwhile. `design.md` §Migration & Rollback records this; it is cheaper to know now than during an incident. |

A conversion between majors runs on the device, writes a new catalogue, and leaves the old one in place until the
new one has validated and replicated. The old catalogue is not deleted by the conversion, because a device that
converts and then fails to replicate must still be able to return to a catalogue the rest of the account can read.

## Deprecation

Nothing in the rule representation is removed without passing through deprecation, because removing a leaf kind
removes a protection some user has already written.

1. **Announce.** A leaf kind, metric or boundary is marked deprecated in the contract at a MINOR bump, with the
   reason and the replacement named. It keeps working exactly as before.
2. **Surface.** The application window marks every stored rule that uses the deprecated element, states in the
   user's own words what will stop working and when, and offers the replacement. A user who never opens that
   window is told through the same surface that reports a rule which can no longer be compiled.
3. **Wait.** No less than two release cycles, and never less than 90 days, between the announcement and the
   removal — measured from the release that announced it, not from the commit. The point of the wait is that a
   person has to act, and people do not open the settings window every week.
4. **Remove.** The removal is a MAJOR bump with a migration that rewrites affected rules where a mechanical
   replacement exists, and presents them for re-elicitation where it does not.

**Finding the remaining consumers** is straightforward for this contract and should stay that way: the stored
catalogue is the complete list. A count of rules still using a deprecated element, per account, is what decides
whether step 4 is safe — not the elapsed time alone. The gate evaluation contract needs no such search, since its
only consumers ship in the same build.

Hardline rules are never deprecated by this procedure. Removing one is a change to what the product refuses
absolutely, which `docs/spec/constitution.md` principle II makes a constitutional matter rather than a versioning
one: it requires a dedicated change and the decision-maker's approval.

## Extension Procedure

### Adding a connector, and with it new object types and tools

This is the common case and it must remain a manifest-only operation, per principle VI. Nothing in this change is
edited.

1. Declare in the connector's manifest the object types, how identity and ancestry are obtained for each, the
   tools, and for every write tool its irreversibility declaration and whether it changes permission. The fields
   the gate requires are listed under Manifest Schema in `model.md`; a tool missing any of them is refused rather
   than allowed, so an incomplete manifest fails loudly.
2. Declare, where the platform's payloads nest field values unusually, the field value shapes. Omit this and
   extraction falls back to the representation's general rules; where those fail, calls are held rather than
   allowed, so the omission costs the user prompts rather than safety.
3. Write nothing in the `approval` capability. No list of destructive operations, no per-connector rule dialect,
   no special case in the evaluator. If a connector cannot be added without one, that is a finding about this
   contract, not about the connector.
4. Verify by extending suite S2 with at least one rule per new object type, and by running the identifier-anchoring
   case from S1 against the new connector: rename the object, confirm the rule still holds.

### Adding a leaf kind to the rule representation

This is the expensive case, and the proposal names its casual use as the rabbit hole to avoid: each addition
widens what the gate can be asked to reason about, which is what the closed set exists to bound.

1. Establish that the intention cannot be expressed by composing existing leaves. The reports of unsupported
   intentions are the evidence for this — the product records them precisely so that this decision has data
   behind it rather than an anecdote.
2. Specify the leaf in `contracts/rule-representation.md` with its members, its comparison semantics, and what
   happens when the value it needs cannot be obtained. That last one is not optional: every leaf must have a
   fail-closed answer, and a leaf whose failure mode is "does not match" is fail-open and must be rejected.
3. Bump MINOR. Note that older builds will halt writes on catalogues using it, which means the release plan has
   to account for users on more than one device.
4. Extend the elicitation prompt in `req-004-rule-elicitation` so that the conversation can actually reach the
   new leaf; a leaf the conversation never produces is a leaf no user gets.
5. Re-run the frozen corpus in full, and add at least one adversarial case that attempts to evade the new leaf.
   A leaf is a new surface, and a new surface without an adversarial case is an untested one.

### Adding a metric or a boundary to a counting leaf

As above, with one additional obligation: the metric must be derivable from ledger records within the stated
boundary, and the ledger must be able to maintain it as records are appended. A metric that requires a scan at
evaluation time is not admissible, because it puts an unbounded read on a path budgeted in microseconds — see
`design.md` §D2.

### Adding a hardline rule

Not an extension procedure. A hardline rule is compiled into the build and is not reachable by a manifest, a
user, or an administrator, so adding one is a product decision recorded as its own change, with the constitutional
check that principle II requires.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| — | — | — | — |

None. `model.md` declares every variability point either `closed` or `open`, and nothing is reserved. This is
deliberate: `docs/spec/constitution.md` forbids silent future-proofing, and the two candidates that suggested
themselves were both rejected rather than parked. A slot for per-connector rule extensions was rejected because
the hybrid was offered to the decision-maker on 2026-09-12 and not chosen, and a slot left open would quietly
become the hybrid anyway. A slot for an advisory model check on questions was rejected because decision D6
settled that the disclosure carries the information, and reserving a place for a model on the ask path would
invite exactly the drift principle II exists to prevent. Both are recorded here so that a later reader does not
reopen them without the arguments that closed them.
