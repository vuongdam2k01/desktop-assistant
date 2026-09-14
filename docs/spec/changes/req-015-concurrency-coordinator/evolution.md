# Evolution: connector

Two contracts arrive with this change, and one existing contract must move to carry them. The asymmetry worth
stating first is that neither new contract has a persistence problem: nothing the coordinator produces survives
its process, so a version of either is fully retired the moment no release uses it. That is the opposite of
`ledger/contracts/ledger-record`, whose old versions live on disk for as long as the retention period allows,
and it makes evolution here cheap in a way it is not there.

What is expensive here is different: both contracts encode a correctness argument in their defaults and in the
meaning of absence. A change that leaves every manifest valid and every caller compiling can still destroy the
guarantee — which is why several structurally harmless changes are classified MAJOR below.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `connector/contracts/resource-coordinator` | A method is removed; the bracket's start or end moves; more than one suspension per bracket becomes legal; `resume` compares against the intended state rather than the recorded one; any mutating operation is exposed across the process boundary; an error code is removed or its meaning changes; a coordinator refusal becomes expressible as a connector error code | A method is added; an optional member is added to `CoordinatedCall` or `CoordinatorSnapshot`; an error code is added whose handling the existing rules already cover; a read-only channel is added | Wording, examples, and messages that do not change a code |
| `connector/contracts/coordination-declaration` | `tool_coordination` becomes optional for a writing tool; a call becomes able to supply its own key; a normalisation is added that can split one object across keys; the meaning of an absent per-tool declaration changes | An optional field is added; a normalisation that can only merge spellings is added; a job class is added together with the rule for how it competes with the existing two | Wording; and adjusting an unmeasured default once a measurement exists, since `class_weights`, `background_floor` and the wait limit are published as provisional |
| `connector/contracts/connector-manifest` (existing, moving from `1.1.0` to `1.2.0`) | Unchanged from what `req-019-connector-framework` states for it | Adding the two coordination objects, as here: optional fields, every earlier manifest still validating | Unchanged |

Three rules cut across all of them. A `frozen` contract is edited only through a version bump with a Migration
section and updated consumers, with impact analysis run first — which is why `connector-manifest` moves to
`1.2.0` rather than being edited in place, and is republished by the change that needs the amendment — the
precedent `req-003-notion-compensation` set when it took the manifest from `1.0.0` to `1.1.0`. A version is
discovered from the contract file itself; there is no
runtime negotiation, because both ends of every contract here live in one application release. And the
provisional numbers are provisional by publication, not by convention: `verification.md` records them as
unverified, so replacing one with a measured value is a PATCH rather than a renegotiation.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| No coordinator | `resource-coordinator@0.1.0` | Not applicable | None | Nothing is stored and nothing is carried forward; the coordinator exists from the first start of the release that contains it |
| `connector-manifest@1.1.0` | `connector-manifest@1.2.0` | Yes, by validation at registration | Every `1.1.0` manifest remains structurally valid | The behavioural difference: a manifest whose write tool declares no resources is refused whole until it does. A read-only connector needs no change at all |
| A writing connector specified under `1.1.0` | The same connector under `1.2.0` | No — an author adds the declarations | None | For each write tool, name the argument paths that carry the objects it may change and their types; declare the connector's identifier normalisation if its platform accepts more than one spelling. Until then that connector offers nothing, which is the intended pressure |
| `coordination-declaration@0.1.x` | `0.1.(x+1)`, a measured default replacing a provisional one | Yes | None | A manifest that declared the value explicitly keeps it; a manifest that relied on the default gets the measured one. This is the intended path for closing open question Q-6 |
| `resource-coordinator@0.x` | Any MAJOR | Callers updated in the same release | None | There is no mixed-version window: a MAJOR is an instruction to re-run the dirty-snapshot reproduction and the deadlock suite before shipping |
| Device-local exclusivity | Exclusivity across devices | No — a new change | None held by the coordinator; the ordering it would need is owned by `sync` | The reserved slot below. It is a new change with its own evidence, not a version bump of either contract here |

## Deprecation

A field of `coordination-declaration` is deprecated in three steps, and the clock is a release clock rather than
a calendar one, because no declaration outlives the release that reads it. First, the field is marked deprecated
and the coordinator stops relying on it while continuing to accept it. Second, every first-party manifest is
updated in the same release, since all of them ship together. Third, the field is removed, which is MAJOR only
if its absence would change behaviour — and for a field with a defined default, it usually is, because the
default then becomes the behaviour rather than the fallback.

An error code is deprecated differently and more slowly. A code is what the job manager classifies on, so a code
that stops being produced must keep being handled until no consumer branches on it; removing it from the
contract is MAJOR even when nothing has produced it for several releases.

There is no equivalent here of "a store still holds old records". The thing that would make a version
un-retirable — persisted state written under it — does not exist by construction (INV-CN-21), which is worth
remembering when someone proposes persisting leases: it would convert a cheap evolution story into the
ledger's expensive one.

Remaining consumers of a contract version are identified from the `consumers` list in each contract's
front-matter together with `spec-check.mjs consumers`.

## Extension Procedure

**Adding a connector that writes.** For each write tool, add `tool_coordination` naming every argument path that
carries an object the tool may change, with the connector's own word for each object's type. Name the paths the
platform call itself addresses — not a field invented to carry a key, which the contract refuses for the reason
INV-CN-15 states. Declare `identifier_normalisation` if the platform accepts an identifier in more than one
spelling; if it does not, leave it absent rather than declaring `none` for symmetry, so that a later reader can
tell a decision from a default. Test with the coordination-declaration conformance suite and the key
normalisation suite from `verification.md`: one object in any accepted spelling must yield exactly one key, and
no two objects may collide.

**Adding a connector that only reads.** Declare nothing. A read tool takes no lease, and a read-only connector
needs neither `tool_coordination` nor a normalisation rule. Declare `connector_coordination.rate` only if the
platform's pacing differs from what the connector's existing rate policy already says.

**Declaring a platform's concurrency tolerance.** Set `concurrency` and `reserved_interactive` in
`connector_coordination` only from a measurement of that platform, run the way
`spikes/SP-15-concurrency/src/test-q4-concurrency-limits.ts` runs: increase concurrent jobs until refusals for
volume appear, then declare a value comfortably below that point. A value outside the accepted range is clamped
and the clamp is reported to you; a value chosen without a measurement is how a platform's cooldown becomes the
product's latency.

**Adding a job class.** This is a MAJOR change to `coordination-declaration` and is not an extension point in
practice, because a third class needs a stated rule for how it competes with both existing ones and how the
reserved slot treats it. Before proposing one, check whether the existing two classes with a different weight
express the same intent — they usually do.

**Adding a resource type.** Nothing is needed. A type is a string the connector chooses, and the coordinator
neither enumerates types nor branches on them. This is the property that makes the Nth platform free, and it is
worth stating explicitly in this list so that nobody adds a registry for it.

These procedures are the source for the connector-author guide under `docs/guides/`, written when the first
connector is authored by someone who did not write this change.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Exclusive access across devices | After `req-022-account-sync` settles ordering across devices; M2 at the earliest | Two devices signed in to one account can each hold what they believe is exclusive access to one object, because nothing here crosses the replication boundary. The roadmap's R12 row already defers this to R3, and the honest reason is that a device-local lease has nothing to be expressed against on a second device until replication defines an order that both devices agree on. Recorded here rather than left as a silent limitation, because a reader who assumes the guarantee is account-wide would design an undo that is not safe | Replication defines a cross-device ordering a lease could be expressed against, and a measurement exists of how often two devices of one account touch one object — which nothing has measured |
| Admission decided from observed latency rather than a declared number | After the first beta produces real queue waits | The limit is a fixed number chosen inside a measured band, which is the right instrument while every measurement comes from one platform and one synthetic workload. An adaptive limit that responds to observed waits is the obvious successor and would be indefensible now, because there is nothing to calibrate it against | Recorded queue waits from real use across more than one platform — the same data open question Q-7 needs |
| A depth bound on one authorisation's queue | When a bulk command's real depth is known | Depth is bounded today only indirectly, through the concurrency limit and the wait limit. A direct bound would need to say what happens to the requests beyond it, and every answer to that is worse than a bound chosen from evidence | A measurement of queue depth under a realistic bulk command, which the 15-request synthetic benchmark does not provide |
