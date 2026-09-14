# Evolution: agent

This change introduces seven contracts and revises four, and they do not all age the same way. Three kinds are
worth telling apart before reading the table. **Configuration the account replicates** — the role registry, the
routing table, the skill catalogue's enabled state, a pack's activation state — must never be half-understood,
because a partly read entry is an identity or an allowlist the user never assigned; these refuse a newer
document whole. **Declarations authored with the product** — a skill manifest, a pack manifest, a handler
registration — are reviewed like product text and fail at load, where their author sees them. **Records of what
happened** — a session's lineage and context account, a child-job link, a redacted reference — are reports about
the past and must stay readable by a build that does not understand every member. Each versioning rule below
follows from which of the three a contract is.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `role-registry@1.0.0` | A required member of an entry is added, removed or changes meaning; a built-in entry is removed or renamed; an entry is allowed to name a model, a provider or a credential; the origin vocabulary loses a value; an unrecognised member may be read around instead of refusing the registry whole | An optional member is added to an entry; an error code is added with its remedy; a built-in entry is *added*; the origin vocabulary gains a value; a read-only channel is added | Wording, labels, and the description text inside the schema file |
| `role-routing@1.0.0` | A tier's meaning changes; resolution is allowed to substitute on failure; the unassigned state is removed; a table-wide default becomes representable; a channel returns a resolved endpoint or names the resolved model to a window; a tier name's syntax tightens | An optional member is added to an assignment; an error code is added; a suitability verdict is added; a capability requirement is relaxed; a read-only channel is added | Wording, labels, evidence citations attached to a verdict |
| `skill-manifest@1.0.0` | A required manifest member changes; the precedence order changes; anything executable becomes admissible; a reference path may leave the package directory; a later-versioned manifest may be partly applied | An optional manifest member is added; a reference file type is admitted; the size ceilings are raised after measurement; an error code is added | Wording; the description text of applicability guidance |
| `capability-pack@1.0.0` | A pack may originate outside the product (this is the reserved slot activating and carries its own security design); a contributed write tool may omit both compensation and irreversibility; activation becomes user-settable; a pack's tools may bypass the wrapping factory | An optional manifest member is added; a contribution kind is added; a pack may declare a new redaction class or handler point already defined elsewhere; an error code is added | Wording, the description of an activation condition |
| `runtime-lifecycle@1.0.0` | A seventh point is added or one of the six is removed or renamed; a point's return vocabulary gains anything that can cause a call to execute; the failure posture of a point changes; the gate or the ledger step becomes registrable; hot reload is introduced | A point's return gains a transformation that cannot authorise; the default or maximum handler budget changes after measurement; an error code is added | Wording; the description text in the schema file |
| `context-assembly@1.0.0` | A source is added to or removed from the seven, or their order changes; the reduction ladder gains, loses or reorders a step; a protected element becomes reducible; assembly may consult a model; the budget may be fixed rather than derived | The reserve fraction or the retained-tail size is pinned after measurement; an optional member is added to the account; a template input kind is added; an error code is added | Wording; illustrative figures in examples |
| `job-delegation@1.0.0` | Depth may exceed one; an agent-to-agent channel of any kind is introduced; a delegation result may carry authority; a child may inherit its parent's approval; the child link gains a member that is not a recorded fact | The fan-out bound is raised after measurement; an optional member is added to the assignment or the result envelope; an error code is added | Wording |
| `secret-redaction@1.0.0` | The reference form gains a member derived from the value; the boundary moves outside the wrapper; one of the four exits stops being defended; the conservative default for undeclared fields is removed; a shipped class is removed | A class is added to the shipped set; a recognition rule is refined; an error code is added | Wording; placeholder text in examples |
| `agent-session@1.0.0` | The role member's provenance changes again; lineage becomes a channel rather than a recorded fact; a transcript may be rewritten; the resume equivalence is weakened | An optional member is added to the context account; an error code is added | Wording |
| `tool-wrapping@0.2.0` | The four steps change order or one is removed; the factory stops being the only producer of a wrapped tool; `secrets` becomes required; the conservative default that redacts an undeclared matching field is removed | An optional registration member is added; the redaction projection gains a class it can name | Wording |
| `worker-loop@0.2.0` | The tool-result envelope changes; a directive is removed; the write-then-verify ordering is relaxed | An optional prompt-context member is added; a directive is added | Wording |

Two rules cut across the table. Tightening any bound — a smaller budget, a narrower path pattern, a shorter
handler budget — is MAJOR even where the type does not change, because existing configurations that satisfy the
old bound stop working on the user's next command. Loosening a bound after measurement is MINOR, and the
measurement is what makes it one: a bound raised on vendor documentation alone is not a MINOR change, it is an
UNVERIFIED claim and stays marked as one.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `role-routing@0.1.0` six closed roles | `role-routing@1.0.0` tiers | Yes | The six assignments re-key to the six built-in tiers of the same names | A re-key, not a re-choice: no role is silently reassigned, an unassigned role stays unassigned, nothing is proposed automatically (INV-AG-24; `design.md` Migration 1) |
| No registry | `role-registry@1.0.0` | Yes | None | The six built-in entries are materialised by the product at every start; the replicated document holds account entries only, so an account with no authored roles has an empty document and a full registry |
| `agent-session@0.1.0` transcript | read by `@1.0.0` | Yes, on read | The four old `AgentRole` values read as built-in identifiers; `pet` splits into `pet-text` or `pet-image` by whether the turn carried images, the same split routing made at run time; absent lineage reads as top-level; absent context account reads as "not recorded" | Transcripts are never rewritten — append-only account data; the reading side translates (`design.md` Migration 2) |
| Job record without a child link | read by this change | Yes, on read | Reads as a top-level job; never occupies `waiting_children` | Nothing backfills (`design.md` Migration 3) |
| Skill catalogue absent | `skill-manifest@1.0.0` | Yes | None | Discovery builds the catalogue; every discovered identifier with no enabled-state record reads as enabled |
| Pack directory absent or empty | `capability-pack@1.0.0` | Yes | None | The product runs with built-in roles, skills and connector tools; the two shipped packs are present and `inactive` |
| Any registry, catalogue state or activation record read by an older build | — | No, by design | Refused whole; the product asks for the update | Reading around an unrecognised member means running work under an identity or an allowlist the user never assigned — the same rule as `TABLE_VERSION_AHEAD` |
| Any session transcript or child link read by an older build | — | Yes | Unknown members ignored; lineage not shown; the session reads under the nearest built-in role | Deliberately the opposite posture: a record about the past is shown incompletely rather than not at all |
| `tool-wrapping@0.1.0` registration | `@0.2.0` | Yes | Valid unchanged; `secrets` absent means the conservative default applies | No adapter author has to act |
| `worker-loop@0.1.0` prompt context | `@0.2.0` | Yes | Valid unchanged; the account members are optional | — |
| Raising the fan-out or depth bound (future MINOR) | — | Yes | Existing links remain valid | Only after a measurement replaces the SP-15 neighbour; a depth above one is a MAJOR revision of `job-delegation` and re-opens the principle I argument |
| Pinning the reserve fraction (future MINOR of `context-assembly`) | — | Yes | Existing accounts remain valid; `budget.basis` already records derived versus fallback | Only after the proposed SP-23 measurement |

## Deprecation

A member, a class, a point or a built-in entry is deprecated in three steps; the second is what makes removal
safe.

1. **Announce in the contract.** The member is marked deprecated with the version that will remove it and the
   replacement. Nothing changes at runtime.
2. **Find the consumers, mechanically where possible.** For a built-in role or a tier this is exact: every
   account's registry and routing table name what they use, and the product can count the assignments and
   entries that would be orphaned before anything is removed. For a shipped skill or a redaction class, the
   catalogue and the tool registrations are enumerable. For an interception point, the consumers are the
   product's own handlers and each pack's `handlers` declaration, which are all first-party and are found by
   reading them. No member is removed while this step has not been done.
3. **Remove at a MAJOR, with the migration recorded above.** A user whose entry or assignment named the removed
   member is asked once and never silently re-pointed; a stored record that carries the removed member stays
   readable, because records about the past are read leniently.

Advance notice runs at least one release cycle between steps 1 and 3 for anything the account replicates or the
user configured. A handler point or a redaction class that no first-party code registers or declares may be
removed in the cycle it is announced.

Two things do not deprecate. A capability pack that is deactivated is not deprecated: its declarations are
withdrawn together, jobs already running keep their frozen tool set, and its records stay readable. And a
skill is never deprecated in place — a superseded playbook is replaced by one with a new identifier, so that a
job's record naming the old identifier still names the text that job actually loaded.

## Extension Procedure

Every extension below is data plus, at most, one adapter. None of them edits the job manager, the gate, the
ledger or the interface; where one would, it is not an extension but a change with its own evidence.

**Adding a role.** Author a role entry: identifier, name, instructions within the ceiling, the tier it resolves
through, its required capabilities from the closed vocabulary, its tool allowlist, whether it may delegate and
under which roles, and any skills to preload. Save it through the settings surface (an account role) or declare
it in a capability pack (a pack role). Verify by observing that an agent starts under the identifier with
exactly the allowlisted tools that exist, that its requests resolve through the named tier, and that the entry
replicates to a second device unchanged. A role naming a new tier adds an assignment the user is asked to make;
nothing is inherited.

**Adding a tier.** There is no separate procedure: a tier exists because a role entry names it. What the author
adds is the assignment, through the routing settings, and the six built-in tiers cannot be removed because the
built-in entries name them.

**Adding a skill.** Create one directory holding a manifest and, optionally, the reference material it names by
relative path — nothing executable, nothing outside the directory. Write the applicability text as the thing a
job matches on: the actions, the objects, the boundary. Verify that the catalogue lists it with its origin and
precedence, that a job whose work matches loads exactly that body and records it, and that an unrelated job does
not. If another package declares the same identifier, verify that exactly one wins and that the shadowed one is
reported.

**Adding a capability pack.** Author the manifest: the tools it contributes (each with its snapshot method and
compensation formula, or `irreversible: true`), the roles, the skills, and an activation condition naming the
evidence that would satisfy it. Place it in the product's pack directory; there is no other route until the
reserved slot below activates. Verify that a pack missing a required declaration is refused whole at load naming
the tool; that an inactive pack contributes nothing to any tool set; that once the evidence is recorded its
tools are produced by the wrapping factory and gated like a connector's; and that deactivating it withdraws its
contributions together while running jobs keep their frozen tool set.

**Adding an interception handler.** Declare it in a pack's `handlers` member — the point, the purpose and a time
budget within the maximum — or register it from product code at start. Verify that a handler at the
before-a-tool-call point can block and transform but that no return it can produce causes execution; that a
block leaves an intent record and a refused result naming the handler; and that a handler which throws is
refused before a call and dropped after one. Adding a seventh *point* is not an extension; it is a MAJOR
revision of `runtime-lifecycle`, because a new place to stand is a new place principle II must be re-argued.

**Adding a redaction class.** Declare the class name, its recognition rule and — there is no choice here — the
closed reference form, in a pack's `secretClasses` member or in the product's shipped set. Optionally declare
which fields of which tools carry it. Verify with a seeded corpus that the value reaches the platform and that a
reference, carrying class and field only, reaches the model request, the transcript, the ledger record and the
replicated envelope; and that an undeclared field matching the rule is redacted under the conservative default.

**Raising a bound.** Fan-out, the size ceilings, the handler budget, the reserve fraction: each is raised only
by a change that cites the measurement replacing the current declared budget, and the change is MINOR. Depth is
excluded: a depth above one is MAJOR and reopens the principle I argument in `design.md` D2.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Capability-pack provenance and integrity (`model.md` § Variability) | The phase in which a capability pack may originate outside this repository | A first-party-only pack needs no signing, and specifying provenance now would be the silent future-proofing the constitution forbids; the slot records that the omission is deliberate | Q-3 in `clarifications.md` answered "third-party packs are permitted". `capability-pack` then gains a provenance and integrity section at a MAJOR revision, the pack loader's in-process isolation posture in `design.md` is re-decided, and the change that does both carries its own security design |

No other slot is reserved. Delegation depth, the interception point set, the reduction ladder and the
capability vocabulary are closed rather than reserved: each is a place where a later extension must re-argue a
constitutional principle, and a reserved slot would present that as a matter of phase rather than of proof.
