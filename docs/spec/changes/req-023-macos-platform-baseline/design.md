## Context

Twenty spikes measured this product on Windows and Linux. The macOS half of every platform requirement was
written from those measurements and marked unverified, with the reasoning recorded in `docs/spike-inputs.md`
§5. Eight macOS spikes have now run on Apple Silicon, macOS 26.5.2, APFS with FileVault on. Most of what they
found confirms the existing design; this document covers only the parts that do not, and how the design absorbs
them without splitting the product into two products.

The constraint that shapes everything below is that the two operating systems disagree in mechanism far more
than in behaviour. The user-visible promises — the pet never eats a keystroke, a recorded step is never lost,
an update does not cost you your connectors — are identical. What satisfies them is not.

## Goals / Non-Goals

**Goals:**
- State the macOS obligations where they differ from Windows, in the capability that owns the behaviour.
- Keep the platform difference behind one surface, so no caller branches on the operating system.
- Make the signing identity a stated architectural constraint rather than a release-week checklist item.

**Non-Goals:**
- Specifying Intel Macs. One machine was measured, and it was Apple Silicon.
- Specifying the screen-awareness features of M3. This change fixes the permission floor they will have to
  respect; it does not design them.
- Re-verifying what macOS confirmed. Frame rate, transparency, state-machine latency, asset loading, crash
  atomicity and the architecture choice for the moving pet all matched Windows and are cited in the reports
  without new requirements.

## Structure

Three components carry the whole of the difference.

**The window integration module** is the boundary. `platform/contracts/window-integration-module@1.0.0`
declares what the product may ask of the operating system window layer, and exactly one implementation exists
per operating system: Win32 for Windows, AppKit for macOS. They share no source. The contract carries a
`capabilities()` operation precisely so that a caller never asks which operating system it is on — on macOS,
presentation without activation is reported as provided by the desktop framework, and on Windows as provided
natively, and `pet` reads the same answer from both. Model entities: this component realises the variability
point of the same name.

**The store opener** is a single place in the local store where durability is decided. It is not a component so
much as an invariant about where a decision lives: the ledger and job stores are opened by one routine that
applies the physical-flush setting on the operating systems that need it, and every other local store is opened
without it. Keeping this in one routine is what makes `INV-LEDGER-20` checkable by reading one function rather
than auditing every call site.

**The release pipeline** produces per-architecture artifacts and per-operating-system manifests, signed with
one stable identity, and the update manifest service serves them through
`backend/contracts/update-feed@1.1.0`.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel | Direction | Pattern | Payload | Error handling |
| --- | --- | --- | --- | --- |
| Main process to native window module | in-process, synchronous call across the FFI boundary | request-response | the operations of `window-integration-module@1.0.0` | An unavailable operation is reported by `capabilities()` before it is called, not thrown at the call site. |
| Operating system to native window module | inbound event | pointer hit-test | pointer position | Resolved inside the module. This is the reason the module exists on macOS: resolving it in the application runtime costs a round trip per motion event, and the spike measured clicks lost at the border of the character because of it. |
| Client updater to manifest service | outbound HTTP | request-response | `update-feed@1.1.0` | A 404 is no update, not a failure. A digest or signature mismatch deletes the download. |
| Application to operating system keychain | in-process | request-response | one master key | A refusal is surfaced as a system card asking the user to reconnect, never as a lost account. |

### Execution boundaries and isolation

The native window module runs inside the main process, as the Windows one already does. It reads nothing about
other applications: window enumeration and the privacy filter over it stay in the separate module that
`req-018-pet-liveness` specifies, so a build without screen awareness does not link code that could read a
window title. That separation is worth more on macOS than on Windows, because reading a window title there
requires a privacy permission and the product has committed to needing none.

### Trust boundaries

The operating system is authoritative about two things the product must not cache: whether a permission is
currently held, and whether a downloaded package is signed by the expected identity. Both are read at the point
of use.

## Decisions

**Requirements state the obligation; the design states the setting.** The ledger requirement says a record
reported as written survives power loss. `PRAGMA fullfsync`, `checkpoint_fullfsync` and `synchronous = FULL`
appear here and in the spike report, not in the requirement. *Alternative rejected:* naming the pragmas in the
requirement. It reads as more precise and is less durable — it would have to change when the store changes,
and it invites an implementation to satisfy the letter on a store where those names mean something else.

**One contract, two implementations, no branching in callers.** *Alternative rejected:* letting `pet` and `app`
test the operating system directly. It is fewer files today and it spreads the platform difference across every
consumer, which is the state the Windows-only specification was already drifting towards.

**The signing identity is an architectural constraint, not a release step.** The measurement is that a change
of identity revokes the stored credentials and the granted permissions of the installed application. That makes
identity continuity a property the update path must have, so it is specified as a requirement of `platform`.
*Alternative rejected:* recording it as a procurement note in the roadmap, which is how the Windows certificate
was handled. On Windows the consequence of getting it wrong is a scary dialog; on macOS it is a user locked out
of their own connectors by an update they did not choose.

**Durability is confined to the ledger and job stores.** *Alternative rejected:* applying the flush everywhere
for uniformity. Two orders of magnitude of throughput is too much to spend on data whose loss costs nothing.

**The permission floor is specified before any feature needs a permission.** *Alternative rejected:* waiting for
M3 and deciding then. The floor is only enforceable while it is still true; written afterwards it would be a
description of whatever had already been built.

## Extensibility & Fallback Strategy

**Module loading and registration.** One implementation of the window integration module is selected at
startup by the operating system it was built for. There is no third-party registration: the contract is
internal, and its `open` classification means extensible by the platform for a further operating system, not by
anyone else.

**Multi-level fallback hierarchy.** For each operation of the contract: the native implementation, then what
the desktop framework provides where that is sufficient, then a reported absence. There is no fourth level and
in particular no silent degradation — an unavailable pointer passthrough is reported rather than replaced with
passing every event through, because the second is a pet the user cannot click.

**Update feed.** Adding an operating system adds a manifest name and a package format. Existing clients are
unaffected, which is the property that makes the widened key MINOR rather than MAJOR.

## Complexity Tracking

None. No constitutional principle is violated. Principle III is strengthened: the durability requirement is
what makes "ledger before act" true on an operating system where the previous assumption did not hold.

## Research

**Why the same test passes on macOS and fails on Windows.** *Decision:* accept the asymmetry and specify each
operating system as measured. *Rationale:* `spikes/SP-7-pet-window-os/macos/REPORT.md` §1 Q1 records 10 passes
in 10, against 6 failures in 10 on Windows in `spikes/SP-7-pet-window-os/REPORT.md`; the report attributes it to
the non-activating panel window kind together with an event path that does not serialise behind window
presentation. *Alternatives:* treating the Windows result as the conservative case for both and requiring a
native module on macOS as well — rejected because it spends an M1 workstream on a problem that was measured not
to exist there.

**Whether the durable setting can be relaxed under load.** *Decision:* no. *Rationale:*
`spikes/SP-12-sqlite-ledger/macos/REPORT.md` §1 Q3 measured 200 of 200 crash injections losing nothing with the
setting on. The report does not measure a partial or adaptive mode, so any such mode is unverified and is not
specified. *Alternatives:* batching commits to amortise the flush — plausible, unmeasured, and it changes when a
record becomes durable, which is the one property Principle III rests on.

**Intel Macs.** *Decision:* unverified, deliberately unspecified. *Rationale:* the constitutional evidence rule.
Everything measured here ran on Apple Silicon.

## Migration & Rollback

**Persistent data.** The durability setting changes how a write is flushed, not what is written. A store
written without it is readable with it and the reverse, so enabling it needs no migration and disabling it
would need none either — which is exactly why it must be a requirement rather than a configuration value.

**Contract.** `update-feed@1.1.0` is additive over `1.0.0`. A client written against `1.0.0` continues reading
`latest.yml` and continues receiving the Windows feed. Rolling back to `1.0.0` means withdrawing the macOS
manifest; macOS clients then see no update rather than a broken one.

**Signing identity.** There is no rollback from a published identity change. Once an update has been installed
under a different identity, the operating system has already discarded the binding, and the user reconnects
their platforms. This is why the requirement forbids producing such an update rather than describing how to
recover from one.

## Risks / Trade-offs

- [The durable ledger caps sustained write throughput at roughly 241 records per second on the measured
  machine] → Confine the setting to the ledger and job stores, and treat any design that writes the ledger in a
  loop as a design to revisit rather than a reason to relax the setting.
- [Two native modules mean two implementations of one contract, which can drift] → The contract carries
  `capabilities()`, so a drift shows up as a reported difference rather than as behaviour that differs silently
  between operating systems.
- [The Apple Developer Program membership is a single point of failure for macOS distribution] → The product
  owner has deferred it and the product stays local for now, which is a position the requirements permit
  because they bind at distribution rather than at build time. The risk is not removed but postponed, and it
  becomes live at the first build handed to anyone else: there is no partial substitute, an unsigned macOS
  build is not distributable, and no migration carries a user from one signing identity to another.
- [The permission floor holds only while every feature respects it] → It is a requirement with a scenario that
  refuses a change introducing a permission into the core path, so a future change contradicts it visibly.
- [One machine, one architecture] → Stated as an assumption, and the requirements are written as obligations
  so that an Intel difference would be a new measurement rather than a contradiction.

## Open Questions

- Whether an Intel Mac needs a separately measured durability setting. Postponable: the requirement is written
  as an obligation, so an Intel measurement would add evidence rather than change the text.
- Whether the combined-architecture package is worth publishing as a manual download at all. Postponable: it
  is outside the update path either way, so the answer changes a release chore and nothing specified here.
