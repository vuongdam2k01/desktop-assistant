# Requirements Quality Checklist: req-024-pet-pack-framework

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-13

## Requirement Completeness

- [ ] CHK001 Is every part of a pack — manifest, animation asset, persona — required by a requirement, so that no part can be omitted and still yield a valid pack? [Completeness, Spec §pet "A pet pack is the unit the product ships, the user creates, and the account owns"]
- [ ] CHK002 Are the obligations of both provenances stated separately, so that what may be done to a built-in template and to an account pack are each fully specified rather than one being inferred from the other? [Completeness, Spec §pet "A built-in template is read-only and a copy of it is independent"]
- [ ] CHK003 Is the behaviour when the account holds no pack of its own specified, rather than left to a surface that would otherwise appear broken? [Completeness, Spec §pet, Spec §app]
- [ ] CHK004 Are the requirements for what happens to a pack at account deletion complete on both sides — device and backend — or is only one side stated? [Completeness, Spec §backend "Deleting the account destroys its pet packs", Gap]
- [ ] CHK005 Does any requirement state what the user sees while a pack is arriving through replication but its asset has not yet transferred? [Completeness, Spec §sync "An account pack replicates whole, and a built-in template does not replicate"]
- [ ] CHK006 Are requirements present for every refusal code the manifest contract declares, or do some codes exist in the contract with no requirement obliging the product to surface them? [Completeness, Gap]

## Requirement Clarity

- [ ] CHK007 Is "bounded free-text character description" quantified with a specific length, and is that figure stated in the requirement rather than only in the schema? [Clarity, Spec §pet "A pack carries the persona specification the pet speaks under", Ambiguity]
- [ ] CHK008 Is "talkativeness" defined as a closed set of values with stated meanings, or does it remain an adjective the reader must interpret? [Clarity, Spec §pet]
- [ ] CHK009 Is the distinction between "incompatible" and "damaged" defined precisely enough that a reader could classify any given failure into exactly one of them? [Clarity, Spec §pet "A pack declares the interface revision it was authored against"]
- [ ] CHK010 Does "the shipped default pack" have an unambiguous identity, so that a reader can tell which of several built-in templates it is? [Clarity, Spec §pet "The pet is never absent because of a pack failure", Ambiguity]
- [ ] CHK011 Is "advisory" defined by what it excludes — gate, tool selection, rules — rather than left as a label? [Clarity, Spec §pet "Persona text is advisory and cannot reach the approval gate"]

## Requirement Consistency

- [ ] CHK012 Do the pet and sync requirements agree on exactly what travels with an account pack, without one naming a part the other omits? [Consistency, Spec §pet vs Spec §sync]
- [ ] CHK013 Does the modified replicated-set requirement remain consistent with its own scenario excluding the pet's on-screen placement, now that a pet-related item has joined the set? [Consistency, Spec §sync "The replicated set is exactly the account-owned stores"]
- [ ] CHK014 Is the size ceiling stated identically wherever it appears — pet, sync, backend — or does any statement of it differ in value or in the moment of enforcement? [Consistency, Spec §sync vs Spec §backend, Conflict]
- [ ] CHK015 Does the modified persona requirement stay consistent with the pre-existing fallback-language scenario it inherited, now that the persona belongs to a pack rather than to the product? [Consistency, Spec §pet "All pet-visible text originates from the pet-agent"]
- [ ] CHK016 Do the app requirements describe a surface consistent with what the pet requirements permit — in particular, that a template cannot be deleted and an account pack can? [Consistency, Spec §app vs Spec §pet]

## Acceptance Criteria Quality

- [ ] CHK017 Can "the pet stays on screen throughout" be objectively determined, or does it need a stated observation method to be checkable? [Measurability, Spec §pet "The pet is never absent because of a pack failure"]
- [ ] CHK018 Is "the reason names which part of the contract the asset failed" specific enough to be judged, given that the set of nameable parts is defined in a contract rather than in the requirement? [Measurability, Spec §pet "Creating a pack means importing an animation asset and authoring its persona"]
- [ ] CHK019 Can an acknowledgement line's compliance — stating receipt only, naming nothing, promising nothing — be judged by a reviewer reading it, and is the judging party identified? [Measurability, Spec §pet, Assumption]
- [ ] CHK020 Is "no message mixes the two personas" stated in a way that can be evaluated against a real exchange rather than only in principle? [Measurability, Spec §pet "A pack carries the persona specification the pet speaks under"]

## Scenario Coverage

- [ ] CHK021 Is the primary path — the user creates a pack, activates it, and sees it on another device — covered end to end across the pet, app and sync specs without a gap between them? [Coverage, Spec §pet, §app, §sync]
- [ ] CHK022 Are alternate paths covered, in particular deriving a pack from a built-in template rather than importing an asset outright? [Coverage, Spec §pet "A built-in template is read-only and a copy of it is independent"]
- [ ] CHK023 Are exception paths covered for each of the three import refusal causes — non-conforming, oversize, unreadable — as distinct scenarios rather than one combined case? [Coverage, Spec §app "Creating a pack reports what the supplied asset failed"]
- [ ] CHK024 Are recovery paths covered: a damaged pack becoming readable again, and a product update making a previously incompatible pack usable? [Coverage, Gap]
- [ ] CHK025 Is there a scenario for the zero-data state on a brand-new device where replication has not yet delivered anything? [Coverage, Edge Case]
- [ ] CHK026 Are non-functional scenario layers represented, or are frame rate, latency and resource behaviour treated as unchanged without a requirement saying so? [Coverage, Gap]

## Edge Case Coverage

- [ ] CHK027 Is behaviour specified when the same account pack is edited on two devices before either has replicated? [Edge Case, Assumption]
- [ ] CHK028 Is behaviour specified when the active pack is deleted on one device while another device has it on screen? [Edge Case, Gap]
- [ ] CHK029 Is behaviour specified when a pack declares a capability, the asset lacks it, and the shipped default pack is itself the one being substituted from? [Edge Case, Spec §pet "A pack declares which animation capabilities it implements and degrades per capability"]
- [ ] CHK030 Is behaviour specified when a pack's asset arrives complete but its digest does not match the manifest? [Edge Case, Spec §pet]
- [ ] CHK031 Is behaviour specified when the user activates a pack while a conversation with the pet is already in progress? [Edge Case, Spec §pet "All pet-visible text originates from the pet-agent"]
- [ ] CHK032 Is behaviour specified when the catalogue offers a template whose contract revision this build cannot present? [Edge Case, Spec §backend "The backend serves the catalogue of built-in pet templates"]

## Non-Functional Requirements

- [ ] CHK033 Are the frame-rate and transition-latency guarantees stated as holding for any conforming pack, not only for the shipped one? [Non-Functional, Gap]
- [ ] CHK034 Is the cost of listing a library bounded by a requirement, or is it only a design property that assets are not read during listing? [Non-Functional, Gap]
- [ ] CHK035 Are the localisation obligations of a persona stated as requirements, given that every interface string elsewhere passes through a localisation layer and persona text does not? [Non-Functional, Spec §pet, Gap]
- [ ] CHK036 Is there a requirement bounding what a pack contributes to each pet-agent request, or is the prompt-cost bound only a schema constraint? [Non-Functional, Spec §pet, Gap]

## Dependencies & Assumptions

- [ ] CHK037 Is the assumption that an account pack conflict resolves by the existing mutable-record rule recorded where a reader of the sync specification would find it, rather than only in the clarifications log? [Assumption, Spec §sync]
- [ ] CHK038 Is the dependency on `pet/contracts/rive-state-machine@2.0.0` stated in the requirements themselves, so that a reader knows a pack's validity depends on a contract revision? [Assumption, Spec §pet "A pack declares the interface revision it was authored against"]
- [ ] CHK039 Is the assumption that built-in templates remain usable without the backend recorded as a requirement rather than only as an assumption? [Assumption, Spec §app "The settings area presents the product's catalogue and the account's own packs separately"]
- [ ] CHK040 Is the dependency of this change on `req-005-electron-rive-pet-render` and `req-018-pet-liveness` — both still unarchived — recorded, and is the consequence of either changing understood? [Assumption, Gap]

## Ambiguities & Conflicts

- [ ] CHK041 Does "the account's own packs" consistently exclude built-in templates the user has merely selected, across every requirement that uses the phrase? [Ambiguity, Spec §sync vs Spec §app]
- [ ] CHK042 Is there a conflict between the pet requirement that a pack is presented only by activation and any expectation carried over from the earlier specification that replacing a file changes the character? [Conflict, Spec §pet "Pet asset pipeline loads binary buffers dynamically without application rebuild"]
- [ ] CHK043 Does the persona requirement conflict with the pre-existing obligation that every interface string passes through the localisation layer, given that persona text is authored per pack? [Conflict, Gap]

## Physical Resource & Topology Quality

- [ ] CHK044 Are the storage locations for both provenances stated, and is it clear which is read-only? [Resource, Topology §Physical Format & Storage]
- [ ] CHK045 Is every quantified budget — asset ceiling, manifest and persona ceiling, resident memory — accompanied by its derivation and its verification status, rather than appearing as a bare number? [Resource, Topology §Physical Resource Budget]
- [ ] CHK046 Is the separation of the asset from the database stated as a property with a reason, so that a reader does not reintroduce the binary as a column? [Resource, Topology §Physical Storage & Data Schema]
- [ ] CHK047 Is the eviction and lifetime behaviour of the resident asset buffer specified precisely enough to guarantee the pet is visible across a swap? [Resource, Topology §Lifecycle & Eviction]
- [ ] CHK048 Since this change adds persistent data and raises a contract major version, are the rollback requirements complete — specifically, what becomes of account packs on a device rolled back to a build implementing the earlier revision? [Resource, Migration & Rollback]

## Extensibility, Protocol & Fallback Robustness

- [ ] CHK049 Is the fallback hierarchy stated as three tiers with a terminating tier that cannot itself fail for want of a pack? [Fallback, Design §Multi-Level Fallback Hierarchy]
- [ ] CHK050 Is it stated that capability substitution is one step and never chains through another custom pack, and is the reason recorded? [Fallback, Model §INV-PACK-02]
- [ ] CHK051 Does the manifest schema declare every field a future distribution channel would need, and is each reserved point accompanied by its phase, rationale and activation condition as the constitution requires? [Extensibility, Model §Variability]
- [ ] CHK052 Are all channels that cross an execution boundary accompanied by a payload schema and an error signal, with none left described only in prose? [Protocol, Design §Communication Channels & Protocols]
- [ ] CHK053 Is the discovery mechanism specified such that a directory lacking a readable manifest is unambiguously not a pack, rather than a pack in an error state? [Extensibility, Model §Discovery & Registry]
- [ ] CHK054 Does the compatibility policy of the manifest contract guarantee that a MINOR revision never invalidates an existing pack, and is that guarantee traceable to the substitution rule? [Extensibility, Contract §Compatibility]

## Notes

Review intent was not asked and was inferred, as the skill permits when the signals are unambiguous. The
defaults applied: **release-gate rigor**, because this change raises a contract by a major version and widens
the replicated set; **reviewer audience is the decision-maker**, since the open items `Q-PACK-1` and `Q-PACK-2`
are theirs; and the two strongest signal clusters are **the trust boundary around persona text** and **the
physical and replication topology of a binary payload**, which is why those two areas carry proportionally more
items.

Several items are deliberately marked `[Gap]` where the requirements do not currently say something that a
reviewer may decide they should. These are not defects asserted by the author — they are questions posed for
the reviewer. `CHK033` through `CHK036` and `CHK043` are the cluster most likely to produce real work, since
they concern whether guarantees that currently hold for one shipped asset should be restated as holding for any
conforming pack.
