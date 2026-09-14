# Requirements Quality Checklist: req-014-byo-oauth-google

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is there a requirement stating what the user is told about their own cloud project when they disconnect the connector — that it remains theirs and the product cannot remove it? [Completeness, Gap]
- [ ] CHK002 Do the requirements say what happens when the same account holds two authorisation clients for the same provider, one supplied on each of two devices before replication reconciled them? [Completeness, Gap]
- [ ] CHK003 Is the obligation to record which account an authorisation was issued for stated as its own requirement, or only as a scenario clause? [Completeness, Spec §connector "An account the user's own client does not admit is reported as the client's restriction"]
- [ ] CHK004 Are the requirements explicit about what the connector does when the provider's consent completes but the exchange then fails — whether the user sees a failure they can retry, and whether anything is stored? [Completeness, Spec §connector "The Google connector authorises with an authorisation client the user created"]
- [ ] CHK005 Is there a requirement covering the user's own provider quota — what the connector does when the user's client is rate-limited by the provider rather than by the product's pacing? [Completeness, Gap]
- [ ] CHK006 Do the requirements state whether a job already running when a connector expires is cancelled, paused or failed, or is that left to the job capability's existing failure requirement? [Completeness, Spec §connector "A refused renewal under the user's own client is an expired connector, not a lost one"]
- [ ] CHK007 Is the obligation that setup progress is account data — and therefore visible to a second device mid-setup — stated anywhere as a requirement, or only in the contract? [Completeness, Spec §app "The bring-your-own setup runs as ordered steps inside the application"]
- [ ] CHK008 Is there a requirement about what the product does with the credential file after reading it, or does that rest entirely on the existing credential-store requirement of `req-012-secure-storage`? [Completeness, Spec §connector "A supplied authorisation client is checked before the browser is opened"]

## Requirement Clarity

- [ ] CHK009 Does "the desktop kind the loopback route requires" name something a reviewer can check against a supplied file, or does it depend on knowing the provider's own vocabulary? [Clarity, Spec §connector "A supplied authorisation client is checked before the browser is opened"]
- [ ] CHK010 Is "the ceiling declared for its route" precise enough that a reader knows there are two different ceilings with two different owners, without opening the contract? [Clarity, Spec §connector "A file that exceeds the ceiling of its route is refused with the ceiling named"]
- [ ] CHK011 Does "in the same words" fix the obligation closely enough to reject an expiry message that paraphrases the setup warning? [Clarity, Spec §connector "A refused renewal under the user's own client is an expired connector, not a lost one"]
- [ ] CHK012 Is "periodically" in the setup warning quantified anywhere the user will read it, given that the cadence is the whole reason the warning exists? [Clarity, Spec §app "The setup states what it will cost the user before the first step"]
- [ ] CHK013 Does "the route declared for its type" make clear that a type with no declared route is a stated outcome rather than a failure? [Clarity, Spec §connector "A Drive file is read by the route its type declares"]
- [ ] CHK014 Is "needing wider permission" distinguishable by a reader from the framework's existing "permission error" state, or are two vocabularies describing one condition? [Clarity, Ambiguity, Spec §connector "A consent that grants less than was asked for does not present as connected"]

## Requirement Consistency

- [ ] CHK015 Does the requirement that the exchange never reaches the broker agree with the existing requirement that a connector using the product's client holds no secret on the device, which names this route as its deliberate exception? [Consistency, Spec §connector "The Google connector authorises with an authorisation client the user created" vs §connector "A connector using the product's authorisation client holds no client secret on the device"]
- [ ] CHK016 Is the dynamically acquired port consistent with the existing loopback requirement, which describes the address as one the device is already listening on? [Consistency, Spec §connector "The device chooses its loopback port at the moment it connects" vs §connector "The authorisation code returns to the device on a loopback address it opened"]
- [ ] CHK017 Do the expired state described here and the framework's connector-state requirement use the same set of states, or has this change introduced a condition the other does not name? [Consistency, Spec §connector "A refused renewal under the user's own client is an expired connector, not a lost one" vs §connector "Connector state is visible and recoverable in one action"]
- [ ] CHK018 Does the account-owned treatment of the supplied client agree with the requirement that connecting a platform connects it for the account rather than for one device? [Consistency, Spec §connector "The authorisation client the user supplied belongs to the account, not to the device" vs §connector "Connecting a platform connects it for the account, not for one device"]
- [ ] CHK019 Is the standard connect flow's promise that the user is never asked for a client identifier consistent with a route that asks them to create one, or does the bring-your-own requirement need to state the exception explicitly? [Consistency, Conflict, Spec §connector "Connecting is the same for every connector and asks nothing technical" vs §connector "Bring-your-own authorisation client is a first-class connect route"]
- [ ] CHK020 Do the app requirement for the connectors area and the uix requirement for the system card agree on where a connector is repaired, or could both be read as offering the repair? [Consistency, Spec §app "The application window holds four areas" vs §uix "A connector that has stopped working reaches the user as a system card"]

## Acceptance Criteria Quality

- [ ] CHK021 Can "no request carrying the user's client identifier or client secret leaves the device" be verified without knowing every request the product makes? [Measurability, Spec §connector "The Google connector authorises with an authorisation client the user created"]
- [ ] CHK022 Is "with no return to the provider's console" checkable on a second device, given that the absence of an action is what must be observed? [Measurability, Spec §connector "The authorisation client the user supplied belongs to the account, not to the device"]
- [ ] CHK023 Can "names the guide step that remedies it" be checked objectively, or would a message that mentions the console satisfy it? [Measurability, Spec §connector "A supplied authorisation client is checked before the browser is opened"]
- [ ] CHK024 Is "resumes at the fifth step" observable without inspecting stored state, and is the observable form specified? [Measurability, Spec §app "The bring-your-own setup runs as ordered steps inside the application"]
- [ ] CHK025 Can "the waiting card is updated rather than a second card being queued" be verified from the badge count alone? [Measurability, Spec §uix "A connector that has stopped working reaches the user as a system card"]

## Scenario Coverage

- [ ] CHK026 Is there a scenario for the recovery layer of a partial consent — the user re-consents and the previously absent tools return — and is the moment they return specified? [Coverage, Spec §connector "A consent that grants less than was asked for does not present as connected"]
- [ ] CHK027 Is there a scenario for two devices attempting Connect for the same connector at the same time? [Coverage, Gap]
- [ ] CHK028 Is the exception layer covered for the setup sequence itself — the user supplying a file at the wrong step, or supplying a second file after one was accepted? [Coverage, Spec §app "The bring-your-own setup runs as ordered steps inside the application"]
- [ ] CHK029 Is there a scenario for a read that succeeds but returns nothing, distinguishing an empty document from an unsupported one? [Coverage, Spec §connector "A Drive file is read by the route its type declares"]
- [ ] CHK030 Is the primary layer covered for the one path the product most depends on — a user completing setup and reaching a first successful read — or is it only implied by the parts? [Coverage, Gap]

## Edge Case Coverage

- [ ] CHK031 Is behaviour specified when the provider redirects successfully but the device's listener has already passed its deadline? [Edge Case, Spec §connector "The device chooses its loopback port at the moment it connects"]
- [ ] CHK032 Is behaviour specified when the user revokes the authorisation in the provider's own settings while the connector shows as connected? [Edge Case, Spec §connector "Connector state is established by asking the platform"]
- [ ] CHK033 Is behaviour specified when a file's kind changes between the metadata read and the content read? [Edge Case, Gap]
- [ ] CHK034 Is behaviour specified when the supplied client is deleted in the provider's console while the product still holds it? [Edge Case, Gap]
- [ ] CHK035 Is behaviour specified when replication delivers a newer authorisation from another device while this device is mid-consent? [Edge Case, Gap]
- [ ] CHK036 Is behaviour specified for a download whose size the platform states as zero? [Edge Case, Spec §connector "A file that exceeds the ceiling of its route is refused with the ceiling named"]

## Non-Functional Requirements

- [ ] CHK037 Are the guide's words required to pass through the localisation layer, given that they are authored content rather than interface strings assembled at the point of use? [Non-Functional, Spec §uix "Every interface string passes through the localisation layer"]
- [ ] CHK038 Is there a requirement bounding how long the device holds an inbound loopback listener open, or does that figure exist only in `verification.md`? [Non-Functional, Gap]
- [ ] CHK039 Are accessibility expectations stated for the setup sequence — a surface a non-technical user must complete unaided — or are they assumed from the application's general requirements? [Non-Functional, Gap]
- [ ] CHK040 Is the memory cost of holding a file up to the download ceiling bounded by any requirement, or only by the ceiling itself? [Non-Functional, Spec §connector "A file that exceeds the ceiling of its route is refused with the ceiling named"]

## Dependencies & Assumptions

- [ ] CHK041 Is the assumption that a second device needs no console work recorded as an assumption and scheduled for measurement, rather than stated as though it had been observed? [Assumption, Spec §connector "The authorisation client the user supplied belongs to the account, not to the device"]
- [ ] CHK042 Is the dependency on `req-012-secure-storage` for holding a user-supplied client stated where a reader of these requirements will see it? [Assumption, Spec §connector "A connector's authorisation is persisted only through the device's credential store"]
- [ ] CHK043 Is the assumption that the verification track eventually retires this route recorded with its consequence — that users holding their own client must be able to keep it? [Assumption, Spec §connector "Bring-your-own authorisation client is a first-class connect route"]
- [ ] CHK044 Is the unmeasured behaviour of a managed-organisation account recorded as unknown in a place a requirement reader will find, rather than only in the clarifications log? [Assumption, Gap]

## Ambiguities & Conflicts

- [ ] CHK045 Does "the provider's own reason" commit the product to showing the provider's text verbatim, or does it permit a product paraphrase? [Ambiguity, Spec §connector "A refused renewal under the user's own client is an expired connector, not a lost one"]
- [ ] CHK046 Is there a conflict between declaring a capability absent unless exercised and declaring a content route whose evidence reads `unmeasured`? [Conflict, Spec §connector "A Google capability that was never exercised is declared absent rather than offered" vs Contract §drive-content-projection]
- [ ] CHK047 Does "one-action reconnect" mean one action in total, or one action per surface, when the user may begin it from a card or from the connectors area? [Ambiguity, Spec §connector "Reconnecting under the user's own client never asks for the credential file again"]

## Physical Resource & Topology Quality

- [ ] CHK048 Are the two ceilings — the product's for downloads and the platform's for exports — each stated with their owner and their figure where a requirement reader will see them? [Resource, Topology §Physical Format & Storage]
- [ ] CHK049 Is it explicit that the loopback session is never written to disk and never replicated, and is that observable in any requirement rather than only in the model? [Resource, Topology §Physical Format & Storage]
- [ ] CHK050 Is the lifetime of downloaded content in memory specified — released once its text form is produced — rather than left to implementation? [Resource, Topology §Physical Format & Storage]
- [ ] CHK051 Are the guide's illustrations accounted for as build resources with a stated behaviour when one is missing? [Resource, Topology §Manifest Schema]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK052 Is the fallback order for a missing or invalid guide descriptor — manifest guidance, then no route at all — stated as an obligation rather than as an implementation choice? [Fallback, §Multi-Level Fallback Hierarchy]
- [ ] CHK053 Does the extension procedure for the Nth platform name every artifact it must add, and is any of them missing from `evolution.md`? [Extensibility, §Extension Procedure]
- [ ] CHK054 Are the error codes of the three new contracts distinguishable by a consumer that knows only the framework's declared connector error codes? [Protocol, Contract §byo-authorisation-client]
- [ ] CHK055 Is the behaviour on a redirect carrying an unknown binding value specified as silent and stateless, so that a build cannot reasonably present it to the user? [Fallback, Contract §byo-authorisation-client]

## Notes

Traceability: 47 of 55 items cite a spec requirement, a contract or a model section; the 8 marked `Gap` name
questions no artifact currently answers, which is what makes them worth a reviewer's time. Items CHK027, CHK034
and CHK035 concern the meeting point between this change and `req-022-account-sync`, and are the ones most likely
to produce a new requirement rather than a tick.
