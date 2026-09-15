# W1 post-merge review — `pre-w1-integration..dev`

Date: 2026-09-14. Range reviewed: `888f0b2` (tag `pre-w1-integration`) → `b07f187`, and the
work done on `dev` since. Machine: Linux; the Windows and macOS evidence comes from the
continuous-integration runs recorded below.

## Outcome

The merged tree is a faithful union of the five features: across the nine hand-resolved
conflict files, no statement, option, assertion, script or dependency present on a feature
branch is missing from `dev`. Every gate that was green before is still green, and the
suite is larger.

Eight defects were found that no static gate caught, and all eight are fixed. Seven carry a
test that failed before the fix; the eighth cannot execute on this machine and is recorded as
such. The most consequential were not in the merge resolutions themselves but in what the
composition of two features made true: an environment variable that one feature added as a
test hook chose where another feature's encrypted credential database was created; an instance
that lost the profile lock still opened that database; and the two features that both act on
the pet window were driving it by two different routes, with the specified per-pixel
click-through switched on by neither.

## What was fixed

### 1. An installed application accepted a profile directory from the environment

`apps/desktop/main/index.ts` honoured `DESKTOP_ASSISTANT_USER_DATA` unconditionally. The pet
rendering feature introduced that override so its Playwright specs could run against a private
profile, and it had no store to relocate. The credential store feature introduced
`credentials.db` under `app.getPath('userData')`, and it had no override. Composed, an
environment variable in shipped main-process code decides where the user's encrypted
connector credentials — and, once the ledger is wired, the append-only ledger — are written.
Because the override is the first statement in the entry point, the single-instance lock moves
with it, so the guard cannot notice the divergence either.

Anything able to set an environment variable on the application's launch (a shortcut, a
launcher, a login item) starts DesktopAssistant against an empty profile beside the real one.
The user sees no connected accounts, reconnects Notion or Gmail, and the new database is
written to that directory. Constitution VIII also applies directly: a development shortcut
shall not stand in for an official flow, and this one was reachable in the product path.

Fixed by `apps/desktop/main/user-data-override.ts`, a predicate in the shape the package
already uses for `shouldDisableHardwareAcceleration`, which returns the override only for an
unpackaged run. Three cases are covered in `apps/desktop/tests/desktop.test.ts`. Every
end-to-end spec launches `dist/main/index.cjs` unpackaged and is unaffected.

This one came from the independent review pass, not from my own three-way comparison.

### 2. A second instance on the same profile opened the database anyway

`app.quit()` was called when the single-instance lock was not acquired, but nothing stopped
`boot()`. Observed directly: with one instance running, a second process on the same profile
registered the window integration module, pre-warmed a card window, **opened `credentials.db`
in the profile the first instance already held**, created the pet window, and only then died
mid-load — the exact concurrent access the lock exists to prevent. The outcome is a race, so
it would not have failed the same way twice.

This came from the credential store feature, but only became reachable after the merge, when
boot also creates windows before quit can take effect. Fixed by exiting the process outright
and saying so. Guarded by `apps/desktop/tests/e2e/single-instance.spec.ts`, which failed
before the fix and passes after.

### 3. The soak runner still resolved the pet window by creation order

`apps/desktop/scripts/run-soak.mjs` called `electronApp.firstWindow()` — the same assumption
that broke all fourteen pet end-to-end tests during integration. The integration report states
the shared helper was applied to "the soak runner"; it was not. Reproduced on this machine:
the run dies after fifteen seconds waiting for a pet stage that the card window never contains.

Fixed to resolve by renderer identity, and the launch is now torn down when that resolution
fails, which previously left an Electron process behind. Guarded by
`apps/desktop/tests/e2e/soak-runner.spec.ts`, which starts the runner and asserts it reaches
the sampling loop; it failed before the fix and passes after in 1.8 s.

No eight-hour soak was run, per scope.

### 4. Continuous integration could never run on this branch

`.github/workflows/ci.yml` triggered only on `main` and `master`. The repository's main branch
is `dev`, and `origin/main` is gone. No Windows or macOS job has ever run on this tree, and
pushing `dev` would not have started one — which is why every cross-platform claim in the
feature reports rests on description rather than observation. `dev` is now in both triggers.

The same file also ran the Linux credential-store smoke, which invokes `xvfb-run`, before the
step that installs `xvfb` and the Electron display libraries. Each feature placed its step
correctly relative to the base file; the union put them in the wrong order. The install step
now precedes both consumers.

### 5. The topmost composition check measures capture exclusion on Windows and macOS

The pet window now gets `excludeFromCapture(win, true)` from the native window facade. That is
correct and required: `docs/spec/capabilities/uix/spec.md:525` says the pet is withheld from
the frames another application captures. But
`apps/desktop/tests/e2e/topmost-composition.spec.ts` proves stacking order with an
operating-system screen grab — `screencapture -x` on macOS, `Graphics.CopyFromScreen` on
Windows — which is precisely what capture exclusion defeats. The check passes here only because
the Linux fallback's `excludeFromCapture` does nothing.

The test now lifts content protection for the duration of the grab and restores it after, so it
measures stacking order rather than the exclusion. Linux stays green (16/16). **The behaviour
under test is UNVERIFIED on Windows and macOS** — see below.

## Second round: the three items first left open

All three were resolved after review. Each followed the same sequence — prove the cause,
write a test that fails, fix, re-run.

### 6. The native window capability had no caller in the product

`PetWindowControllerImpl` moved the pet with `win.setBounds()`, revealed it with
`win.showInactive()` and reasserted always-on-top with Electron's own
`setAlwaysOnTop` / `setVisibleOnAllWorkspaces`. It never called the platform facade. So two
features managed the same property of the same window by two different routes, and the
framework route ran *after* the native one on every reveal and on every application
activation.

Worse, per-pixel click-through was never switched on, although it is required twice over —
`docs/spec/capabilities/pet/spec.md:270` (pass clicks through transparent pixels via
`WM_NCHITTEST`, return `HTCLIENT` on the character) and
`docs/spec/capabilities/platform/spec.md:503` (the macOS module resolves pointer events
against the character's own opaque pixels). `select-window-integration.ts` even refuses to
start on Windows or macOS unless `setPointerPassthrough` reports a working capability, so
the product demanded a capability it then never used.

Resolved in three parts:

- `reassertAlwaysOnTop()` now calls `windowIntegration.applyNoActivateTopmost()`. On Linux
  the fallback performs exactly the two Electron calls the method used to make itself, so
  behaviour here is unchanged; on Windows and macOS the native styling is no longer
  contradicted by a framework call behind its back.
- `apps/desktop/main/pet-window/pet-pointer-mask.ts` turns a captured frame into the
  `PixelAlphaProvider` the facade samples. Electron returns BGRA on every platform, so the
  alpha byte is at a fixed offset and no per-platform channel order is involved. The native
  layer rescales the mask to the window, so the capture is used at its own resolution and
  never resampled. A capture whose length no supported display scale factor accounts for is
  refused rather than guessed at, and the previous mask is left in place.
- `refreshPointerMask()` supplies that mask when the pet is first revealed, when it is shown
  again, and after a character hot-swap — the three moments the silhouette changes. It is a
  no-op where the platform reports `setPointerPassthrough: 'unavailable'`, which is why
  Linux behaviour is untouched.

The controller now receives the facade through its constructor, which is the only signature
change; both construction sites were updated.

Covered by `tests/pet-pointer-mask.test.ts` (7) and `tests/pet-window-integration-seam.test.ts`
(5), all of which failed before the change. One assumption could not be settled by unit tests
— that a real Electron capture buffer's length is accounted for by the window's reported size
— so `tests/e2e/pointer-mask-capture.spec.ts` feeds the mask logic an actual capture of the
running pet and checks it separates character from padding. It passes here. **The native hit
test itself still needs Windows or macOS.**

### 7. Shared services could be read before boot published them

`windowIntegration`, `cardWindow` and `credentialStore` are always published during boot and
were read by nobody, so a later consumer reading one too early would have received
`undefined` with no compile error and no signal. They are now accessors that throw and name
the field, with `has…` companions for a caller that legitimately wants to ask. `petWindow`,
`appWindow`, `petController` and `tray` stay plain optional state, because whether they exist
is a real question; `tray` also carries a note that it is the only strong reference to the
tray icon and must not be removed as dead. Covered by `tests/desktop-context.test.ts`, which
failed before the change.

### 8. The lint suppression was removed

`'no-undef': 'off'` is gone from the `**/*.cjs` block. The recorded merge rationale was that
the credential store smoke script needs it; measurement showed otherwise, and `pnpm lint` is
clean without it, so the rule now applies to the three `.cjs` files that run outside the
typechecker.

## Found and deliberately not changed

- **`moveWithoutActivate()` still has no product caller.** The pet is positioned with
  `win.setBounds()` and revealed with `win.showInactive()`.

  A correction to an earlier draft of this report, which claimed non-activating placement is
  required only of the dialogue card: it is required of the pet too.
  `docs/spec/capabilities/pet/spec.md:317` says the locomotion engine SHALL move the pet
  window across displays at up to 60 frames per second *using non-activating window
  placement*. The reason to leave it is different from what was written, and narrower: that
  locomotion engine does not exist yet. The `setBounds()` calls in the controller today are
  display reconciliation — restoring saved bounds, following a detached monitor, reacting to a
  scale-factor change — not locomotion, and none of them activates the window. The obligation
  lands on the feature that makes the pet move.

- **The ledger-store suites import internal modules.** Every existing test reaches for
  `../src/opener.js` and similar, so none of them exercised the surface a consumer actually
  imports. Rather than change those suites, a consumer-boundary suite was added alongside them.

## Constitutional invariants on the merged tree

**Ledger before act, append-only (III).** State plainly: `packages/ledger-store` is wired to
nothing. `apps/desktop` does not depend on it and no call site outside the package invokes
`appendIntent`. Proving the invariant "through the merged wiring" is therefore not possible
today, and wiring one would be wave-2 work that was explicitly out of scope.

The strongest available proof was added instead:
`packages/ledger-store/tests/consumer-boundary.test.ts` imports only from the package's public
entry point and drives the sequence a wrapped tool call must follow. It shows the record is
readable from an independent connection at the moment the effect runs, that the effect is
withheld when the write fails, and that a failed write leaves no record behind. Three tests,
all passing.

**Credential store.** Verified through the real main-process IPC handler, not the package API.
The renderer surface is a single channel returning exactly `{ present, lastUpdated }`. Two gaps
were closed: a credential marked unreadable still yields exactly that shape and no `readable`
flag or secret material, and a store that cannot be read causes the handler to reject rather
than answer "not present" — which would have invited the application to overwrite a credential
it simply could not read. Both passed on first run; the invariants held, the coverage did not
exist.

**Backend data boundary.** Already well covered and re-run on the merged tree:
`full-flow-store-boundary.test.ts` dumps PostgreSQL and Redis and asserts no issued session
token, refresh token or provider token appears in either, and locks the schema to exactly four
tables. The broker returns provider tokens to the client and persists none. 9 files, 48 tests,
all green.

## The four assumption groups

1. **Module registration order.** Clean. In the Electron composition root every context field is
   written before it is read: the window integration module is first and supplies
   `windowIntegration` to the pet and app window modules; the tray module reads `petController`
   and `petWindow` after the pet module has written them, through optional access. In Fastify,
   the database, Redis and rate-limit plugins are registered before the routes that decorate
   from them, and the session guard is constructed before any route that uses it.
2. **Selection by position rather than identity.** Two hits, both fixed: the soak runner
   (item 3) and the window-integration driver (below). All remaining window lookups match on
   title or renderer URL.
3. **IPC channels registered twice.** None. Six product channels, each registered once; every
   preload method maps to a handler, and no handler is unreachable from the bridge.
4. **Shared operating-system resources.** None. One database name, `credentials.db`, in the
   profile directory; the ledger has no path yet. One lock, one tray tooltip, one application
   name; the background helper used by the composition check deliberately names itself
   differently. The backend binds one configurable port and its tests run without file
   parallelism. Test temporary directories all use distinct prefixes.

## Duplication at the seam

Little, and mostly justified. `CredentialStoreError` and `LedgerStoreError` follow the same
shape but are package-private and domain-specific; the two SQLite openers differ in the pragmas
they must set. Neither should be merged across the package boundary.

The one real duplication is my own: the window locator now needed by two plain-ESM runners and
by the TypeScript specs. The two runners now share
`apps/desktop/tests/helpers/window-locator.mjs`. The typed `pet-window.ts` used by the specs
remains separate because the runners sit outside the TypeScript program and the package does
not enable `allowJs`. Collapsing the last copy would mean changing that compiler setting, which
is beyond a proven defect.

## Measurements on the merged tree, after the fixes

| Gate | Before | After |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | passes | passes |
| `pnpm contracts:check` | passes | passes |
| `pnpm lint` | passes | passes |
| `pnpm typecheck` | 8 packages | 8 packages |
| `pnpm test` | 27 files, 226 tests | 32 files, 259 tests |
| `pnpm build` / `build:check` | passes | passes |
| `pnpm package:unsigned` | `SQLITE_NATIVE_READY`, `CREDENTIAL_STORE_PACKAGE_READY` | same |
| Credential store smoke, Linux | `CREDENTIAL_STORE_LINUX_FAIL_CLOSED_OK` | same |
| Pet end-to-end, headless Linux | 14 passed | 17 passed |
| `test:e2e:window-integration` | skipped, exit 0 | skipped, exit 0 |
| `native:build`, `native:test` | skipped, exit 0 | skipped, exit 0 |

No orphaned Electron or Xvfb processes remain.

## UNVERIFIED at the time of the local review

What follows is the state before continuous integration could run. The section after it records
which of these were subsequently settled by a real Windows and macOS run, and which were not.
The three exit-zero skips are **not** evidence of anything. On this Linux machine:

- **The window-integration end-to-end suite has almost certainly never run at all.** It skips on
  Linux, its author worked on Linux, and continuous integration could not run on this branch.
  Reading it showed the suite was largely inert by construction: every harness call went through
  `ElectronApplication.evaluate`, which executes in the main process where `window` does not
  exist, so each call threw and fell into a `.catch()` that reached for the first window — the
  pre-warmed card, which has no node integration. The card-handle and `webContents.id`
  stability assertions sat inside `if (initialCardInfo && currentCardInfo)` and were skipped in
  silence, and the pet lookup had an `|| windows()[0]` fallback onto the same card. The driver
  is rewritten to resolve both windows by identity and to invoke the harness from a page that
  has node integration, with no swallowing branches. **This is the one fix with no
  fail-before-fix evidence**, because the suite cannot execute here; its proof must come from
  the first Windows and macOS run.
- **Capture exclusion and the topmost composition check (item 5)** are reasoned from the code and
  the specification, not observed. On Linux the fallback makes the conflict invisible.
- **The native pointer hit test (item 6)** is wired and its mask is verified against a real
  Electron capture here, but the native call itself is a no-op on Linux. That a click on
  transparent padding actually reaches the window underneath can only be observed on Windows or
  macOS — the window-integration suite covers exactly that scenario and will now run.
- **Native window integration and the pet frame-rate figures** cannot be measured here at all.

Everything above becomes checkable on the first real continuous-integration run, which the
trigger fix now makes possible.

## Settled by the first real Windows and macOS runs

Continuous integration had never executed on this repository. Once the trigger was fixed, fifteen
runs were needed to get it green, and every failure it exposed was a pre-existing defect on a
path no local check could take: an already-built machine, an already-running service, a POSIX
path, or one operating system per developer. The list below is what those runs established.

**Now proven on Windows and macOS.**

- The window-integration end-to-end suite runs. Its rewritten driver resolves both windows by
  identity and invokes the harness from a page with node integration, and the suite executes
  rather than falling through swallowed errors. Fixing it exposed two further defects that
  no reading had found: the harness was silently dying because `tsup` bundled `electron` into
  it, and once its output was relayed the application turned out not to start on macOS at all,
  because the no-activate styling threw on a window that was not a panel.
- The native modules compile and load. Neither had ever been built. The macOS addon called a
  Node-API function that does not exist, and the Windows crate named modules that `windows-sys`
  does not place where the code expected them.
- The packaged application loads its native modules from inside the bundle on the platform they
  belong to: `SQLITE_NATIVE_READY`, `CREDENTIAL_STORE_PACKAGE_READY`, and additionally
  `WIN32_WINDOW_NATIVE_READY` on Windows and `MACOS_WINDOW_NATIVE_READY` on macOS, each with
  the physical `.node` binary verified outside `app.asar` for the right architecture. This job
  had never run before, because it waits on the quality job.
- The topmost composition check passes on Windows. The pet is found above a background window
  and the background shows through its transparent padding, with capture exclusion suspended for
  the grab and restored afterwards. Getting there corrected a diagnosis stated earlier in this
  review: the Windows capture failure was blamed on the absence of an interactive desktop
  session, citing SP-0. Surfacing the command's error output showed a PowerShell parse error
  instead — evidence that correctly explains the focus failure had been transferred onto a
  symptom it did not explain.

**Measured, and it changed a conclusion.** An in-process capture survives content protection:
on macOS `capturePage()` returned a frame whose alpha-boundary scan passed while the same run's
operating-system grab found the pet entirely absent. But capture exclusion applied by the native
module cannot be lifted from outside the process, so the operating-system demonstration has no
macOS route that does not require the product to carry a verification mode. This settles the
open question below and is recorded in `docs/spec/changes/req-027-transparency-capture-layer/`.

**Still unproven, and only a machine with an interactive desktop session can prove it.** The
focus-retention scenarios of the window-integration suite, the eight-hour soak, and the pet
frame-rate figures on Windows and macOS. A hosted runner executes in a background session
rather than the active input desktop, which `spikes/SP-0-gui-harness/REPORT.md` §Q2 records as
the reason its own harness had to bind to `WinSta0\Default`. Running those checks on a hosted
runner would report a fact about the session, not about the product.

## Unresolved questions

- The conflict between `docs/spec/capabilities/uix/spec.md:525` and
  `docs/spec/capabilities/platform/spec.md:179` is no longer an open question about what is
  true, only about what the specification should say. The living specs were not edited, per
  scope; the change `req-027-transparency-capture-layer` carries the proposal, and its
  recommendation is settled against measurement: the operating-system layer on Windows and
  Linux, the in-process layer on macOS, with the compositing claim recorded as undemonstrable
  there. It still needs the rest of its planning artifacts and an approval before sync.
- Should `DESKTOP_ASSISTANT_USER_DATA` remain reachable in packaged builds for support or
  portable-profile purposes? It is now gated to unpackaged runs. If a packaged escape hatch is
  wanted, that is a product decision and needs a different mechanism than an environment
  variable.
- `dev` is pushed and every job is green. Pull request #1 was marked merged by an accidental
  push of `dev` itself while the review branch was checked out; the independent full-range
  review therefore runs against a new pull request opened from `dev` onto a branch pinned at
  `888f0b2`, which exists only to carry that diff and must never be merged.
- The pointer mask is refreshed when the pet is revealed, shown again, and after a character
  swap. It is therefore a snapshot of one animation frame, so a click very close to the
  silhouette's edge during a large animation may be judged against a slightly stale outline.
  Refreshing per frame is not affordable. Neither `pet` nor `platform` states a cadence; the
  specification should say what accuracy is expected here.
- The five feature worktrees still exist and their branches are merged; removing them is your
  call.
