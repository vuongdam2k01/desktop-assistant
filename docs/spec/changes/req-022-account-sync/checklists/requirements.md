# Requirements Quality Checklist: req-022-account-sync

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Does the replicated set stated in the specs account for every store named as account-owned in constitution principle VII — jobs, ledger, rules, configuration, connector authorisation and transcripts — with none silently absent? [Completeness, Spec §sync "The replicated set is exactly the account-owned stores"]
- [ ] CHK002 Is the behaviour of a device that has enrolled but never completed a full transfer specified for every surface the user can reach, or only for the enrolment path itself? [Completeness, Gap]
- [ ] CHK003 Are requirements stated for what happens to a job that was mid-execution when its own device was revoked, as distinct from a device that merely went offline? [Completeness, Gap]
- [ ] CHK004 Is the rollback position for this change recorded — what happens to data already replicated if the amendment is reversed or the replication feature is withdrawn before release? [Completeness, Gap]
- [ ] CHK005 Are ID conventions established for requirements and acceptance criteria in this project, given that requirements are currently addressed by title alone and titles are editable? [Traceability, Gap]
- [ ] CHK006 Does any requirement state what the user is told when their account is signed in on more devices than the product intends to support, or is no such bound asserted anywhere? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK007 Is "erases the account's data from itself" defined precisely enough to be checkable — specifically whether it covers derived artifacts such as search indexes, caches and image extracts, not only the records themselves? [Clarity, Spec §sync "A signed-out or revoked device erases the account's data from itself"]
- [ ] CHK008 Does "restored ready to use" have an observable meaning, or could a device satisfy it while still lacking something the user needs before the first job runs? [Clarity, Spec §sync "Account sign-in alone restores the account's data on a new device"]
- [ ] CHK009 Is "the superseded version is present in the ledger as superseded" clear about whether the user can find it without knowing a conflict occurred? [Clarity, Spec §sync "A conflicting mutable record resolves deterministically and keeps the superseded version"]
- [ ] CHK010 Is the distinction between "unavailable on this device" and "revoked" stated in terms a reader can apply, given that both prevent the connector from being used? [Clarity, Spec §connector "Connector state is visible and recoverable in one action"]
- [ ] CHK011 Does "a bounded period" in the lease requirement communicate a real constraint to an implementer, or does it defer so completely to SP-22 that the requirement asserts nothing verifiable? [Clarity, Ambiguity, Spec §sync "Replicated authorisation is usable only under a bounded lease"]

## Requirement Consistency

- [ ] CHK012 Do the `ledger` retention requirement and the `sync` replicated-set requirement agree on whether transcripts expire with the ledger records they belong to, or do they state it in terms that could diverge? [Consistency, Spec §ledger "Retention is bounded, configurable and deleted only deliberately" vs §sync "The replicated set is exactly the account-owned stores"]
- [ ] CHK013 Is the account-deletion behaviour consistent across the three capabilities that specify part of it, without one promising erasure the others do not deliver? [Consistency, Spec §app vs §backend vs §sync deletion requirements]
- [ ] CHK014 Do the `platform` decryption-failure remedy and the `sync` enrolment requirement agree on what a device does when its secure storage is unreadable but it has never replicated? [Consistency, Spec §platform "Credentials are held in operating-system secure storage" vs §sync enrolment]
- [ ] CHK015 Does the `connector` requirement that reconnect can be completed on any device conflict with the `sync` requirement that a job executes only on its creating device? [Consistency, Spec §connector vs §sync "A job executes only on the device that created it"]

## Acceptance Criteria Quality

- [ ] CHK016 Can "the user is not asked for a passphrase, recovery code, exported file, or confirmation from the lost device" be objectively checked, or does it require judgement about what counts as being asked? [Measurability, Spec §sync enrolment]
- [ ] CHK017 Is "every record from both devices is present on both devices and on the backend" checkable without access to the backend's internal state? [Measurability, Spec §sync "Append-only stores resolve by append-and-reconcile"]
- [ ] CHK018 Can "both devices present the combined records in the same order" be verified without a fixed definition of what the order is? [Measurability, Spec §sync "Replicated records present in the same order on every device"]
- [ ] CHK019 Is the audit requirement stated so that its absence is detectable — can a reviewer establish that a key use without an audit record did not occur, rather than only that audit records exist? [Measurability, Spec §backend "Key access is confined to the replication path, least-privileged and audited"]

## Scenario Coverage

- [ ] CHK020 Is there a requirement covering the case where a user signs in to a second account on a machine that already holds a first account's data, beyond the isolation scenario? [Coverage, Spec §sync "Replication serves one account and no other"]
- [ ] CHK021 Are recovery scenarios specified for a device whose local store is corrupted rather than merely stale — can it re-enrol without the corruption replicating outward? [Coverage, Gap]
- [ ] CHK022 Is the alternate path specified where the user declines to wait for unreplicated work at sign-out — is that work discarded, and is the user told so? [Coverage, Spec §app "Sign-out states what it destroys and what has not been shared"]
- [ ] CHK023 Are non-functional requirements for replication intentionally omitted pending spike SP-22, or missing? No latency, throughput, storage or enrolment-duration requirement appears in any delta spec. [Coverage, Gap]
- [ ] CHK024 Is there a scenario covering the first sign-in of a device that runs a build older than the account's other devices, distinct from the protocol-mismatch case in the contracts? [Coverage, Gap]

## Edge Case Coverage

- [ ] CHK025 Is behaviour specified when the same record is edited on three or more devices concurrently, rather than the two-device case the requirement describes? [Edge Case, Spec §sync "A conflicting mutable record resolves deterministically and keeps the superseded version"]
- [ ] CHK026 Is behaviour specified when two devices push records that each claim to have observed the other, so that no causal order exists between them? [Edge Case, Gap]
- [ ] CHK027 Is the case specified where a device's lease expires while a job on it is mid-execution with connector operations already performed? [Edge Case, Spec §sync lease vs §connector]
- [ ] CHK028 Is behaviour specified when retention expiry and a conflict resolution would act on the same record at the same time — does a record expire while being preserved as a superseded version? [Edge Case, Gap]
- [ ] CHK029 Is the case specified where the account's last remaining device is revoked, leaving the account with replicated data and no enrolled device? [Edge Case, Gap]
- [ ] CHK030 Are minor boundary conditions clustered elsewhere — an empty store, a single-record store, a device enrolling while another is being revoked — covered by any requirement, or left to implementation judgement? [Edge Case, Gap]

## Non-Functional Requirements

- [ ] CHK031 Given that no replication threshold is stated anywhere in the specs, is the decision to defer all of them to SP-22 recorded where a reviewer of the specs alone would find it? [Non-Functional, Assumption]
- [ ] CHK032 Are requirements stated for what the user is shown while a large enrolment is in progress, so that "restores ready to use" does not describe an unbounded wait? [Non-Functional, Gap]
- [ ] CHK033 Is the observability of the replication path specified — can an operator establish that a device is failing to replicate without reading that device? [Non-Functional, Gap]
- [ ] CHK034 Are the data-residency and legal obligations raised by RISK-067 reflected in any requirement, or do they remain only in the risk ledger? [Non-Functional, Gap]

## Dependencies & Assumptions

- [ ] CHK035 Is the assumption that Google Sign-In remains the sole authentication mechanism recorded together with its consequence — that compromise of that account now yields the user's entire history across all devices? [Assumption, Spec §proposal Assumptions, RISK-064]
- [ ] CHK036 Is the assumption that a revoked device eventually reconnects, and therefore eventually erases, recorded as an assumption rather than relied upon as a guarantee? [Assumption, Spec §sync "A signed-out or revoked device erases the account's data from itself", RISK-066]
- [ ] CHK037 Is the dependency on the backend's key custody being operationally confined stated as a requirement with consequences, given that RISK-063 records no mechanism prevents the key path widening? [Assumption, Spec §backend key access, RISK-063]

## Ambiguities & Conflicts

- [ ] CHK038 Does "the server holds the connector token, encrypted at rest" conflict with the `platform` requirement that credentials are held in operating-system secure storage, or are the two storage locations clearly complementary? [Conflict, Spec §platform vs §connector "Connecting a platform connects it for the account, not for one device"]
- [ ] CHK039 Is it unambiguous whether a job's approval can be answered from a second device while the first is offline, given that the job resumes on its own device? [Ambiguity, Spec §sync "A job executes only on the device that created it"]
- [ ] CHK040 Does the requirement that the backend "never interprets content" conflict with its obligation to apply retention, which requires knowing when a record was recorded? [Ambiguity, Spec §backend "The backend serves replication without executing the account's work" vs §ledger retention]

## Physical Resource & Topology Quality

- [ ] CHK041 Are the storage locations distinguished clearly enough that a reader knows which data lives in the application data directory and which in operating-system secure storage on each device? [Resource, Topology §Physical Format & Storage]
- [ ] CHK042 Is the claim that replication metadata stays outside the encrypted payload stated with its consequence — that originating device, sequence and recorded time are readable by the backend in plaintext? [Resource, Topology §Physical Format & Storage]
- [ ] CHK043 Are the quantified budgets that do exist correctly scoped as per-device and per-90-days, so that no reader mistakes the 12.36 MB figure for an account total? [Resource, Topology §Physical Resource Budget, RISK-069]
- [ ] CHK044 Is the absence of any account-total, transfer or memory budget stated as an open measurement rather than as an absence of constraint? [Resource, Topology §Physical Resource Budget]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK045 Is the refusal to provide any fallback for a missing or malformed store descriptor justified in terms a reviewer can accept, given that refusal means the store does not replicate at all? [Fallback, Model §Fallback on Missing Manifest]
- [ ] CHK046 Does the store descriptor schema make the destructive combination unexpressible rather than merely forbidden — can an append-only store declare last-writer-wins and be caught only at review? [Extensibility, Contract §replicated-store-descriptor, RISK-065]
- [ ] CHK047 Is the protocol's behaviour on losing its change stream specified as a fallback to pulling by cursor, with no correctness dependency on the stream arriving? [Fallback, Contract §replication-protocol]
- [ ] CHK048 Are the error matrices complete with respect to the requirements — does every failure a spec scenario describes have a corresponding error code and a stated handling side? [Extensibility, Contract §replication-protocol vs §device-registry]
- [ ] CHK049 Is the refusal to replicate partially across a protocol MAJOR boundary stated with its cost — that a device holding unreplicated work cannot hand it back until it updates? [Fallback, Contract §replication-protocol Compatibility]
- [ ] CHK050 Are the two reserved slots each accompanied by a condition specific enough to be recognised when it occurs, rather than a general aspiration? [Extensibility, Evolution §Reserved Slots]

## Notes

**Review intent (defaults applied).** No clarifying questions were asked: the emphasis was unambiguous from the
change itself. This is a constitutional amendment that redefines principle VII, touches persistent storage on
both sides of the client/backend boundary, and weakens a security invariant deliberately. Rigor is therefore set
at release-gate level rather than pre-commit, the intended reader is the W4 reviewer, and the two emphasised
clusters are **security and key custody** (RISK-062, RISK-063, RISK-064, RISK-066) and **data integrity across
replicas** (principle III, RISK-065, RISK-068).

**`design.md` was not read, because it does not exist.** By the Q-5 decision recorded in `clarifications.md`,
design and verification are gated on spike SP-22. Several items above — CHK023, CHK031, CHK032, CHK033 — probe
requirements that would ordinarily be settled by then. They are written as `[Gap]` deliberately: the reviewer
should read them as "is this gap the one we agreed to, and is it recorded where the next reader will find it?",
not as an accusation that the specs are incomplete by accident.

**Items 41–50 evaluate `model.md` and the three contracts** rather than the delta specs, since the Physical
Resource and Extensibility dimensions are owned by those artifacts in this schema. Traceability markers point at
them accordingly.

**Metrics.** 50 items. Traceability: 50 of 50 carry a `Spec §`, `Contract §`, `Model §`, `Topology §`,
`Evolution §` reference or a `Gap` / `Ambiguity` / `Conflict` / `Assumption` marker — 100 percent against a
target of 80. Every one of the eleven dimensions carries at least one item; none was omitted. Scenario layers
covered by the items: Primary, Alternate, Exception and Recovery are each represented; the Non-functional layer
is represented only by items questioning its absence, which is the state Q-5 put it in.
