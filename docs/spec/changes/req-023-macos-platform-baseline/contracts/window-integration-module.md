---
contract: window-integration-module
version: 1.0.0
status: draft
owner: platform
consumers: [pet, app, uix]
---

# Contract: window-integration-module

## Purpose

Fixes what the rest of the product may ask of the operating system's window layer, so that the pet, the
management window and the interface behave identically on Windows and macOS while resting on two native
implementations that share no code. The contract exists because the difference between the operating systems is
large — an extended window style and a window-procedure hook on one, a panel style and a view hit-test on the
other — and without a fixed surface that difference leaks into every caller.

## Schema / Surface

A code-level interface, loaded in the desktop client's main process and provided by exactly one implementation
per operating system. Each entry states an obligation, not a system call; how an implementation meets it is
recorded in that platform's design.

| Operation | Direction | Obligation | Failure |
| --- | --- | --- | --- |
| `presentWithoutActivating(window)` | caller -> module | The window becomes visible without the application becoming active and without keyboard focus leaving where it is. | Refuses if the window kind cannot carry the guarantee, rather than showing the window and hoping. |
| `setPointerPassthrough(window, mask)` | caller -> module | Pointer events over fully transparent pixels reach the application underneath; events over opaque pixels reach the window. Resolved without a round trip to the application runtime. | Refuses an ill-formed mask. Never falls back to passing everything through, which would make the pet unclickable. |
| `setVisibleEverywhere(window)` | caller -> module | The window stays visible across every workspace or virtual desktop and over full-screen applications. | Refuses on a window that is not the pet or its bubble. |
| `restoreFocusTo(previous)` | caller -> module | The application that held focus before the bubble opened holds it again. | If that application no longer exists, leaves focus where the operating system puts it and reports that, rather than activating the product. |
| `setDockPresence(visible)` | caller -> module | The product appears in, or withdraws from, the operating system's application list and switcher. | On an operating system where presence is per window rather than per application, is a no-op and reports so. |
| `setExcludedFromCapture(window, excluded)` | caller -> module | Another application capturing the screen does not receive this window's contents, while the user still sees it. | Reports refusal if the operating system cannot exclude the window, so the interface can warn instead of silently broadcasting. |
| `capabilities()` | caller -> module | States which of the above this implementation performs natively, which the desktop framework already provides, and which are unavailable. | Never throws; an unavailable operation is reported here rather than discovered at the call site. |

`capabilities()` is what keeps the two implementations behind one surface. On macOS,
`presentWithoutActivating` is satisfied by the desktop framework alone and is reported as such; on Windows the
same entry is reported as natively implemented, because the framework there loses keystrokes.

## Semantics

Every operation is synchronous with respect to the caller and applies to a window the caller owns. None
of them reads anything about other applications: window enumeration and the privacy filter over it are a
separate contract, so that a build with no screen-awareness feature does not link a module that could read
window titles.

`setPointerPassthrough` is the reason the module exists on macOS at all. Resolving a pointer event by asking
the application runtime costs a round trip on every motion event, and the measurement behind this change
recorded clicks lost at the character's border because of it.

## Compatibility

Adding an operation is a MINOR change. Changing what an operation guarantees, or removing one, is MAJOR and
requires every consumer to be revisited, because each consumer's behaviour is specified in terms of the
guarantee rather than the call. An implementation reporting an operation as unavailable through
`capabilities()` is not a contract change; it is the contract working.

## Consumers

- `pet` — presentation without activation, pointer passthrough, visibility everywhere, focus restoration.
- `app` — dock presence as the management window opens and closes.
- `uix` — exclusion from capture while the user shares or records their screen.

## Evidence

`spikes/SP-7-pet-window-os/macos/REPORT.md` §2 and §3 for the macOS surface and for the finding that
presentation without activation needs no native code there; `spikes/SP-7-pet-window-os/REPORT.md` §3.1 for the
Windows surface; `spikes/SP-18-pet-liveness/macos/REPORT.md` §1 Q29 and Q30 for capture exclusion and focus
restoration.
