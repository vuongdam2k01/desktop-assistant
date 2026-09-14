> **Amended 2026-09-12** by `req-022-account-sync` (constitution 2.0.0): data is account-owned and replicates to every signed-in device, encrypted at rest under service-managed keys. The passages below were corrected where they asserted device-bound storage.

## Why

Harvested from `spikes/SP-11-secure-storage/REPORT.md`. The spike verified how connector tokens and provider credentials are stored on Windows, and eliminated two candidate mechanisms by measurement.

## Problem

The product holds OAuth tokens for the user's real accounts and API keys they pay for. Where those live decides what an attacker with file access gets, whether another Windows user on the same machine can read them, and whether uninstalling really removes them.

- The platform secure-storage API, storing ciphertext in the local application database, meets the requirement on Windows — VERIFIED (`spikes/SP-11-secure-storage/REPORT.md#0-ket-luan`).
- The Windows Credential Manager route fails on a hard 2,560-byte limit, which a connector credential payload exceeds — VERIFIED (`spikes/SP-11-secure-storage/REPORT.md#0-ket-luan`).
- Isolation between Windows users is absolute: another user's decryption attempt fails with a bad-key-state error — VERIFIED (`spikes/SP-11-secure-storage/REPORT.md#0-ket-luan`).
- The previously common third-party keychain library was archived by its maintainer in 2022 and is excluded — VERIFIED (`spikes/SP-11-secure-storage/REPORT.md#0-ket-luan`).

## Cost of inaction

The requirement currently names the Credential Manager, which the measurement shows to be both size-limited and user-visible clutter in the Windows control panel. Building to the requirement as written would fail at the first connector credential.

## Options

### Option A — Platform secure-storage API with ciphertext in the local database
- **Sketch**: one service encrypts through the OS API and stores the ciphertext in a dedicated local table with a namespaced key per credential; decryption failure surfaces as a system card offering reconnection.
- **Appetite**: medium (weeks).
- **Trade-offs**: no size limit, no control-panel clutter, verified cross-user isolation, and one code path for both platforms; ties credential lifetime to the OS user profile, so an out-of-band password reset can orphan the data.
- **Rabbit holes**: building a key-rotation scheme before there is a threat that needs one.

### Option B — Minimum viable slice: encrypted file with an application-held key
- **Sketch**: encrypt credentials with a key stored alongside the application.
- **Appetite**: small (days).
- **Trade-offs**: no OS dependency; the key sits next to the ciphertext, so it protects against nothing an attacker with file access cannot defeat.
- **Rabbit holes**: none — it does not meet the requirement.

## Recommendation

Option A, and the requirement's wording is corrected to name the platform API rather than the Credential Manager.

## What Changes

- **BREAKING** to the requirement as currently worded: the security requirement is restated to specify the platform secure-storage API with ciphertext at rest in local application data, rather than naming the Windows Credential Manager — VERIFIED (`spikes/SP-11-secure-storage/REPORT.md#2-tac-dong-len-adr-prd`, `spikes/SP-11-secure-storage/macos/REPORT.md#2-tac-dong-len-adr-prd`).
- A dedicated credentials table holds key, ciphertext, update time and metadata, with keys namespaced by credential class — VERIFIED (`spikes/SP-11-secure-storage/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-11-secure-storage/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Decryption failure is a handled state: the app raises a system card directing the user to reconnect the affected connector or reconfigure the affected model — VERIFIED (`spikes/SP-11-secure-storage/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-11-secure-storage/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- Account deletion and uninstall wipe all credentials before the database file is removed, and revoke server-side tokens — VERIFIED (`spikes/SP-11-secure-storage/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`, `spikes/SP-11-secure-storage/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).

## Capabilities

REQUIRES spec-impact — touches persistent storage and a security requirement.

### New Capabilities
- `platform`: secure credential storage service, key namespacing, wipe-on-uninstall behaviour.

### Modified Capabilities
- `connector`: token persistence delegates to the secure storage service.
- `backend`: account deletion triggers client-side wipe plus server-side revocation.

## Impact

Local database schema, connector connect and disconnect flows, provider configuration, uninstall and account-deletion paths.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle VII as redefined at 2.0.0 — credentials are account-owned and replicate encrypted, so device-local secure storage protects this machine's copy rather than the only copy. The decryption-failure path improves as a result: a device that cannot decrypt its local copy re-syncs from the account instead of asking the user to reconnect every connector by hand. No violation.

## Assumptions

- The application always runs in an interactive user session, never as a system service, so the per-user encryption profile always exists.
- Device-local encryption still binds to the OS user profile; since `req-022-account-sync` that is no longer a single point of loss, because the account holds a replicated copy.
