---
contract: usage-accounting
version: 0.1.0
status: draft
owner: agent
consumers: [agent, app, job, ledger, sync]
schema_files: [usage-accounting.schema.json, usage-accounting.unit-price.schema.json]
---

# Contract: Usage Accounting

## Purpose

The user pays their provider directly, so the product's obligation is to show them what they spent it on. This
contract defines what one model request records, how a cost is derived from prices the user supplied, and what
the product shows when there is no price to derive one from.

It exists because the risk it closes is a user being surprised by their own bill, and because the measured
figures are small enough that getting the presentation wrong makes them meaningless: a job cost $0.0111 and a
month of ordinary use cost $0.167 — VERIFIED
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6,
`spikes/SP-17-provider-matrix/evidence/monthly-cost-matrix.json`). A per-job figure rounded to two decimal
places would read as zero for every job the product will ever run, which is why precision is part of this
contract rather than a presentation detail.

What it does not cover: where requests are routed, which belongs to `agent/contracts/role-routing@0.1.0`; and
what the job detail page looks like, which belongs to the `app` capability.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`usage-accounting.schema.json`](./usage-accounting.schema.json) | JSON Schema 2020-12 | normative |
| [`usage-accounting.unit-price.schema.json`](./usage-accounting.unit-price.schema.json) | JSON Schema 2020-12 | normative |

The first file is the shape of what one model request records; the second is the shape of a unit price as the
user enters it, and is what the price form validates against before it saves. Between them they carry the three
decisions that make the figures mean anything. Money is decimal text held to at least six decimal places, so a
cost the file admits cannot be one this product's measured figures round to zero. A cost is inseparable from the
basis it was computed under, so a price corrected later never silently rewrites what an old job cost. And a
record claiming reported usage must carry a token count, because absence treated as zero is the one thing the
user could never detect by looking.

What the files cannot express is stated here instead: that a record is written once per request identity, and
that a job total is derived at read time from the records present rather than stored. Both are relations across
records, and both are held by the store.

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { ProfileId } from "provider-profile@0.1.0";
import type { Role } from "role-routing@0.1.0";

/** Decimal written as a string. Money and per-million-token prices are never held as binary floating point. */
type Decimal = string;

interface UsageRecord {
  jobId: string;
  requestId: string;              // the identity the ledger and the transcript already correlate by
  role: Role;
  profileId: ProfileId;
  model: string;
  reported: boolean;              // false when the provider returned no usage figures
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  cost?: RecordedCost;            // present only when a unit price existed when the record was written
  recordedAt: string;
}

interface RecordedCost {
  amount: Decimal;
  currency: string;               // ISO 4217 code, as the user entered it with the price
  basis: CostBasis;
}

/** Kept with the cost so it can always be explained and recomputed. */
interface CostBasis {
  inputPricePerMillion: Decimal;
  outputPricePerMillion: Decimal;
  currency: string;
  priceEnteredAt: string;
}

interface UnitPrice {
  profileId: ProfileId;
  model: string;
  inputPricePerMillion: Decimal;
  outputPricePerMillion: Decimal;
  currency: string;
  enteredAt: string;
}

interface JobUsage {
  jobId: string;
  records: UsageRecord[];
  byRole: Array<{ role: Role; inputTokens: number; outputTokens: number; cost?: RecordedCost }>;
  total: {
    inputTokens: number;
    outputTokens: number;
    cost?: RecordedCost;          // absent when any record in the job has no cost
    incompleteReason?: "job-running" | "usage-not-reported" | "no-price-configured";
  };
}

interface UsageAccounting {
  record(entry: UsageRecord): Promise<void>;          // write-once; a second write for a requestId is refused
  forJob(jobId: string): Promise<JobUsage>;           // totals derived at read time, never stored
  prices(): Promise<UnitPrice[]>;
  setPrice(price: UnitPrice): Promise<void>;
  clearPrice(profileId: ProfileId, model: string): Promise<void>;
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `usage/for-job` | Window → Main | Request-Response | `{ jobId }` | `JobUsage` | None; an unknown job yields empty records rather than an error |
| `usage/prices` | Window → Main | Request-Response | `{}` | `UnitPrice[]` | None |
| `usage/set-price` | Window → Main | Request-Response | `{ price }` | `{ ok: true }` | `PRICE_MALFORMED`, `CURRENCY_UNKNOWN`, `MODEL_NOT_OFFERED` |
| `usage/clear-price` | Window → Main | Request-Response | `{ profileId, model }` | `{ ok: true }` | None |
| `usage/updated` | Main → Window | Pub-Sub | — | `{ jobId }` | None; an open job detail page refreshes while the job runs |

**Channels that deliberately do not exist.** No channel writes a usage record from a window, so displayed usage
is always what the request actually consumed. No channel returns an aggregate across jobs from this contract:
what a month cost is a question about the job list, not about one job, and inventing a second aggregate here
would create a figure nothing could reconcile against the records.

### 3. Module Descriptor / Manifest Specification

A unit price as the user enters it and as it replicates is
[`usage-accounting.unit-price.schema.json`](./usage-accounting.unit-price.schema.json); what one request records
is [`usage-accounting.schema.json`](./usage-accounting.schema.json). Both are held beside this document rather
than transcribed into it.

A price as the user would enter it for the measured cheap model:

```json
{
  "profileId": "ark-shared",
  "model": "cheap-fast",
  "inputPricePerMillion": "0.110000",
  "outputPricePerMillion": "0.110000",
  "currency": "USD",
  "enteredAt": "2026-09-10T08:00:00Z"
}
```

The same price entered the way a user naturally would, and refused:

```json
{
  "profileId": "ark-shared",
  "model": "cheap-fast",
  "inputPricePerMillion": "$0.00000011 per token",
  "currency": "usd",
  "enteredAt": "2026-09-10T08:00:00Z"
}
```

Refused three times over: the amount carries a currency symbol and a unit rather than being a decimal, the
output price is missing rather than being assumed equal to the input price, and the currency is not an uppercase
three-letter code. The second of those is the one worth stating out loud — most providers charge more for output
than for input, so inferring a missing output price from the input price would understate every job by a
predictable margin.

**Discovery.** None. Prices are entered by the user against a model a profile offers, and they replicate with the
routing table as account-owned configuration.

**Fallback when no price exists.** The record is written with token counts and no cost. The job's total carries
`incompleteReason: "no-price-configured"`, which the job detail page renders as a statement that no cost is
available for that model. Nothing substitutes a price from another model, another profile, or a table the
product shipped.

## Semantics

**Prices are per million tokens because that is how providers quote them.** Entering a per-token price would ask
the user to type seven leading zeros and would make a typo indistinguishable from a correct value. The stored
form matches what the user reads on their provider's pricing page.

**Money is decimal, and precision is load-bearing.** Amounts and prices are decimal strings, and cost arithmetic
is exact decimal arithmetic. Costs are held to at least six decimal places, because the measured per-call cost
of the cheapest role was $0.000203 — VERIFIED
(`spikes/SP-10-risk-judge/REPORT.md#0-ket-luan`) — and a representation that cannot hold it would record every
risk-judge call as free. Display rounds; the record does not.

**A cost carries its basis.** A recorded cost keeps the prices and currency it was computed from (INV-AG-25), so
a user who corrects a price later sees old jobs still explaining themselves with the price that was in force.
Changing a price never rewrites a record: it changes what future records cost, and the job list is honest about
having been priced differently at different times.

**Totals are derived, never stored.** `forJob` computes from the records it finds (INV-AG-29). A record arriving
late — a request that finished after the page was first drawn — changes the total when the page is next read,
rather than requiring a stored total to be corrected. A job whose records use two currencies has no total cost,
because adding them would require an exchange rate the product has no business inventing; the per-role figures
still stand.

**Unreported usage is not zero.** A provider that returns no usage figures produces a record with `reported`
false and no token counts. It is shown as not reported and excluded from the total, with the total marked
incomplete. Counting it as zero would understate a job in a way the user could never detect.

**Records are write-once.** One record per request identity, refused on a second write. The identity is the one
the ledger and the transcript already use, so a usage record joins to its intent and its result without a second
index.

**Retention follows the job.** Usage records live and die with the job record under the ledger's retention rule.
They are never evicted separately, because a job whose costs had been evicted would contradict its own ledger.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `PRICE_MALFORMED` | The amount is not a decimal within the accepted precision | Main, at save | The price form refuses the save and states the accepted form |
| `CURRENCY_UNKNOWN` | The currency is not a three-letter code | Main, at save | The price form refuses the save |
| `MODEL_NOT_OFFERED` | The price names a model the profile does not offer | Main, at save | The price form refuses the save and names the models the profile offers |
| `RECORD_DUPLICATE` | A second usage record was written for one request identity | Main; the second write is refused | Nothing; this is an internal invariant breach, recorded for diagnosis rather than shown |
| `TOTAL_MIXED_CURRENCY` | A job's records carry costs in more than one currency | Main, at read | The job shows per-role costs and states that a single total is not available |

## Compatibility

**MAJOR** — changing the price unit away from per million tokens; storing a cost without its basis; making
records mutable; holding money as a binary floating-point number; removing the unreported state.

**MINOR** — adding an optional member to a record; adding an aggregate view; adding a `incompleteReason`;
widening accepted price precision.

**PATCH** — wording, display rounding, and currency formatting.

**Support window.** Usage records replicate with their jobs, so a record written by a newer build may be read by
an older one. A record is therefore read field by field with unknown members ignored — the opposite of the
routing table's whole-table refusal, and deliberately so: a usage record is a report about the past, and showing
a job's tokens without a member the older build does not understand is better than showing the user nothing about
a job they ran. A record whose cost the older build cannot interpret is shown as token counts with no cost.

## Examples

**Valid** — one risk-judge call on a profile with prices configured:

```json
{
  "jobId": "job-2026-09-12-0031",
  "requestId": "call-7f21c9",
  "role": "risk-judge",
  "profileId": "ark-shared",
  "model": "cheap-fast",
  "reported": true,
  "inputTokens": 1638,
  "outputTokens": 200,
  "durationMs": 3154,
  "cost": {
    "amount": "0.000203",
    "currency": "USD",
    "basis": {
      "inputPricePerMillion": "0.110000",
      "outputPricePerMillion": "0.110000",
      "currency": "USD",
      "priceEnteredAt": "2026-09-10T08:00:00Z"
    }
  },
  "recordedAt": "2026-09-12T10:04:14Z"
}
```

**Rejected** — a record that rounds, loses its basis, and reports nothing as zero:

```json
{
  "jobId": "job-2026-09-12-0031",
  "requestId": "call-7f21c9",
  "role": "risk-judge",
  "profileId": "ark-shared",
  "model": "cheap-fast",
  "reported": true,
  "inputTokens": 0,
  "outputTokens": 0,
  "durationMs": 3154,
  "cost": { "amount": "0.00", "currency": "USD" },
  "recordedAt": "2026-09-12T10:04:14Z"
}
```

Rejected on three counts. The cost is rounded to two decimals, which for this product's measured figures is
indistinguishable from free. It carries no basis, so nothing could later explain where it came from. And the
token counts are zero while `reported` is true, which is the shape an unreported response takes when someone
treats absence as zero — the one thing this contract refuses to do, because the user cannot tell the difference
by looking.

## Migration

Not applicable at `0.1.0`: no usage record or price exists in the field. A later change to the price unit would
not rewrite stored costs, because each carries the basis it was computed under; it would migrate the price book
only, and old records would continue to explain themselves in the terms they were written in.
