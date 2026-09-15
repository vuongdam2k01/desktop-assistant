# Settling the open items left by the wave-one post-merge review

Date: 2026-09-14. Follows `plans/reports/review-260914-0723-w1-post-merge.md`.

## Outcome

Every item that review left open is now either decided with evidence behind it, or tied to a
named experiment that decides it. Nothing is left as a standing "we should look at that".

## Constraints

The living specification changes only through an active specdocs change. Quantitative
thresholds and platform capabilities cite a spike report or are marked UNVERIFIED — vendor
documentation and mechanism reasoning are not proof. This machine is Linux, so anything that
needs Windows or macOS has to be scheduled rather than measured. No wave-two feature is added.
A decision already verified by source or measurement is not reversed without new evidence.

## Non-goals

Wiring the ledger into a call path, building the locomotion engine, running the eight-hour
soak, and drafting the remaining artifacts of the specification change beyond its proposal.

## Acceptance

Each open item carries a decision and its evidence, or the experiment that will decide it and
when it runs. Errors in the previous report are corrected rather than left standing.

---

## What the research changed

### The specification conflict is real, not a layering misunderstanding

The attractive reading was that the two requirements speak about different capture layers —
an in-process capture for transparency, an operating-system capture for exclusion — and so
both hold. That reading does not survive the source.

`spikes/SP-0-gui-harness/REPORT.md` §Q2 shows the transparency claim was established with an
operating-system screen grab: `System.Drawing` with Win32 GDI `BitBlt` on the active input
desktop, in `src/screenshot.ps1`. `spikes/SP-18-pet-liveness/macos/REPORT.md` §Q29 shows
content protection removes the window from exactly those streams, VERIFIED on macOS. The
requirement that asks for a capture and the requirement that prevents one are pointed at the
same window.

This matters beyond tidiness: while the contradiction stands, a failing transparency check
cannot be told apart from the product working correctly.

### The per-pixel hit test has no empirical basis at all

No spike ever built an alpha mask from live rendered content. `SP-7-pet-window-os` specified
the `WM_NCHITTEST` mechanism; the spike that actually ran used Electron's
`setIgnoreMouseEvents()` with `document.elementFromPoint`. There is no measurement of the cost
of building a mask, no refresh cadence, no statement of how stale a mask may be, and no
comparison of the character's silhouette across animation states.

So it is not only the cadence I chose that lacks evidence — the whole approach does. That is
now recorded as UNVERIFIED rather than presented as a considered threshold.

### A load-bearing unknown was hiding underneath both

The pet window has capture exclusion applied, and the mask is built by capturing that same
window. Whether an in-process capture survives content protection on Windows and macOS is not
measured anywhere. If it does not, the mask cannot be built on those platforms and the
existing alpha-boundary check fails there too.

This is the one unknown worth paying to resolve, and it costs nothing: the alpha-boundary scan
already runs on all three operating systems, so the first real continuous-integration run
answers it.

### A correction to the previous report

It claimed non-activating window placement is required only of the dialogue card. That is
wrong. `docs/spec/capabilities/pet/spec.md:317` requires the locomotion engine to move the pet
window using non-activating placement. The conclusion — leave it — is unchanged, but the
reason is narrower: the locomotion engine does not exist yet, and the `setBounds()` calls in
the controller today are display reconciliation, not locomotion.

---

## Decisions

| Item | Decision | Why |
| --- | --- | --- |
| Specification conflict | Open a change and carry the clarification through the specdocs workflow | The contradiction decides how a failing check is read; leaving it hands that judgement to whoever meets the failure |
| Pointer mask approach | Keep the capture-based mask, fix its timing, mark it UNVERIFIED, let the continuous-integration run decide whether it holds on Windows and macOS | It is already built and is the cheapest of the three to abandon; the deciding experiment is already scheduled and free |
| Push and pull request | Push and open the pull request now | It is the only way to run the experiment the other two decisions wait on |
| Profile override in packaged builds | No escape hatch | Principle VIII forbids a development shortcut standing in for an official flow, and principle VII already makes recovery a matter of signing in |

### Options weighed for the pointer mask

**Keep the capture-based mask (chosen).** Already written and covered by tests, including one
that feeds the mask logic a real Electron capture. Its load-bearing assumption is that an
in-process capture survives content protection; it fails first on Windows or macOS, and the
scheduled run says so immediately. Cheapest to abandon, because nothing else depends on it.

**Read the pixels in the renderer instead.** The renderer owns the Rive canvas and can read it
with `getImageData`, so it never touches an operating-system capture and knows exactly when it
has painted. Immune to the unknown above. Rejected for now only because it costs a new channel
across the process boundary and renderer work, to buy protection against a risk that a free
experiment is about to measure. It remains the fallback if that experiment goes the wrong way.

**Remove the wiring and wait for a spike.** Honest, but it throws away working code to wait for
a measurement that the scheduled run partly supplies, and leaves a specified capability
unimplemented for longer with nothing gained.

### What was fixed as a result

The mask was captured synchronously at the moment the pet was revealed, before anything was
necessarily painted. A capture taken then comes back fully transparent, and a fully transparent
mask makes every click pass through — the pet would have been completely uninteractive. The
capture now waits for the renderer to paint, and a mask with nothing opaque in it is refused
outright rather than installed.

---

## What the continuous-integration run found

The first real run on this tree failed, and every failure predates the wave-one merge. They had
simply never had a chance to appear.

- The repository declared no line-ending normalisation, so a Windows checkout rewrote every
  committed file to CRLF while the contract generator still emitted LF. The drift check compares
  bytes, so every contract reported drift. No Windows contributor could have passed this either.
- The `build-check` tests drive the package's own compiled binary, but the test task waited only
  for its dependencies to build, not for itself. They failed wherever tests ran before a build.
- The `build-check` entry point carried a fallback that imported `src/cli.js` when the build
  output was missing. The source is TypeScript, so that file never exists; the fallback could
  only ever fail with a module-resolution error. It had been invisible because any machine that
  had run a build took the other branch.
- The ledger immutability scenario required the `sqlite3` command-line binary on Linux. That
  binary is not part of the product, and it is absent from the toolchain-free container the
  project itself builds in, so the scenario failed there on a missing dependency rather than on
  its subject.
- The workflow ran the whole suite without starting anything, so every backend integration test
  failed on a refused connection to PostgreSQL and Redis. Those tests had only ever passed on a
  developer machine that happened to have the stack already running — including this one, which
  is why the local baseline looked clean.

All five are fixed, and each fix is verified here by reproducing the state it needs — a checkout
with no build output, a machine with no `sqlite3` — rather than by reasoning about it.

The last one forced a boundary that had never been written down: the backend is a Linux service,
and GitHub's Windows and macOS runners cannot host PostgreSQL and Redis. Its tests now run on
Linux against the services the repository already declares in its compose file, rather than a
second copy of those definitions inside the workflow, and are excluded explicitly on the other
two platforms rather than skipped in silence.

Clearing those let the run reach further, and three more appeared — each one a path no local
check on this machine could have taken.

- **The macOS native addon had never been compiled.** `native/macos-window/src/macos_window.mm`
  calls `napi_get_value_boolean`, which does not exist; the Node-API function is
  `napi_get_value_bool`. Everything the feature report says about that module — its capability
  map, its ARC and macOS 13.0 targeting — rests on a source tree that does not build, because
  the work was done on Linux where the native target skips. A static sweep of the file's other
  Node-API symbols found no second mistake, but Objective-C++ cannot be compiled here, so only
  the run confirms it.
- **`pnpm build` could never have run on Windows.** The desktop build script spawns `pnpm`
  without a shell, and `pnpm` is a `.CMD` there, which cannot be spawned directly. It surfaced
  as a null exit code with no reason attached. Two sibling scripts already passed `shell: true`;
  the build, packaging and dev scripts had missed it, so the packaging job was carrying the same
  defect a step behind.
- **The topmost composition check waited a fixed 1500 ms** for a second Electron to cold start
  before measuring the screen. The run reported `petPixelCount: 7415` with
  `bgPixelCountDesktopTotal: 0` — the pet was captured, the background never appeared — so the
  check failed reporting the wrong thing entirely. It now waits until the background is actually
  on screen. This is the same shape as every other defect in this review: a timing assumption
  that happens to hold on the machine where it was written.

On the Ubuntu runner, sixteen of seventeen end-to-end tests passed, including all three added by
this review, and the toolchain-free container went green. With the wait fixed, Ubuntu went green
in full on the next run.

Clearing those reached two more, both of which had been silent rather than loud.

- **Eight command-line entry points could never run on Windows.** Each decided whether it was
  being invoked directly by comparing `import.meta.url` against a hand-built `file://` plus
  `process.argv[1]`. On Windows that path is a drive letter with backslashes, so the comparison
  never matched: the script exited with status zero and printed nothing. The `build-check` tests
  saw an empty stdout and a success code and reported eight failures that named none of this.
  Two scripts in `packages/contracts` already used `pathToFileURL`; the rest now do.
- **The macOS addon test asserted its error codes against the message text.** Once the addon
  compiled, its AppKit core tests all passed and the module threw `INVALID_NS_VIEW` exactly as
  intended — and the test rejected it, because the message reads "Invalid handle buffer length".
  The assertions now read the `code`.

The Windows addon test was deliberately left matching on the message. `napi-rs` carries the code
there via `Error::from_reason`, so message matching is correct for it. The two test scripts
differ because the two modules genuinely differ.

With those cleared the macOS native module went green in full — it compiles, its AppKit core
tests pass, and its handle-validation checks pass. Two more defects surfaced behind them.

- **The build-check binary imported its compiled entry point by absolute path.** On Windows that
  is not a URL the module loader accepts, and it failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME`
  naming the drive letter as the protocol. The same shape as the direct-run guards: a path
  handed to something that wanted a URL.
- **The window-integration harness bundled Electron into itself.** Its entry points are compiled
  with `tsup`, which externalises a package's `dependencies` but not its `devDependencies`, and
  `electron` is a devDependency. Inside Electron the harness therefore reached the npm shim
  rather than the module Electron provides, and sat printing "Downloading Electron binary..."
  until the launch timed out three minutes later.

The second of those is worth noting for how it was settled. The suite cannot run on this
machine, but its compilation can: building the harness both ways here showed the entry point at
4.94 KB with the shim inlined, and at 1.84 KB with a plain require of `electron` once it was
externalised. A defect that only manifests on Windows and macOS was still proved by measurement
rather than argued from the error message.

### The two findings that matter most

**The desktop application could not start on macOS.** Applying the topmost styling routed
entirely through the native module, which throws `INVALID_WINDOW_KIND` when the window is not
an NSPanel. The card window is pre-warmed during module registration, so that throw reached
`boot()` and the application exited. This is not a test problem: the product does not run on one
of its two target platforms.

The fix rests on the project's own evidence rather than on preference. The capability map already
declares `presentWithoutActivating: 'framework'` for macOS, and
`spikes/SP-7-pet-window-os/macos/REPORT.md` §Q1 measured plain Electron achieving focus
protection at ten out of ten, concluding the native module is needed for pointer hit testing
(Q2) and workspace collection behaviour (Q3) rather than for focus. So the framework behaviour
is applied first and kept when the native styling does not apply, while a handle that does not
belong to this process is still refused. Why Electron did not produce an NSPanel for
`type: 'panel'` here, when the spike obtained one on the same Electron version, is not answered
and is recorded below.

The first version of that fix was itself wrong, and running the suite caught it within one
round. It applied the framework behaviour before calling the native module, which broke the
foreign-handle check — that check passes a bare object carrying only a handle — and, worse,
meant a *successful* native call was followed by framework calls over the top of it. That is
the same two-owners-one-window defect this review had already fixed once in the pet controller,
recreated a layer below it. Ownership is now established first, the native module keeps sole
ownership where its styling lands, and the framework is used only on the branch where it does
not. The lesson is narrow and worth keeping: a fix that places two calls next to each other has
to say which one owns the result, and not saying so is what produced the original defect.

**The Windows native module had never compiled either.** It imported the window subclassing
entry points from `Win32::UI::Controls` and `ScreenToClient` from `Win32::UI::WindowsAndMessaging`;
in `windows-sys` those live in `Win32::UI::Shell` and `Win32::Graphics::Gdi`, and the crate
declared neither feature.

An earlier pass in this session checked the declared features against the symbols the code used
and reported no mismatch. That check was worthless: it confirmed the features covered the modules
the code *named*, not that the code named the *right* modules — it could only ever agree with
itself. The correction was to stop reasoning and install a Rust toolchain with the Windows
target, which reproduced both errors here and now compiles the library and its tests clean
without needing a Windows machine. The correct module paths were read out of the vendored
`windows-sys` source rather than recalled.

---

### A third appearance of the same root cause

Importing `electron` as a value in a plain Node process runs the npm package's shim, which
goes looking for a binary. That is what bundled the shim into the window-integration harness,
and it turned out to be happening in the unit tests too: the suites had been printing
"Downloading Electron binary..." for several runs while still passing, so it read as noise. On
macOS two vitest workers reached the shim at once, raced over the same extraction, and one
failed on a file that already existed.

The noise was the warning, and it was ignored because the tests were green. Unit tests here
drive their subjects through injected fakes and never need a real Electron, so vitest now
resolves the module to a stub that throws a named error if something reaches for a capability
it should have been given instead. The end-to-end suites launch the real application and are
untouched.

### What the Windows and macOS runs finally established

The Windows native module compiles, its eight Rust unit tests pass, and its handle validation
and error codes pass. The macOS module does the same. The window-integration suite reached and
passed its first assertion ever — a foreign window handle is refused with `FOREIGN_HWND` — which
also confirms the rewritten transport reaches the harness.

It then failed on `FakeEditor must remain focused`, and that one is not a product defect. A
hosted runner executes in a background session, not the active input desktop.
`spikes/SP-0-gui-harness/REPORT.md` §Q2 records exactly this: its own harness had to bind a
thread to `WinSta0\Default` through `OpenInputDesktop` to escape the "handle is invalid" error
that a background runner on a secondary desktop produces, and SP-7 measured the focus guarantee
on a real user desktop. Measuring focus where nothing can hold it reports on the session rather
than on the product.

The suite is therefore no longer invoked on hosted runners, with that reason recorded at the
step. This is deliberately not the same as the silent skip this review criticised: the skip
claimed coverage that did not exist, whereas this states where the measurement cannot be taken
and leaves the requirement assigned to a machine that can take it. The suite stays UNVERIFIED
until such a machine exists.

### The load-bearing unknown is settled

An in-process capture survives content protection. On macOS, where the exclusion goes through
the native module, the alpha-boundary scan and the pointer-mask capture check both passed, while
the same run's operating-system grab showed the pet entirely absent from its own rectangle. So
the pointer mask stays as built and does not need to move into the renderer, and the
specification change can offer an in-process demonstration route alongside the operating-system
one.

The same measurement exposed a further asymmetry between the two native modules. The Windows
integration implements capture exclusion with Electron's own `setContentProtection`, so the
Electron call reverses it; the macOS integration goes through the native module, and Electron's
setter does not undo that. That is the third form of the same defect this review keeps meeting:
two paths managing one property, with no statement of which one owns it.

The attempt to reach the native module from the test failed twice over, and the second failure
is the informative one. `require` is not available inside an `electronApplication.evaluate`, and
routing around that does not help either: the native module validates that a handle belongs to
the calling process, so a call from the test runner is refused as a foreign handle. Only the
application's own code can lift what that code set.

The operating-system composition check therefore does not run on macOS. This was measured rather
than assumed — the pet returned zero pixels while the window behind it captured normally — and
it has a consequence for the specification change: its recommended option asks a demonstration
to suspend the exclusion, and on macOS nothing outside the application can. Giving that option a
macOS route would mean shipping a verification mode in the product, which is what principle VIII
exists to prevent. The change now has a decision to make that it did not have when it was
written, and that is recorded in its proposal rather than settled here.

## Still open

- Whether an in-process capture survives content protection on Windows and macOS. The
  continuous-integration run answers it; the answer decides whether the pointer mask stays as
  built or moves into the renderer, and whether the specification change can offer a second
  demonstration route.
- The cadence of the pointer mask refresh. It is a snapshot taken at reveal, at show, and after
  a character swap, and no evidence supports any cadence, including that one. It needs a spike
  that measures the cost of a refresh and compares silhouettes across animation states.
- `docs/spec/changes/req-027-transparency-capture-layer` carries a proposal only. The remaining
  artifacts, and the decision whether it supersedes part of `req-002-gui-spike-harness`, follow
  the normal specdocs workflow.
- Why Electron does not produce an NSPanel for `type: 'panel'` on the card and pet windows,
  when `spikes/SP-7-pet-window-os/macos/src/electron-pet/main.js` obtained one with the same
  Electron version and the same combination of transparency and framelessness. The application
  no longer fails because of it, but the native panel styling — screen-saver level and joining
  every space — is not being applied, and that is a real capability the spike measured.
- The two native modules report the same class of failure through different properties: the
  Windows one puts the code in the message, the macOS one sets a `code` on the error. The
  `WindowIntegration` facade passes both shapes through without normalising, so a caller wanting
  to tell a foreign handle from an invalid one has to handle both. The `native-window-manager`
  contract does not state an error shape, so this is unspecified rather than a violation, and
  settling it means changing that contract.
- The window-integration suite still has no environment that can run it. It needs a Windows
  machine with an interactive desktop session; the same is true of the eight-hour soak, which
  exceeds the six-hour cap on a hosted job, and of the pet frame-rate figures on both target
  platforms. One persistent machine per target platform would settle all three.
- The five feature worktrees still exist and their branches are merged; removing them is the
  maintainer's call.
