# Requirements Quality Checklist: req-023-macos-platform-baseline

**Purpose**: Verify the QUALITY OF THE REQUIREMENTS (completeness, clarity, consistency, measurability, coverage) prior to implementation. Does not verify code implementation.
**Ownership**: Ticked by reviewer. `[x]` = requirement quality criterion satisfied; does NOT mean implementation is complete.
**Created**: 2026-09-13

## Requirement Completeness

- [ ] CHK001 Does every macOS finding that changes an obligation appear as a requirement, rather than only as a citation added to an existing one? [Completeness, Gap]
- [ ] CHK002 Is the case where a credential cannot be decrypted after an update specified, and not only the case where the identity is correct? [Completeness, Spec platform §"An update preserves the signing identity"]
- [ ] CHK003 Are all three states of a permission — never asked, granted, refused — reachable in some scenario, including revocation after a grant? [Completeness, Spec uix §"A refused operating-system permission degrades one feature"]
- [ ] CHK004 Is it stated what happens when the application that previously held focus no longer exists? [Completeness, Spec pet §"Returning focus to the previously active application"]
- [ ] CHK005 Does the durability requirement cover the case where a tool call is about to run against a record whose flush has not returned, not merely the case of a completed write? [Completeness, Spec ledger §"A record the store reports as written survives sudden power loss"]

## Requirement Clarity

- [ ] CHK006 Is "durable media" stated in terms a reviewer can judge, rather than resting on a reader knowing what the operating system means by a flush? [Clarity, Spec ledger §"A record the store reports as written…"]
- [ ] CHK007 Do the requirements state obligations rather than the settings that meet them today, so that the text survives a change of store or framework? [Clarity, Spec ledger, platform]
- [ ] CHK008 Is "the product's core behaviour" enumerated rather than left as a phrase each reader interprets? [Clarity, Spec platform §"The product's core behaviour requires no operating-system privacy permission"]
- [ ] CHK009 Is "the same identity" precise enough to judge, given that a certificate is renewed periodically while remaining the same identity to the operating system? [Clarity, Ambiguity, Spec platform §"An update preserves the signing identity"]

## Requirement Consistency

- [ ] CHK010 Does the new macOS native module requirement sit consistently beside the existing Windows one, without implying that one supersedes or generalises the other? [Consistency, Spec platform §"macOS native integration module", §"Windows native integration module"]
- [ ] CHK011 Is the claim that macOS needs no native code for focus preservation consistent with the claim that macOS does need native code for focus restoration? [Consistency, Spec pet — both requirements]
- [ ] CHK012 Does the zero-permission floor sit consistently with the existing privacy-filter requirement, which describes reading window information? [Consistency, Spec platform §"Native privacy filter strips raw window titles"]
- [ ] CHK013 Does the widened update contract remain consistent with the existing Windows signing and update requirements, which were written for a single feed? [Consistency, Spec platform §"Desktop application packages and signs releases"]

## Acceptance Criteria Quality

- [ ] CHK014 Is each threshold in `verification.md` traceable to a measurement rather than chosen for roundness, and is the gap between the floor and the measurement explained where one exists? [Acceptance Criteria Quality, verification.md Thresholds]
- [ ] CHK015 Can each acceptance criterion be judged by observing the product, without reading its source? [Acceptance Criteria Quality, verification.md]
- [ ] CHK016 Is the throughput floor of 200 commits per second defensible as a product requirement, or is it merely the measurement rounded down? [Acceptance Criteria Quality, Ambiguity, verification.md Thresholds]

## Scenario Coverage

- [ ] CHK017 Does every added requirement carry at least one scenario for the case where the obligation is not met, and not only the case where it is? [Scenario Coverage, Spec all files]
- [ ] CHK018 Is the deliberate case covered alongside the incidental one — the user choosing to address the pet, as against the pet interrupting? [Scenario Coverage, Spec pet §"Presenting the speech bubble…"]
- [ ] CHK019 Is the case of a release published for one operating system alone covered from the other operating system's point of view? [Scenario Coverage, Spec backend §"The update manifest is served per operating system…"]

## Edge Case Coverage

- [ ] CHK020 Is power loss covered at the moment that matters — immediately after the store reports success — rather than at an arbitrary point? [Edge Case Coverage, Spec ledger]
- [ ] CHK021 Is a job still running when the management window closes covered, so that Dock withdrawal does not read as the product exiting? [Edge Case Coverage, Spec app §"The product's presence in the macOS Dock…"]
- [ ] CHK022 Is the user's own view during screen sharing covered, so that hiding the pet from the audience is not read as hiding it from the user? [Edge Case Coverage, Spec uix §"The pet is withheld from screen sharing"]
- [ ] CHK023 Is a manifest naming an uninstallable package format caught at publication rather than on the user's machine? [Edge Case Coverage, Spec backend]

## Non-Functional

- [ ] CHK024 Is the two-orders-of-magnitude throughput cost of durability stated where a designer would encounter it, rather than only in the spike report? [Non-Functional, Spec ledger §"The cost of durability is confined…", model.md Resource budgets]
- [ ] CHK025 Are the measurements that could not be taken — 120 Hz, mixed-scale displays, battery, notch, Sidecar, Intel — recorded as unverified rather than omitted silently? [Non-Functional, Dependencies & Assumptions, verification.md Out of Scope]
- [ ] CHK026 Is the privacy consequence of the zero-permission floor stated as a product property rather than as a technical convenience? [Non-Functional, Spec platform, uix]

## Dependencies & Assumptions

- [ ] CHK027 Is the Apple Developer Program membership recorded as a precondition with no fallback, rather than as a task that could be deferred? [Dependencies & Assumptions, proposal.md Assumptions, design.md Risks]
- [ ] CHK028 Is the single-machine basis of every measurement stated, and are the requirements written so that a second machine would add evidence rather than contradict text? [Dependencies & Assumptions, clarifications.md Assumptions]
- [ ] CHK029 Is the dependency between this change and `req-016-signing-update` explicit, given that it revises that change's contract? [Dependencies & Assumptions, contracts/update-feed.md Amends]

## Ambiguities & Conflicts

- [ ] CHK030 Does the change avoid asserting anything about Intel Macs, in either direction? [Ambiguities & Conflicts, design.md Research]
- [ ] CHK031 Is there a conflict between confining the durable setting to two stores and any existing requirement that assumes uniform store behaviour? [Ambiguities & Conflicts, Conflict, Spec ledger]
- [ ] CHK032 Does the reserved slot for a permission-dependent feature conflict with the requirement that the core needs no permission, or does it deliberately bound it? [Ambiguities & Conflicts, model.md Variability]
