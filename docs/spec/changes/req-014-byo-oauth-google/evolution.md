# Evolution: connector

This change introduces three contracts and amends none. What follows is how they are allowed to move, what the
second platform on this route costs, and which questions are deliberately held open with the condition that opens
them.

All three are published at `0.1.0` with status `draft`, and that is deliberate: they were written from one
measured provider, and one provider is not a family. They are frozen by the change that expresses a second
platform through them, which is the same standard `req-019-connector-framework` applied to the manifest before it
was frozen.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `connector/contracts/byo-authorisation-client@0.1.0` | Removing an acceptance field or an error code; changing what an error code means; moving the exchange to a server; changing the redirect strategy away from a loopback address on an acquired port; narrowing `accepted_client_kinds` for a provider whose users already hold clients | Adding a provider's acceptance descriptor; adding an accepted client kind; adding a loopback host form; adding an error code a build that does not know it presents as a general failure; adding an optional field | Wording of refusals and user-visible messages; changing which step an existing refusal points at |
| `connector/contracts/byo-setup-guide@0.1.0` | Removing a step that stored progress may refer to; changing what a step's completion means; reordering so that a confirmed step now follows one not yet reached; removing the preamble or any of its four notes | Adding a troubleshooting entry; adding an illustration; adding an optional field; appending a console step that does not invalidate earlier progress | Wording of a body, title or action label; a corrected page address |
| `connector/contracts/drive-content-projection@0.1.0` | Removing a route; changing a route's produced form; declaring a platform-owned ceiling the platform does not honour; changing `unknown_kind_outcome` | Adding a route for a new kind; adding an alternative form; moving the product's own ceiling within what has been measured to work | Correcting an `evidence` citation; wording that reaches the user through an outcome |

`connector/contracts/connector-manifest@1.1.0` is read, not amended. Nothing in this change gives it a new field,
so its consumers are untouched and its version window stays as `req-003-notion-compensation` left it.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| No route | `byo-authorisation-client@0.1.0` | Not applicable | None | First version; no stored client exists against any earlier form |
| A guide whose steps changed | The same guide at a later version | Automatic | Setup progress naming a step the new guide does not declare | Progress resumes at the first step whose work cannot be confirmed, stating why, rather than being discarded silently — the rule `GUIDE_STEP_REFERENCE_UNKNOWN` exists for |
| A stored client under a withdrawn accepted kind | Refusal with an explanation | Manual, by the user | The stored client and its tokens | Narrowing accepted kinds is MAJOR precisely because this migration exists: a client accepted last month either keeps working or is refused with words, never fails in the browser |
| This route | The product's own authorisation client, once verification completes | Not automatic, by design | The user's client and its grant | The profile an authorisation was granted under is recorded with it, so a build offering both presents the choice; the user's console project is theirs and is never deleted by the product |
| This change withdrawn | No route | Manual | The stored client and grant, erased as part of the withdrawal | An authorisation nothing can renew is a credential with no owner; the withdrawal message states that the console project remains the user's |

## Deprecation

A step, a route or an accepted client kind is deprecated by being marked in its descriptor and kept working for
at least one release in which the product tells the affected users what will change and what they must do. What
"affected" means is decidable from stored state: a step by the progress records that name it, a content route by
nothing at all — no user state refers to a route — and an accepted client kind by the clients stored under it.

The route as a whole has a foreseen end. When the provider verifies the product's own authorisation client, this
route stops being the only way to reach the platform. It is not removed at that moment: users holding their own
client keep it, because they created a project in their own cloud account on the product's instructions and
discarding that unilaterally would be the product spending something it does not own. Removal is a separate
decision with its own notice, taken when no account still authorises through a supplied client.

## Extension Procedure

**To offer this route for another platform**, four things are added and nothing is edited:

1. In that connector's manifest, declare `auth.byo_client.supported` with the lifetime caveat the provider
   imposes. The manifest contract already carries both fields.
2. Publish an acceptance rule under `connector/contracts/byo-authorisation-client@0.1.0` naming the client kinds
   that can complete a loopback flow at that provider, the fields a supplied file must carry, the loopback host
   forms the provider accepts, and whether proof of possession is required. Measure each of these against the
   real provider; a rule written from documentation is a rule that fails in the user's browser.
3. Publish a setup guide under `connector/contracts/byo-setup-guide@0.1.0`: the preamble's four notes, the ordered
   steps with their console addresses, the step that accepts the file, the final consent step, the expiry words,
   and the troubleshooting entries for the failures the provider actually produces.
4. If the platform returns file content, publish content routes under
   `connector/contracts/drive-content-projection@0.1.0`, one row per kind, each with its ceiling, that ceiling's
   owner, and an `evidence` field that says where the row was run or that it was not.

**To verify the addition**: the guide loads and the route is offered; a client of an unaccepted kind is refused
before the browser opens; a complete setup reaches connected on a clean machine; a second signed-in device uses
the connector with no console work; a partial consent leaves the affected tools absent; every declared content
route has been exercised. No interface change, no core change and no new screen should have been needed — if one
was, the extension has found a gap in these contracts and the gap is the finding.

**To add a file kind** to an existing connector: one row, one measurement, one line in the row saying where the
measurement lives.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| The verified mass-market channel for this provider | M2 at the earliest | This route exists only because the provider's verification and security-assessment track was deferred on budget. The product's own client with a narrower scope profile is already expressible in the manifest, so the slot is a decision about coexistence, not a mechanism that has to be built in advance | The provider verifying the product's own authorisation client, at which point a decision is required about users who already hold their own |
| The managed-organisation client type | When an organisation account is available to measure on | A client created inside a managed organisation may not carry the unverified-client cadence at all, which would remove the reconnection this change is built around. Assuming either answer would build a remedy for a problem that may not exist, or omit one that does | The measurement recorded as Q-1 in `clarifications.md`, on a real organisation account |
| Streaming and chunked extraction in place of a download ceiling | When the product extracts text from large binaries | The ceiling is what keeps the boundary honest until extraction exists; it is a smaller commitment than a streaming pipeline and is visible to the user as a stated limit rather than as a failure | A change that introduces text extraction, at which point the product's own ceiling becomes a chunk size rather than a refusal |
| Freezing the three contracts at `1.0.0` | When a second platform is expressed through them | One provider is not a family, and a boundary renegotiated per provider is not one. Freezing early would encode this provider's peculiarities as the shape | A second connector publishing an acceptance rule and a guide, with the core unchanged |
