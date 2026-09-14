# Clarifications

## Coverage Map

| Dimension | Status | Notes |
| --- | --- | --- |
| Functional scope & behavior (goals, out-of-scope, user roles) | Clear | Scope is the set of macOS measurements that change an obligation. Confirmations that macOS matches Windows are cited in the reports and add no requirement. |
| Domain & data model (entities, identifiers, lifecycles, scale) | Clear | No new entity. The change conditions existing behaviour on the operating system and on the signing identity, both of which already exist in the model. |
| Interaction & UX flow (critical journeys, error/empty/loading, accessibility) | Clear | Two journeys are touched: onboarding without a permission prompt, and the pet withdrawing from a shared screen. Both are specified with their refusal cases. |
| Non-functional (performance, scale, reliability, observability, security, compliance) | Clear | Durability is measured (200 of 200 crashes with no loss) and its cost is measured (241 writes per second, 4.033 ms at the median). |
| Integration & external dependencies (external services, formats, versions) | Clear | An Apple Developer Program membership is a precondition of macOS distribution. The product owner decided on 2026-09-13 to defer it and develop locally for now, which the requirements already accommodate: they bind at the point a package reaches a user, not at the point one is built. |
| Edge cases & failure handling (negative cases, limits, concurrency) | Clear | The specified cases include power loss mid-write, an update signed with a changed identity, a refused permission, and an absent previously-active application. |
| Constraints & trade-offs (technical, rejected alternatives) | Clear | The rejected alternative is stating the mechanism in the requirement; the requirement states the obligation and `design.md` records the setting. |
| Terminology & consistency (standard terms, terms to avoid) | Clear | Requirements name the obligation, not the operating-system call. Product terms follow the existing capabilities. |
| Completion signals (verifiable acceptance criteria, definition of done) | Clear | Every requirement has scenarios that name an observable outcome; `verification.md` sets the regression scope. |
| Placeholders (TODOs, unquantified adjectives) | Clear | No placeholder remains. Figures come from the cited measurements. |
| Physical Resource & Artifact Topology (formats, storage locations, RAM/Disk/IO budgets) | Clear | Per-architecture archive for the update path, disk image for manual download, separate manifest per operating system. Write throughput on the durable setting is stated. |
| Modularity, Pluggability & Manifest Schemas (SPI/plugin abstractions, manifest schemas, fallbacks) | Clear | The two native modules are separate components behind the same product-facing behaviour, which is what keeps the platform difference out of the rest of the design. |
| Execution Boundaries & Protocol Topology (multi-process/sandbox, wire protocols, channel schemas) | Clear | Pointer hit-testing is resolved in the native module rather than across the process boundary, which is the reason the module exists on macOS at all. |
| Resilience, Degraded Modes & State Reconciliation (graceful degradation, offline queues, reconciliation) | Clear | Degradation is specified for a refused permission and for a credential that will not decrypt after an update. |

## Sessions

### Session 2026-09-13 — rating

Every dimension above is rated from the eight macOS spike reports, which answer the questions this change would
otherwise have had to ask. One row was left Partial: whether the Apple Developer Program membership would be
bought, which is a procurement decision rather than a design question.

### Session 2026-09-13 — decision from the product owner

**Q-1. Is the Apple Developer Program membership bought now, so that macOS distribution can begin?**
**Answer: no. Development and use stay local for the time being; the membership is decided later.**

This changes nothing in the requirements, and that is worth stating rather than assuming. The signing
obligations were written to bind at distribution, not at build time: `platform` — "macOS releases are signed
with an Apple Developer ID and notarised before distribution" — carries the scenario "A build is produced for
testing rather than distribution", under which a development identity is permitted and the build is not
published through the update feed. A locally built, locally run product is exactly that case.

Two consequences the decision does carry, both operational rather than specified:

- A locally signed build raises an operating-system password prompt when it reaches the keychain, measured in
  `spikes/SP-11-secure-storage/macos/REPORT.md` §1 Q3. During local development this is an irritation. It is
  the same mechanism that would become data loss after a distributed update, which is why the requirement
  exists.
- The first build handed to anyone else fixes the identity for good. There is no migration from one identity
  to another that preserves a user's credentials or permissions, so the decision to defer holds only while
  nothing is distributed. Handing a build to a single tester on another machine is distribution for this
  purpose.

## Assumptions

- No assumption is made about the Apple Developer Program membership. The product owner decided on 2026-09-13
  to defer it and keep the product local, and the specification states the obligation — signed and notarised,
  identity unchanged across updates — as a condition on distribution rather than as a claim that the
  membership exists. If it is never bought, macOS distribution does not happen; there is no lesser version of
  this requirement to fall back on.
- The measurements come from one machine: Apple Silicon, macOS 26.5.2, APFS with FileVault on. Intel Macs are
  not covered. The requirements are written as obligations rather than as settings, so an Intel difference
  would be a new measurement rather than a contradiction of the text.
- What the Mac mini could not measure — a 120 Hz display, two displays at different scale factors, battery
  drain, the notch, Sidecar — stays unverified and is deliberately absent from these requirements.
