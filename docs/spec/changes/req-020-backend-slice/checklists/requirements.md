# Requirements Quality Checklist: req-020-backend-slice

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Does any requirement state what the backend does when the invitation set admits an address that a *second* identity-provider subject later presents — that is, when an address is reassigned at the provider after an invitation was issued for it? [Completeness, Gap]
- [ ] CHK002 Is the administration of the invitation allowlist — who may add, withdraw or expire an entry, and through what surface — specified anywhere, or only asserted as "the minimal administration needed"? [Completeness, Spec §backend "Access during the closed beta is gated by an allowlist"]
- [ ] CHK003 Is there a requirement covering what happens to an account's live sessions when the *account* is suspended rather than deleted, given the account entity carries a status attribute? [Completeness, Gap]
- [ ] CHK004 Does the outage requirement account for an outage that begins *during* a brokered exchange, after the provider has issued tokens but before the response reaches the device? [Completeness, Spec §backend "A backend outage blocks only new sign-in, new authorisation, version checks and replication"]
- [ ] CHK005 Is the rotation procedure for the session signing key specified with the same care as provider secret rotation, given that rotating it invalidates every live session? [Completeness, Spec §backend "Server secrets are held in a secret manager and rotated"]
- [ ] CHK006 Are requirements stated for the retention of expired and revoked session records, or is this left entirely to the design's open questions? [Completeness, Gap]
- [ ] CHK007 Does any requirement or contract state a bound on how many devices one account may enrol, or is the set unbounded by omission? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK008 Is "the authentication and brokering store" defined precisely enough that a reviewer can tell, for any new server-side record, which store it belongs in? [Clarity, Spec §backend "The authentication and brokering store holds only account, device, session and invitation records"]
- [ ] CHK009 Does "retains no provider credential" state clearly whether it covers transient artifacts an implementation might create incidentally — request buffers, error payloads, crash dumps — or only deliberate storage? [Clarity, Spec §backend "The authorisation broker retains no provider credential"]
- [ ] CHK010 Is "production-equivalent infrastructure" defined well enough to settle a disagreement about whether a given load test satisfies the release criterion? [Clarity, Ambiguity, Spec §backend "The backend meets its availability and load expectations"]
- [ ] CHK011 Does "an irreversible hash" communicate a verifiable property, or does it rely on the reader knowing which constructions qualify? [Clarity, Spec §backend "Session refresh tokens are held only as an irreversible hash"]
- [ ] CHK012 Is "the configured rate" in the abuse requirement expressed so that a reviewer can tell whether a given configuration satisfies it, or does the requirement assert only that some rate exists? [Clarity, Ambiguity, Spec §backend "The backend is observable and resists abuse"]
- [ ] CHK013 Is the meaning of "no partial authorisation is left behind" the same in the connector specs and the backend specs, or could each be satisfied while the other is not? [Clarity, Spec §connector "The authorisation code returns to the device on a loopback address it opened" vs §backend broker requirements]

## Requirement Consistency

- [ ] CHK014 Do the store-shape requirement and the requirements added by `req-022-account-sync` agree on where replicated connector authorisation rests, without one implying the server holds no authorisation at all? [Consistency, Spec §backend "The authentication and brokering store holds only account, device, session and invitation records" vs living spec "The backend stores the account's replicated data encrypted at rest"]
- [ ] CHK015 Does the modified endpoint-authentication requirement, which now names health alongside version check as unauthenticated, remain consistent with the observability requirement's expectation that health answers without a session? [Consistency, Spec §backend "Every endpoint is authenticated and transport is encrypted" vs "The backend is observable and resists abuse"]
- [ ] CHK016 Do this change's version-check modifications and the narrowing announced by `req-016-signing-update` describe the same endpoint scope, or will one have to be rewritten when the other is specified? [Consistency, Conflict, Spec §backend "The backend serves version checks and the update manifest"]
- [ ] CHK017 Does the connector requirement that no client secret is present on the device sit consistently with the bring-your-own route in `req-014-byo-oauth-google`, where the user supplies credentials that are held on the device? [Consistency, Spec §connector "A connector using the product's authorisation client holds no client secret on the device"]
- [ ] CHK018 Are the outage consequences stated here consistent with RISK-009, which additionally records that devices drift apart while replication is stalled? [Consistency, Spec §backend outage requirement vs `docs/spec/risks.md` RISK-009]

## Acceptance Criteria Quality

- [ ] CHK019 Can "no connector token, command, prompt, fetched content, transcript or ledger record appears in it" be checked mechanically against a live store, or does it require an inspector to recognise content by eye? [Measurability, Spec §backend store-shape requirement]
- [ ] CHK020 Is "no value in them can be presented to the backend as a refresh token" verifiable as stated, given that it is a claim about the absence of a capability rather than about an observed output? [Measurability, Spec §backend "Session refresh tokens are held only as an irreversible hash"]
- [ ] CHK021 Can "the connector shows as connected with no further user action" be measured without a definition of what counts as an action, given the three-click figure this change cites? [Measurability, Spec §connector loopback requirement]
- [ ] CHK022 Does the load requirement state a pass criterion that a test can fail, now that the development-machine percentiles are explicitly excluded as thresholds? [Measurability, Spec §backend "The backend meets its availability and load expectations"]
- [ ] CHK023 Is the 99.5 percent availability figure accompanied by a stated measurement window, method and exclusion policy, without which it cannot be assessed? [Measurability, Spec §backend availability requirement]

## Scenario Coverage

- [ ] CHK024 Is there a scenario covering a successful connect for a provider that requires the proof-key exchange, end to end, rather than only the broker's handling of it? [Coverage, Spec §backend "The backend brokers connector authorisation for any provider"]
- [ ] CHK025 Are the Primary, Alternate, Exception and Recovery layers each represented for the sign-in journey specifically, or is Recovery represented only through renewal? [Coverage, Spec §backend "Authentication is Google Sign-In exchanged for an application session"]
- [ ] CHK026 Is there a scenario for the account-deletion path in which the user's device is offline throughout, given that the living spec states withdrawals proceed from the server? [Coverage, Spec §backend, living "Deleting the account withdraws its connector authorisations at the providers"]
- [ ] CHK027 Does any scenario cover a second device connecting the same platform that a first device already connected, which is the account-scoped case `req-022-account-sync` introduced? [Coverage, Gap]

## Edge Case Coverage

- [ ] CHK028 Is the case of two devices signing in concurrently for an account whose invitation has not yet been consumed covered, or could both consume it? [Edge Case, Gap]
- [ ] CHK029 Does any requirement address a binding that is consumed by one instance while a second instance is serving a retry of the same exchange, in a multi-instance deployment? [Edge Case, Gap, Design §R3]
- [ ] CHK030 Is the case of a provider returning tokens successfully but the response failing to reach the device covered, so that the user is not left with an authorisation granted at the platform and absent locally? [Edge Case, Gap]
- [ ] CHK031 Is a clock-skewed device's view of token expiry considered, given that the client decides when to renew? [Edge Case, Gap]
- [ ] CHK032 Does the rate-limit requirement address a shared-address population — several beta users behind one network address — so that limiting does not become an accidental denial of the beta? [Edge Case, Spec §backend "The backend is observable and resists abuse"]
- [ ] CHK033 Is the zero-data case covered for the invitation set, and is its refusal deliberately indistinguishable from an ordinary uninvited refusal? [Edge Case, Spec §backend "Access during the closed beta is gated by an allowlist"]

## Non-Functional Requirements

- [ ] CHK034 Are the observability obligations stated in terms of what must be answerable — error rate, refusal causes, exchange failures per provider — rather than only that logging and monitoring exist? [Non-Functional, Spec §backend "The backend is observable and resists abuse"]
- [ ] CHK035 Is a bound stated for how long a device may be refused during a rate-limit episode before the product should present it as an outage rather than as a delay? [Non-Functional, Gap]
- [ ] CHK036 Does any requirement place an obligation on the *latency* of sign-in as experienced by a user, as distinct from the throughput the load test measures? [Non-Functional, Gap]
- [ ] CHK037 Is the audit obligation for key access stated with a retention period, given that an audit record with no retention is not evidence? [Non-Functional, Living spec §backend "Key access is confined to the replication path, least-privileged and audited"]

## Dependencies & Assumptions

- [ ] CHK038 Is the assumption that beta scale is the design point — and that the load figure is headroom rather than a capacity plan — recorded where a reader of the specs alone would find it? [Assumption, `proposal.md` §Assumptions]
- [ ] CHK039 Is the dependency on `req-022-account-sync` for the replication store and the device registry stated clearly enough that this change cannot be implemented as though the server held nothing? [Assumption, Model §Relations]
- [ ] CHK040 Is the open question about provider refresh-token expiry recorded with what it blocks, rather than only that it is unanswered? [Assumption, `clarifications.md` §Open Q-1]
- [ ] CHK041 Does the design's dependence on `req-016-signing-update` for manifest content leave the version-check requirement independently implementable? [Assumption, Contract §public-service-endpoints Purpose]

## Ambiguities & Conflicts

- [ ] CHK042 Does the proposal's superseded privacy claim remain visibly superseded in every artifact, so that no reader takes "the server holds no work content" from this change? [Conflict, `proposal.md` Constitution notice vs Spec §backend store-shape requirement]
- [ ] CHK043 Is it unambiguous whether "the backend" in the outage requirement means the whole service or a single instance, given that a single unhealthy instance is not an outage? [Ambiguity, Spec §backend outage requirement]
- [ ] CHK044 Could "withheld" and "unsupported" be read as the same provider state by a device, and does that matter for what the user is told? [Ambiguity, Contract §authorisation-provider-descriptor Semantics]

## Physical Resource & Topology Quality

- [ ] CHK045 Are the storage locations of the two server-side stores, and the boundary between them, stated precisely enough that a dump proving the first store's shape is a meaningful test? [Resource, Topology §1 Physical Format & Storage]
- [ ] CHK046 Is the per-account footprint of the authentication and brokering store bounded by an argument a reviewer can check, rather than by an unstated assumption that it does not grow? [Resource, Topology §1 Physical Resource Budget]
- [ ] CHK047 Are the development-machine load figures labelled clearly enough that they cannot be mistaken for release budgets by a reader who sees only the model? [Resource, Topology §1 Physical Resource Budget]
- [ ] CHK048 Does the State-to-Artifact matrix account for every state the Session and Invitation lifecycles name, including withdrawal of a consumed invitation? [Topology, Model §2 State-to-Artifact Mapping Matrix]
- [ ] CHK049 Is the absence of any persistent artifact for a brokered exchange expressed as a checkable property rather than as an intention? [Resource, Model §INV-BE-03]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK050 Is the descriptor schema strict enough that a misspelt required field is refused rather than silently defaulted, and is that strictness justified where a reader will see it? [Extensibility, Contract §authorisation-provider-descriptor Semantics]
- [ ] CHK051 Does the fallback hierarchy state explicitly that there is no Tier 2 substitution for a broken provider, and give the reason, so a later contributor does not add one as an improvement? [Fallback, Design §Extensibility 2 Multi-Level Fallback Hierarchy]
- [ ] CHK052 Are the wire contracts' error matrices complete against the errors their own type definitions declare, with no code defined but unhandled? [Protocol, Contract §client-session-api and §authorisation-broker-api Error Matrix]
- [ ] CHK053 Is the treatment of an unrecognised error code or enumeration value specified in the same direction — towards refusal, never towards success — in all four contracts? [Protocol, Contract §Compatibility, all four]
- [ ] CHK054 Does the extension procedure make clear that adding a provider changes no contract version, and is that claim traceable to the measurement that supports it? [Extensibility, Evolution §Extension Procedure]
- [ ] CHK055 Is the reserved store-topology slot stated with an activation condition a future reader could actually evaluate, rather than a general intention to scale? [Extensibility, Model §Variability, Evolution §Reserved Slots]

## Notes

**On the superseded privacy claim.** This change was the original evidence for constitution principle VII at
1.0.0, and its central claim — that the server holds no work content — was withdrawn at 2.0.0. Several items
above (CHK014, CHK042) exist to check that the withdrawal is visible rather than merely recorded once in the
proposal. A reviewer should treat "the old claim is still legible somewhere as current" as a defect of these
artifacts, not as a historical curiosity.

**On thresholds.** CHK010, CHK022, CHK023 and CHK047 all circle the same issue from different dimensions: the
spike produced numbers, and those numbers are not release criteria. The items are deliberately repetitive
across dimensions because the failure they guard against — a development-machine percentile quietly becoming a
release bar — happens by a reader skimming one artifact, not by a decision anyone makes.

**Items 45–55 evaluate `model.md`, `design.md` and the four contracts** rather than the delta specs, since the
Physical Resource, Topology and Extensibility dimensions are owned by those artifacts in this schema.
Traceability markers point at them accordingly.

**Metrics.** 55 items. Traceability: 55 of 55 carry a `Spec §`, `Contract §`, `Model §`, `Topology §`,
`Design §`, `Evolution §` or document reference, or a `Gap` / `Ambiguity` / `Conflict` / `Assumption` marker —
100 percent against a target of 80. All eleven dimensions carry at least one item. Scenario layers represented:
Primary, Alternate, Exception and Recovery.
