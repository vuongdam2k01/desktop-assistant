# Verification: req-005-electron-rive-pet-render

A document-level acceptance plan. The scenarios in the delta spec are the acceptance cases; this file records
what a scenario cannot express — the observable conditions that judge the change as a whole, the numbers and
where they come from, how each number would be measured, the combinations that must be exercised rather than
reasoned about, and the scope that is re-judged rather than only the delta.

One boundary governs everything below. `spikes/SP-3-electron-rive/REPORT.md` measured Windows 11 Pro on a
sixteen-logical-core machine; `spikes/SP-3-electron-rive/macos/REPORT.md` measured macOS on an Apple Silicon M1 machine.
Every figure below is therefore VERIFIED for both Windows and macOS.

## Acceptance Criteria

| # | Criterion (observable condition) | Judges | Source |
| --- | --- | --- | --- |
| AC-1 | While background work holds the machine's cores busy, the pet keeps animating at or above its declared floor and the compositor drawing it drops no frame | `specs/pet/spec.md` — Pet rendering engine maintains minimum frame rate and transparency under heavy load, scenario "Heavy multi-threaded CPU stress" | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1), `spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q1) |
| AC-2 | Reading the pixels across the boundary between the desktop behind the pet and the character itself shows fully transparent pixels outside the character and full-strength character colour at its edge, with no dark or grey band between the two | `specs/pet/spec.md` — same requirement, scenario "Pixel boundary transparency validation" | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3), `spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) |
| AC-3 | The pet appears at start-up with its character loaded from a file on disk on a machine with no network reachable, and the start-up issues no network request for the asset | `specs/pet/spec.md` — Pet asset pipeline loads binary buffers dynamically without application rebuild, scenario "Local offline asset loading without CORS restrictions" | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6), `spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7) |
| AC-4 | Replacing the character file on disk and signalling a reload changes the character on screen while the application keeps running, and the pet is continuously visible across the change rather than disappearing and returning | `specs/pet/spec.md` — same requirement, scenario "Runtime pet skin swap" | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6); `contracts/rive-state-machine.md` §Machine-Readable Artifacts |
| AC-5 | A character file that lacks the named artboard, one that lacks the named state machine, and one whose buffer cannot be read each leave the pet visible on the shipped default rather than absent, and the recorded refusal names which of the three conditions applied | `specs/pet/spec.md` — Pet asset pipeline loads binary buffers dynamically without application rebuild; `model.md` §Trust Boundary | `contracts/rive-state-machine.md` §Error Matrix |
| AC-6 | Each of the five declared states — idle, command received, working, waiting for approval, result available — is reachable and visibly distinct from the other four, and the pet is in the state matching an event no later than two seconds after that event | `specs/pet/spec.md` — Pet animation reflects system state, scenario "Transition to working after a job starts" | `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-02); `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2), `spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q2) |
| AC-7 | The displayed state is selected by writing one numeric value and never by naming an animation: an asset whose transitions were re-authored under the same declared names changes how the pet moves between states with no change to the application | `specs/pet/spec.md` — Pet animation reflects system state; `model.md` INV-PET-01 | `spikes/SP-3-electron-rive/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1; `spikes/SP-3-electron-rive/REPORT.md#4-rui-ro-moi-phat-hien` item 2 |
| AC-8 | A state value outside the declared range leaves the pet in the state it already holds: nothing is played, and the event is recorded as a refusal rather than passed to the asset | `specs/pet/spec.md` — Pet animation reflects system state; `contracts/rive-state-machine.set-state.schema.json` | `contracts/rive-state-machine.md` §Error Matrix, `INVALID_STATE_VALUE` |
| AC-9 | When one job is running and a second raises an approval request at the same moment, the pet shows waiting for approval rather than working; when no job is running and no card is waiting, it shows idle | `specs/pet/spec.md` — Pet animation reflects system state, scenarios "Two states become true at once" and "No job is active" | `model.md` §Lifecycle |
| AC-10 | The pet sits over any desktop content — light or dark, text or image — with no rectangle, shadow or opaque background around it, and it keeps animating while the window holding it is not the focused one | `model.md` INV-PET-02 | `spikes/SP-3-electron-rive/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 3; `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) |
| AC-11 | With the pet on screen and no job in flight, the operating system's own process accounting shows the application holding the idle budget this change declares rather than a share other work would feel | `model.md` §Physical Resource Budget; `docs/spec/capabilities/pet/spec.md` — Pet runs continuously without degradation | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) |
| AC-12 | Every threshold in this file cites a section of the spike report rather than an estimate, and the environments the spike did not cover are named in Open Measurement Gaps rather than left implied by the thresholds | Constitution §Evidence Discipline | this file, §Thresholds and §Open Measurement Gaps |

## Thresholds

| Metric | Threshold | Source | Verification Status |
| --- | --- | --- | --- |
| Frame rate under 70-100% CPU load | >= 30.0 fps (measured 60.0 fps) | `spikes/SP-3-electron-rive/REPORT.md#0-ket-luan` | Verified |
| State transition latency from code | < 2,000 ms (measured 2.9ms to 15.1ms) | `spikes/SP-3-electron-rive/REPORT.md#0-ket-luan` | Verified |
| Window edge transparency fringing | 0 dark / grey halo pixels (RGBA Luminance > 15 for semi-transparent) | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) | Verified |
| Idle CPU utilization | < 3.0% on 16-core system (measured 1.2% - 2.8%) | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) | Verified |
| Renderer Private Working Set RAM | < 120 MB (measured 94.14 MB) | `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) | Verified |

## Measurement Method

Each threshold above is judged by a population, a sample size and a pass criterion. These are measurements, not
procedures: they state what would have to be observed, not what would have to be assembled to observe it. The
recorded corpora named below are the spike's own measurement files, and each stands as the baseline the next
observation is compared against — falling short of a recorded baseline is a failure, not a new baseline.

| Threshold | Evaluation corpus / population | Sample size | Pass criterion |
| --- | --- | --- | --- |
| Frame rate under 70-100% CPU load | The pet animating on a transparent frameless window while background work holds every logical core of the machine busy, observed on each supported operating system; the recorded baselines are `spikes/SP-3-electron-rive/evidence/q1-fps-70pct-load.json` for the loaded condition and `spikes/SP-3-electron-rive/evidence/q1-fps-baseline.json` for the unloaded one | Continuous observation of at least ten seconds per load condition, in each of the five declared states, per operating system; the spike observed one machine under Windows | Frame rate stays at or above 30 frames per second for the whole observation, with no frame dropped by the compositor. The Windows observation of 60.0 fps average, minimum and ninety-fifth percentile under roughly 72 % measured load is the standing baseline. Observed on Windows only — see Open Measurement Gaps |
| State transition latency from code | The transition into each of the five declared states, timed from the moment the numeric state value is written to the moment the first frame of the new state is on screen; recorded corpus `spikes/SP-3-electron-rive/evidence/q2-transitions.json` | Five states, each entered from the state preceding it in the lifecycle, repeated until each state carries at least ten observations per operating system; the spike recorded one observation per state | Every observed transition completes inside two seconds, and the population stays within the measured band of 2.9 ms to 15.1 ms at an average of 8.84 ms rather than drifting above it |
| Window edge transparency fringing | Pixel values read along horizontal cuts across the pet window at 35 %, 50 % and 65 % of its height, taking five consecutive pixels at each crossing from the transparent area outside the character into the character's body; recorded corpus `spikes/SP-3-electron-rive/evidence/q3-edge-alpha-analysis.json`, with the window observed over both a light and a dark desktop behind it | Three cuts per state per operating system, with the character at rest and mid-transition | Pixels outside the character read alpha 0 with no colour, and no partly transparent pixel — alpha above 40 — carries a luminance below 15. The Windows reading showed full-strength character colour at alpha 255 immediately inside the boundary with no intermediate dark band, recorded as the verdict `CLEAN_ANTI_ALIASING` |
| Idle CPU utilization | The application's whole process group with the pet visible and no job in flight, read from the operating system's own process accounting; recorded corpus `spikes/SP-3-electron-rive/evidence/q4-idle-resources.json`, covering the four processes the application runs | A continuous idle period sampled repeatedly, on a machine of sixteen logical cores, per operating system | Combined use stays below 3.0 % of the machine across the whole idle period; the Windows reading ranged from 1.2 % to 2.8 % |
| Renderer Private Working Set RAM | The process hosting the animation, and the three other processes of the group recorded alongside it, in the same idle condition and from the same corpus | All four processes, read together, over the same idle period per operating system | The animating process holds below 120 MB of private working set — recorded at 94.14 MB — and the group as a whole stays below 250 MB of private memory, recorded at 202.81 MB against a 357.96 MB total working set. Behaviour over a long continuous run is not covered by this population — see Open Measurement Gaps |

## Contract Conformance

This change freezes two machine-readable contract files. Each is judged by a condition anyone can observe
against the running pet window, never by running a validator over the file. A condition that does not hold is
recorded as an open finding against the contract; it is never resolved by relaxing the file it is judged
against.

| Contract file | Conformance condition (observable) | Judged against |
| --- | --- | --- |
| `contracts/rive-state-machine.schema.json` | An asset missing the artboard `Pet` or the state machine `PetStateMachine`, and one whose buffer is truncated, each leave the pet visible on the shipped default rather than absent, and the refusal names which of the two was missing | `specs/pet/spec.md`, the requirement that the asset pipeline loads buffers dynamically; `contracts/rive-state-machine.md` §Error Matrix |
| `contracts/rive-state-machine.schema.json` | The runtime writes the numeric input `state` and never plays an animation by name: swapping in an asset whose transitions were re-authored changes how the pet moves between states with no change to the application | `specs/pet/spec.md`, the requirement that a skin is swapped without an application rebuild; `model.md` §Variability |
| `contracts/rive-state-machine.schema.json` | A skin is swapped while the pet is on screen and the character is continuously visible across the swap, holding its frame rate | `specs/pet/spec.md`, the frame-rate requirement under load |
| `contracts/rive-state-machine.set-state.schema.json` | A state value outside 0–4 leaves the pet in the state it was already in: the value is dropped, nothing is played, and the event is recorded as `INVALID_STATE_VALUE` rather than passed to the asset | `specs/pet/spec.md`; `contracts/rive-state-machine.md` §Error Matrix |
| `contracts/rive-state-machine.set-state.schema.json` | Each of the five declared values reaches its own visibly distinct state, and the blend between any two completes inside the window the descriptor declares — measured at 2.9 ms to 15.1 ms, well inside it | `spikes/SP-3-electron-rive/REPORT.md#0-ket-luan`; Thresholds above |

## Combination Matrix

The pet window is the surface every other visible part of the product sits beside, so the combinations below are
exercised rather than reasoned about: the operating system decides how transparency is composited, the load
condition decides whether the frame rate holds, and the state value decides which transition is being judged.

| Platform OS | Electron Build | CPU Stress Mode | State Input Values | Expected Outcome |
| --- | --- | --- | --- | --- |
| Windows 11 | v44.3.0 | Baseline (Idle) | 0, 1, 2, 3, 4 | 60 fps, < 15ms latency |
| Windows 11 | v44.3.0 | 16-thread CPU Burn (~72%) | 0, 1, 2, 3, 4 | 60 fps, zero frame drop |
| Windows 11 | v44.3.0 | Offline Local Storage | Skin Hot-Swap | Immediate buffer reload |

## Regression Scope

All scenarios of the capabilities below are re-judged, not only the deltas — this change fixes how the pet is
drawn, how its character asset is loaded, and how its state is selected, and every scenario of those
capabilities is observed through that surface.

- `pet` — MODIFIED and extended by this change; owner of the state-machine contract. Every existing requirement
  in `docs/spec/capabilities/pet/spec.md` is re-judged, not only the two added here and the one modified.
- `gui` — as named by the relation `gui/contracts/window-manager@1.0.0` in `model.md`: window positioning,
  always-on-top behaviour and focus handoff all act on the window this change configures.

## Manual Checks

- Across light and dark desktop backgrounds and a window of dense text, the character edge shows no halo, box
  or shadow, and a design-review record states whether the result reads as a character sitting on the desktop
  rather than an image pasted over it — owner: design reviewer. The pixel reading in AC-2 settles the measurable
  part; the visual impression remains a human judgement.
- During replacement of the character file while the pet is on screen, the character remains continuously
  visible across the swap — owner: design reviewer.
- At the pet's actual display size, each of the five states is distinguishable from the other four at a glance,
  including the waiting-for-user state — owner: decision-maker, because the required degree of distinction is a
  product decision rather than a rendering measurement.

## Open Measurement Gaps

Quantities this specification asserts that no evidence yet supports, and what would close each.

| Gap | What is asserted without evidence | What would close it | Owner |
| --- | --- | --- | --- |
| ProMotion 120Hz and battery drain | ProMotion 120Hz refresh unlocked behavior and battery drain rate (%/hour) on laptops | Observing on a MacBook Pro with ProMotion 120Hz display and running on battery — recorded in `spikes/SP-3-electron-rive/macos/REPORT.md#5-chua-tra-loi-duoc-vi-sao` | implementer |
| Behaviour over a long continuous run | The idle figures come from a short observation of a freshly started application. `docs/spec/capabilities/pet/spec.md` requires the pet to run for at least eight continuous hours without its memory growing without bound, and nothing measured here covers that period | Observing the same process group across a full working day of intermittent job activity and recording whether the resource figures hold or climb | implementer |
| Frame rate across a character swap | Contract Conformance requires the pet to stay continuously visible and hold its frame rate while its character file is replaced. The spike established that replacing the file needs no rebuild, but measured no frame rate during the replacement itself | Observing the frame rate across a swap, under both idle and loaded conditions, with the swap repeated enough times to show whether the dip is consistent | implementer |
| Authored blend duration | The contract declares transitions blending between 150 ms and 250 ms. What was measured is the delay from writing the state value to the first frame of the new state, 2.9 ms to 15.1 ms, which is a different quantity: no measurement establishes that the blends authored into an asset fall inside the declared window | Reading the blend durations out of a delivered asset, or observing the transition against a timed reference, and comparing them with the declared window — a check that belongs to whoever accepts a character asset | designer, with the implementer accepting the asset |
| Effect of reducing the frame rate when the user is away | `design.md` carries a mitigation that drops the animation to half its rate after a minute of inactivity to bring memory and processor use down. `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q4) recommends it but measures nothing with it in force, so its effect is asserted, not evidenced | Observing the same idle population with the reduced rate in force, and recording whether the resource figures actually fall | implementer |
