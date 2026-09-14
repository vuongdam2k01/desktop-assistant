> **Constitution notice**: this change touches principle VII — it widens the replicated set to include binary assets the user creates — and it puts authored persona text on the path into the pet-agent's prompt, which the `External Content Is Data` invariant governs. It amends neither: both are satisfied by design, and the Constitution check below states how.

## Why

The decision-maker directed on 2026-09-13 that the pet become a **pet pack** — a complete, standard-framed set carrying both its animation and its personality — so that the product can ship a catalogue of ready-made pets and the user can build their own, on an architecture that extends rather than accumulates special cases.

## Problem

The pet is the product's primary touchpoint, and today it is one file. `req-005-electron-rive-pet-render` established that the `.riv` asset loads from a binary buffer and swaps at runtime without a rebuild — VERIFIED (`spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` Q6) — and reserved the variability point "Character Asset Skin — open". What it did not do is specify the framework that makes the point usable. Four consequences follow, and each is load-bearing rather than cosmetic.

- **No pack identity.** An asset carries no manifest: no id, version, author, preview, declared capabilities, or the contract revision it targets. The product cannot tell a pack written for a later revision from a corrupt file — both surface as `ARTBOARD_NOT_FOUND` and fall back to the shipped default. A connector has had a manifest since `req-019-connector-framework`; the pet has not.
- **The contract already contradicts the specification.** `req-018-pet-liveness` introduced a two-layer state machine — locomotion against work status, VERIFIED at 60 fps (`spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` Q19, Q20) — and the living requirement at `docs/spec/capabilities/pet/spec.md:334` requires it. `pet/contracts/rive-state-machine@1.0.0` still declares a single numeric input. Nobody outside the core team can author a conforming pet today, because the interface they would author against does not describe the product.
- **The persona has no owner.** `docs/spec/capabilities/pet/spec.md:120` requires every pet-visible string to come from the pet-agent "under its persona specification", and grants one exception for a localised acknowledgement line set. No artifact in the repository owns that specification. Open questions `Q-OQ-3` (persona, tone, talkativeness) and `Q-OQ-4` (graphic style, one fixed character or not) have stayed open in `req-001-mvp-product-definition` partly because there is no container to put an answer into.
- **Nothing follows the account.** `docs/spec/capabilities/sync/spec.md:35` fixes the replicated set and excludes device-local concerns. A pet the user builds on one machine is, under today's specification, a file on that machine. On the next machine they get the default back and must carry the file across themselves — which is the pattern principle VII exists to forbid.

Why now: the pet's rendering, locomotion and window behaviour are specified and measured on both operating systems. The framework that turns one character into a system has to be decided before a designer produces a second character, because every asset authored against the current contract is authored against an interface that is about to change.

## Cost of inaction

The product ships with exactly one pet and no supported way to add another. Every additional character becomes a core edit, which is the failure mode principle VI names for connectors and which applies here for the same reason. `Q-OQ-3` and `Q-OQ-4` stay blocking, because answering them would mean hardcoding one persona and one style into the application. And the contract stays in its current contradictory state, so the first external asset authored against it is wasted work.

## Options

### Option A — Account-owned pet packs carrying visuals and persona, from two provenances
- **Sketch**: the user opens the pet settings and sees two shelves — a catalogue of pets the product ships, and the pets belonging to their account. Selecting one changes the character on screen and how it talks. They create their own by supplying a conforming animation and filling in its personality, and it is theirs: sign in on another machine and it is already there, selectable, without carrying a file.
- **Appetite**: large (months).
- **Trade-offs**: it is the only option that satisfies all three of the decision-maker's requirements at once — a supplied catalogue, user authorship, and an architecture that extends. The costs are real and named rather than discovered later: the replication path must carry binary blobs, not only records, which is a widening of the backend's storage obligation; and authored persona text joins the prompt path, which must be closed off from the approval gate by construction rather than by good behaviour.
- **Rabbit holes**: building a general asset-management system rather than the specific pack this product needs; letting "the user creates a pack" grow into an in-app animation editor; treating persona as a free-form prompt slot the user can write anything into, which quietly turns the pack into an instruction channel.

### Option B — Minimum viable slice: visual-only packs, device-local
- **Sketch**: the settings screen lists the `.riv` files present on this machine and lets the user pick one. Personality stays fixed in the product. Nothing replicates.
- **Appetite**: small (days).
- **Trade-offs**: it is close to what `req-005` already specifies, and it would ship quickly. It leaves the persona ownerless, so `Q-OQ-3` stays blocked; it leaves the contract contradiction unfixed, so the packs it enables are authored against a broken interface; and it makes the user carry files between machines. It delivers a picker, not a framework, and the framework is what was asked for.
- **Rabbit holes**: none worth exploring — its limits are the point of rejecting it.

### Option C — Public marketplace with third-party distribution from the start
- **Sketch**: packs are published, browsed and installed from a public store, with community submissions.
- **Appetite**: large (months), plus a permanent moderation obligation.
- **Trade-offs**: **Deferred by the decision-maker on 2026-09-13.** A public store makes every pack third-party untrusted content and demands content review, provenance signing, takedown, and abuse handling — an ongoing operational commitment with no user yet asking for it. The pack format designed under Option A does not foreclose it; distribution is a separate layer above the same manifest.
- **Rabbit holes**: signing and review infrastructure built before there is a second author; moderation policy written before there is content to moderate.

## Recommendation

Option A, selected by the decision-maker. Option C is recorded as deliberately deferred, not rejected — the manifest and the contract are designed so that adding a distribution channel later changes who supplies a pack and what trust it carries, and changes nothing about what a pack is.

## What Changes

- A **pet pack** becomes the unit the product ships, the user creates, and the account owns: a manifest, an animation asset, and a persona — name, character, tone, talkativeness, and the localised acknowledgement line set that `docs/spec/capabilities/pet/spec.md:120` already refers to and nothing currently owns.
- **BREAKING** — `pet/contracts/rive-state-machine` rises to `2.0.0`. The two-layer state machine that `req-018-pet-liveness` specified and measured becomes part of the declared interface: a locomotion layer alongside the work-status layer, instead of the single numeric input `1.0.0` declares. This is the MAJOR trigger that change's own versioning policy names, and it resolves a contradiction that exists today between the contract and the living specification.
- A pack declares which capabilities it implements, and the product degrades per capability rather than per pack: a pack that animates the five work states but not locomotion keeps its character and borrows default locomotion, instead of being refused whole. This replaces the current all-or-nothing fallback to the shipped default, which stays as the last tier.
- A pack declares the contract revision it targets, so a pack written for a later revision is refused as incompatible and says so, rather than presenting as a corrupt file.
- Two provenances, with different trust and different lifecycles. **Built-in templates** are supplied by the product, distributed through the backend and the update channel, and are read-only on the device. **Account packs** are created by the user, belong to the account, and replicate.
- Creating a pack means importing a conforming animation file and filling in its persona; the product validates the import against the contract and packages the result. Authoring the animation itself stays outside this change, so the product supplies the frame and the standard, not a drawing tool.
- A persona is authored as structured fields — name, languages, talkativeness, and the acknowledgement line set — plus one length-bounded free-text character description, which is what lets two packs sharing a catalogue style still sound like different characters.
- The active pack is an account-level choice and replicates with the rest of the configuration, so signing in on any machine presents the same pet rather than the default.
- **BREAKING** to `docs/spec/capabilities/sync/spec.md:35` — the replicated set widens. It currently enumerates records: jobs, ledger, rules, configuration, connector authorisation, transcripts. An account pack replicates in full, manifest, persona and binary asset together, so the store must carry a bounded binary payload. The pet's on-screen placement stays device-local and unaffected.
- The application window gains pet management: both shelves, a preview, activation, creation, and deletion, with deletion of the active pack falling back to a supplied template rather than leaving the pet absent.
- Persona text is bound to the advisory layer by construction. It shapes how the pet speaks and can never name a tool, widen an approval, alter a rule, or reach the gate — which is principle II's existing position on system prompts, applied to text that now has an author other than the product.
- `Q-OQ-3` and `Q-OQ-4` stop blocking the architecture. This change specifies the container; their answers become the content of the default built-in pack and can be decided after it.

## Capabilities

REQUIRES spec-impact — modifies four capabilities, raises a contract by a MAJOR version with two declared consumers, and widens persistent storage on both sides of the client/backend boundary.

### New Capabilities

None. The pack framework belongs to `pet`, which already owns the rendering surface, the asset pipeline and the persona reference; introducing a thirteenth domain would separate a pack from the surface that consumes it.

### Modified Capabilities

- `pet`: owns the pack as a modelled entity, its manifest, its persona, the activation lifecycle, per-capability degradation, and the contract at `2.0.0`. The requirements at `docs/spec/capabilities/pet/spec.md:120`, `:254` and `:334` are restated rather than replaced.
- `app`: the settings area gains the pet management surface — two shelves, preview, activation, creation, deletion.
- `sync`: the replicated set widens to carry account packs, and the pack store declares its own conflict-resolution rule as `docs/spec/capabilities/sync/spec.md:53` requires of every replicated store.
- `backend`: distributes the built-in catalogue, and stores account packs as encrypted bounded binary payloads alongside the record stores from `req-020-backend-slice`.

## Impact

The pet renderer and its asset loading path; the designer-developer interface and every asset authored against it; the application settings surface; the replication protocol and its payload shape; backend storage and the update manifest; and the pet-agent's prompt assembly, which now composes a persona supplied by a pack. `req-005-electron-rive-pet-render` and `req-018-pet-liveness` are both affected through the contract bump and must be reconciled rather than left standing.

## Refs

None — this project declares no upstream traceability anchor. The directive of 2026-09-13 is recorded in this proposal.

## Constitution check

- **VII (Account-Owned Data)** — engaged and satisfied. An account pack is the user's creation and therefore account-owned; it replicates so that sign-in alone restores it, and the user carries no file between machines. The widening is of payload kind, from records to a bounded binary, not of principle. Built-in templates are product-supplied and are not account data, so they are distributed rather than replicated.
- **External Content Is Data** — engaged. Persona text is authored content on the path into the pet-agent's prompt. It is advisory only: it may shape voice, and may never authorize an action, relax an approval, or alter a rule. Under Option A the author is the account holder themselves, which lowers the likelihood of hostile text but changes nothing about the boundary, because the boundary is what makes Option C safe to add later.
- **II (Hard Gate Outside The LLM Loop)** — preserved, and the reason the previous point holds by construction. The gate is in the application layer and no prompt content reaches it, so a persona cannot become privilege.
- **VI (Connectors Are Data)** — not governing here, since it names connectors specifically, but this change deliberately takes its shape: a pack is a manifest plus assets, and adding the Nth pack changes no core module.
- **Reserved By Design** — the manifest reserves the fields a distribution channel would need. Each carries its phase, its rationale and its activation condition in `model.md`, as the clause requires; none are silent.
- **Rigor By Risk** — `design` schema is required and used: new entities, a modified contract, and persistent storage on the replication path.
- Principles I, III, IV, V and VIII are unaffected. A pack changes how the pet looks and speaks; it touches no job record, no ledger write, no compensating action, and no official flow.

## Assumptions

- Built-in templates are read-only on the device and are replaced wholesale by a release, the same posture `req-005-electron-rive-pet-render` gives the shipped default asset. A user who wants to change one creates an account pack from it, which is thereafter independent and is not overwritten by a later release of its origin.
- The shipped default pack remains the terminal fallback and the one pack the product cannot start without, unchanged from `req-005`.
- An account pack's binary is bounded at 5 MB, roughly ten times the under-500 KB budget `req-005-electron-rive-pet-render` sets for the shipped asset. The ceiling exists so that replication stays a record-sized operation needing no separate blob transfer channel, and an import exceeding it is refused at the point of import rather than at the point of sync.
- A pack that fails validation is refused at load and left on disk rather than deleted, so the user can see what was rejected — the posture already specified for a failing asset.
- An account pack edited on two devices resolves by the rule the living `sync` specification already states for a conflicting mutable record, rather than by a rule invented for this store.
