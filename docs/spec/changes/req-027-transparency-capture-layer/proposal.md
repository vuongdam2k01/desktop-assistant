# Transparency capture layer

## Why

Two living requirements cannot both be demonstrated on the pet window, because one asks for a capture that the other deliberately makes impossible. The specification never says at which layer transparency is to be shown, so the contradiction only surfaces when someone tries to verify it.

## Problem

The platform capability requires that transparent window regions render as transparent, and its scenarios ask for *a capture of the window area* that shows the background through those regions. That requirement is evidenced by `spikes/SP-0-gui-harness/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, and the spike demonstrated it with an operating-system screen grab — `System.Drawing` with Win32 GDI `BitBlt` bound to the active input desktop (`spikes/SP-0-gui-harness/src/screenshot.ps1`, REPORT §Q2).

The uix capability requires that the pet window and its speech bubble be excluded from the frames another application captures, evidenced by `spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q29) — VERIFIED: window content protection removes the window from other applications' capture streams. An operating-system screen grab is one of those streams.

So on the product's own primary window the two are mutually exclusive. Whoever has to demonstrate the transparency requirement — the continuous-integration suite today, a release gate later — receives a frame with no pet in it, and cannot tell a genuine transparency regression from capture exclusion working exactly as intended. The pet is the one window the transparency requirement most matters for, and it is the one window where the demonstration now reads as a false negative.

This surfaced when the two features that own these requirements were merged onto one branch and run together for the first time. Neither feature was wrong on its own.

## Cost of inaction

The transparency requirement stops being verifiable on the window it exists for. A real regression — a compositor configuration lost on Windows, hardware acceleration re-enabled in a virtual machine, an alpha channel dropped after an Electron upgrade — would produce the same blank region as correct capture exclusion, so nothing would flag it. Meanwhile the project's evidence discipline would be nominally satisfied by a check that measures the wrong property, which is worse than having no check, because it invites confidence.

## Options

### Option A — Name the layer, and allow a demonstration to lift the exclusion
- **Sketch**: The transparency requirement says explicitly which capture layer its scenarios speak about, and states that a demonstration performed at the operating-system layer suspends the pet's capture exclusion for the duration of that demonstration and restores it afterwards. Capture exclusion itself is unchanged; nothing the user sees changes.
- **Appetite**: small (days)
- **Trade-offs**: Resolves the contradiction without depending on any fact that is still unknown, and matches what a demonstration has to do in practice anyway. It does add a sentence whose only audience is whoever writes the verification, which is a mild cost in requirement prose.
- **Rabbit holes**: Drifting into specifying the verification harness itself. The requirement should name the layer and the obligation, not the tool.

### Option B — Move the demonstration to an in-process capture only
- **Sketch**: The requirement is restated so that transparency is shown by capturing the window from inside the application rather than from the operating system, which content protection is believed not to affect.
- **Appetite**: small (days)
- **Trade-offs**: Needs no suspension of capture exclusion, and the product already has such a check. But it rests on an unverified belief: no spike measured whether an in-process capture survives content protection on Windows or macOS. It also weakens the requirement, because an in-process capture proves the renderer produced alpha, not that the operating-system compositor honoured it — which is the property the original spike set out to establish, in the sessions where it is most likely to fail.
- **Rabbit holes**: Quietly reducing a compositing guarantee to a rendering guarantee while the requirement text still reads like the stronger claim.

### Option C — Do nothing; record the contradiction
- **Sketch**: Both requirements stay as written, and the conflict lives in a report.
- **Appetite**: small (hours)
- **Trade-offs**: Costs nothing now and keeps the specification stable. But the contradiction is load-bearing: it decides whether a failing transparency check means a defect or means the product is working. Leaving it unresolved hands that judgement to whoever happens to read the failure next.
- **Rabbit holes**: None; the hazard is the opposite — it looks free.

## Recommendation

**Option A where it has a route, Option B where it does not.** When this proposal was written, both options rested on an unmeasured belief, and Option A was recommended because it was the one that did not. Both beliefs have since been measured, and the answer is not the same on every platform; the section "Measured since this proposal was written" records what was observed and where.

Windows and Linux keep Option A. The pet's capture exclusion is applied there through the application's own framework call, so the application can lift it for the duration of a demonstration and restore it afterwards, and the operating-system grab then sees exactly what the compositor produced. That is the stronger claim — the one SP-0 established, and the one that catches a compositor misconfiguration, a virtual machine falling back to a software path, or an alpha channel lost after an upgrade.

macOS takes Option B. The exclusion there is applied by the native module, which refuses a window handle that does not belong to the calling process, so nothing outside the application can suspend it. Giving macOS an operating-system route would mean the shipped product carrying a mode that exists only to make verification possible, and principle VIII forbids a development shortcut standing in for the real path. The in-process capture is measured to survive content protection on macOS, so the rendering claim is demonstrable there without any such mode.

The cost is stated plainly rather than hidden: on macOS the requirement is demonstrated one layer lower, and a compositor-level regression that the renderer does not see would go unobserved on that platform alone. That is the honest consequence of a capability the platform deliberately does not offer, and it is recorded as a known gap rather than papered over with a check that measures the wrong property.

## What Changes

- The platform requirement "Transparent window regions render as transparent in every supported session" states the capture layer each of its scenarios refers to, rather than leaving the layer unsaid.
- Where the demonstration is performed at the operating-system layer, the requirement carries an explicit obligation: the pet's capture exclusion is suspended for the duration of that demonstration and restored afterwards.
- Where the platform does not permit an external party to suspend that exclusion, the requirement names the in-process layer instead and records that the compositing claim is not demonstrable on that platform.
- No product behaviour changes. Not **BREAKING**: no contract, stored data, or observable behaviour is affected.

## Capabilities

REQUIRES spec-impact

### New Capabilities

None.

### Modified Capabilities

- `platform`: the requirement "Transparent window regions render as transparent in every supported session" — its scenarios gain the capture layer, and the requirement gains the suspension obligation. No other requirement in the capability changes.

The uix requirement "The pet is withheld from screen sharing and screen recording" is **not** modified. It is correct as written; the conflict is entirely in the other requirement's silence about layer.

## Impact

- Verification only. `apps/desktop/tests/e2e/topmost-composition.spec.ts` already suspends capture exclusion around its operating-system grab, so it becomes the demonstration the requirement describes rather than an undocumented workaround.
- `apps/desktop/tests/e2e/pet-rendering.spec.ts` performs an in-process alpha-boundary scan. It remains valid as a rendering check and is unaffected by this change either way.
- No application code, API, dependency, or persistent data is touched.
- Two active changes own the requirements in question — `req-002-gui-spike-harness` owns the platform requirement and `req-023-macos-platform-baseline` owns the uix one. Neither is archived, so impact analysis has to say whether this change supersedes part of `req-002` or layers on top of it.

## Refs

None. This project declares no upstream traceability anchor.

## Constitution check

- **Evidence Discipline**: this change is the direct application of that section. Both sides of the contradiction are cited to spike reports, and the recommendation is chosen specifically to avoid resting on an unmeasured assumption.
- No principle is violated. Principles I–VIII are untouched: no agent orchestration, approval gate, ledger write, irreversibility declaration, input normalisation, connector surface, account-owned data, or official flow is affected.

## Assumptions

- Suspending capture exclusion inside a verification run is acceptable, because it happens on a test machine and is restored immediately. If the project would rather never suspend it even under test, the in-process layer becomes the only route on every platform and the requirement drops to the rendering claim throughout.
- A demonstrable claim that differs by platform is preferable to a uniform claim that is false on one of them. If the project would rather the requirement read identically everywhere, it should name the in-process layer for all three platforms and accept the weaker claim on Windows and Linux as well.

## Measured since this proposal was written

An in-process capture **does** survive content protection. On a macOS runner, with capture
exclusion applied through the native module, `capturePage()` returned a frame in which the
alpha-boundary scan passed and the pointer mask separated the character from its padding. The
same run's operating-system screen grab reported the pet entirely absent — every pixel of its
rectangle read as background — so the exclusion was genuinely in force at the time.

Option B is therefore a measured route rather than an assumption.

It also showed that capture exclusion cannot be lifted through Electron's own
`setContentProtection` on macOS, because the native module set it; the Windows integration uses
Electron's API and therefore reverses cleanly. Any demonstration that suspends the exclusion has
to do so through the same mechanism that applied it.

**This removes Option A's route on macOS specifically.** The native module validates that a handle belongs to the calling
process, so only the application's own code can lift what it set. A demonstration running
outside the application therefore cannot suspend the exclusion on macOS at all, and the only way
to give Option A a macOS route would be for the product to carry a verification mode — which is
the kind of development shortcut in a product path that principle VIII exists to prevent.

The Windows side has since been measured rather than assumed. On a Windows runner, the
operating-system screen grab ran with the pet's capture exclusion suspended around it and the
demonstration passed: the pet was found above a background window, and the background showed
through the pet's transparent padding. Windows applies the exclusion through Electron's own
`setContentProtection`, so the application can reverse it and the grab sees what the compositor
actually produced. Linux never applies an exclusion at all, so the demonstration was always
available there.

So the shape that now fits the evidence is per-platform rather than single-layer: the
operating-system demonstration on Windows and Linux, measured to work, and the in-process
demonstration on macOS, also measured to work. Option A therefore keeps its route on two of the
three platforms and loses it only on macOS, where Option B's route is the one that exists. The
Recommendation above is written against that evidence rather than against the state of knowledge
this proposal opened with.
