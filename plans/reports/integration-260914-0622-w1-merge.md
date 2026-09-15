# W1 integration report — five parallel features merged into `dev`

Date: 2026-09-14. Base before integration: `888f0b2` (tagged `pre-w1-integration`).
Head after integration: `2f39f0b`.

## Outcome

All five wave-1 features are merged into `dev` and the whole workspace passes every gate
together, not only in isolation. One genuine cross-feature defect was found and fixed during
integration; without it the pet rendering suite failed completely on the merged tree.

## What was merged

Each worktree carried its work uncommitted. The work was committed on its own branch first, then
merged into `dev` with a merge commit per feature, in an order chosen so that the owner of a shared
file merges before the features that only touch it as an integration point.

| Order | Branch | Commit | Conflicts |
| --- | --- | --- | --- |
| 1 | `feat/f01-ledger-local-store` | `9f83bfa` | none |
| 2 | `feat/f10-backend-slice` | `61cc169` | none |
| 3 | `feat/f03-credential-store` | `10718f0` | lockfile only |
| 4 | `feat/f17-pet-rendering` | `4f7b32b` | composition root, desktop package manifest, preload bridge, lockfile |
| 5 | `feat/f18-native-window-integration` | `1a0ed6c` | CI workflow, desktop context, pet window module, packaging script, eslint config, desktop package manifest, lockfile |

The lockfile was never merged by hand. Every conflict in it was resolved by discarding both sides and
regenerating from the merged package manifests with `pnpm install`.

## Integration decisions that were not mechanical unions

**Pet window construction now goes through the native window facade.** The pet feature created its
window with transparency, frameless chrome, no shadow, no taskbar entry and, on macOS, a panel window
type written inline. The native window feature supplies exactly those properties per operating system
through `browserWindowOptions('pet')`, including the macOS panel type and a Linux fallback that returns
the same set. The facade now owns them; the pet feature keeps only what the facade does not express —
its geometry constants, non-resizable and non-maximizable flags, the initially hidden state, and its
navigation and popup denial. Always-on-top is likewise delegated: on Linux the fallback performs the same
`setAlwaysOnTop` and `setVisibleOnAllWorkspaces` calls the pet feature had written inline, while Windows
and macOS get the native implementation.

**The user-data override now runs before the single instance lock.** The credential store introduced a
single instance lock to prevent concurrent database access, and the pet feature introduced a
`DESKTOP_ASSISTANT_USER_DATA` override so tests can run against a private profile. Merged naively, the
lock would have been taken against the default profile directory before the override applied, so a second
instance under a different profile would have quit instead of starting. The override is now the first
statement in the main entry point.

**The commonjs lint relaxation was kept.** Both features independently added a `**/*.cjs` block to the
eslint configuration and only one of them disabled `no-undef`, which the credential store smoke script
needs. The union keeps the relaxation, which is a superset and breaks nothing on the other side.

**The packaged-application smoke script now probes both subsystems.** The two features each appended
their own probe to the generated script and their own marker assertion. Both probes and both assertions
are retained, so packaging verifies the SQLite binding, the native window capabilities on Windows and
macOS, and the credential store module in one run.

## Cross-feature defect found and fixed

On the merged tree every pet rendering end-to-end test failed, including all fourteen that had passed on
the feature branch. The cause is not a merge artefact. The native window feature pre-warms a hidden card
window during its registration module, which runs before the pet window is created. The pet tests obtained
their page with `electronApp.firstWindow()`, so they received the blank card window, whose document never
contains the pet stage element, and timed out waiting for it.

The assumption that the pet is the first window was only ever true while the pet feature stood alone. The
fix is a shared helper, `apps/desktop/tests/helpers/pet-window.ts`, that resolves the pet window by its
renderer URL rather than by creation order, used by the pet rendering suite, the performance and stress
suite, the topmost composition check, and the soak runner. Product behaviour was not changed: pre-warming
the card window at startup is a declared requirement of the native window feature.

## Verification on the merged tree

| Gate | Result |
| --- | --- |
| `pnpm contracts:check` | passed, contracts in sync with `docs/spec` |
| `pnpm lint` | passed, eslint clean and no byte-order marks |
| `pnpm typecheck` | passed, 8 packages strict clean |
| `pnpm test` | passed, 8 tasks, 27 test files across backend, ledger store, credential store, desktop, contracts and build check |
| `pnpm build` | passed, 6 tasks |
| `pnpm build:check` | passed, harness pin, SQLite binding, native packaging and byte-order mark checks |
| `pnpm package:unsigned` | passed, packaged application emitted `SQLITE_NATIVE_READY` and `CREDENTIAL_STORE_PACKAGE_READY` |
| Credential store native smoke, Linux | passed, emitted `CREDENTIAL_STORE_LINUX_FAIL_CLOSED_OK` |
| Pet end-to-end suite, headless Linux | passed, 14 of 14, including the alpha boundary scan and topmost composition check |
| Window integration end-to-end | skipped by design on Linux, exit 0 |
| `pnpm native:build`, `pnpm native:test` | skipped by design on Linux, exit 0 |

## Not verified on this machine

The native window integration and the pet rendering frame-rate measurements require Windows and macOS.
Their end-to-end suites and native builds deliberately skip on Linux, and the merged tree has not yet been
exercised on the Windows and macOS runners. The continuous integration workflow covers both, and the
merged workflow now runs the window integration suite inside the native target step and the pet suite in
its own steps on all three operating systems.

## Unresolved questions

- Should `dev` be pushed to `origin` now, or held until the Windows and macOS continuous integration run
  on the merged tree reports green?
- The five feature worktrees still exist and their branches are merged. Removing them is your call.
