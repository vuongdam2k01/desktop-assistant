## Context

The spike built and measured the whole mechanism in one process against a mock platform store: a closed rule
representation, a pure evaluator, and a wrapper holding each tool's implementation privately. Twenty adversarial
cases ran against a real agent on a real model and nothing reached a connector, at a p99 evaluation latency of
0.48 ms (`spikes/SP-8-rule-ir-hardgate/REPORT.md#0-ket-luan`). This design carries that result into a product that
differs from the spike in four ways that matter.

The product is an Electron application with windows the user can interact with, so there is now a boundary between
what displays a decision and what takes one. It talks to real platforms, so the object metadata the spike read
from a mock store is now a network call. Its data belongs to the account and replicates to other devices
(principle VII), so state the spike kept in session memory has to survive a restart and be consistent across
machines. And it is meant to reach many platforms with only a manifest and an adapter (principle VI), so the
Notion vocabulary the spike's schema was written in cannot stay in the rule format.

Four decisions taken with the decision-maker on 2026-09-12 shape what follows, and are recorded in
`clarifications.md`: targeting is connector-neutral; mode `off` keeps the user's own refusals; counts come from
the ledger; conflicts resolve by strictness rather than by a priority number. A fifth withdrew the spike's phrase
matching on questions in favour of disclosing refusals.

## Goals / Non-Goals

**Goals:**
- Preserve the measured property — no dangerous operation reaches a connector even when the model is fully
  steered — under the four differences above.
- Keep the decision model-free, side-effect-free and reproducible, so that a disputed decision can be replayed.
- Put the rule format's platform knowledge in connector manifests, so the second connector adds no core code.
- Fail closed everywhere the gate cannot complete a decision, and make the halted state visible rather than
  silent.

**Non-Goals:**
- The model-based risk judge that runs after the static tier in `smart` mode; that is `req-011-risk-judge`.
- The elicitation conversation that produces a rule; that is `req-004-rule-elicitation`. This change owns only
  the form the conversation compiles into and the validation that accepts or rejects it.
- Replication and conflict resolution mechanics for the catalogue; those belong to `sync`.
- Widening what a rule can express. The closed set is the safety argument, and the proposal names its widening as
  the rabbit hole to avoid.

## Structure

| Component | Responsibility | Model entity | Reached through |
| --- | --- | --- | --- |
| Rule Store | Loads the account's catalogue, validates it against the representation, keeps it resident, reloads on local edit and on replication merge, and reports the health of that load. | Rule Catalogue | `approval/contracts/rule-representation@1.0.0` |
| Evaluator | Decides one call: pure, synchronous, model-free, no I/O of its own. | Condition, Verdict | `approval/contracts/gate-evaluation@0.1.0` |
| Subject Assembler | Builds the Call Subject: the call's arguments as given, the object's metadata read from the connector, and the irreversibility and permission declarations read from the manifest. This is where the rule that metadata never comes from arguments is enforced. | Call Subject | `connector/contracts/connector-manifest` (owned by `connector`) |
| Count Reader | Answers a count a condition names, from the ledger's maintained projection. Returns unavailable rather than zero. | Accumulation Window | `ledger/contracts/ledger-record` |
| Grant Register | Holds scoped approvals for the life of their job and allowlist entries for the life of the account; matches a grant only on the full tuple. | Scoped Approval, Allowlist Entry | `approval/contracts/gate-evaluation@0.1.0` |
| Approval Broker | Turns a hold into a request, carries it to the windows, applies the decision that comes back, and handles expiry and the unattended case. | Verdict, Scoped Approval | `approval/contracts/gate-evaluation@0.1.0` |
| Refusal Register | Remembers, for the length of a job, that something in it was stopped, and hands that to every question the job asks afterwards. | Refusal Notice | `approval/contracts/gate-evaluation@0.1.0` |
| Tool Wrapper | The obligatory sequence around every connector tool: record intent, evaluate, execute only on allow, record result. Holds the implementation privately. | — (behaviour specified in `specs/agent/spec.md`) | `approval/contracts/gate-evaluation@0.1.0` |
| Gate Health | The single place that says whether writes are permitted at all, and why not. | — | `approval/contracts/gate-evaluation@0.1.0` |

Hardline rules and the static patterns of the smart tier are not components. They are catalogue content compiled
into the build, expressed in the same representation as the user's rules and evaluated by the same evaluator,
which is what the spike established in its third question.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

Two boundaries exist. The first separates the agent harness from everything that can act. The second separates
the windows from everything that decides. The channels the windows use are specified in full in
`approval/contracts/gate-evaluation@0.1.0` §2 and are not restated here; what follows is the agent boundary and
the summary of why the window boundary is shaped as it is.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Payload Schema | Return Type | Side Effects | Error Handling & Timeout |
| --- | --- | --- | --- | --- | --- | --- |
| `agent/tool-registry` | main → agent host | Pub-Sub | — | Tool descriptors: name, description, argument schema. No implementation, no endpoint, no credential. | Agent host rebuilds its tool list. | A descriptor that fails its own schema is omitted; the agent then has no such tool and says so. |
| `agent/tool-invoke` | agent host → main | Request-Response | `{ callId, tool, arguments }` | The tool's result, or a refusal or hold carrying the rule and reason | The full obligatory sequence: intent record, evaluation, execution on allow only, result record | Argument schema violation rejects before evaluation. Evaluation failure holds or halts per the error matrix. Timeout is the connector's, and a timed-out call has already been recorded as intent. |
| `agent/ask-user` | agent host → main | Request-Response | `{ jobId, question, options[], allowFreeText }` | The user's answer | The question is presented with any Refusal Notice for that job attached by main | One open ask per job; a second is rejected with an instruction to combine. Expiry pauses the job. |
| `agent/job-lifecycle` | Duplex | Pub-Sub | Job state transitions | — | Ends grants and notices when the job ends | A lost agent host leaves the job paused, not completed; grants expire with the job. |

### Execution Boundaries & Isolation

The main process owns everything that can act or decide: connector adapters and their credentials, the tool
implementations, the wrapper, the evaluator, the rule store, the ledger writer, the grant register. The agent
harness runs in a separate host process and holds no tool implementation at all — only descriptors. It cannot
reach a platform except by asking main to invoke a tool, and main's answer to that request passes through the
wrapper by construction, because in main there is no other way to reach the implementation.

This is stronger than the arrangement the spike measured, where the closure-wrapped implementation lived in the
same process as the harness. There, the argument was that the reference was unreachable; here, the reference is
not present. The cost is one inter-process round trip per tool call, which is negligible beside the connector's
own network latency and is not inside the evaluation budget.

The windows — pet and application — own no decision. They display approval requests, carry the user's choice
back, and list and edit rules. There is no channel by which a window submits a call subject, obtains a verdict,
or invokes a tool, and that absence is a MAJOR-versioned property of the gate-evaluation contract rather than an
implementation habit.

Recovery. If the agent host dies, its jobs are left paused and their grants and refusal notices expire with the
job; nothing half-executed is reported as done, because the ledger holds an intent record without a result
record for exactly the calls in flight. If a window dies, pending approval requests stay pending and reappear
when a window returns. If the main process dies, nothing was executing that was not already recorded as intent,
and the counts rebuild from the ledger at the next start.

### Trust Boundaries & Input Validation

Every payload on `agent/tool-invoke` is untrusted, because its contents are shaped by model output that in turn
may be shaped by injected content: eight of the twelve measured injection cases steered the model completely. It
is validated against the tool's declared argument schema before evaluation, and it is used as the *subject* of the
decision and never as an input to it. In particular the object's type, ancestry, creator and assignee are read by
the Subject Assembler from the connector's own record of the object, never from the arguments — the boundary that
adversarial case A-17 attacked by reassigning an object before acting on it.

Every payload on a window channel is untrusted in a different sense: it carries a human decision, and the gate
checks that the decision is one that was actually offered. A decision naming an unknown or expired request is
refused; a decision on a hardline refusal is refused and recorded, because no request was ever raised for it.

The replicated catalogue is untrusted until it validates. Under principle VII the backend can decrypt, so the
protection there is operational; the catalogue is therefore validated on every load, and one that does not
validate stops writes rather than being repaired. Hardline rules are outside this boundary entirely, being in the
build.

## Decisions

### D1 — The gate, the tool implementations and the ledger live in one process; the agent harness lives in another
- **Choice**: main process owns adapters, wrapper, evaluator, rule store and ledger; the harness runs in a
  separate host holding only tool descriptors and reaching tools over `agent/tool-invoke`.
- **Rationale**: the measured guarantee rests on the implementation being unreachable except through the wrapper.
  Moving the harness out turns "unreachable" into "not present", which is a stronger claim and one that does not
  depend on a language's closure semantics. It also keeps a runaway agent loop from blocking the window that is
  supposed to show the user what is happening.
- **Alternatives Considered**: *One process, as the spike ran it* — rejected because the harness would share an
  address space with connector credentials and could block the UI, and because the closure argument, while
  verified, is a property of the runtime rather than of the architecture. *The gate in a third process of its own*
  — rejected because it needs the catalogue and the ledger, which live in main, so it would add a hop to the hot
  path to reach the data it needs anyway.

### D2 — Counts come from a maintained ledger projection, not from session memory and not from a scan
- **Choice**: the ledger maintains a count per open job and per calendar day as records are appended; the Count
  Reader asks it by key. Rebuilt from records at start and after a replication merge.
- **Rationale**: the decision-maker settled that counts must survive a restart and span devices. A projection is
  the only shape that satisfies that without putting an unbounded read on a path budgeted in microseconds, and
  rebuilding from records keeps the ledger the single source of truth rather than creating a second one.
- **Alternatives Considered**: *Session memory, as measured* — rejected: a restart resets a threshold to zero and
  a second device never sees the first one's writes, which is the fragmentation route case A-13 attacked, merely
  moved from within a job to across a restart. *Scanning ledger records per evaluation* — rejected as unbounded
  on the hot path. *A cached count with a short expiry* — rejected because a stale count is a fail-open window,
  and its width is exactly the attacker's budget.

### D3 — Conflicts resolve by strictness, and no rule carries a priority
- **Choice**: refuse beats hold beats allow; the representation has no priority, weight or order member, and
  cannot gain one without a MAJOR bump.
- **Rationale**: the thing that compiles a user's rule is a model. A number that decides which protection wins
  would therefore be chosen by a model, quietly, per rule.
- **Alternatives Considered**: *The spike's compiled priority integer* — rejected for that reason. *A
  user-ordered list in the application window* — rejected because it is a way to weaken a rule without editing
  it, and because the resulting mistake is invisible: the rule is still there, still listed, and no longer
  reached.

### D4 — Hardline rules ship in the build and never enter the stored catalogue
- **Choice**: hardline rules and the smart tier's static patterns are compiled in. A stored rule claiming either
  origin is rejected as tampering.
- **Rationale**: anything in the replicated store can be edited, corrupted or lost. The hardline list is the one
  thing that must survive a bad catalogue, so it cannot be in the catalogue.
- **Alternatives Considered**: *Store them as ordinary rules with a protected flag* — rejected: the flag is only
  as strong as the store that holds it, and the store is exactly what an attacker who reached the disk would
  edit. *Sign the hardline entries* — rejected as more machinery for a weaker result; the key would have to live
  on the device too.

### D5 — Targeting is connector-neutral and driven by the manifest
- **Choice**: a rule names a connector, a manifest-declared object type, an immutable identifier and an ancestor
  chain. Irreversibility and permission effects are read from the manifest, not from a list the gate keeps.
- **Rationale**: principle VI. A rule format holding Notion's nouns makes connector number two a core edit, and a
  gate keeping its own list of destructive operations makes it two core edits.
- **Alternatives Considered**: *Keep Notion's vocabulary for the MVP* — rejected by the decision-maker on
  2026-09-12. *A rule dialect per connector* — rejected: N formats each needing their own adversarial corpus.

### D6 — Refusals are disclosed on later questions; the gate reads no free text
- **Choice**: once something is refused or held in a job, every subsequent question in that job is presented with
  the operation, the object and the rule attached. The phrase matching the spike used is withdrawn.
- **Rationale**: the gate cannot reliably judge what a sentence means without a model, and principle II forbids a
  model from being the thing that stops an operation. What it can know without judgement is that it just refused
  something. Attaching that fact to the question leaves the user informed, which is the actual objective — a user
  who acts by hand in their own workspace was never inside the system's control, only inside its duty to tell them.
- **Alternatives Considered**: *Keep the phrase list* — rejected: brittle, single-language, and it puts string
  matching on the gate path where every other decision is structural. *A model classifier on the question* —
  rejected outright as a gate; permitted only as an advisory warning, which this design does not include because
  the disclosure already carries the information.
- **Consequence**: adversarial case A-14 is re-scored from blocked to disclosed. Nothing executed in either
  design, so the zero-leakage claim about operations reaching a connector is unaffected, but the corpus must
  record the change rather than absorb it.

### D7 — A catalogue from the future halts writes; it is never partially read
- **Choice**: a catalogue whose representation version is ahead of this build stops all writes and prompts the
  update. Unknown members are never ignored.
- **Rationale**: in an account replicating to several devices that update at different times, the older device
  will meet the newer catalogue routinely. The unknown member may be precisely the one that stops something, so
  reading around it is fail-open by construction.
- **Alternatives Considered**: *Ignore unrecognised members* — rejected for that reason. *Downgrade the
  catalogue to what this build understands* — rejected because it silently deletes protections and then
  replicates the deletion.

### D8 — A value that cannot be extracted holds the call
- **Choice**: field extraction uses the manifest's declaration where it gives one and the representation's general
  rules otherwise; a value that still cannot be extracted produces a hold, not a non-match.
- **Rationale**: treating an unextractable value as "the rule did not match" is a fail-open default sitting under
  every field rule in the product, and it would be reached precisely by payload shapes nobody anticipated — which
  is what an attacker supplies.
- **Alternatives Considered**: *Non-match* — rejected as above. *Refuse outright* — rejected as too blunt: an
  unfamiliar payload shape is usually a new platform feature, not an attack, and refusing would strand the user
  with no way forward. A hold puts a person in the loop, which is what a hold is for.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading & Registration Mechanism**: connector manifests are loaded eagerly when the application starts and
  when a connector is connected, by the `connector` capability; the gate subscribes to that registry and derives
  from each manifest the three things it needs — the object types a rule may name, the tools a rule may name, and
  each write tool's irreversibility and permission declarations. Nothing is derived lazily on the hot path. The
  rule catalogue is loaded and validated at start, and reloaded whole on a local edit or a replication merge;
  there is no incremental patching of a resident catalogue, because a half-applied edit is a gate with an unknown
  shape.
- **Isolation & Sandboxing**: manifests are data and are validated on load like any other untrusted input. The
  adapters generated from them are leaf functions in the main process that hold a reference to their platform and
  to nothing else — no reference to the harness, to another tool, or to the ledger. The harness itself is isolated
  by process, per D1.
- **Resource Management & Eviction**: the catalogue is resident in full and is not evicted; it is small, and a
  partially resident catalogue is a gate with holes. Derived manifest declarations are dropped when a connector is
  disconnected, and any rule naming that connector then matches nothing — reported to the user as a rule whose
  platform is not connected, not silently kept as if it protected something. Scoped approvals and refusal notices
  are released when their job reaches a terminal state. Object metadata cached during a job is released with the
  job, and only immutable attributes — identity, ancestry, creator — are cached at all.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (Specific ➔ General)**: a field's value shape declared by the manifest ──> the representation's general
  extraction rules ──> `FIELD_VALUE_UNEXTRACTABLE`, which holds that one call for the user. Degradation is
  per-call and always toward a person, never toward execution.
- **Tier 2 (Custom ➔ Built-in Default)**: the user's catalogue unreadable, invalid, or written by a newer release
  ──> the built-in baseline of hardline rules and static patterns alone. Because the user's rules are the part
  that expresses nuance, this baseline cannot safely approve anything, so writes stop account-wide on that device
  while reads and reporting continue. The user sees a banner naming the fault and the offending rule, and jobs
  needing writes pause rather than fail. The same tier catches a missing manifest declaration, narrowed to the
  tools of that connector.
- **Tier 3 (Degraded Safe-Mode)**: the evaluator itself fails ──> read-only safe mode. No write tool is reachable,
  because the wrapper refuses a call it could not evaluate rather than passing it through; the agent may still
  gather and report; the pet shows the halted state and the application window explains it. The product does not
  crash and does not open: an assistant that can only read is a degraded product, whereas an assistant that writes
  without a gate is the failure this whole change exists to prevent.

## Complexity Tracking

None. No constitutional principle is violated, and two clauses are tightened rather than bent: mode `off` now
keeps the user's own refusals, which is stricter than the behaviour measured in the spike, and the tool
implementation moves out of the harness's process, which strengthens principle II's separation rather than
relaxing it. The withdrawal of phrase matching in D6 removes a mechanism rather than adding an exception, and its
consequence for adversarial case A-14 is recorded in D6 and in the proposal's assumptions rather than being
absorbed.

## Research

### R1 — Does evaluation still fit its budget once a count is read rather than remembered?
- **Decision**: the ledger maintains counts as records are appended and the evaluator reads one by key; the whole
  evaluation, that read included, is held to the same 1.0 ms p99 ceiling, and the ceiling is re-measured before
  the latency claim is restated.
- **Rationale**: the measured 0.48 ms p99 covered predicate evaluation over twenty-one rules with counts in
  memory. A keyed read of a maintained counter is the only shape with a plausible chance of staying inside the
  remaining headroom; a scan certainly does not.
- **Alternatives**: scanning records per evaluation, rejected as unbounded; a cached count with an expiry,
  rejected because the staleness window is a fail-open window.
- **Source / Verification Status**: the predicate half is VERIFIED
  (`spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi`, Q6, 10,000 evaluations). The projection read
  is UNVERIFIED and is the first thing the verification plan measures.

### R2 — What does obtaining object metadata actually cost, and what happens when it fails?
- **Decision**: the metadata read sits outside the evaluation budget, as part of the tool call's own cost. The
  immutable attributes — identity, ancestry, creator — are read once per object per job and reused. A metadata
  read that fails holds the call; it never allows it and never substitutes the arguments' own claims.
- **Rationale**: ancestry and creator do not change while a job runs, so one read per object bounds the cost at
  the number of distinct objects a job touches rather than the number of calls it makes. Falling back to the
  arguments would reopen case A-17 exactly.
- **Alternatives**: reading metadata per call, rejected as needless platform traffic; trusting the arguments when
  the read fails, rejected as a fail-open default; skipping ownership rules when metadata is unavailable, rejected
  for the same reason.
- **Source / Verification Status**: UNVERIFIED, and the most consequential gap in this design. The spike read
  metadata from a mock store, so this cost was zero in the measurement; against a real platform it is a network
  call and may exceed the entire agent loop's budget for an object-heavy job.

### R3 — Does the frozen corpus still produce zero leakage against this design?
- **Decision**: the corpus is re-run against the connector-neutral representation, the ledger-derived counts and
  the withdrawn phrase list before any artifact restates the zero-leakage result as measured; A-14 is re-scored as
  disclosed rather than blocked, and the count cases gain restart and second-device variants.
- **Rationale**: the result is the entire justification for this change; carrying it over a changed design without
  re-running it would be exactly the vendor-documentation-as-conclusion move the constitution's evidence
  discipline forbids.
- **Alternatives**: restating the original result with a note, rejected — a note is not a measurement.
- **Source / Verification Status**: the original run is VERIFIED
  (`spikes/SP-8-rule-ir-hardgate/REPORT.md#0-ket-luan`); its applicability to this design is UNVERIFIED.

### R4 — How does a rule about another person's work identify that person across platforms?
- **Decision**: a principal is an identifier as the connector states it, plus the two resolved tokens for the
  signed-in account and for the assistant itself. No cross-connector identity mapping is attempted.
- **Rationale**: a rule is written about a platform's objects, so the platform's own notion of who someone is is
  the one the user was looking at when they wrote it. Mapping identities across platforms is a product capability
  in its own right, and guessing at it inside the gate would make a rule mean something the user did not say.
- **Alternatives**: a product-level identity map, rejected as scope and as a source of silent over- and
  under-matching.
- **Source / Verification Status**: UNVERIFIED; the spike used one connector and one name.

## Migration & Rollback

This change introduces persistent data that has no predecessor — no rule catalogue exists in the field, and no
application code exists yet — so there is nothing to migrate from. What it does introduce is two versioned
contracts and a store that will be replicated across devices at different release levels, which makes the
forward and backward policies load-bearing from the first release.

**Forward.** A device meeting a catalogue written by a newer release stops writes and prompts for the update
(D7). It never reads around what it does not understand. The consequence is deliberate and should be stated to
the user plainly: a device that is behind is a device that cannot write, not a device that writes with fewer
rules.

**Rollback.** Reverting this change, or reverting to a release that predates a MAJOR bump of the rule
representation, is not a code-only operation once a user has written rules: every existing catalogue becomes a
future catalogue to the reverted build and writes halt account-wide. A rollback plan must therefore include
exporting the user's rules in the representation version the target build understands, or accepting that the
account operates read-only until it rolls forward again. Recording this now, before rules exist, is cheaper than
discovering it during an incident.

**Legacy data.** None. The spike's artefacts under `spikes/SP-8-rule-ir-hardgate/` are evidence, not data to
carry forward; the catalogue of twenty user rules there is a test corpus and belongs in the verification suite,
not in a shipped default catalogue.

## Risks / Trade-offs

- [The object metadata read dominates the tool call, or fails often against a real platform] → immutable
  attributes are read once per object per job and reused; a failed read holds the call rather than allowing it;
  R2 measures the real cost before the design is committed to in code.
- [The maintained count drifts from the ledger it claims to summarise] → it is rebuilt from records at start and
  after every replication merge, and a projection that cannot be rebuilt answers unavailable, which holds calls
  rather than counting zero.
- [Two devices hold different catalogues for a while] → each evaluates the catalogue it holds. A rule the user
  wrote binds immediately on the device they wrote it on; the exposure is other devices, for the length of
  replication lag, for a rule written seconds earlier. Narrowing it further would mean blocking writes during
  replication, which trades a small and shrinking window for a constant one.
- [The closed representation frustrates a user whose intention it cannot express] → the intention is reported as
  unsupported and nothing is stored, per the existing requirement. The report is also the product's own signal
  about which leaf to consider adding, so the boundary is instrumented rather than merely defended.
- [Disclosure fatigue: every question in a job carries a refusal until the user stops reading them] → the notice
  is scoped to the job and names the specific operation and rule, so it ends when the job ends rather than
  accumulating.
- [A pathological pattern in a user's own rule slows the hot path] → patterns are bounded in length and compiled
  when the rule is stored, so a pattern that will not compile makes the rule unstorable rather than making the
  leaf vacuous at evaluation time.
- [The strictest-wins rule makes a legitimate exception awkward to express] → the exception goes inside the rule
  that grants it, using the representation's negation. This is a genuine usability cost of D3, accepted because
  the alternative is a precedence mechanism that can be got wrong invisibly.

## Open Questions

- Should the smart tier's static patterns be listed individually in the application window and switchable one by
  one, or presented as a single property of the mode? This changes what the settings surface shows and nothing
  about the representation, the evaluator or the tasks below.
- Should the maintained counts also serve the job detail view, which wants similar figures for display? A reuse
  question that can be settled when that view is built; the gate's requirement is satisfied either way.
