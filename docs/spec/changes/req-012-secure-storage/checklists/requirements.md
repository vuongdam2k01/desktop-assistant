# Requirements Quality Checklist: req-012-secure-storage

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-12

## Requirement Completeness

- [ ] CHK001 Is there a requirement stating what the product does while the secure-storage facility is unavailable — which surfaces still work and which jobs fail — or does the existing requirement stop at "refuses to hold them in plain text"? [Completeness, Spec §platform "Credentials are held in operating-system secure storage"]
- [ ] CHK002 Is the rollback position stated anywhere as a requirement — what the user is told and what they must do if this store is removed or reverted — or only as a design intention? [Completeness, Gap]
- [ ] CHK003 Do the requirements oblige the product to erase credentials when a device is revoked from another device, or is revocation covered only by the sign-out requirement inherited from `req-022-account-sync`? [Completeness, Spec §platform "Erasing the device's credentials leaves nothing readable behind"]
- [ ] CHK004 Is any requirement stated about what the user is shown while a whole-store erasure is running, given that sign-out and account deletion can both be interrupted? [Completeness, Gap]
- [ ] CHK005 Are ID conventions established for requirements in this project, given that requirements are addressed by title alone and a title edit silently breaks a `MODIFIED` delta? [Traceability, Gap]
- [ ] CHK006 Do the requirements state who may register a credential class, or is registration treated as an internal act no requirement constrains? [Completeness, Gap]
- [ ] CHK007 Is there a requirement covering a credential that is present but expired, as distinct from absent and from unreadable — or is expiry left entirely to the connector capability? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK008 Is "SHALL NOT be placed in an operating-system credential vault that limits the size of an entry or lists the product's entries" checkable as written, or does it read as a prohibition on a named product rather than on an observable property? [Clarity, Spec §platform "Credentials are held in operating-system secure storage"]
- [ ] CHK009 Is "two and a half kilobytes" in the large-credential scenario clearly the rejected route's limit rather than a limit this design imposes? [Clarity, Ambiguity, Spec §platform large-credential scenario]
- [ ] CHK010 Does "marked unreadable" name something observable from outside the product, or an internal marking no test or user can see? [Clarity, Spec §platform "A credential that cannot be decrypted is never returned as a value"]
- [ ] CHK011 Is "the identity it was issued for" precise enough for a connector authorising the same platform twice for different accounts, or does it leave the second case to be invented at implementation time? [Clarity, Spec §platform "Every stored credential is addressed by a namespaced key"]
- [ ] CHK012 Does "discard every decrypted copy the product holds" state a checkable condition, given that the product's memory is not externally observable? [Clarity, Measurability, Spec §platform erasure requirement]
- [ ] CHK013 Is "an exported diagnostic bundle" defined anywhere in the specification set, or does the connector requirement constrain an artifact no other requirement establishes? [Clarity, Gap, Spec §connector "A connector's authorisation is persisted only through the device's credential store"]

## Requirement Consistency

- [ ] CHK014 Does the modified platform requirement still agree with the `sync` requirement that a signed-out or revoked device erases the account's data from itself, or do the two now describe the same erasure in different vocabularies? [Consistency, Spec §platform vs §sync "A signed-out or revoked device erases the account's data from itself"]
- [ ] CHK015 Is the statement that credentials rest as ciphertext in the application's data directory consistent with the `req-022-account-sync` model, which says replication material and connector authorisation are held in secure storage "never in that directory"? [Conflict, Model §req-022 Physical Topology vs Spec §platform]
- [ ] CHK016 Do the backend requirement to withdraw authorisations at the providers and the `connector` requirement that disconnecting calls the revoke endpoint describe one obligation twice, and if so is the duplication deliberate? [Consistency, Spec §backend "Deleting the account withdraws its connector authorisations at the providers" vs §connector "Disconnecting revokes and erases the authorisation"]
- [ ] CHK017 Does the requirement that no decrypted credential reaches an agent's context agree with how the connector capability describes tool parameters, which are generated from the manifest and passed through the agent? [Consistency, Spec §platform "A decrypted credential never leaves the process that uses it" vs §connector "The tool set is generated from connected connectors only"]

## Acceptance Criteria Quality

- [ ] CHK018 Is "no credential value is readable from it" measurable without knowing what value was stored — that is, can a test assert it without holding the plaintext it is looking for? [Measurability, Spec §platform "Credential is not recoverable from the application directory"]
- [ ] CHK019 Can "none of the product's credentials is listed there" be checked on both supported operating systems, or does it assume a credential list that only one of them presents? [Measurability, Spec §platform credential-list scenario]
- [ ] CHK020 Is "the user is told which authorisations could not be withdrawn" specific enough to accept or reject an implementation that reports a count rather than names? [Measurability, Spec §backend revocation-failure scenario]

## Scenario Coverage

- [ ] CHK021 Is there a scenario for the recovery layer in which an erasure and a restoration are outstanding at the same time — a device signed out while a connector entry was already unreadable? [Coverage, Gap]
- [ ] CHK022 Is the alternate path where a user connects the same platform on two devices simultaneously represented anywhere, or does coverage assume one writer per credential? [Coverage, Gap]
- [ ] CHK023 Does any scenario cover a credential written while an erasure is running, which is reachable when a job completes an authorisation during sign-out? [Coverage, Gap]
- [ ] CHK024 Are the exception-layer scenarios for the decryption-failure requirement distinguishable in their observable outcome, or do the altered-bytes and unrecognised-form cases assert the same thing twice? [Coverage, Spec §platform decryption-failure requirement]

## Edge Case Coverage

- [ ] CHK025 Is the case of two credential classes claiming overlapping key patterns covered by a requirement, or does it exist only as an error code in the descriptor contract? [Edge Case, Contract §credential-class-descriptor `CLASS_PATTERN_CONFLICT`, Gap]
- [ ] CHK026 Is there coverage for the product starting while the store file exists but the facility reports itself unavailable — a state in which entries are present and none can be read? [Edge Case, Gap]
- [ ] CHK027 Does any requirement address a credential store file that has been replaced with a valid store from the same machine but an earlier point in time, which is a restore that does not fail decryption? [Edge Case, Gap]
- [ ] CHK028 Is the case of an uninstall that the user interrupts and never resumes — the application removed while its store file survives — addressed, or does the interrupted-erasure scenario assume the product runs again? [Edge Case, Spec §platform "Erasure is interrupted part-way"]

## Non-Functional Requirements

- [ ] CHK029 Is any requirement stated about how long a read may take, given that credentials are read on the path of every tool call and the measured cost is well under a millisecond? [Non-Functional, Gap]
- [ ] CHK030 Are the security properties that the measurement established — cross-user isolation and per-entry capacity — expressed as requirements a test can rerun, or do they live only in the verification plan? [Non-Functional, Spec §platform "Stored credentials are readable only by the operating-system user that stored them"]
- [ ] CHK031 Is the absence of an audit record for local credential use deliberate, given that principle VII requires an audit record for every key access on the backend side? [Non-Functional, Assumption, Constitution principle VII]

## Dependencies & Assumptions

- [ ] CHK032 Is the assumption that the product always runs in an interactive user session, never as a service, recorded where a reader of the requirements would meet it rather than only in the proposal? [Assumption, Proposal §Assumptions, RISK-043]
- [ ] CHK033 Does the dependency on `req-022-account-sync` — whose replication supplies every replacement in the restoration route — appear in the change metadata and the roadmap ordering? [Dependency, Assumption]
- [ ] CHK034 Is the macOS gap stated as an assumption with an owner and a trigger, or does the requirement set read as though both operating systems were measured? [Assumption, Spec §platform source notes, Clarifications Q-1]

## Ambiguities & Conflicts

- [ ] CHK035 Does "the material a device uses to replicate the account's data" name the same thing as the `auth:session:` class in the model, and would a reader of the specification alone know that? [Ambiguity, Spec §platform vs Model §Entities]
- [ ] CHK036 Is it clear whether the unavailable-facility behaviour forbids only persistent plain text or also an in-memory credential supplied by the user for one session? [Ambiguity, Spec §platform "Secure storage is unavailable"]
- [ ] CHK037 Do the specification and the design agree on whether an unreadable entry is discarded immediately or retained until its replacement arrives? [Conflict, Spec §platform decryption-failure requirement vs Design §D5]

## Physical Resource & Topology Quality

- [ ] CHK038 Are the storage location, the row shape and the fixed 31-byte ciphertext overhead recorded with their measurement source rather than as design assertions? [Resource, Topology §1 Physical Format & Storage]
- [ ] CHK039 Is the absence of a stated store-size budget justified rather than merely omitted, and is the observation that replaces it assigned to someone? [Resource, Topology §1 Physical Resource Budget, Verification §Thresholds]
- [ ] CHK040 Does the state-to-artifact matrix cover every event that writes or erases a credential, including token refresh during a job and replacement from replication? [Topology §2 State-to-Artifact Mapping Matrix]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK041 Is the three-tier fallback hierarchy complete in the sense that every failing state in the lifecycle reaches exactly one tier, or is there a state — an unreadable entry in a class that neither replicates nor can be re-established by sign-in — with no tier? [Extensibility, Design §Extensibility & Fallback Strategy, Model §INV-PLT-06]
- [ ] CHK042 Are the mandatory erasure triggers on every credential class expressed in the manifest schema strongly enough that a class cannot be registered without them, rather than relying on review? [Extensibility, Contract §credential-class-descriptor `erase_on`]
- [ ] CHK043 Is the absence of any channel returning a credential value stated as a property of the protocol rather than as a rule implementers are asked to follow? [Protocol, Contract §secure-storage Wire Protocol, Design §D6]
- [ ] CHK044 Does the descriptor contract say what happens to credentials already on disk when their class's `erase_on` or `restoration_route` changes in a new descriptor version? [Extensibility, Gap, Contract §credential-class-descriptor Compatibility]

## Notes

**Context and defaults.** Generated in a non-interactive session, so the defaults recorded by the checklist
procedure apply: standard rigor, reviewer audience, and emphasis on the two strongest signal clusters in this
change — the security boundary around credential values, and the completeness of erasure and restoration. No
focus argument was supplied.

**Traceability convention.** This project has no upstream requirement identifiers, so items reference
requirements by capability and title (`Spec §platform "…"`), and reference the other artifacts of this change as
`Model §`, `Contract §`, `Topology §`, `Design §` and `Verification §`.

**Items worth the reviewer's attention first.** CHK015 asks about a genuine tension between this change and the
model of `req-022-account-sync`: one says credentials are held in secure storage rather than the data directory,
the other says the ciphertext rests in a store file inside that directory, and a reader needs to be told that
these are the same arrangement described at different levels. CHK031 asks whether local credential use should
leave an audit record, since the constitution demands one for every key access on the backend and this change
deliberately does not add one on the device. CHK044 asks the question a future version of the descriptor
contract will have to answer, and answering it now is cheaper than after the first class has shipped.

**Metrics.** 44 items. Traceability: 44 of 44 carry a `Spec §`, `Model §`, `Contract §`, `Topology §`,
`Design §` or `Verification §` reference, or a `Gap` / `Ambiguity` / `Conflict` / `Assumption` /
`Dependency` / `Traceability` marker — 100 percent against a target of 80. All eleven dimensions carry at least
one item; none was omitted. Scenario layers represented: Primary, Alternate, Exception, Recovery and
Non-functional.
