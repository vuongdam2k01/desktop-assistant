---
contract: secret-redaction
version: 1.0.0
status: draft
owner: agent
consumers: [agent, ledger, approval, connector, sync, uix]
schema_files: [secret-redaction.schema.json]
---

# Contract: Secret Redaction

## Purpose

Every tool argument and every tool result crosses one boundary before it becomes something the product keeps.
This contract owns that boundary: what counts as secret material, how a value of that kind is recognised, and
what stands in the record where the value was. It is a step of the tool wrapper, placed between the arguments
and the intent record and again between the platform's answer and the result record
(`agent/contracts/tool-wrapping@0.2.0`, the order in `design.md` § Structure), and the unredacted value reaches
only the platform the call was made against.

There are exactly four exits it defends, and they are the whole reason it sits where it does: the model request,
the stored transcript, the ledger record, and the replicated store. Anything arriving at one of those without
having crossed this boundary would be a path that does not exist (INV-AG-42). Redacting later — in the ledger
writer, in a window, at display time — leaves the value in at least one of the four, and under principle VII the
worst of the four is the replicated store: replicated data is decryptable by the service by design, so the only
cheap defence against a secret in an account's history is not writing it down.

Whoever writes a connector adapter, a capability pack or a tool of any kind builds on this contract, and mostly
by doing nothing: the declaration it offers is optional, and the default protects a tool whose author never read
this document.

What it does not cover: where a credential is *kept*, which is `platform/contracts/secure-storage@0.1.0` and its
class descriptor; the shape of the record a reference sits inside, which is
`ledger/contracts/ledger-record@0.1.0` and is unchanged by this contract — a reference replaces a *value*, never
a record's shape; and how a redacted field is displayed, which is `uix`'s.

**Evidence status.** No measurement of redaction exists in this project. Every claim below about what the
recognition rules catch and what they over-catch is **UNVERIFIED**; `design.md` R3 proposes spike **SP-25 —
redaction over a seeded corpus** to measure what reaches each of the four exits and the false-positive rate
against ordinary content. The reference architecture treats this class of material as never belonging in a
conversation (`https://omp.sh/docs/secrets`, UNVERIFIED); `@oh-my-pi/*` is read as a design space and refused as
a dependency — VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q9).

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`secret-redaction.schema.json`](./secret-redaction.schema.json) | JSON Schema 2020-12 | normative |

The file carries three documents and is worth reading for the third. `RedactionClassDeclaration` is how the
vocabulary opens; `ToolSecretFieldDeclaration` is the optional member a tool registration may carry; and
`RedactedReference` is the closed form, expressed so that the closure is structural rather than a rule someone
must remember. It admits exactly three members with `additionalProperties: false`, and both of the members that
carry anything are constrained to alphabets in which no fragment of a value can be spelled — the class name
comes from the declared vocabulary, the field path from the product's own traversal. A `hash`, a `prefix`, a
`last4`, a `length` or a lookup `key` cannot be added to a reference without editing that file, and editing it
that way is a MAJOR revision of this contract with the argument in § Compatibility to answer first.

What the file cannot express is everything positional. It cannot say that the boundary is a step of the wrapper
rather than a reader's courtesy; that a value crosses it exactly once; that the adapter is handed the
unredacted arguments; or that a declaration is an optimisation over the default rather than a replacement for
it. Those are stated under § Semantics, and they are what a MAJOR bump here exists to protect.

## Schema / Surface

### 1. Interface & Data Types

The normative shapes are [`secret-redaction.schema.json`](./secret-redaction.schema.json). The declarations
below name the same members for a reader and add what a schema file cannot hold: the projection surface the
wrapper calls, and what a projection can return.

```typescript
import type { ToolImplementation } from "tool-wrapping@0.2.0";

/** A class name from the declared vocabulary. A pack's class is prefixed with the pack identifier and a dot. */
type ClassName = string;

/** A traversal path within the document being projected. Never a platform's own key text; see FieldPath. */
type FieldPath = string;

/** The closed form. Three members, and no fourth is representable (INV-AG-43). */
interface RedactedReference {
  readonly redacted: true;
  readonly class: ClassName;
  readonly field: FieldPath;
}

/** How a value of a class is recognised when no tool declared the field that carries it. */
interface RecognitionRule {
  rule: string;
  appliesTo: "field-name" | "value";
  pattern: string;                    // compiled when the declaration is read; an uncompilable one refuses it
  minLength?: number;                 // keeps a broad value pattern off short ordinary strings
  description: string;                // what it catches, and what it is known to over-catch
}

interface RedactionClass {
  schemaVersion: string;
  class: ClassName;
  name: string;                       // display text where a reference is shown
  origin: "product" | "pack";
  pack?: string;                      // required when origin is "pack"; also the class name's prefix segment
  description?: string;
  recognition: { rules: RecognitionRule[] };   // an empty list means declaration-only, and says so
  referenceForm: "class-and-field";   // named, never chosen: the vocabulary is open, the form is closed
}

/** The optional member tool-wrapping@0.2.0 adds to a registration. Absent is the ordinary case. */
interface ToolSecretFields {
  schemaVersion: string;
  tool: string;
  arguments?: Array<{ path: FieldPath; class: ClassName }>;
  results?: Array<{ path: FieldPath; class: ClassName }>;
}

/**
 * The boundary itself. In-process, held by the wrapper, reachable from nothing else — not from a session, not
 * from an interception point, not from a window. It has no "disable" and no per-call option, because an
 * argument that could turn it off is an argument model output could learn to produce.
 */
interface RedactionBoundary {
  /** Called with the arguments as they will be sent; returns what the intent record and the model may hold. */
  projectArguments(tool: string, args: Record<string, unknown>): Projection;
  /** Called with the platform's answer; returns what the result record, the transcript and the agent may hold. */
  projectResult(tool: string, value: unknown): Projection;
  /** The declared vocabulary as it stands now, for display and for registration-time checking. */
  classes(): ReadonlyArray<RedactionClass>;
}

type Projection =
  | { ok: true; value: unknown; replaced: ReadonlyArray<RedactedReference> }
  | { ok: false; error: RedactionErrorCode; detail: string };

type RedactionErrorCode =
  | "REDACTION_CLASS_INVALID"        // a declaration the boundary cannot compile; the class does not exist
  | "REDACTION_CLASS_NAME_CONFLICT"  // two declarations claim one class name
  | "SECRET_FIELD_PATH_UNKNOWN"      // a tool declares a field its parameter shape has no member for
  | "SECRET_FIELD_CLASS_UNKNOWN"     // a tool names a class no declaration provides
  | "REDACTION_FAILED_ARGUMENTS"     // projection could not complete before the intent record
  | "REDACTION_FAILED_RESULT"        // projection of the platform's answer could not complete
  | "REFERENCE_MALFORMED";           // a value shaped like a reference carrying a member outside the form
```

**Where the two calls sit, stated once.** `projectArguments` runs after the before-a-tool-call interception
point and before the intent record is appended; `projectResult` runs after the adapter returns and before the
result record is appended. The adapter is invoked with the arguments the agent produced, unprojected. Any other
placement is a different contract, and § Compatibility says so.

### 2. Wire / Communication Protocol

Not applicable, and the absence is the point rather than an omission. No window channel exists here for two
independent reasons, either of which alone would be sufficient.

A window never sees an unredacted value. Everything a window can read — a ledger entry through
`ledger/contracts/ledger-store@0.1.0`, a transcript, a job detail — is downstream of the boundary, so by the
time anything crosses a process boundary the value is already a reference. A channel carrying the value to a
window for redaction there would be the display-time redaction D9 rejects: it would put the secret in the store
and in the replicated envelope, which is where it matters most.

A window never configures the boundary. A class is a declaration made by the product or contributed by an
activated capability pack, and activation is evidence-bound rather than user-settable, so there is nothing to
toggle. A user-settable exception — "do not redact this field" — would be a way to switch redaction off from
outside the wrapper, and the wrapper's guarantees are exactly the ones that must not be reachable that way
(principle II, INV-AG-41). This is the same asymmetry `agent/contracts/role-routing@0.1.0` establishes: a window
may express intent and can never obtain the resolved thing.

The boundary is therefore an ordinary in-process step, like the gate and the ledger write beside it, in the one
process that owns connectors and the store.

### 3. Module Descriptor / Manifest Specification

**The class declaration.** A redaction class is a document —
[`secret-redaction.schema.json`](./secret-redaction.schema.json), the `RedactionClassDeclaration` alternative —
carrying three things that matter and some that do not. The class *name* is the vocabulary entry and the only
thing about the class a reference carries. The *recognition* is how a value of the class is spotted when no tool
declared the field holding it: an ordered list of rules, each testing either the field's name or the value's
text, each carrying the description of what it is known to over-catch. And the *reference form* is named rather
than chosen: `class-and-field`, the one form there is.

**How a capability pack contributes a class.** A pack declares classes in its manifest's `secretClasses` member
(`agent/contracts/capability-pack@1.0.0`; `model.md` § Manifest Schema). They are contributed when the pack
activates and withdrawn when it deactivates, together with its tools, roles and skills — an unactivated pack
declares no class, as it contributes nothing else (INV-AG-45). A pack's class name is prefixed with the pack
identifier and a dot, which makes a collision with a shipped class impossible rather than merely detectable, and
makes a reference's class name say where its explanation lives. A pack cannot redefine a shipped class, cannot
remove a rule from one, and cannot introduce a reference form; it can only add a kind of material to protect.
This is the open half of the pair recorded in `model.md` § Variability: *redaction classes — open; the reference
form — closed*.

**The tool's optional declaration.** A tool may name which of its argument and result fields carry which class.
It is an optional member of the registration surface in `agent/contracts/tool-wrapping@0.2.0` — optional in the
strict sense that no registration written against `tool-wrapping@0.1.0` becomes invalid, which is why that bump
is MINOR. What the declaration buys is precision: a declared field is redacted whatever its value looks like,
including when it is empty, short, or shaped like ordinary text. What it does not buy is exemption: an
undeclared field matching a declared class's rule is redacted anyway.

**The shipped set.** Five classes ship with the product:

- `provider-credential` — the key that opens a model provider. Field-name and value rules; held in secure
  storage, so it should never appear in a payload at all.
- `connector-authorisation-token` — the access token a connector call is made with. Field-name and value rules;
  likewise held in secure storage.
- `authorisation-code` — the one-time code exchanged during a connector Connect flow. Field-name rules;
  short-lived and high-value.
- `refresh-token` — the long-lived half of an authorisation. Field-name and value rules.
- `personal-identifier` — personal-identifier material appearing inside a platform payload: the account
  identifiers, contact details and document identifiers a connector read returns. Value rules, and the class
  most likely to over-catch; see § Semantics.

The first two deserve a note that explains why the boundary exists at all. A provider credential and a connector
authorisation are held by `platform/contracts/secure-storage@0.1.0` and are attached to a request by the adapter
rather than travelling as a tool argument, so in the ordinary path they are never values the boundary sees.
Their classes exist for the paths that are not ordinary: a token quoted back inside an error message, an
authorisation header echoed in a debug field, a refresh token pasted by the user into a command, a connector
whose payload contains another system's key. Those are the cases where an author's omission and a secret's
arrival coincide, and they are exactly the cases a declaration-only scheme would miss.

**Fallback when a declaration is absent or unreadable.** A class whose declaration cannot be compiled does not
exist, and the component that declared it fails with it: the product fails to start for a shipped class, and a
pack contributing one contributes nothing at all. There is deliberately no partially-loaded class, because a
class that exists with half its rules reports a protection it is not providing.

## Semantics

**The boundary is a step, not a reader's courtesy.** It sits inside the wrapper, with the gate and the ledger
write, and like them it is not a registration at an interception point (INV-AG-41): there is nothing to
unregister, nothing to reorder and nothing to persuade. A handler at the before-a-tool-call point may transform
arguments; what it hands back is then projected like any other arguments, so a handler cannot route a value past
the boundary either.

**Four exits, and a value crosses once.** The model request, the stored transcript, the ledger record and the
replicated store are downstream of the two projection calls, and the replicated store is downstream of the
ledger record rather than a fifth path of its own — `sync/contracts/replication-protocol@0.1.0` carries records
that were already projected when they were written. A value that has already become a reference is left alone
when it passes again: the `redacted: true` marker is what makes "exactly once" (INV-AG-42) checkable rather than
merely intended.

**Classification is declaration-first with a conservative default.** A tool's declaration is consulted first and
is authoritative for the fields it names. Every other field is tested against the recognition rules of every
declared class, and a match is redacted. The order matters only for cost; the outcome of a conflict does not
arise, because a declared field is already redacted and a rule can only add. The reason for the default is
stated as plainly as it can be: an omission by a tool author must not become a disclosure. A connector manifest
is written once and read by everyone afterwards; the author who forgets a field is the ordinary case, not the
exceptional one.

**The adapter receives the unredacted arguments.** This is why the boundary projects what *leaves* the wrapper
rather than what enters the adapter. No platform call is affected by redaction, so redaction cannot break a tool
by removing something the call needed — the risk register's line on this
(`design.md` § Risks) is answered by the placement rather than by care. The cost of a false positive is
therefore bounded: a reference where a value would have been, in the record and in the model request. It is not
free — an agent that cannot see a value it needed may re-plan or fail — but it is not a broken write.

**A reference carries the class and the field and nothing else.** Not a hash: a hash of a token is a verifier
for that token and replicates as one. Not a truncation: a prefix is the half that identifies the account and
often the issuer. Not a length, not a lookup key into some local table that a second device does not hold. All
three would be written into the account's history and would replicate, and under principle VII the service
holds the means to decrypt what replicates — the protection there is operational, not cryptographic. The
cheapest defence against a secret in a replicated store is that the secret was never written to it.

**Open vocabulary, closed form.** A capability pack that handles a new kind of secret declares a class; nothing
in the product is edited for it, which is principle VI applied to this surface. Nothing may declare a new
reference form, because every consumer — the ledger reader, the undo agent, the job detail, the replication
envelope, a future export — reads references without negotiating, and a second form would mean each of them
handling a shape it was not written for.

**What the `ledger` requirement gets, and what is still open.** A ledger record must carry the full account of
one step (principle III). A redacted intent record names the connector, the tool, every parameter that is not
secret, the class of each parameter that is, and the field each occupied; its result record names the outcome,
the snapshot and the compensating action the same way. The account is therefore complete in everything except
the secret itself. Whether that satisfies the requirement is **Q-6 in this change's `clarifications.md`**, it is
owned by the `ledger` capability owner, and it is not settled here. The recommended answer is yes, for the
reason just given; if it is answered no, `ledger` gains a MODIFIED requirement and this contract's reference
form is what that requirement must be written against.

**Failure is closed on the way in and closed on the way out.** A projection of arguments that cannot complete
refuses the call before the intent record is written, so nothing executes and nothing is recorded as having
executed — the same posture `agent/contracts/tool-wrapping@0.1.0` gives an unwritable intent record. A
projection of a *result* that cannot complete is a harder case, because the call already happened: the value
reaches none of the four exits, the result record is written as a failure naming the tool and the class whose
rule failed, and the agent receives that failure. Letting the value through because projecting it was awkward
would be the one outcome this contract exists to prevent.

**False positives are expected and unmeasured.** `personal-identifier` is the class most likely to over-catch:
an identifier-shaped string in ordinary prose is indistinguishable from an identifier by pattern alone, and a
Notion page or an email body is full of both. Every figure anyone might want here — coverage, false-positive
rate, the effect on a job's success — is **UNVERIFIED**, and proposed spike **SP-25** in `design.md` R3 is where
those numbers are to come from: a seeded corpus of tokens, keys and personal identifiers placed into connector
payloads, user commands and attachments, measured at each of the four exits and against ordinary content. No
number is asserted in this contract, and vendor documentation is not grounds for one.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `REDACTION_CLASS_INVALID` | A class declaration the boundary cannot compile — an uncompilable pattern, a later `schemaVersion`, a missing member | Callee, at read time | A shipped class: the product does not start. A pack's class: the pack contributes nothing, and a SYSTEM card names the pack and the failing field |
| `REDACTION_CLASS_NAME_CONFLICT` | Two declarations claim one class name | Callee, at read time | As above; a class name resolved by load order would make a reference's meaning depend on start-up sequence |
| `SECRET_FIELD_PATH_UNKNOWN` | A tool declares a secret field its parameter shape has no member for | Callee, at registration; the tool is refused | Nothing at run time — the failure lands where a tool author sees it, not where a user does |
| `SECRET_FIELD_CLASS_UNKNOWN` | A tool names a class no declaration provides | Callee, at registration; the tool is refused | As above |
| `REDACTION_FAILED_ARGUMENTS` | Projection could not complete before the intent record | Callee (the wrapper); the call is refused, fail-closed | An ERROR card stating the action was not performed because the product could not safely record it |
| `REDACTION_FAILED_RESULT` | Projection of the platform's answer could not complete | Callee (the wrapper); the value reaches no exit and the result record records the failure | An ERROR card stating the action was performed and its result could not be safely recorded, naming the tool |
| `REFERENCE_MALFORMED` | A value shaped like a reference carries a member outside the closed form | Callee, wherever it is read — the store, the replication reader, a consumer | The record is refused rather than displayed; the only legitimate producer of a reference is the boundary, so a malformed one is evidence of tampering or of a build mismatch |

## Compatibility

**MAJOR** — adding any member to `RedactedReference`, including one derived from the value; moving either
projection call relative to the interception point, the ledger write or the adapter invocation; making the
recognition default opt-in; letting a class be declared by anything other than the product or a capability pack;
adding a second reference form; removing a shipped class; exposing any configuration of the boundary to a
window. Each of these changes the security argument rather than the interface, which is why it is MAJOR even
where it is source-compatible.

**MINOR** — adding a class to the shipped set; adding a recognition rule to an existing class; adding an
optional member to a class declaration or to a tool's declaration; adding an error code whose handling is
already covered by the fail-closed rule; tightening a pattern so that it over-catches less.

**PATCH** — wording, display names, rule descriptions, and the evidence citations attached to them.

**Support window.** References replicate, and devices on different builds read each other's records. An older
build meeting a reference whose class it does not know reads it unchanged and displays the class name it cannot
explain: the reference form is closed and both its members are plain strings, so nothing is ambiguous, and the
secret is already absent. This is deliberately the opposite of the refuse-whole rule that governs a registry or
a routing table, and the difference is what the document drives. A registry drives execution, so reading around
an unrecognised member means running work under an identity the user never assigned; a record is history, so
refusing to display one because a class name is new would hide an account of a step that already happened.

## Examples

**Valid** — the shipped class for a connector's authorisation token, declaration and recognition together:

```json
{
  "schemaVersion": "1.0.0",
  "class": "connector-authorisation-token",
  "name": "Connector authorisation token",
  "origin": "product",
  "description": "The access token a connector call is made with. Held by platform/contracts/secure-storage@0.1.0 and attached by the adapter, so in the ordinary path it is never a value this boundary sees; the class exists for the paths where it arrives inside a payload anyway.",
  "recognition": {
    "rules": [
      {
        "rule": "authorisation-field-name",
        "appliesTo": "field-name",
        "pattern": "^(?:[Aa]uthorization|[Aa]uthorisation|access_token|accessToken|bearer_token)$",
        "description": "A field named as an authorisation. Catches a header echoed into a payload; does not catch a token hidden under a name the product cannot predict."
      },
      {
        "rule": "bearer-value",
        "appliesTo": "value",
        "pattern": "^[Bb]earer\\s+[A-Za-z0-9._~+/=-]{16,}$",
        "minLength": 24,
        "description": "A value carrying a bearer prefix and an opaque remainder. Known to miss a bare token with no prefix, which is what the field-name rule and a tool's declaration are for."
      }
    ]
  },
  "referenceForm": "class-and-field"
}
```

**Valid** — a tool naming one argument field, which is all a declaration ever needs to be:

```json
{
  "schemaVersion": "1.0.0",
  "tool": "notion_exchange_authorisation",
  "arguments": [
    { "path": "code", "class": "authorisation-code" },
    { "path": "client.secret", "class": "provider-credential" }
  ]
}
```

**The same call, as the adapter and the platform receive it.** The wrapper hands the adapter the arguments the
agent produced, unprojected, so the call against Notion is unaffected by anything on this page. The value here
is an obvious placeholder, as every credential-shaped string in this repository is:

```json
{
  "code": "PLACEHOLDER-AUTH-CODE-DO-NOT-USE",
  "client": { "id": "placeholder-client", "secret": "PLACEHOLDER-CLIENT-SECRET" },
  "redirect_uri": "https://localhost/callback"
}
```

**The same call, as the ledger record and the model request receive it.** This is the projection — the intent
record's `parameters` and the material the next model request may carry. `redirect_uri` was neither declared nor
matched by any rule, so it is present in the clear, which is what keeps the account of the step readable:

```json
{
  "code": { "redacted": true, "class": "authorisation-code", "field": "code" },
  "client": {
    "id": "placeholder-client",
    "secret": { "redacted": true, "class": "provider-credential", "field": "client.secret" }
  },
  "redirect_uri": "https://localhost/callback"
}
```

**A result carrying a secret the product did not expect.** The tool is an ordinary Notion read that declares no
secret fields at all. The platform returns a page whose properties happen to contain a token someone pasted into
a database cell. The projected result reaching the transcript, the record and the agent is:

```json
{
  "page_id": "placeholder-page-0001",
  "properties": {
    "Owner": "placeholder-person",
    "Deploy key": { "redacted": true, "class": "connector-authorisation-token", "field": "properties.Deploy key" }
  }
}
```

Nothing about this tool changed to make that happen, and that is the whole argument for the conservative
default: the author of a read tool cannot enumerate what a user will type into a page. The field path here is
spelled from the traversal rather than copied as free text — a key the path grammar cannot spell is written
`*` — because a platform's own key text is untrusted content and a reference must not become a second carrier of
it. Whether this rule fires on the material that actually occurs, and how often it fires on material that is not
secret, is UNVERIFIED: proposed spike SP-25 (`design.md` R3) is the measurement.

**Rejected** — a reference that keeps a little of the value "so the user can tell which token it was":

```json
{
  "redacted": true,
  "class": "connector-authorisation-token",
  "field": "client.secret",
  "valuePrefix": "PLACEHOLDER-ab",
  "valueSha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "valueLength": 64
}
```

Refused by the schema on all three added members, and the refusal is the contract's central claim rather than
tidiness. A prefix is the half of a token that identifies the account and often the issuer. A hash is a verifier
for the value: anyone holding a candidate can confirm it, and the candidate set for a token that follows an
issuer's format is not large. A length narrows the format. All three would be written into the account's history
and would replicate, and under principle VII the service holds the means to decrypt what replicates
(the protection there is operational, not cryptographic), so the only defence that costs nothing is that the
material was never written down (INV-AG-43). If a user genuinely needs to know which authorisation was used, the
answer is the connector authorisation's own identifier held by `platform/contracts/secure-storage@0.1.0` — a
name the product assigned, not a piece of the secret.

**A redacted record replicating.** What crosses to the account is the record that was already projected when it
was written; `sync/contracts/replication-protocol@0.1.0` carries it as an envelope payload and adds nothing and
removes nothing:

```json
{
  "recordId": "placeholder-record-0007",
  "jobId": "placeholder-job-0003",
  "position": 4,
  "type": "intent",
  "correlationId": "placeholder-call-0011",
  "content": {
    "connector": "notion",
    "tool": "notion_exchange_authorisation",
    "parameters": {
      "code": { "redacted": true, "class": "authorisation-code", "field": "code" },
      "redirect_uri": "https://localhost/callback"
    },
    "before": { "captured": false, "reason": "no readable prior state for an authorisation exchange" },
    "reversibility": { "kind": "irreversible", "reason": "an authorisation exchange cannot be un-exchanged" }
  }
}
```

The record's shape is `ledger/contracts/ledger-record@0.1.0`, unchanged: a reference replaced a value inside
`parameters`, and `parameters` was already declared as data that is never instruction. A second device reading
this record, on this build or a later one, learns the class and the field and can learn nothing else — which is
the same thing the service learns, and that symmetry is the point.

## Migration

Not applicable at `1.0.0` in the usual sense: this contract has no predecessor, no application code exists yet,
and no record has been written, so there is no store holding a secret in the clear to convert. Three notes carry
forward instead.

**The tool registration surface.** `agent/contracts/tool-wrapping` moves `0.1.0` → `0.2.0` to add the optional
`secrets` member. The bump is MINOR precisely because the member is optional: every registration written against
`0.1.0` remains valid and remains protected, by the recognition default rather than by a declaration.

**Records written before the boundary existed.** None exist today. Should any be written during implementation
before the boundary is in place, they are not rewritten — the ledger is append-only and principle III admits no
edit — and the remedy for a secret already recorded is the one the platform offers: revoke the material and
record the revocation as a new record referencing the original. This is stated here so that nobody reaches for a
sweep-and-rewrite migration, which would be a constitutional violation performed in the name of security.

**The first MAJOR.** If the reference form ever gains a member, every consumer that reads a reference — the
ledger reader, undo, the job detail, replication — must be enumerated in that change's impact analysis before
the member is added, and the argument under § Compatibility answered in writing: what the new member reveals to
a party holding the replicated store, and what is gained that the class and the field do not already give.
