---
contract: drive-content-projection
version: 0.1.0
status: draft
owner: connector
consumers: [connector, agent, app]
schema_files: [drive-content-projection.schema.json]
---

# Contract: Drive Content Projection

## Purpose

A file-storage platform holds two different things under one word: documents it computes on demand, which have no
bytes until something asks for a form of them, and files it stores, which have bytes already. Reading either into
an agent's context is a projection — a decision about which route to take, what form to produce and how much of
it to accept — and this contract is where those decisions are written down as reviewable data rather than as
branches inside an adapter.

The connector runtime builds on it to read a file; `agent` receives what it produces and the reason when it
produces nothing; `app` renders that reason to the user. A new file kind is a row and a measurement, never an
adapter branch (INV-GG-09), and a kind with no row is unsupported by name rather than silently empty.

Every route below states where it was measured. The rows measured against the real platform under a read-only
authorisation are cited to `spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) and
`spikes/SP-13-byo-oauth-google/evidence/q6_drive_export_read.log`; the rows that were not say so in the same
field, because a route nobody has run is a plan, not a capability.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`drive-content-projection.schema.json`](./drive-content-projection.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of a published route table: one row per file kind, the route it is read by, the form the
job receives, the ceiling it stops at and who owns that ceiling. It carries the evidence discipline structurally
— a row must cite a path under `spikes/` or say `unmeasured` and why — so a route cannot be added on the strength
of resembling another one.

What the file cannot express is which rows are true. That a kind is read by export rather than download, and that
a ceiling is where it is, are measurements; the file only refuses a row that hides whether the measurement was
made.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type FileKind = string;                       // the platform's own type name for a file

interface ContentRoute {
  file_kind: FileKind;
  route: "export" | "download";
  produced_form: string;                      // what the job receives
  alternative_forms?: string[];               // other forms the same kind may be asked for
  ceiling_bytes: number;
  ceiling_owner: "platform" | "product";
  evidence: string;                           // where this row was measured, or that it was not
}

interface ContentProjectionRules {
  connector_id: string;
  version: string;
  routes: ContentRoute[];
  unknown_kind_outcome: "unsupported";        // the only permitted answer; see Semantics
}

interface ContentReadRequest {
  file_reference: string;
  requested_form?: string;                    // one of the route's alternative forms
}

type ContentReadOutcome =
  | { result: "content"; form: string; bytes: number; route: "export" | "download"; content: string }
  | { result: "unsupported_kind"; file_kind: FileKind }
  | { result: "too_large"; ceiling_bytes: number; ceiling_owner: "platform" | "product"; observed_bytes?: number }
  | { result: "empty"; reason: string }
  | { result: "failed"; code: string; provider_message?: string };
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| Platform export endpoint | Device → platform | Request-Response | The file reference and the form the route declares | The produced form, as text | `CONTENT_TOO_LARGE_PLATFORM` when the platform refuses the export for size; `EXPORT_REFUSED` for any other refusal, carrying the platform's words |
| Platform media endpoint | Device → platform | Request-Response, streamed | The file reference, read as stored bytes | The bytes, up to the route's ceiling | `CONTENT_TOO_LARGE_PRODUCT` when the ceiling is reached; the transfer is stopped at the ceiling rather than completed and then discarded |
| Platform metadata endpoint | Device → platform | Request-Response | The file reference | The file kind and, where the platform states it, the size | A file kind absent from the rules yields `CONTENT_KIND_UNSUPPORTED` before any content request is made |

All three are ordinary platform calls made by the connector's adapter from inside a wrapped tool. Nothing here
crosses a process boundary of the product's own, and no content reaches an agent except as the result of that
wrapped tool, under the connector's declared sanitization.

### 3. Module Descriptor / Manifest Specification

The normative descriptor is [`drive-content-projection.schema.json`](./drive-content-projection.schema.json), and
it is not restated here.

Two of this contract's rules are in the file itself rather than left to review: `unknown_kind_outcome` is a member
with exactly one value, so a build cannot acquire a default route for a kind nobody measured, and every row's
`evidence` must name a path under `spikes/` or say `unmeasured` with its reason. What the file cannot express, and
what *Semantics* below holds instead: that a ceiling owned by the product is named as the product's when a user
meets it, and that a route's produced form is the one the platform actually returns.

## Semantics

**The kind decides the route, and the kind comes from the platform.** The connector asks the platform what a file
is before deciding how to read it. It does not infer the kind from a name, an extension or a guess, because a
document that is computed and a file that is stored can share both.

**A kind with no route is unsupported, and says which kind.** This is the only permitted answer, which is why
`unknown_kind_outcome` is an enumeration of one: the alternative a product reaches for — trying a download and
returning whatever comes back — produces an agent context full of a format nobody chose. Naming the kind is what
lets a user ask for it and a reviewer add a row.

**A ceiling belongs to a route and states whose it is** (INV-GG-10). The platform's ceiling is what the platform
refuses; the product's ceiling is what the product declines to load. They are remedied differently — one by asking
the platform for a smaller form, one by a product decision — and a message that confuses them tells the user the
platform refused something it would have served.

**A size that is not known in advance is enforced at the ceiling, not excused.** Where the platform does not state
a size, the transfer stops when the ceiling is reached and the outcome is `too_large` without an observed size.
The alternative — allowing an unknown size through because it is unknown — is how a desktop application meets a
file that does not fit in its memory.

**`evidence` is required on every row and may say `unmeasured`.** A row that has not been run against the real
platform is a plan: it may ship as a declaration, and `verification.md` requires each to be exercised before the
connector is released. Stating it in the row is what keeps the distinction visible to whoever reads the rules
rather than the report — the constitution's evidence discipline applied to the one artifact a reviewer will
actually consult.

**Produced content is untrusted data.** Whatever a document or a file contains is content under the
constitution's External Content Is Data section; it reaches an agent through the connector's declared
`content_sanitization` and never as instruction.

**An empty result is reported as empty with a reason**, never as content of zero length, because a job that asked
for a document and received nothing must be able to say which of the two happened.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `CONTENT_KIND_UNSUPPORTED` | The file's kind has no route in the rules | Callee | The job says the kind is not supported and names it; nothing is loaded |
| `CONTENT_TOO_LARGE_PRODUCT` | A stored file exceeds the ceiling the product applies | Callee | The job says the file is larger than the application will load and states the ceiling |
| `CONTENT_TOO_LARGE_PLATFORM` | The platform refuses an export because the produced form would exceed its own ceiling | Both — the platform decides, the product explains | The job says the document is too large for the platform to export and states the platform's ceiling |
| `CONTENT_SIZE_UNKNOWN` | The platform states no size and the transfer reached the ceiling | Callee | As `CONTENT_TOO_LARGE_PRODUCT`, without claiming a size the platform never gave |
| `EXPORT_REFUSED` | The platform refuses an export for any other reason | Both | The platform's own words are shown, attributed to the platform |
| `CONTENT_EMPTY` | The route produced nothing for a file that exists | Callee | The job reports an empty document rather than an empty result |
| `PROVIDER_UNREACHABLE` | The platform could not be reached | Both | The job's retry policy decides; nothing is concluded about the file or the authorisation |

## Compatibility

**MAJOR** — removing a route; changing a route's produced form; raising a ceiling whose owner is the platform to
something the platform does not honour; changing `unknown_kind_outcome`.

**MINOR** — adding a route for a new kind; adding an alternative form; lowering or raising the product's own
ceiling within what has been measured to work.

**PATCH** — correcting an `evidence` citation; wording that reaches the user through an outcome rather than
through the rules.

**Support window.** The rules ship in the build that reads them; one version is loaded at a time. Ceilings are the
part that outlives a build in the user's expectations, which is why changing the platform's declared ceiling to a
figure the platform does not honour is MAJOR rather than a correction.

## Examples

**Accepted** — the rules for the measured platform:

```json
{
  "connector_id": "google_drive",
  "version": "1.0.0",
  "unknown_kind_outcome": "unsupported",
  "routes": [
    {
      "file_kind": "application/vnd.google-apps.spreadsheet",
      "route": "export",
      "produced_form": "text/csv",
      "alternative_forms": ["application/pdf"],
      "ceiling_bytes": 10485760,
      "ceiling_owner": "platform",
      "evidence": "spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi Q6 — export to delimited text returned real columns at 696 bytes and to a document form at 32,275 bytes; the ceiling figure itself is the provider's documented limit and is unmeasured"
    },
    {
      "file_kind": "application/vnd.google-apps.document",
      "route": "export",
      "produced_form": "text/markdown",
      "alternative_forms": ["text/plain"],
      "ceiling_bytes": 10485760,
      "ceiling_owner": "platform",
      "evidence": "unmeasured — no document of this kind was exported during SP-13; scheduled in verification.md before release"
    },
    {
      "file_kind": "application/pdf",
      "route": "download",
      "produced_form": "application/pdf",
      "ceiling_bytes": 20971520,
      "ceiling_owner": "product",
      "evidence": "spikes/SP-13-byo-oauth-google/evidence/q6_drive_export_read.log — stored files of 20,880,847, 27,709,920 and 30,749,685 bytes downloaded successfully; the ceiling is the product's decision, argued in design.md D5"
    },
    {
      "file_kind": "text/markdown",
      "route": "download",
      "produced_form": "text/markdown",
      "ceiling_bytes": 20971520,
      "ceiling_owner": "product",
      "evidence": "spikes/SP-13-byo-oauth-google/evidence/q6_drive_export_read.log — 31,181 bytes downloaded successfully"
    }
  ]
}
```

**Rejected** — rules that hide what they do not know:

```json
{
  "connector_id": "google_drive",
  "version": "1.0.0",
  "unknown_kind_outcome": "unsupported",
  "routes": [
    {
      "file_kind": "application/vnd.google-apps.presentation",
      "route": "export",
      "produced_form": "text/plain",
      "ceiling_bytes": 10485760,
      "ceiling_owner": "product",
      "evidence": "assumed to work like the other computed kinds"
    }
  ]
}
```

It is wrong in the two ways this contract exists to prevent, and only the first of them is mechanical. The row
was never run — no presentation was exported during the measurement — and rather than saying `unmeasured`, its
`evidence` argues from resemblance, which is exactly the inference the constitution's evidence discipline
forbids and which a reviewer skimming the table would read as a citation; the schema refuses that line, because
`evidence` must name a path under `spikes/` or begin with `unmeasured`. The second fault survives the schema:
the ceiling it declares is the platform's figure labelled as the product's, so a user meeting it would be told
the application declined to load a document the platform had already refused to produce. No schema can catch
that, because both values are well-formed and only knowing the platform's real limit separates them. Rules are
reviewed by reading, which is the reason they are data.

## Migration

Not applicable — first version.
