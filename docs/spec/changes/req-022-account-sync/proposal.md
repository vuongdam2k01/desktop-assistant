> **Constitution notice**: this change redefines principle VII and raises the constitution from 1.0.0 to 2.0.0. It is the amendment the Governance section requires, and every other artifact amended on 2026-09-12 derives from it.

## Why

The decision-maker directed on 2026-09-12 that the product become account-owned rather than device-owned: signing in on any machine must restore the same data, configuration and history, ready to use. A follow-up directive the same day fixed the constraint that decides the design — the user must not have to carry anything between machines, so account sign-in alone has to be sufficient.

## Problem

Under principle VII as ratified at 1.0.0, everything the product accumulates — job history, the readable ledger, approval rules, connector authorisation, provider configuration — lived on one machine and only that machine. Three consequences follow, and none of them are edge cases.

- A second machine is a blank product. The user reconnects every connector, re-authorises their own OAuth client for the provider that requires it, reconfigures models, and re-teaches every approval rule they previously elicited through a multi-turn conversation — which `req-004-rule-elicitation` measured at 4.35 turns each.
- History does not follow the user. The ledger is what makes undo possible and what the user reads to understand what happened; on a new machine it is simply gone, and nothing can be undone across the boundary.
- A lost or replaced machine loses all of it permanently, because nothing is anywhere else.

The accumulated rules, connections and history are the product's value. Binding them to a device throws that value away at every machine change.

## Cost of inaction

The product stays usable only on the one machine where it was first configured. In practice this caps it at single-device use, undermines the trust story it is built on — the user cannot audit or reverse work from anywhere else — and makes machine replacement a total loss of everything the user taught it.

## Options

### Option A — Account-owned data, encrypted at rest under service-managed keys
- **Sketch**: the client replicates its stores to the backend, which holds them encrypted at rest. A new device signs in and pulls the account's full state; nothing else is asked of the user. The local store remains the working copy, so nothing depends on the network being up.
- **Appetite**: large (months).
- **Trade-offs**: this is the only option that satisfies the stated constraint, including the case that matters most — a replacement device after the old one is lost. The cost is stated plainly: because sign-in alone must be sufficient to recover the data, the service necessarily holds the means to decrypt it, so the privacy boundary is operational rather than mathematical. A compromise of the backend or its key custody exposes user work content, which makes confined key access, least privilege and audited access load-bearing controls rather than hygiene.
- **Rabbit holes**: designing a general-purpose sync engine rather than replication for the specific stores this product has; letting the "serve replication" key path quietly widen into analytics, support tooling or model input.

### Option B — End-to-end encrypted, key never leaves the user
- **Sketch**: the client encrypts under a key derived from a passphrase the user sets, or transferred from an already-enrolled device; the backend stores ciphertext it genuinely cannot read.
- **Appetite**: large (months).
- **Trade-offs**: the strongest possible boundary — a backend breach yields nothing readable. **Rejected by the decision-maker on 2026-09-12**: it cannot meet the constraint. A passphrase is a secret the user must carry, and device-to-device transfer requires still possessing the old machine, which fails precisely when the user most needs recovery.
- **Rabbit holes**: key escrow schemes that claim end-to-end properties while quietly making the server able to decrypt — the worst of both, because the guarantee is then false.

### Option C — Server-readable plaintext
- **Sketch**: the backend stores everything in readable form with no encryption at rest.
- **Appetite**: medium (weeks).
- **Trade-offs**: simplest to build and operate. It gives up encryption at rest for no gain in user experience over Option A, since Option A is already invisible to the user, and it leaves nothing between a stolen database file and the user's work.
- **Rabbit holes**: none worth exploring; Option A costs little more and is strictly better.

## Recommendation

Option A, selected by the decision-maker. Option B is recorded as evaluated and rejected, with the constraint that settled it, so the question is not reopened without it.

## What Changes

- **BREAKING** — principle VII is redefined. Jobs, ledger, rules, configuration, connector authorisation and transcripts are account-owned and replicate to every signed-in device; account sign-in alone restores them, and the user carries no secret, file or enrolled device between machines. Replicated data is encrypted at rest under service-managed keys, and the privacy boundary is stated as operational rather than cryptographic. Constitution raised to 2.0.0.
- A new capability `sync` owns the replication protocol, conflict-resolution rules, the device registry and revocation, and device enrolment from sign-in alone.
- The backend gains an encrypted replication store, key custody with audited access, and a device registry, on top of the four tables verified in `req-020-backend-slice`. **BREAKING** to that change's verified invariant: the backend now does hold user work content, so the property demonstrated by dumping the database no longer holds and must be restated as "encrypted at rest, key access confined to the replication path, every access audited".
- Connector authorisation becomes account-scoped rather than device-scoped, which answers the open question `OQ-9` carried in `req-001-mvp-product-definition` about whether the connector token stays client-only or the server holds it: the server holds it, encrypted at rest, and it follows the account to every device.
- **BREAKING** for the reading of `req-012-secure-storage`: device-local secure storage still protects credentials on the machine, but credentials are no longer bound to one machine's user profile, and the decryption-failure path now has a real remedy — re-sync from the account rather than ask the user to reconnect every connector.
- A job is pinned to the device that created it. Other devices see its status and history live but do not execute it, so the object lock and rate queue verified in `req-015-concurrency-coordinator` stay in-process as measured.
- Offline behaviour is unchanged and now explicitly load-bearing: the local store is the working copy, the offline command queue from `req-021-ask-user-offline` still holds commands during an outage, and crash recovery from `req-013-sqlite-ledger` still runs against the local store first.
- The append-only guarantee of `req-013-sqlite-ledger` must now hold across replicas, not only within one store, so ledger replication resolves by append-and-reconcile and never by last-writer-wins.

## Capabilities

REQUIRES spec-impact — redefines a constitutional principle, adds a capability, changes persistent storage on both sides of the client/backend boundary, and alters a security requirement.

### New Capabilities
- `sync`: replication protocol, conflict resolution, device registry and revocation, enrolment from sign-in alone.

### Modified Capabilities
- `backend`: gains encrypted replication, key custody and device registry; its privacy invariant is restated and weakened, which is the substantive cost of this change.
- `ledger`: records replicate; append-only has to hold across devices, not only within one store.
- `platform`: device-local secure storage additionally protects replication material.
- `connector`: authorisation is account-scoped, so connecting on one device connects everywhere.
- `app`: surfaces sync state, the enrolled device list, and device revocation.

## Impact

Both persistent schemas, the client/backend interface, the sign-in flow, connector connect and disconnect, secure storage, and every store that carries user data. Ten harvested proposals and the risk ledger are amended alongside this change; `docs/raw-idea/prd-mvp.md` receives a changelog entry pointing here rather than a rewrite, since it is background material with no traceability role.

## Refs

None — no upstream traceability anchor. Both directives are recorded in this proposal and in the constitution's Sync Impact Report.

## Constitution check

Principle VII is redefined by this change, which is the amendment itself. Principle III is affected and preserved: append-only must now hold across replicas, which is why ledger conflict resolution is append-and-reconcile rather than last-writer-wins. Principles I, II, IV, V, VI and VIII are unaffected — the approval gate, the ledger-before-act obligation and the manifest boundary all sit on the device and do not move.

## Assumptions

- Google Sign-In remains the authentication mechanism, and it is now the sole gate on the user's entire history, which raises the consequence of an account compromise accordingly.
- A revoked or signed-out device wipes its local store and replication material; revocation is enforced server-side so a device that never reconnects is not the only line of defence.
