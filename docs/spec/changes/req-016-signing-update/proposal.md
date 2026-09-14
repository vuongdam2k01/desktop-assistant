> **Amended 2026-09-12** by `req-022-account-sync` (constitution 2.0.0): data is account-owned and replicates to every signed-in device, encrypted at rest under service-managed keys. The passages below were corrected where they asserted device-bound storage.

## Why

Harvested from `spikes/SP-16-signing-update/REPORT.md`. The spike ran the packaging, signing and auto-update pipeline end to end with a self-signed certificate.

## Problem

Auto-update is one of the official flows the product commits to using rather than working around. It only functions if the installer is trusted by the operating system, and the certificate route that would deliver that trust has both a procurement lead time and a constraint that rules out the cheapest option.

- The pipeline runs completely through a local manifest with a self-signed certificate, so it does not block current milestone work — VERIFIED (`spikes/SP-16-signing-update/REPORT.md#0-ket-luan`).
- On a real user machine, the platform reputation service and trust verification reject a self-signed certificate outright unless the user manually imports the root certificate — VERIFIED (`spikes/SP-16-signing-update/REPORT.md#0-ket-luan`).
- Since a 2023 industry rule change, traditional exportable key files are no longer issued, so automated signing requires a cloud signing service rather than a hardware token — VERIFIED (`spikes/SP-16-signing-update/REPORT.md#2-tac-dong-len-adr-prd`).

## Cost of inaction

A certificate is a purchase with a lead time, not a task. Reaching the first closed beta without one means either no updates or an installer the operating system warns against — and the hardware-token alternative cannot be automated at all, with local import of such devices reported to add up to a month of customs delay.

## Options

### Option A — Cloud signing service, procured before the closed beta
- **Sketch**: continuous integration signs through a cloud service; the backend serves a static manifest alongside the installer and its block map. Update install is deferred while a job is running.
- **Appetite**: medium (weeks), gated on a purchase decision.
- **Trade-offs**: fully automatable and compatible with the current rules; requires a commercial decision at least two weeks before the first beta, and an individual certificate still shows a reputation warning until the installer builds reputation.
- **Rabbit holes**: building a signing abstraction across providers before one has been chosen.

### Option B — Minimum viable slice: unsigned builds for the single-user phase
- **Sketch**: skip signing while the product owner is the only user.
- **Appetite**: small (hours).
- **Trade-offs**: no procurement now; violates the commitment that the first user exercises the real flows, and pushes discovery of every signing problem to the worst possible moment.
- **Rabbit holes**: none.

## Recommendation

Option A. The constitution requires the first user to exercise the real update flow, and the certificate has a lead time that must start before it is needed.

## What Changes

- Signing moves to a cloud service in continuous integration; hardware-token certificate packages are excluded because they cannot be automated — VERIFIED (`spikes/SP-16-signing-update/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-16-signing-update/macos/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-16-signing-update/REPORT.md#4-rui-ro-moi-phat-hien`).
- The backend's update responsibility is clarified: serve a static manifest plus the installer and block map. It does not sign the manifest, because integrity is already carried by the file hash and platform trust verification — VERIFIED (`spikes/SP-16-signing-update/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-16-signing-update/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- Automatic install on quit is disabled. An update waits on job state: if a job is running, the user is asked before restart — VERIFIED (`spikes/SP-16-signing-update/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-16-signing-update/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- The packaging configuration is specified, including update signature verification, hash algorithm, a timestamp server and per-user install without elevation — VERIFIED (`spikes/SP-16-signing-update/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-16-signing-update/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Update checks run on a periodic interval with user-visible availability, progress and restart-prompt states — VERIFIED (`spikes/SP-16-signing-update/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-16-signing-update/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).

## Capabilities

REQUIRES spec-impact — defines the release artifact contract consumed by the backend.

### New Capabilities
- `platform`: packaging, signing pipeline, update lifecycle and its interaction with running jobs.

### Modified Capabilities
- `backend`: update manifest endpoint scope is narrowed to static artifact serving.
- `app`: tray and quit behaviour accounts for pending updates and active jobs.

## Impact

Continuous integration configuration and secrets, backend static hosting, application quit and restart paths, and a procurement decision with an external lead time.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle VIII — the update flow must be the real one for the first user, which is what makes the certificate a scheduled dependency rather than a later concern. Principle VII as redefined at 2.0.0 — the update path is unaffected: the backend serves static artifacts and this change adds no access to account data. No violation.

## Assumptions

- Windows is the first signed platform; the macOS signing and notarisation track is deferred and unverified.
