# Independent review of the wave-1 integration range

Date: 2026-09-14. Pull request #2, `dev` into `w1-integration-base` (pinned at `888f0b2`).
Range: 212 files, roughly 28,000 added lines. The pull request is a review surface and must
never be merged.

## Outcome

The post-merge review that preceded this one looked at the seams between the five features,
because that is where the merge could break things nobody owned. This review looked inside
the features themselves, which no one had re-read since their authors verified them in
isolation. It was carried out by four reviewers working in parallel over four ownership
boundaries, and every finding below was checked against the source before being accepted —
two of the four reviewers additionally executed their claims rather than inferring them.

Five defects were found that would be classed as critical, and all five are fixed, tested and
pushed. Roughly thirty further defects are recorded here and are **not** fixed; several of
them are controls that read as implemented but cannot fire, which is the more dangerous shape
because the next reader will trust them.

The diff exceeds the limit the pull-request API will render, so the review could not be run
as a single pass. That is worth recording as a fact about this range rather than a complaint:
a body of work this size does not get reviewed as one diff by a person either.

## The five critical defects, and what each one actually did

**An installed application loaded its renderers from an address in the environment.** Both
window modules decided whether to use a development server purely by whether the variable was
set. The preload bridge attaches to a window, not to an origin, so a renderer loaded from an
address someone else chose would hold the same credential-presence and pet surfaces as the
real one. The navigation guards do not cover this, because they only see navigation the
renderer starts, not a load the main process performs itself. The pet asset path had the same
shape: read in the main process, its bytes handed to the renderer's animation parser.

This is the same defect class as the profile-directory override fixed in the previous round,
and it is the clearest lesson of this review: that fix was applied to one variable while two
siblings sat in adjacent files. All three now go through one module whose only job is that
decision, so the next such variable has an obvious place to be declared.

**Database backups defaulted into the working tree, and four dumps were committed.** A dump
holds every account, device, session and invitation row the service has. The scheduled command
in the operations runbook runs from a checkout, so a production backup would land where the
next commit picks it up — and the repository's own secret scanner did not look there. I
verified the committed dumps contain no real address, so nothing has leaked and published
history is not rewritten. A path inside the checkout is now refused rather than discouraged,
the default lives outside the repository, the directory is ignored and the scanner covers it.

**The ledger wrote the user's deletion confirmation for them.** Deleting by user request
destroys history and the material an undo would replay, which is why the lower-level call
demands an explicit acknowledgement that undo will be lost. The entry point on the store's own
interface synthesised that acknowledgement itself, so the gate could refuse nothing, and the
resulting immutable record asserted a human decision nobody had made — in a store whose
records can never be corrected by editing. The same call discarded the actor it was given and
dropped the age boundary of a user deletion.

**An interrupted credential erasure resumed as a silent no-op.** The marker that survives a
crash recorded only the trigger, scope and start time; the set of classes the erasure was
allowed to reach was recomputed from whatever the next launch happened to have registered. A
launch registering fewer classes erased nothing, cleared its own marker, and reported the
disconnect complete while the credential was still decryptable. The allowed set is now
recorded with the marker, and an erasure that cannot say what it must reach keeps its
obligation instead of declaring itself done.

**The Windows pointer hit test made the pet undraggable.** The subclass procedure answered
every position itself and never passed the message up, so the framework layer that turns a
press on the character into a window drag was never reached. The pet could be seen and
clicked but not moved, and only after per-pixel hit testing was switched on — so it would
present as the pet becoming undraggable some time after startup. It now answers only for
transparent pixels and delegates everywhere the character is drawn, which is what the macOS
side already did. Removing the superseded helper also made the crate's unit tests compile
away from Windows for the first time.

## Found and not fixed

These are recorded rather than repaired. They are real, each has a stated failure scenario,
and none of them is a style preference.

**Controls that read as implemented but cannot fire.** The backend's log redaction uses
partial-key wildcards that its redaction library does not support, so twenty-two of its
twenty-six configured paths do nothing; today nothing logs a token, so the requirement is
satisfied by accident rather than by the control. Device revocation is never written by any
code path and is cleared by the next sign-in, so a revoked device re-enrols itself. The
per-request invitation-revocation check cannot match a revoked row, because revoking also
clears the column the check joins on; the requirement holds only because the same transaction
revokes the sessions. On the desktop side, the result of applying capture exclusion to the pet
window is discarded, so a failure on macOS would put the pet into every screen share for the
session with nothing logged.

**Native calls that report success after the operation did not happen.** Installing the
Windows subclass ignores its return value; the macOS class-pair swizzle sets its association
before the swizzle succeeds, so a failure both reports success and poisons every later attempt;
the macOS capture-exclusion entry point ignores the status of its boolean accessor, so a
non-boolean argument makes the window shareable and returns true. No test exercises either
addon with a valid window handle, which is why none of these can be caught in continuous
integration.

**Verification scripts that can pass without measuring anything.** The soak harness reads
memory from the first renderer in the metrics list, which is the pre-warmed card window sitting
on a blank page, so an eight-hour run would report a leak-free result for the wrong process.
The packaging check selects whichever unpacked directory is listed first, and this working tree
already contains a Linux one, so a macOS build in the same tree would verify a stale foreign
artifact and print success. The credential-store security smoke test has no exit on its failure
path, so a genuine failure hangs rather than failing. The no-C++-toolchain proof uses `which`,
whose absence is indistinguishable from the tool's absence, so the step would certify the
opposite of its claim on an image that has no `which`.

**Correctness defects inside the features.** An expired approval request can never be resolved
and never becomes expired, because the status update is rolled back by the exception thrown
immediately after it. Retention expiry deletes the intents of jobs that are still in flight,
destroying their recovery and undo material. An interrupted removal can make the ledger
permanently unopenable. Ledger text queries silently return incomplete results and cannot match
several fields they appear to search. A superseded pet-pack activation reports success, so the
main process commits the wrong pack identity and rebuilds the pointer mask from the wrong
silhouette. An unhandled rejection during quit kills the main process before the credential
database closes. The two addons disagree on the alpha threshold, so the clickable silhouette
differs between Windows and macOS.

**Boundaries worth a decision rather than a patch.** The backend applies no allowlist to the
OAuth scopes a client asks for, so any holder of a beta session can obtain a consent screen for
full mailbox access under the project's own client credentials — the read-only boundary is
enforced only by the client that asks. Account deletion revokes third-party grants before the
step designed to fail closed, so a failed deletion leaves the account intact with every
connector silently dead. Refresh rotation has no reuse detection and no absolute lifetime, so a
detected replay — the clearest signal of theft — is discarded and the stolen branch survives
indefinitely.

## What was verified and is clear

Recorded so it is not re-litigated. The ledger's append-only triggers hold against external
updates and deletes, including from a separate process and the command-line client, and the
trigger drop during removal is transaction-scoped with no visible window. Crash-injection tests
are genuine: a spawned worker killed with a signal, not a mock. No secret material leaves the
credential store — presence returns exactly the two declared fields, its error type carries no
message, and the plaintext canary test over the database and its sidecars is a real assertion.
The backend persists no third-party token anywhere, has no injection and no reachable
server-side request forgery, and every route outside health, version, updates and sign-in sits
behind the session guard. Both addons validate that a window handle belongs to the calling
process before acting, copy the alpha buffer rather than retaining a pointer into
JavaScript-owned memory, and are sound against a hostile width, height and buffer triple. The
Electron windows all set context isolation, sandboxing and no node integration, and there are no
duplicate channel registrations across the five features.

## Verification

The full suite is 36 test files and 278 tests, all passing, against 32 files and 259 tests
before this review and 27 files and 226 tests at the pre-review baseline. Lint, typecheck,
build and the static build checks are clean. Every fix above carries a test that failed before
it. The Windows crate's unit tests now run away from Windows as well.

## Unresolved questions

- Roughly thirty defects above are recorded and not fixed. They sit inside feature interiors
  rather than at the seams this review was originally scoped to, and repairing them is a
  larger body of work than the range it would be attached to. Whether to take them now, fold
  them into wave 2, or triage them against the beta date is a scheduling decision.
- Is client-chosen OAuth scope intentional? If it is, the read-only boundary for mail and
  drive should be restated as a client convention rather than an enforced property.
- Should device revocation be an operator capability at all? Nothing writes it today, so the
  choice is between implementing it and removing it with both of its check sites.
- Which alpha threshold is the contract for pointer hit testing? The two addons currently
  disagree, and neither the contracts package nor either type declaration states which is
  intended.
- The pull-request diff exceeds what the API will render. If this range is to receive a human
  review as well, it needs splitting into reviewable units, and the natural split is the five
  feature boundaries.

---

## Addendum: what was taken from the "found and not fixed" list

Written after the repository was republished. Everything below is on `dev` with all seven
continuous-integration jobs green, and each fix carries a test that failed before it unless
stated otherwise.

**Checks that could pass without measuring anything.** The endurance run read memory from the
first renderer listed, which is the hidden card window on a blank page, so an eight-hour run
would have reported a flat result whatever the pet did; it now selects by the pet's process
identity. The packaging check verified whichever unpacked directory the filesystem listed
first, and this tree already holds a Linux one, so a macOS build here would have verified the
Linux artifact and printed success; it now selects by the platform being packaged. The proof
that no C++ toolchain is present relied on `which`, whose absence is indistinguishable from
the compiler's — demonstrated in a container carrying three C++ compilers, where the old
expression printed its success line and exited zero. The credential store's security check had
no exit on its failure path, so a plaintext leak would have surfaced as a job timeout.

**Controls that read as implemented and could not fire.** Twenty-two of the backend's
twenty-six log-redaction paths matched nothing, because the library matches path segments and
has no notion of a key name at arbitrary depth; redaction now walks the record by key name.
Device revocation was cleared by the next sign-in, so re-enrolment — exactly what whoever
holds a lost device would do — lifted it. The per-request invitation check looked the
invitation up by the column revocation clears, which a schema constraint requires to be null
for any status but redeemed, so the rejection could never fire.

**Native calls reporting success after the work did not happen.** Four of them: the Windows
subclass installation ignored its result and stored the mask first; the mask was released only
if the window still existed; the macOS swizzle recorded the original class before succeeding,
poisoning every later attempt; and the boolean accessor ignored its status, so a non-boolean
argument made the window shareable and returned true. The Windows module also gained the
owning-thread check the macOS module already required, both loaders now keep the real load
failure, and the two modules now agree on where the pointer stops falling through.

**Correctness.** An expired approval request was marked expired inside the transaction that
then threw, so the mark was rolled back and the request could never leave the pending list. A
superseded pack activation reported success, so the main process committed the wrong pack's
identity. Handing a pack to a destroyed window left an unread rejection that ended the process
before the credential database closed.

**A gate that was not running.** Three packages compiled only `src` while the repository
treats a green typecheck as proof. Turning it on found sixteen real type errors, including
five options objects passing a `message` the error type deliberately does not accept — so
those strings were discarded at runtime and the distinctions they claimed never existed.
Turbo's cache was hiding some of them; the forced run is the one that counts.

### Reverted after checking the specification

Retention removing the records of jobs still in flight was fixed, and the fix broke two
existing scenarios. `docs/spec/capabilities/ledger/spec.md:145` requires retention to remove
records that pass the period with no exception for unfinished jobs; only deliberate user
deletion carries the warning that undo becomes impossible. The change was reverted. The hazard
is real — a long-suspended job crossing the boundary loses the pre-write snapshot that
recovery and undo depend on, while its row still advertises a live state — but it is a
contradiction inside the specification rather than a defect in the code, and the specification
was not edited.

### Measured, not argued

An Intel macOS runner could not be obtained: a job requesting one stayed queued for
twenty-three minutes without starting, and no Intel macOS image appears in the last hundred
runner-image releases. This is not proof the label was withdrawn, only that the architecture
cannot be covered in hosted continuous integration in practice. It matters because the
platform capability promises macOS 13 or later, which includes Intel hardware, and the x64
native module has never been compiled anywhere.

### Still open, and each one a product decision

- The backend applies no ceiling to the OAuth scopes a client requests, so any holder of a beta
  session can obtain a consent screen for full mailbox access under the project's own client
  credentials, while the stated boundary is read-only mail and drive.
- Account deletion revokes third-party grants before the step designed to fail closed, so a
  failed deletion leaves the account intact with every connector silently dead.
- Refresh rotation has no reuse detection and no absolute lifetime, so a replay — the clearest
  signal of theft — is discarded and the stolen branch survives indefinitely.
- Whether Intel Macs are supported at all, or the promise narrows to Apple Silicon.
- Whether retention or undo wins for a job that outlives the retention period.
