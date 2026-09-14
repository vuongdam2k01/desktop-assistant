---
contract: context-assembly
version: 1.0.0
status: draft
owner: agent
consumers: [agent, job, app, uix]
schema_files: [context-assembly.schema.json]
---

# Contract: Context Assembly

## Purpose

This contract owns the token economy of a job: what goes into a model request, how much room the job has, and
what is given up when that room runs out. Every model request the product makes — the pet's, the worker's, a
child job's — is composed here, from seven declared sources in one declared order, by a function that consults
no model. What it produces is not an artifact: an assembled context lives for one request and is gone. What
survives is the account of how it was built, and that account is what this contract freezes.

Two things follow from assembling rather than accumulating. A failed run can be reproduced against the exact
context that produced it, because nothing in the assembly varies between two runs given the same inputs
(INV-AG-36). And the question "why did the agent think that?" has an answer that does not require trusting the
agent: the budget it worked under, the sources it was given, the reductions that were applied and the skills
that were loaded are all recorded (INV-AG-37).

It assembles *around* an envelope that already exists rather than replacing it.
`agent/contracts/worker-loop@0.2.0` fixes the temporal anchor, the tool set and the turn ceiling injected before
the first turn, and fixes the `{ content, details }` envelope every tool result travels in; both are VERIFIED
necessities (`spikes/SP-4-agent-loop/REPORT.md` §1 Q1 case S-16, and §1 Q5). Nothing here reshapes either. The
anchor and the tool set become sections two and three of this contract's order, and a tool result inside the
transcript is still that envelope.

What it does not cover: which model the tier resolves to, which is
`agent/contracts/role-routing@1.0.0`; what a request consumed once the provider answered, which is
`agent/contracts/usage-accounting@0.1.0`; which skills exist and which body wins precedence, which is
`agent/contracts/skill-manifest@1.0.0`; and what a value is allowed to look like once it leaves the wrapper,
which is `agent/contracts/secret-redaction@1.0.0` — the boundary runs before a value reaches a context, so what
arrives here is already a redacted reference or was never secret.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`context-assembly.schema.json`](./context-assembly.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of one request's account, as it is recorded against the job, replicated with it and read
back afterwards. It is worth reading for what it makes unrepresentable as much as for what it requires.

The seven sources are the seven members of `sections`, all required, nothing else admitted, each carrying the
fixed ordinal that is its place in the declared order. A context assembled from six sources, or in a different
order, therefore has no valid account — the same technique `agent/contracts/role-routing@1.0.0` uses for its
assignments, and for the same reason: absence is how something quietly acquires a default nobody chose.

A reduction can name only a section the ladder may act on (`command-and-attachments`, `transcript`) and only an
element kind the ladder may remove. The protected set — the job's command, an attachment still in use, the
temporal anchor, the tool set, an unanswered question, the most recent turn — has no name anywhere in the file,
so asking for its removal is not a thing this account can describe.

And every bound template input carries `declared: true`, which has exactly one permitted value. A render given
an input the template does not declare fails and produces no section, so it has no account; a document that
claims one is refused here rather than believed.

What the file cannot express is stated below: that the recorded reductions ran in ladder order, that a bound
input's name occurs in the template's `declaredInputs`, and that the composer's token count agrees with the
provider's. The first two are render-time and assembly-time checks; the third is a fact about someone else's
tokeniser, and is one of the reasons a reserve exists at all.

**The file carries provisional defaults, not measured thresholds.** The reserve fraction that turns a model's
window into a ceiling and a reserve, and the size of the transcript tail that summarisation retains, have no
measurement behind them. The product still needs values to run at all, so this contract declares provisional
defaults and marks every one of them **UNVERIFIED**: the ceiling is the assigned model's declared window; the
reserve is 20% of the ceiling and never below 8 000 tokens; reduction begins when the assembled context plus
the expected next turn crosses the reserve; summarisation retains the most recent turns up to 25% of the
ceiling; and when a profile declares no window the fallback ceiling is 32 000 tokens. These are declared
budgets decided in `clarifications.md` session 2026-09-13 (Q-4), chosen so that a long job has room to run on
the models this project has measured rather than derived from any measurement of context behaviour. They are
not copied from anywhere: the reference architecture documents reserve-based sizing
(`https://omp.sh/docs/compaction`, UNVERIFIED), and copying a number out of vendor documentation is precisely
what Evidence Discipline forbids. That architecture is read here as documentation of a design space and never as
a component — `@oh-my-pi/*` is a refused dependency, VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9) — so every
pattern it suggests is re-derived against the pinned harness or rejected, and every claim traceable only to its
documentation is marked UNVERIFIED wherever it appears below. `design.md` R1 proposes spike **SP-23 — context
budget and reduction** to measure both figures against the SP-4 job corpus extended with long multi-target
jobs; when it reports, the measured values replace the provisional ones as a MINOR revision, and every job's
account already records which values it ran under.

## Schema / Surface

### 1. Interface & Data Types

The normative shape is [`context-assembly.schema.json`](./context-assembly.schema.json). The declarations below
name the same members for a reader and add what the file does not carry: the composer's own entry surface, and
the meaning each member has for the request it serves.

```typescript
import type { TemporalAnchor } from "worker-loop@0.1.0";
import type { LedgerRecordId } from "ledger-record@0.1.0";

/** The seven declared sources, closed and ordered. The ordinal is the order. */
type ContextSourceKind =
  | "role-instructions"        // 1 — the role entry's durable instructions
  | "temporal-anchor"          // 2 — worker-loop@0.2.0's anchor, unchanged
  | "tool-set"                 // 3 — the allowlist resolved once and frozen (INV-AG-33)
  | "account-rules"            // 4 — the account's rules, as advisory text only
  | "loaded-skills"            // 5 — the bodies of the skills this job loaded
  | "command-and-attachments"  // 6 — what the user asked for, and what they dropped in
  | "transcript";              // 7 — this job's own turns and tool results

/** Everything assembly reads. A pure function of exactly this (INV-AG-36). */
interface AssemblyInputs {
  jobId: string;
  requestOrdinal: number;
  roleId: string;
  roleInstructions: string;
  /** An input, not a clock read: the instant is supplied, which is what keeps assembly pure. */
  temporalAnchor: TemporalAnchor;
  toolSet: string[];
  advisoryRules: RenderedRules;
  loadedSkills: LoadedSkill[];
  command: ExternalValue;
  attachments: AttachmentRef[];
  transcript: TranscriptEntry[];
  budget: ContextBudget;
}

interface ContextBudget {
  unit: "tokens";
  derivation: "model-window" | "declared-fallback";
  /** Present only when derived: the window the assigned model's profile declares. */
  modelWindowTokens?: number;
  ceilingTokens: number;
  /** Headroom for the turn that follows. Provisional default 20% of the ceiling, never below 8 000; UNVERIFIED (SP-23). */
  reserveTokens: number;
}

/** The four steps, in the one order. A fifth is a MAJOR revision. */
type ReductionStep =
  | "drop-superseded-reads"        // 1 — lossless: a later read of the same object supersedes
  | "drop-empty-results"           // 2 — lossless: an empty search carried no information
  | "reference-bulky-results"      // 3 — lossless: the ledger still holds it in full
  | "summarise-older-transcript";  // 4 — the only step that summarises, and only the older part

type ProtectedElement =
  | "command" | "attachment-in-use" | "unanswered-question" | "most-recent-turn";

/** What a template may be given, and what it may never be given as. */
interface PromptTemplate {
  templateId: string;
  templateVersion: string;
  section: ContextSourceKind;
  declaredInputs: Array<{ name: string; required: boolean; accepts: "product-text" | "external-content" }>;
}

interface BoundInput {
  name: string;                   // occurs in declaredInputs, or the render fails
  declared: true;                 // one permitted value; see the schema
  carriedAs: "instruction-text" | "quoted-data";
  origin: { kind: OriginKind; reference?: string };
}

type OriginKind =
  | "product" | "account-rule"    // authored wording; may be instruction-text
  | "user-command" | "attachment" | "platform" | "child-job" | "web-page" | "screen";
                                  // untrusted; always quoted-data (INV-AG-39)

/** The composer's entry surface. In-process only; see §2. */
interface ContextComposer {
  /** Deterministic. Same inputs, same context, same account. */
  assemble(inputs: AssemblyInputs): Promise<AssemblyOutcome>;
  /** Runs the ladder in order against an assembled context; never against the ledger or the
   *  stored transcript (INV-AG-38). */
  reduce(context: AssembledContext, target: ContextBudget): Promise<ReductionOutcome>;
  /** Refuses an undeclared input and a required input left unbound. */
  render(template: PromptTemplate, inputs: BoundInput[]): Promise<RenderOutcome>;
}

type AssemblyOutcome =
  | { ok: true; context: AssembledContext; account: AssembledContextAccount }
  | { ok: false; error: ContextErrorCode; detail: string };

type ReductionOutcome =
  | { ok: true; context: AssembledContext; applied: ReductionEntry[] }
  | { ok: false; error: "CONTEXT_BUDGET_EXHAUSTED"; applied: ReductionEntry[]; ceilingTokens: number };

type RenderOutcome =
  | { ok: true; text: string }
  | { ok: false; error: "TEMPLATE_INPUT_UNDECLARED" | "TEMPLATE_INPUT_MISSING"
        | "TEMPLATE_EXTERNAL_AS_INSTRUCTION"; input: string };

type ContextErrorCode =
  | "CONTEXT_SOURCE_UNAVAILABLE"
  | "CONTEXT_OVER_BUDGET_AT_START"
  | "CONTEXT_BUDGET_EXHAUSTED"
  | "TEMPLATE_INPUT_UNDECLARED"
  | "TEMPLATE_INPUT_MISSING"
  | "TEMPLATE_EXTERNAL_AS_INSTRUCTION"
  | "REDUCTION_TARGET_PROTECTED"
  | "ACCOUNT_VERSION_AHEAD";

/** The recorded account. Normative shape: context-assembly.schema.json. */
type AssembledContextAccount = unknown;
```

### 2. Wire / Communication Protocol

**An assembled context is never sent to a window.** This contract adds no channel at all; what a window sees is
the *account*, carried on the job record through the surface `job` already owns.

The reason is not tidiness. An assembled context is the whole of what a model is about to be told: the role's
instructions, the rules as advisory text, every attachment, every tool result read back from a platform. Putting
it on a channel would create a second reader of material whose only reason to exist is one request, and a
second place for it to be retained, replicated and later leaked — while adding nothing the account does not
already answer. The account is smaller, it is durable by design, and it is what an investigation actually needs:
the budget, the sources, the reductions, the skills. It also keeps the asymmetry
`agent/contracts/role-routing@1.0.0` establishes, where a window may express intent and never obtains the
resolved material behind it.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| *(the job's account)* | Main → Window | via the surface `job` owns; no channel is added here | — | The job record, carrying one `AssembledContextAccount` per request | `ACCOUNT_VERSION_AHEAD` — the account is refused whole and the job's context detail is unavailable until the build is updated; the job itself still reads |
| *(assembled context)* | — | — | — | — | **No channel.** It exists for one request, in the main process, and is never serialised to a window, a file or a replicated store |
| *(assemble)* | — | — | — | — | **No channel.** Assembly happens beside the request it serves; nothing outside the main process may trigger one |
| *(reduce)* | — | — | — | — | **No channel.** Reduction is triggered by the budget, never by a user action, a model output or a handler return value |
| *(render)* | — | — | — | — | **No channel.** A template is rendered where its inputs are in hand; no window may supply a template or an input |

**Channels that deliberately do not exist.** Nothing lets a window read an assembled context, edit the source
order, add a source, insert a ladder step, raise a budget for one job, or ask for a reduction. The budget follows
from the model the user assigned to the role's tier, and the way to change it is to assign a different model —
one path, through settings, which is the property `role-routing` exists to protect.

### 3. Module Descriptor / Manifest Specification

A prompt template is a declared document, not a string the product assembles inline. Its descriptor is the
`templatesRendered` member of [`context-assembly.schema.json`](./context-assembly.schema.json), which carries
both halves together: what the template declares, and what this render actually bound into it.

**Identity.** `templateId` is stable for the life of the product; changing it produces a different instruction
rather than a new version of one. `templateVersion` is the template author's own, and is recorded because two
runs of the same job under two template versions are two different runs. `section` names which of the seven
sources the render produced — exactly one; nothing renders into a section that does not exist.

**Declared inputs.** Every slot the template has is declared with a name, whether it is required, and what it
accepts: `product-text` for the product's own or the account's own authored wording, `external-content` for
anything read from a platform, a page, a screen, an attachment, a child job, or the user's own command.

**A render with an undeclared input fails.** Not "is ignored", not "is appended": the render is refused with
`TEMPLATE_INPUT_UNDECLARED`, and the job does not start. The alternative — binding what was passed and rendering
whatever comes out — silently produces a different instruction than the one anybody wrote, and nothing
downstream would show it. A required slot left unbound is refused the same way, with `TEMPLATE_INPUT_MISSING`.

**External content is an input value and never part of the template.** A value whose origin is anything but
`product` or `account-rule` is carried as `quoted-data`: set off from the instructions, attributed to where it
came from, never concatenated into the template's own text. Attempting the opposite is refused at render with
`TEMPLATE_EXTERNAL_AS_INSTRUCTION`. This is the whole of INV-AG-39, and it is why the invariant is structural
rather than a matter of writing prompts carefully.

**Discovery.** None, and deliberately. Templates ship with the product and with activated capability packs;
there is no directory a user or a model may add one to, and no channel that supplies one. A pack's template is
still a declared document of this shape and is refused whole if it is not.

**Fallback when a template is missing or malformed.** The section is not assembled, the job does not start, and
the failure names the template. There is no default rendering, because a default rendering is an instruction
nobody wrote.

## Semantics

**Assembly is a pure function of its declared inputs.** No model is consulted about what the context should
contain, and no value that differs between two runs with identical inputs enters it (INV-AG-36). The temporal
anchor is the case worth stating: the instant is an *input* to the assembly, supplied by the caller, not a clock
the assembly reads — which is what lets the same job be reassembled later and compared with the context that
actually failed. Letting a model choose what to include was considered and rejected in `design.md` D4 for two
reasons: it is irreproducible, and it puts a context that carries untrusted content in charge of what survives.

**Every context carries the account of its own construction.** Budget, sources, reductions, skills (INV-AG-37).
The account is recorded against the job, which is where an investigation will look, and it is the only durable
trace: the context itself is memory only and is never persisted.

**The budget belongs to the assigned model, not to the product.** It is derived from the context window the
assigned model's provider profile declares, less a reserve for the turn that follows. A fixed ceiling was
rejected — it would be wrong for every model but one, and the user may reassign the tier at any time
(`design.md` D4, alternative *(c)*). When a profile declares no window, the product uses its declared fallback
ceiling — provisionally 32 000 tokens, UNVERIFIED — and records `derivation: "declared-fallback"`, so the
account says plainly that this run was working from a guess. **The reserve fraction and the retained-tail size
are provisional declared defaults** — 20% of the ceiling with an 8 000-token floor, and the most recent turns up
to 25% of the ceiling — decided in `clarifications.md` session 2026-09-13 (Q-4) so that the product has values
to run with, and UNVERIFIED until SP-23 (`design.md` R1) measures them. A contract that presented them as
measured would be asserting a measurement this project does not have; a contract that declared nothing would
leave an implementer to invent them silently.

**A context that is over budget before the first turn does not start the job.** The user is told the work is too
large for the model assigned to that role — a statement they can act on, by assigning a larger model or asking
for less — rather than the job starting and failing somewhere in the middle.

**The ladder is closed, ordered, and cheapest-and-most-faithful first.** Drop superseded reads of the same
object; drop results that carried no information, such as an empty search; replace bulky results with a
reference to the ledger record holding them; summarise the older part of the transcript. The first three lose
nothing recoverable: what they remove is superseded, empty, or still readable in full in the ledger. Only the
fourth summarises, and only what is older. The order is not a preference: it is what makes "reduction happened"
a much weaker claim than it would otherwise be, because three quarters of the ladder can run without the run
losing anything at all. Neither a capability pack nor a role may insert a step, because a step that removes the
wrong thing is invisible until a run goes wrong.

**The protected set is closed and structural.** The job's command, attachments still in use, the temporal
anchor, the tool set, an unanswered question and the most recent turn are never removed. Five of the seven
sections are not reducible at all, so most of the set is protected by having no reachable target; within the two
that are, the closed list of element kinds holds no name for the command or for an attachment still in use. An
unanswered question survives exactly as it was asked, with its options — at most one ask may be open per job,
VERIFIED (`spikes/SP-21-ask-user-offline/REPORT.md` §1 Q2), so this is one element, not a class that can grow.

**Reduction acts only on what is sent to the model.** The ledger and the stored transcript are append-only and
are never rewritten by it (INV-AG-38, constitution principle III). A bulky result replaced by a reference is
still in the ledger in full, and the reference identifies the record, so the user and a later investigation can
read what the agent actually saw. This is what makes step three lossless rather than merely cheap.

**An image is never archived to make room.** The reference architecture's maintenance chain includes folding
history into images for a vision-capable model (`https://omp.sh/docs/compaction`, UNVERIFIED). It is rejected
here: it would make a job's survival depend on the assigned model having vision, and two of the three text
models this project measured refuse images outright, returning `HTTP 400` with an explicit unsupported-input
error — VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md` §1 Q1). A reduction strategy that fails on two thirds
of the measured field is not a reduction strategy.

**When the ladder completes and the context is still over budget, the job fails naming the budget.** It does not
send a request the provider will refuse. The job's completed-operations list and its undo offer are intact,
because a job that ran out of room is still a job that did things, and what it did is the part the user cares
about most at that moment.

**The model does not change mid-run to gain room.** A one-time handoff to a larger model was considered and
rejected in `design.md` D5: a running job finishes against the assignment it started with, and the ledger and
the usage account both attribute spend to a role, so a job whose role changed halfway is a job whose account
cannot be read. Where planning deserves a stronger model than execution, that is delegation — two jobs, two
recorded roles, two accounts — not a switch inside one.

**Skills are advertised cheaply and loaded whole.** Only the bodies a job actually loaded occupy section five;
every other enabled skill is represented to the agent by its identifier and the work it applies to. A skill
loaded mid-job is recorded with `reason: "matched-mid-job"` and the request ordinal at which it arrived, and the
budget is re-evaluated before the next request. A skill that was asked for and is absent appears in
`skillsUnavailable` with the catalogue's reason: the agent starts without it rather than the job failing.

**A source that cannot be read stops the job; a source that is empty does not.** An account whose rules cannot
be read is not the account the run was meant to have, so assembly fails with `CONTEXT_SOURCE_UNAVAILABLE`. A
rule set that is genuinely empty produces a section of zero tokens. The two are different facts and the schema
keeps them different, because every section is always present.

**Nothing from another job enters.** The account's scope is one `jobId`. A child job assembles its own context
from its own sources; what it reports back to its parent arrives as a delegation result, which is external
content wherever it is read (INV-JOB-09) and therefore enters the parent's context as a bound input with
`origin.kind: "child-job"`, never as instruction text.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `CONTEXT_SOURCE_UNAVAILABLE` | One of the seven declared sources could not be read at assembly time | Main; no context, no request, no job | A SYSTEM card naming the source that could not be read; the job does not start |
| `CONTEXT_OVER_BUDGET_AT_START` | The first assembled context already exceeds the ceiling | Main; the job never starts | The work is too large for the model assigned to that role, named, with the routing settings offered |
| `CONTEXT_BUDGET_EXHAUSTED` | Every ladder step ran and the context still exceeds the ceiling | Main; the job fails | The job fails naming the budget, with its completed-operations list and its undo offer intact |
| `TEMPLATE_INPUT_UNDECLARED` | A render was given an input the template does not declare | Main, at render; fail-closed | The job does not start; the failure names the template and the input, because the alternative is a different instruction nobody wrote |
| `TEMPLATE_INPUT_MISSING` | A required declared input was left unbound | Main, at render; fail-closed | As above, naming the slot |
| `TEMPLATE_EXTERNAL_AS_INSTRUCTION` | A value whose origin is untrusted was bound as instruction text | Main, at render; fail-closed | The job does not start; the failure names the input and its origin. This path is a product defect, not a user error, and is reported as one |
| `REDUCTION_TARGET_PROTECTED` | A reduction named a protected section or element | Main; the reduction does not run | None directly: the ladder never produces this, so it is a defect signal recorded against the job rather than a state the user is asked to resolve |
| `ACCOUNT_VERSION_AHEAD` | A job's context account replicated from a device running a newer build | Main; the account is refused whole | A SYSTEM card asking for the update; the job's own record still reads, and its context detail is unavailable until then |

## Compatibility

**MAJOR** — adding, removing, renaming or reordering a context source; adding, removing or reordering a ladder
step; removing an element from the protected set; making an assembled context reachable from a window; making
assembly consult a model; letting external content be rendered as instruction text; changing what `declared`
means on a bound input; making reduction able to rewrite the ledger or the stored transcript.

**MINOR** — adding an optional member to the account (a new per-step measurement, a new skill origin); adding a
`ContextErrorCode` with a remedy; adding an `origin.kind` for a new carrier of external content; adding a
`reason` for an unavailable skill; pinning the reserve fraction or the retained-tail size once SP-23 has
measured them, since a figure the account already records becomes a figure the product declares.

**PATCH** — wording, descriptions, and the evidence citations attached to a statement.

**Support window.** The account replicates with its job record between devices on different builds, so the
mixed-version rule is the one this project already uses: a newer build reads an older account unchanged; an
older build meeting a newer `accountVersion` refuses the account whole rather than reading around a member it
does not recognise. Reading around an unrecognised member here would mean presenting an incomplete list of what
was removed from a context as though it were complete, which is worse than presenting nothing.

## Examples

The token figures below are the values one configuration produced for one model under the provisional
defaults. **They are illustrative, not normative**: the reserve fraction and the retained-tail size are
provisional declared budgets, UNVERIFIED pending SP-23 (`design.md` R1), and the account's job is to record
whatever values the product actually ran under, not to encode a number.

**Valid** — a worker nine requests into a long job: seven sections in the declared order, a budget derived from
the assigned model's window, one recorded reduction that replaced two bulky results with references to their
ledger records, and one loaded skill.

```json
{
  "accountVersion": "1.0.0",
  "jobId": "job-4f21c9",
  "requestOrdinal": 9,
  "roleId": "worker",
  "budget": {
    "unit": "tokens",
    "derivation": "model-window",
    "modelWindowTokens": 131072,
    "ceilingTokens": 98304,
    "reserveTokens": 16384
  },
  "sections": {
    "role-instructions": { "ordinal": 1, "tokens": 640, "reducible": false, "renderedFromTemplate": "agent.role-instructions" },
    "temporal-anchor": { "ordinal": 2, "tokens": 48, "reducible": false, "renderedFromTemplate": "agent.temporal-anchor" },
    "tool-set": { "ordinal": 3, "tokens": 1120, "reducible": false },
    "account-rules": { "ordinal": 4, "tokens": 310, "reducible": false, "renderedFromTemplate": "agent.account-rules.advisory" },
    "loaded-skills": { "ordinal": 5, "tokens": 2980, "reducible": false },
    "command-and-attachments": {
      "ordinal": 6,
      "tokens": 210,
      "reducible": true,
      "renderedFromTemplate": "agent.job-command",
      "protectedElements": ["command"]
    },
    "transcript": {
      "ordinal": 7,
      "tokens": 79320,
      "reducible": true,
      "protectedElements": ["most-recent-turn"]
    }
  },
  "templatesRendered": [
    {
      "templateId": "agent.account-rules.advisory",
      "templateVersion": "1.0.0",
      "section": "account-rules",
      "declaredInputs": [
        { "name": "ruleText", "required": true, "accepts": "product-text" }
      ],
      "boundInputs": [
        {
          "name": "ruleText",
          "declared": true,
          "carriedAs": "instruction-text",
          "origin": { "kind": "account-rule", "reference": "rule-set-7" }
        }
      ]
    },
    {
      "templateId": "agent.job-command",
      "templateVersion": "1.0.0",
      "section": "command-and-attachments",
      "declaredInputs": [
        { "name": "commandText", "required": true, "accepts": "external-content" },
        { "name": "attachmentDigest", "required": false, "accepts": "external-content" }
      ],
      "boundInputs": [
        {
          "name": "commandText",
          "declared": true,
          "carriedAs": "quoted-data",
          "origin": { "kind": "user-command", "reference": "job-4f21c9#command" }
        }
      ]
    }
  ],
  "assembledTokens": 84628,
  "reductions": [
    {
      "step": "reference-bulky-results",
      "appliedTo": "transcript",
      "recoverable": true,
      "removed": [
        {
          "elementKind": "bulky-result",
          "count": 2,
          "replacedBy": "ledger-reference",
          "ledgerRecordIds": ["led-8831", "led-8834"]
        }
      ],
      "reclaimedTokens": 21460
    }
  ],
  "skillsLoaded": [
    {
      "skillId": "notion-task-triage",
      "origin": "product",
      "reason": "matched-at-start",
      "loadedAtRequestOrdinal": 1,
      "tokens": 2980
    }
  ],
  "skillsUnavailable": [],
  "disposition": "sent"
}
```

**Valid** — the same shape where the assigned model's profile declares no context window. The budget is the
product's declared fallback and says so: `derivation` is `declared-fallback` and `modelWindowTokens` is absent,
because a figure that was never read must not be recorded as though it had been. Nothing else changes — a job
on a fallback budget is an ordinary job, it is merely one whose account tells a later reader not to compare its
room with anyone else's.

```json
{
  "accountVersion": "1.0.0",
  "jobId": "job-71ab04",
  "requestOrdinal": 1,
  "roleId": "worker",
  "budget": {
    "unit": "tokens",
    "derivation": "declared-fallback",
    "ceilingTokens": 24576,
    "reserveTokens": 4096
  },
  "sections": {
    "role-instructions": { "ordinal": 1, "tokens": 640, "reducible": false },
    "temporal-anchor": { "ordinal": 2, "tokens": 48, "reducible": false },
    "tool-set": { "ordinal": 3, "tokens": 1120, "reducible": false },
    "account-rules": { "ordinal": 4, "tokens": 0, "reducible": false },
    "loaded-skills": { "ordinal": 5, "tokens": 0, "reducible": false },
    "command-and-attachments": { "ordinal": 6, "tokens": 96, "reducible": true, "protectedElements": ["command"] },
    "transcript": { "ordinal": 7, "tokens": 0, "reducible": true }
  },
  "assembledTokens": 1904,
  "reductions": [],
  "skillsLoaded": [],
  "skillsUnavailable": [
    { "skillId": "meeting-minutes", "reason": "not-in-catalogue" }
  ],
  "disposition": "sent"
}
```

The empty `account-rules` section is the second thing worth reading here. It is present and zero, not absent:
an account with no rules yet is a different fact from an account whose rules could not be read, and the latter
stops the job with `CONTEXT_SOURCE_UNAVAILABLE` rather than producing a context.

**Rejected** — a render that was given an input the template does not declare. The template declares
`resultSummary`; the render also bound `pageBody`, a Notion page body read back by a tool, and wrote it down as
undeclared.

```json
{
  "accountVersion": "1.0.0",
  "jobId": "job-90cc18",
  "requestOrdinal": 3,
  "roleId": "worker",
  "budget": {
    "unit": "tokens",
    "derivation": "model-window",
    "modelWindowTokens": 131072,
    "ceilingTokens": 98304,
    "reserveTokens": 16384
  },
  "sections": {
    "role-instructions": { "ordinal": 1, "tokens": 640, "reducible": false },
    "temporal-anchor": { "ordinal": 2, "tokens": 48, "reducible": false },
    "tool-set": { "ordinal": 3, "tokens": 1120, "reducible": false },
    "account-rules": { "ordinal": 4, "tokens": 310, "reducible": false },
    "loaded-skills": { "ordinal": 5, "tokens": 0, "reducible": false },
    "command-and-attachments": { "ordinal": 6, "tokens": 210, "reducible": true },
    "transcript": { "ordinal": 7, "tokens": 4200, "reducible": true, "renderedFromTemplate": "agent.tool-result" }
  },
  "templatesRendered": [
    {
      "templateId": "agent.tool-result",
      "templateVersion": "1.0.0",
      "section": "transcript",
      "declaredInputs": [
        { "name": "resultSummary", "required": true, "accepts": "external-content" }
      ],
      "boundInputs": [
        {
          "name": "resultSummary",
          "declared": true,
          "carriedAs": "quoted-data",
          "origin": { "kind": "platform", "reference": "notion:page-1182" }
        },
        {
          "name": "pageBody",
          "declared": false,
          "carriedAs": "quoted-data",
          "origin": { "kind": "platform", "reference": "notion:page-1182" }
        }
      ]
    }
  ],
  "assembledTokens": 6528,
  "reductions": [],
  "skillsLoaded": [],
  "disposition": "sent"
}
```

*Rationale for rejection*: `declared` has one permitted value, and `false` is not it. The document is describing
something that cannot have happened — a render given an input its template does not declare is refused with
`TEMPLATE_INPUT_UNDECLARED` and the job does not start, so the section was never produced and there is no
account to write. Refusing it here rather than accepting a well-formed record of an impossible render matters,
because the alternative shape of this failure is the dangerous one: an undeclared input quietly bound and
rendered produces an instruction nobody wrote, out of content read from a platform, which is exactly the path
INV-AG-39 and the constitution's *External Content Is Data* section exist to close.

**Rejected** — a reduction asked to remove a protected section. The ladder has run out of transcript to reclaim
and the request is for the temporal anchor to go.

```json
{
  "accountVersion": "1.0.0",
  "jobId": "job-55de02",
  "requestOrdinal": 14,
  "roleId": "worker",
  "budget": {
    "unit": "tokens",
    "derivation": "model-window",
    "modelWindowTokens": 131072,
    "ceilingTokens": 98304,
    "reserveTokens": 16384
  },
  "sections": {
    "role-instructions": { "ordinal": 1, "tokens": 640, "reducible": false },
    "temporal-anchor": { "ordinal": 2, "tokens": 48, "reducible": false },
    "tool-set": { "ordinal": 3, "tokens": 1120, "reducible": false },
    "account-rules": { "ordinal": 4, "tokens": 310, "reducible": false },
    "loaded-skills": { "ordinal": 5, "tokens": 2980, "reducible": false },
    "command-and-attachments": { "ordinal": 6, "tokens": 210, "reducible": true, "protectedElements": ["command"] },
    "transcript": { "ordinal": 7, "tokens": 96000, "reducible": true, "protectedElements": ["most-recent-turn"] }
  },
  "assembledTokens": 101308,
  "reductions": [
    {
      "step": "summarise-older-transcript",
      "appliedTo": "transcript",
      "recoverable": false,
      "removed": [
        { "elementKind": "older-turn-range", "count": 1, "replacedBy": "summary" }
      ],
      "reclaimedTokens": 18200
    },
    {
      "step": "drop-empty-results",
      "appliedTo": "temporal-anchor",
      "recoverable": true,
      "removed": [
        { "elementKind": "empty-result", "count": 1, "replacedBy": "nothing" }
      ]
    }
  ],
  "skillsLoaded": [],
  "disposition": "exhausted-over-budget",
  "failure": {
    "code": "CONTEXT_BUDGET_EXHAUSTED",
    "statedCeilingTokens": 98304,
    "detail": "This job needs more room than the model assigned to the worker role has."
  }
}
```

*Rationale for rejection*: `appliedTo` admits only the two reducible sections, so `temporal-anchor` is not a
value a reduction can carry. The protected set is not defended by a check that could be forgotten; it is
defended by there being nothing to write down. Removing the anchor is the specific failure this matters most
for — it is the section whose absence produced the boundary-day errors of case S-16, VERIFIED
(`spikes/SP-4-agent-loop/REPORT.md` §1 Q1) — and a context that has quietly lost it fails by computing the wrong
dates, not by stopping. The correct account of this run is the one this document was reaching for and should
have stopped at: the ladder completed, the context is still over budget, and the job fails naming the budget
with its completed-operations list intact. A second fault is visible in the same document, and it is one the
schema accepts and a reviewer must still refuse: the recorded steps ran in the wrong order, since summarisation
is the last rung of the ladder and not the first. Ordering is a relation between entries, which no shape of a
single entry can express — it is stated under Semantics and is what a MAJOR bump here exists to protect.

## Migration

Not applicable at `1.0.0`: no context account exists in the field, and no job record written before this change
carries one. A job record from an earlier build reads as a job whose context was not accounted for, which is
correct — it was not. Nothing backfills, and nothing reconstructs an account for a run that has already
happened: an account is a record of what was done, and a reconstructed one would be a guess wearing the same
shape.

Two later migrations are foreseeable and are named here so that the version rule is unambiguous. Replacing the
provisional reserve fraction or retained-tail size with measured values once SP-23 reports is a MINOR revision —
the figures are already recorded per job, so older accounts stay readable and merely record the provisional
setting they ran under. Adding an eighth
context source, or a fifth ladder step, is MAJOR and requires its own change: an older build meeting such an
account refuses it whole under `ACCOUNT_VERSION_AHEAD`, because a list of sources that silently omits one it
does not recognise is a list that misleads the reader about what the model saw.
