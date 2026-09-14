# Verification: req-024-pet-pack-framework

<!-- A document-level acceptance plan. It states how the specified behavior would be judged, never how it is
built or tested in code. No build, install, compile, or test-runner steps belong in this file. -->

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | An animation asset placed by hand into the pack storage location, with no manifest beside it, is absent from the library; the same asset with a valid manifest is present and activatable | `specs/pet/spec.md` — "A pet pack is the unit the product ships, the user creates, and the account owns", scenario "An animation asset arrives without a manifest" | `contracts/pet-pack-manifest.md` §Module Descriptor, Discovery |
| AC-2 | A pack declaring a contract major revision the build does not implement is refused, and the reported reason is distinguishable by a reader from the reason reported for an asset whose bytes cannot be read | `specs/pet/spec.md` — "A pack declares the interface revision it was authored against", all three scenarios | `contracts/rive-state-machine.md` §Error Matrix, `INCOMPATIBLE_REVISION` versus `INVALID_ASSET_BUFFER` |
| AC-3 | A pack whose asset contains the work status layer and no locomotion layer is activated, and what appears on screen is that pack's character moving with the shipped default pack's gait — not the default character, and not an absent pet | `specs/pet/spec.md` — "A pack declares which animation capabilities it implements and degrades per capability", scenario "A pack implements work status but not locomotion" | `design.md` §Multi-Level Fallback Hierarchy, Tier 1 |
| AC-4 | A pack declaring the locomotion layer whose asset does not contain it behaves identically to AC-3, so the declaration changes nothing about what is rendered | `specs/pet/spec.md` — same requirement, scenario "A pack declares a capability it does not contain" | `model.md` INV-PACK-06 |
| AC-5 | Across the deletion of the active pack, the loss of an active pack's asset mid-session, and a start-up in which no pack in the library loads, a pet is on screen at every moment of observation | `specs/pet/spec.md` — "The pet is never absent because of a pack failure", all three scenarios | `model.md` INV-PACK-04, INV-PACK-05 |
| AC-6 | Activating a second pack changes the voice of subsequent pet messages and does not alter messages already presented | `specs/pet/spec.md` — "A pack carries the persona specification the pet speaks under", scenario "Activating a pack changes how the pet speaks"; and "All pet-visible text originates from the pet-agent", scenario "The active pack changes mid-conversation" | `contracts/pet-pack-manifest.md` §Semantics |
| AC-7 | A pack whose character description instructs the pet to approve without asking, names a connector operation as pre-approved, or asserts a different approval mode, produces the same approval behaviour as a pack whose description says none of those things | `specs/pet/spec.md` — "Persona text is advisory and cannot reach the approval gate", all three scenarios | `docs/spec/constitution.md` principle II; `model.md` INV-PACK-03 |
| AC-8 | An account pack created on one device is present and activatable on a second device after nothing more than signing in, with no file transferred by the user | `specs/sync/spec.md` — "An account pack replicates whole, and a built-in template does not replicate", scenario "A pack created on one device appears on another" | `contracts/pet-pack-store.descriptor.json`; `docs/spec/constitution.md` principle VII |
| AC-9 | A pack whose manifest has arrived and whose asset has not is listed as still arriving and cannot be activated; once the asset arrives and its digest verifies, it becomes activatable | `specs/sync/spec.md` — same requirement, scenario "A pack arrives without its asset" | `contracts/pet-pack-store.sql`, state `arriving`; descriptor capability `partial-transfer` |
| AC-10 | An asset above the size ceiling is refused at the moment the user supplies it, with both its size and the ceiling stated, and no pack of any kind results | `specs/sync/spec.md` — "A replicated pack is bounded in size"; `specs/app/spec.md` — "Creating a pack reports what the supplied asset failed", scenario "An asset over the size ceiling" | `contracts/pet-pack-manifest.schema.json`, `asset.sizeBytes` |
| AC-11 | The three import refusals — non-conforming, oversize, unreadable — are each reported in terms a user could act on differently, and no pack directory is left behind by any of them | `specs/app/spec.md` — "Creating a pack reports what the supplied asset failed", all three scenarios | `contracts/pet-pack-manifest.md` §Error Matrix, `ImportRefusal` |
| AC-12 | Editing a built-in template produces a new account pack and leaves the template unchanged; a release that updates that template leaves the derived pack unchanged; and the template cannot be deleted | `specs/pet/spec.md` — "A built-in template is read-only and a copy of it is independent", all three scenarios | `model.md` INV-PACK-01 |
| AC-13 | With the backend unreachable, the templates already on the device remain listed and activatable, and the surface states that the catalogue could not be refreshed rather than presenting an empty catalogue | `specs/app/spec.md` — "The settings area presents the product's catalogue and the account's own packs separately", scenario "The catalogue cannot be reached"; `specs/backend/spec.md` — "The backend serves the catalogue of built-in pet templates", scenario "The catalogue is unavailable" | `docs/spec/constitution.md` principle VII, local working copy |
| AC-14 | A library listing states, for every pack, which capabilities it supplies, before the user activates it | `specs/app/spec.md` — "The user can see what a pack looks like before activating it", scenario "A pack declaring fewer capabilities" | `design.md` D3, disclosure rather than surprise |
| AC-15 | Deleting an account destroys the pet packs stored for it and leaves the catalogue of built-in templates unchanged | `specs/backend/spec.md` — "Deleting the account destroys its pet packs", both scenarios | `docs/spec/constitution.md` principle VII |
| AC-16 | Replacing the active pack's asset file on disk, without an activation, changes nothing about what is on screen | `specs/pet/spec.md` — "Pet asset pipeline loads binary buffers dynamically without application rebuild", scenario "The asset changes on disk without an activation" | `model.md` INV-PACK-07 |
| AC-17 | A payload carrying only a locomotion value changes how the pet moves and leaves its work status animation untouched, and the converse holds | `specs/pet/spec.md` — "Two-layer animation state machine combining locomotion and work status", scenario "A pack authored outside the product implements both layers" | `contracts/rive-state-machine.set-state.schema.json`; `spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q19, Q20) |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Animation asset size, per pack | at most 5 MB (5,242,880 bytes) | `clarifications.md` session 2026-09-13; derived as roughly ten times the under-500 KB budget in `req-005-electron-rive-pet-render/model.md` | **unverified** — a declared budget, not a measurement |
| Manifest and persona document, per pack | at most 64 KB combined | `model.md` §Physical Resource Budget | **unverified** |
| Character description length | at most 1,200 characters | `design.md` R3 | **unverified** |
| Acknowledgement line length | at most 120 characters per line | `contracts/pet-pack-manifest.schema.json` | **unverified** |
| Frame rate under load, any conforming pack | at least 30 frames per second at 70–100% system CPU load | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1); `spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) | verified for the shipped asset; **unverified** that it generalises to an arbitrary conforming pack |
| Layer transition latency | between 1.3 ms and 15.8 ms from writing an input to the first blended frame | `spikes/SP-3-electron-rive/REPORT.md#0-ket-luan` (Windows 2.9–15.1 ms, average 8.84 ms); `spikes/SP-3-electron-rive/macos/REPORT.md#0-ket-luan` (macOS 1.3–15.8 ms, average 11.06 ms) | verified for the shipped asset |
| Authored blend duration | between 150 ms and 250 ms | `contracts/rive-state-machine.schema.json`, carried unchanged from `1.0.0` | **unverified** — `req-005-electron-rive-pet-render/verification.md` already records that the measured quantity is the input-to-frame delay, which is a different quantity from the authored blend |
| Two-layer animation under simultaneous transition | 60 frames per second with no stutter | `spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q19, Q20); `spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q19, Q20) | verified for the shipped asset |
| Resident asset buffers during a pack swap | exactly one bound at any observed moment, with the incoming buffer bound before the outgoing one is released | `model.md` §Lifecycle & Eviction | **unverified** |

## Measurement Method

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Asset size ceiling | Assets spanning the boundary: well under, one byte under, exactly at, one byte over, and far over | 5 assets | Every asset at or under the ceiling is accepted and every asset over it is refused, with the refusal naming both figures. The boundary cases are the point of the corpus: a ceiling enforced with an off-by-one error would pass a coarser corpus |
| Frame rate generalising to an arbitrary pack | Packs differing in what actually costs frames — vertex count, number of simultaneously animating elements, artboard dimensions — spanning from simpler than the shipped asset to at the size ceiling, observed under the same 70–100% CPU load as SP-3 | 4 packs per operating system | Every pack holds at least 30 frames per second, or the pack characteristics at which it does not are recorded, so the figure is stated as a property of conforming packs rather than assumed from one asset |
| Layer independence | A pack implementing both layers, observed while a work status change is written during each locomotion state and while a locomotion change is written during each work status state | 20 combinations | Neither layer's animation restarts, freezes, or is visibly interrupted by the other's transition. This is a per-pack property, not a runtime property: a pack can couple its layers internally and still satisfy every schema |
| Resident buffers across a swap | A swap between two packs, observed with resident memory sampled continuously across the transition, repeated under idle and loaded conditions | 10 swaps per condition | The character is continuously visible, and resident asset memory at no sampled moment exceeds the sum of two assets — which is what distinguishes bind-before-release from a leak that happens to look correct |
| Replication of a pack | Account packs at several sizes up to the ceiling, replicated between two devices over a network representative of a home connection | 4 packs | Each arrives complete with its digest verifying, and the elapsed time is recorded. No threshold is asserted for the elapsed time, because none has been measured and inventing one would be worse than recording the observation |
| Persona prompt cost | Packs whose character descriptions span from empty to the 1,200-character bound, each issuing the same command | 4 packs | The contribution of the persona to each request is recorded. This establishes the figure rather than judging it: the bound exists to make the cost predictable, and predictability is what is being observed |

## Contract Conformance

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/pet-pack-manifest.schema.json` | A manifest whose asset path contains a directory separator or a parent reference is refused before any path is resolved, so no file outside the pack directory is ever opened on its behalf | `contracts/pet-pack-manifest.md` §Module Descriptor; the rejected example "an asset path that leaves the pack directory" |
| `contracts/pet-pack-manifest.schema.json` | A manifest declaring a major schema revision the build does not implement is refused whole, and no field of it takes effect | `specs/pet/spec.md` — "A pack declares the interface revision it was authored against" |
| `contracts/pet-pack-manifest.schema.json` | A pack whose manifest carries no persona cannot be created | `specs/pet/spec.md` — "A pack carries the persona specification the pet speaks under", scenario "A pack carries no persona at all" |
| `contracts/rive-state-machine.schema.json` | An asset declaring only the work status layer loads and presents its character, and an asset declaring neither layer does not | `specs/pet/spec.md` — "A pack declares which animation capabilities it implements and degrades per capability" |
| `contracts/rive-state-machine.set-state.schema.json` | A payload carrying an out-of-range value in one layer and a valid value in the other applies the valid one and holds the other layer's current value; a payload carrying neither layer changes nothing | `contracts/rive-state-machine.md` — rejected example "an out-of-range locomotion value"; §Error Matrix, `INVALID_STATE_VALUE` |
| `contracts/pet-pack-store.sql` | A row whose asset size exceeds the ceiling cannot exist in the store, whether it came from an import or from replication | `specs/sync/spec.md` — "A replicated pack is bounded in size" |
| `contracts/pet-pack-store.sql` | There is no observable moment at which the selection relation holds no row, including across the deletion of the pack it referenced | `specs/pet/spec.md` — "The pet is never absent because of a pack failure", scenario "The active pack is deleted"; `model.md` INV-PACK-04 |
| `contracts/pet-pack-store.descriptor.json` | The pack store replicates, resolves conflicts and erases on sign-out exactly as the descriptor declares, with no behaviour particular to packs appearing in the replication path | `specs/sync/spec.md`; `sync/contracts/replicated-store-descriptor@0.1.0` |

## Combination Matrix

This change belongs to two clusters: `desktop-shell` (`pet`, `app`, `uix`) and `account-sync` (`sync`,
`ledger`, `backend`, `platform`). Three dimensions therefore need combining, and the third is the one that
would otherwise be missed.

| Dimension | Values |
| --- | --- |
| Operating system | Windows, macOS |
| Pack provenance and capability | shipped default; built-in template, both layers; account pack, both layers; account pack, work status only |
| Device and connectivity state | single device online; second device receiving through replication; device offline with the catalogue unreachable |

The combinations that must be judged rather than inferred are the ones where two dimensions interact: an account
pack with only the work status layer, arriving by replication onto a second device of the other operating
system, exercises capability substitution, digest verification after transfer, and the platform's own rendering
path at the same time — and each of those has previously been measured only in isolation.

## Regression Scope

Every scenario of each capability below is re-judged when this change is realised, not only the deltas, because
each either changes behaviour or consumes a contract whose revision changed.

- `pet` — MODIFIED: three requirements restated, and the contract it owns raised to a major revision.
- `app` — MODIFIED: the settings area gains a surface, and one existing requirement is restated.
- `sync` — MODIFIED: the replicated set widens from records alone to records with a bounded binary.
- `backend` — MODIFIED: serves a catalogue and stores a new class of replicated payload.
- `uix` — consumer: the pet's visible state and its dialog surface present text that now originates from a
  pack's persona. No requirement of `uix` is edited, which is exactly why its scenarios are re-judged rather
  than assumed unaffected.
- `agent` — consumer: the pet-agent receives its persona from a pack. Its own requirements are unchanged, and
  the scenario in which a persona instructs it is judged here as AC-7 rather than there.
- `platform` — consumer: the pack storage locations sit under the paths this capability owns, and pack
  deletion on sign-out follows its wipe obligations.
- cluster `desktop-shell` (`pet`, `app`, `uix`) — cross-cutting: its combination matrix reruns, because the
  shared window stack and notification surface now present text originating from a pack.
- cluster `account-sync` (`sync`, `ledger`, `backend`, `platform`) — cross-cutting: its combination matrix
  reruns with a payload class it has not previously carried, since the pack store is the first replicated store
  holding a binary.

Compiled by `impact.md` §Regression Scope, which records the evidence for each entry.

## Manual Checks

- Reading the acknowledgement lines of every pack the product ships, to judge that each states receipt only — naming nothing from the command, asserting no understanding of it, promising no outcome. This cannot be judged mechanically: the schema can bound a line's length and not its meaning. — owner: product owner.
- Reading the character description of every pack the product ships, to judge that it describes a character rather than instructing an agent. The distinction is a matter of reading, and it is the check that keeps the persona boundary honest from the authoring side while the enforcement side keeps it honest structurally. — owner: product owner.
- Watching a pack that substitutes the default locomotion, to judge whether the composite reads as one character or as two. Nothing in the specification forbids a mismatch, and if the result is consistently jarring that is a product decision about whether to disclose it more strongly or to require both layers. — owner: product experience lead.
- Watching a pack swap on both operating systems, to judge that the character is continuously present rather than flickering, blanking, or jumping position across the transition. — owner: implementer, with the product experience lead accepting.
- Reviewing the persona of a pack authored in a language the reviewer does not read, to determine whether the product needs a review path for packs in languages the product owner cannot check. This is a process question surfaced by the specification rather than answered by it. — owner: product owner.

## Open Measurement Gaps

| Gap | What would close it | Owner |
| --- | --- | --- |
| No evidence exists for replication of a binary payload. `req-022-account-sync` measured records; the 5 MB ceiling was chosen to stay inside that envelope rather than because the envelope's edge is known | Replicating packs of several sizes between two devices and recording arrival time, failure behaviour on interruption, and backend storage growth. Until then the ceiling is a budget, not a finding | implementer, through a dedicated spike |
| The frame-rate and latency figures are verified for one shipped asset. Whether they hold for an arbitrary conforming pack is asserted by this change and measured by nothing | The four-pack corpus in §Measurement Method, run under the same load conditions as SP-3 on both operating systems | implementer |
| Whether the presence of a specific named layer input can be read from an asset's own headers, or only discovered at bind time, is unknown. `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6) covered loading and swapping, not per-input introspection | Reading a deliberately mismatched asset — declaring a layer it does not contain — and recording at which point the mismatch becomes detectable. The design works either way; what is unknown is whether the library can disclose the substitution before activation or only after | implementer, recorded as `design.md` R2 |
| The authored blend duration window of 150–250 ms remains unmeasured, carried unchanged from `1.0.0`. `req-005-electron-rive-pet-render/verification.md` already records that the measured 2.9–15.8 ms figure is the input-to-frame delay and a different quantity | Reading the blend durations out of a delivered asset, or observing a transition against a timed reference — a check that belongs to whoever accepts an asset | designer, with the implementer accepting the asset |
| The prompt cost a persona adds to each pet-agent request is bounded by declaration and measured by nothing. `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) established the latencies the product already works against and measured no relationship between persona length and latency | The four-pack corpus in §Measurement Method. The purpose is to establish the figure, not to judge it against a threshold that does not exist | implementer |
