---
contract: byo-setup-guide
version: 0.1.0
status: draft
owner: connector
consumers: [app, uix, connector]
schema_files: [byo-setup-guide.schema.json]
---

# Contract: Bring-Your-Own Setup Guide

## Purpose

A platform that asks the user to create their own authorisation client has to walk them through doing it. This
contract is how that walk is expressed as data: an ordered sequence of steps, what the user is told before the
first one, what closes each one, and what the product says when the route later stops working.

`app` builds on it and knows no platform: it renders steps, opens the pages they name, records how far the user
reached, and accepts the file at the step that asks for one. `connector` authors one descriptor per platform
offering the route. `uix` uses its expiry words so that the sentence on a dialog card and the sentence the user
read at setup are the same sentence.

The reason this is a contract rather than a screen is principle VI measured against the one surface most tempting
to special-case: adding the Nth platform's route must cost a descriptor and a review, not an interface change
(INV-GG-11). The content for the first platform is the draft guide the spike produced
(`spikes/SP-13-byo-oauth-google/evidence/byo-setup-guide-draft.md`), which is eight steps — six in the provider's
console and two in the application — VERIFIED (`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi`
Q7).

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`byo-setup-guide.schema.json`](./byo-setup-guide.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of a guide, and it is validated at load: a guide it refuses makes the route absent rather
than partial, because a sequence a person cannot finish is worse than one that was never offered. It carries the
obligations a guide cannot be allowed to omit — the four preamble notes, a console step naming the page it
happens on, a step that completes by supplying the client, and the expiry notice — so that none of them can be
dropped by an author in a hurry.

What the file cannot express is whether the sequence works for the person it is written for. Whether a step is
followable, whether the illustrations match what the provider currently shows, and whether the notes are
understood are settled by the unaided setup check in `verification.md`, not by validation.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type ConnectorId = string;
type StepId = string;

interface SetupGuide {
  connector_id: ConnectorId;
  version: string;                       // semver of this guide's content
  preamble: SetupPreamble;
  steps: SetupStep[];                    // ordered; the order is the sequence
  expiry_notice: ExpiryNotice;
  troubleshooting?: TroubleshootingEntry[];
}

interface SetupPreamble {
  step_count_note: string;               // what the user is told about the size of the task
  provider_warning_note: string;         // that the provider will show a warning screen, and that passing it is expected
  reconnection_note: string;             // that the connection will need re-establishing while the client is unverified
  storage_note: string;                  // where what they supply is kept, and what it is bound to
}

interface SetupStep {
  id: StepId;
  title: string;
  body: string;                          // plain text; no markup the renderer must interpret
  location: "provider_console" | "application" | "browser";
  page_url?: string;                     // required when location is provider_console
  illustration?: string;                 // a build resource shipped beside this descriptor
  completion: StepCompletion;
}

type StepCompletion =
  | { by: "confirmation" }                                  // the user says they did it
  | { by: "file"; accepts: "authorisation_client" }         // the step that supplies the client
  | { by: "authorisation" };                                // the step completed by the browser consent

interface ExpiryNotice {
  title: string;
  body: string;                          // the words shown when an authorisation obtained this way stops working
  action_label: string;                  // the words on the control that re-establishes it
}

interface TroubleshootingEntry {
  symptom: string;                       // what the user sees, in their words
  remedy_step_id: StepId;                // where they go to fix it
  body: string;
}

/** How the sequence is followed. Implemented by app; the progress is account data. */
interface SetupProgress {
  connector_id: ConnectorId;
  last_confirmed_step: StepId | null;
  updated_at: string;
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `connector:guide:get` | Window process → connector runtime | Request-Response | `{ connector_id }` | `SetupGuide`, or absent when the connector declares no route | An unvalidatable guide is absent rather than partial: the route is not offered and the failing declaration is named in the connector's unavailability reason |
| `connector:guide:progress` | Window process → connector runtime | Request-Response | `{ connector_id, last_confirmed_step }` | `SetupProgress` | A step identity the guide does not declare is refused; progress is never recorded against an unknown step |
| `connector:guide:progress-changed` | Connector runtime → window process | Pub-Sub | — | `SetupProgress` | Emitted after replication brings another device's progress, so the sequence continues where the account left it |

The file the user chooses at the step whose completion is `file` does not travel on these channels. It is read and
handed to `connector:byo:supply-client` of `connector/contracts/byo-authorisation-client@0.1.0`, which is the only
route by which client credentials enter the product.

### 3. Module Descriptor / Manifest Specification

The normative descriptor is [`byo-setup-guide.schema.json`](./byo-setup-guide.schema.json), validated at load and
not restated here.

The file expresses what a guide must contain before it may be offered: the four preamble notes, at least one
step, a step that completes by supplying the authorisation client, a page address on every step that happens in
the provider's console, and the expiry notice with the words of its action. What it cannot express, and what
*Semantics* and the table of refusals below hold instead: that a troubleshooting entry names a step this guide
declares, that the steps are in an order a person can follow, and that the words match what the provider
currently shows.

## Semantics

**Validation is whole-guide, at load, like a manifest.** A guide that fails any rule below yields no guide at
all, and the connector does not offer the route rather than offering a sequence that breaks partway. The rules:
exactly one step completes `by: "file"`; exactly one completes `by: "authorisation"`, and it is the last step;
every `location: "provider_console"` step carries a `page_url`; every `remedy_step_id`, in this descriptor and in
the acceptance rule of `connector/contracts/byo-authorisation-client@0.1.0`, names a step this guide declares;
every `illustration` resolves to a resource present in the build.

**The order of `steps` is the sequence.** There is no ordering field, no branching and no conditional step. A
sequence that needed a branch would be two guides or a decision the product should make for the user, and both are
better than a renderer that evaluates conditions.

**The preamble is shown before the first step and is not skippable.** Its four notes exist because each names a
cost the user is agreeing to: how long this takes, that the provider will try to warn them off — the measured path
runs through a screen whose prominent control is "back to safety", with the way forward behind a secondary link
(`spikes/SP-13-byo-oauth-google/REPORT.md#1-tra-loi-tung-cau-hoi` Q5) — how often they will have to come back, and
what the product keeps. A route this awkward is defensible only if the user agreed to it knowing.

**`storage_note` states where the supplied client lives, and that is an account statement, not a device one.**
Under the constitution's principle VII the client is account-owned and replicates encrypted, so the note says the
client is kept for the account and reaches the user's other devices. A note claiming it never leaves this machine
would be false, and this is the one place a user would read such a claim.

**All four preamble notes and every step, notice and troubleshooting body pass through the localisation layer**
like any other interface text. They are authored content in the descriptor, not strings assembled at the point of
use.

**Progress is account data and is advisory.** It says where to resume; it is not a gate. A user who has already
created a client may supply the file at any time, and a resumed sequence never re-asks for work already done —
which is the same property that makes reconnection one consent rather than eight steps.

**The expiry notice is the single source of those words.** The connectors area and the dialog card both render
it, so a user who reads about the seven-day cadence at setup meets the same sentence when it happens.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `GUIDE_SCHEMA_INVALID` | The descriptor does not satisfy `byo-setup-guide.schema.json` | Callee, at load | The connector does not offer the bring-your-own route and names the failing declaration; every other connector is unaffected |
| `GUIDE_STEP_ORDER_INVALID` | No file step, no final authorisation step, or more than one of either | Callee, at load | As above |
| `GUIDE_PAGE_MISSING` | A console step carries no page address | Callee, at load | As above — a console step the user cannot be sent to is a step they must find themselves |
| `GUIDE_STEP_REFERENCE_UNKNOWN` | A remedy points at a step the guide does not declare | Callee, at load | As above; the acceptance rule's remedies are checked against this guide at the same moment |
| `GUIDE_ILLUSTRATION_MISSING` | An illustration names a resource the build does not contain | Callee, at load | As above, rather than a step rendering a gap where a picture was promised |
| `GUIDE_ABSENT` | The connector declares the route and publishes no guide | Callee, at load | The route falls back to the plain guidance the manifest carries, and is not offered at all if the manifest carries none |
| `PROGRESS_STEP_UNKNOWN` | Progress names a step the current guide does not declare, after the guide's content changed | Both | The sequence resumes at the first step whose work the product cannot confirm was done, and says why; progress is never silently discarded |

## Compatibility

**MAJOR** — removing a step whose work a stored progress refers to; changing what a step's completion means;
changing the order such that a previously later step now precedes one a user has already confirmed; removing the
preamble or any of its notes.

**MINOR** — adding a troubleshooting entry; adding an illustration to a step; adding an optional field; adding a
step at the end of the console sequence that does not invalidate earlier progress.

**PATCH** — wording of a body, a title or an action label; a corrected page address.

**Support window.** A guide ships in the build that renders it, so only one version is ever loaded. The version
that matters across builds is the one stored progress refers to, which is why step identities are stable and
removing one is MAJOR.

## Examples

**Accepted** — the measured provider's guide, abbreviated to its first console step, its file step and its final
step; the full sequence is eight steps:

```json
{
  "connector_id": "google",
  "version": "1.0.0",
  "preamble": {
    "step_count_note": "Eight steps: six in Google Cloud Console, two here. Around fifteen minutes the first time.",
    "provider_warning_note": "Google will show a screen saying this app is not verified, with a large button back to safety. That is expected for a client you created yourself: open Advanced and continue.",
    "reconnection_note": "While your own client stays unverified, Google ends the connection every seven days. Reconnecting is one button here and one consent in the browser.",
    "storage_note": "The credentials you download are kept for your account, encrypted, and reach your other signed-in devices, so you do this once rather than once per machine."
  },
  "steps": [
    {
      "id": "create-project",
      "title": "Create a Google Cloud project",
      "body": "Sign in with the Google account whose mail and files you want to work with, then create a new project and give it any name you will recognise.",
      "location": "provider_console",
      "page_url": "https://console.cloud.google.com/projectcreate",
      "illustration": "assets/google/console-setup.svg",
      "completion": { "by": "confirmation" }
    },
    {
      "id": "download-credentials",
      "title": "Download the credentials file",
      "body": "Download the JSON file for the desktop client you just created, then bring it back here.",
      "location": "provider_console",
      "page_url": "https://console.cloud.google.com/apis/credentials",
      "completion": { "by": "file", "accepts": "authorisation_client" }
    },
    {
      "id": "browser-consent",
      "title": "Allow access in the browser",
      "body": "Choose the account you listed as a test user, pass the not-verified screen through Advanced, tick both permissions and continue. You will be returned here automatically.",
      "location": "browser",
      "illustration": "assets/google/consent-flow.svg",
      "completion": { "by": "authorisation" }
    }
  ],
  "expiry_notice": {
    "title": "Google needs you to allow access again",
    "body": "Google ends the connection every seven days while your own client is unverified. Nothing you set up in the console is lost, and your credentials are still here.",
    "action_label": "Reconnect"
  },
  "troubleshooting": [
    {
      "symptom": "Google says access is blocked and the app has not completed verification",
      "remedy_step_id": "create-project",
      "body": "The account you signed in with is not listed as a test user on your client. Add it in the console, then try again."
    }
  ]
}
```

**Rejected** — a guide whose sequence cannot be followed:

```json
{
  "connector_id": "google",
  "version": "1.0.0",
  "preamble": {
    "step_count_note": "A few quick steps.",
    "provider_warning_note": "Ignore anything Google says.",
    "reconnection_note": "You should not need to do this again.",
    "storage_note": "Your credentials never leave this computer."
  },
  "steps": [
    {
      "id": "browser-consent",
      "title": "Allow access in the browser",
      "body": "Approve the permissions.",
      "location": "browser",
      "completion": { "by": "authorisation" }
    },
    {
      "id": "open-console",
      "title": "Set up the client",
      "body": "Create a project and a client in the console.",
      "location": "provider_console",
      "completion": { "by": "confirmation" }
    }
  ],
  "expiry_notice": {
    "title": "Disconnected",
    "body": "Something went wrong.",
    "action_label": "Fix"
  }
}
```

It is refused four times over, and each refusal is a rule that exists because of a way a user gets stranded. Two
of them the schema refuses on its own: there is no step that accepts the credentials file, so the consent step
could never have a client to run under, and the console step carries no page address, leaving the user to find
the console themselves — the failure the whole descriptor exists to prevent. Two survive the schema. The
authorisation step is not last, so the sequence asks for consent before the client exists, and where a step sits
in the sequence is not something a descriptor schema constrains. And the preamble is false in both directions that matter: it tells the user to ignore the provider's
warning rather than explaining it, promises no reconnection where the provider imposes one every seven days, and
claims the credentials stay on this machine when principle VII replicates them to the account. A guide is reviewed
by reading, which is the reason it is data.

## Migration

Not applicable — first version.
