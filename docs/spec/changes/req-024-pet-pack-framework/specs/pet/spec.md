## ADDED Requirements

### Requirement: A pet pack is the unit the product ships, the user creates, and the account owns

A pet pack SHALL consist of exactly three parts — a manifest declaring its identity, an animation asset, and a
persona — and the product SHALL present a pet only by activating a pack, never by loading an animation asset
that no manifest describes.

Source: decision-maker directive 2026-09-13, recorded in `proposal.md` — UNVERIFIED. The three-part shape
follows the manifest-plus-adapter form that `docs/spec/constitution.md` principle VI establishes for
connectors; the principle governs connectors rather than pets, so the shape is borrowed deliberately rather
than inherited.

#### Scenario: An animation asset arrives without a manifest
- **GIVEN** an animation asset is placed in the pack storage location by hand
- **WHEN** the product enumerates the packs available to the user
- **THEN** that asset is absent from the enumeration, because a pack is its manifest and an undescribed asset
  is not one

#### Scenario: A manifest names an asset that is not present
- **WHEN** a pack is activated whose manifest names an animation asset missing from the pack
- **THEN** activation is refused, the reason names the missing asset, and the previously active pack stays on
  screen

#### Scenario: The account holds no pack of its own
- **WHEN** a user who has never created a pack opens the pet settings
- **THEN** the built-in catalogue is offered and the account shelf reports that it is empty, rather than the
  surface presenting as broken

### Requirement: A pack declares the interface revision it was authored against

A pack manifest SHALL declare the major revision of the pet animation contract it was authored against, and the
product SHALL refuse to activate a pack whose declared revision it does not implement, reporting incompatibility
distinctly from a damaged file.

Source: decision-maker directive 2026-09-13, recorded in `proposal.md` — UNVERIFIED. The need is established by
the contradiction this change resolves: `req-018-pet-liveness` specified a second animation layer while
`pet/contracts/rive-state-machine@1.0.0` continued to declare one, so an asset and the runtime could disagree
with no way to say so.

#### Scenario: A pack authored for a later revision
- **GIVEN** a pack declares a contract revision higher than the one the installed product implements
- **WHEN** the user attempts to activate it
- **THEN** activation is refused with the reason that the pack requires a newer version of the product, and the
  pack is retained rather than deleted

#### Scenario: A pack authored for an earlier revision
- **GIVEN** a pack declares a contract revision the product no longer implements
- **WHEN** the user attempts to activate it
- **THEN** activation is refused with the reason that the pack was authored for a superseded interface, and the
  reason is distinguishable from a damaged-file refusal

#### Scenario: A damaged file is not reported as incompatible
- **WHEN** a pack whose declared revision is implemented fails to load because its asset cannot be read
- **THEN** the reported reason is that the asset is unreadable, not that the pack is incompatible

### Requirement: A pack declares which animation capabilities it implements and degrades per capability

A pack manifest SHALL declare which animation capabilities it implements, and when an activated pack does not
implement a capability the product SHALL substitute the shipped default pack's behaviour for that capability
alone while retaining the activated pack for every capability it does implement.

Source: decision-maker directive 2026-09-13, recorded in `proposal.md` — UNVERIFIED. It replaces the
whole-pack fallback that `req-005-electron-rive-pet-render` specified, which had only one tier: a pack missing
anything reverted entirely to the shipped default.

#### Scenario: A pack implements work status but not locomotion
- **GIVEN** an activated pack declares the work status layer and not the locomotion layer
- **WHEN** the pet moves across the screen
- **THEN** the character from the activated pack is shown moving with the default pack's locomotion behaviour,
  rather than the activated pack being refused

#### Scenario: A pack declares a capability it does not contain
- **GIVEN** a pack declares the locomotion layer but its asset carries no such layer
- **WHEN** the pack is activated
- **THEN** the product treats the capability as absent and substitutes the default behaviour for it, because the
  asset rather than the declaration is what can be rendered

#### Scenario: A pack implements no declared capability at all
- **WHEN** an activated pack implements none of the declared capabilities
- **THEN** the shipped default pack is presented in full and the activation is reported as failed

### Requirement: The pet is never absent because of a pack failure

The product SHALL present the shipped default pack whenever no other pack can be presented, and the shipped
default pack SHALL be present on every installation.

Source: `req-005-electron-rive-pet-render/model.md` §Physical Storage & Data Schema, which names the shipped
asset as the fallback every failure path lands on and the one asset the application may not start without —
UNVERIFIED, carried forward here as a requirement because it was previously stated only as a storage posture.

#### Scenario: The active pack is deleted
- **GIVEN** the active pack is an account pack
- **WHEN** the user deletes it
- **THEN** a built-in template becomes active and the pet stays on screen throughout, rather than the pet
  disappearing until a new pack is chosen

#### Scenario: Every pack fails to load at startup
- **WHEN** the product starts and no pack in the account's library can be loaded
- **THEN** the shipped default pack is presented and the failure is reported to the user

#### Scenario: A pack fails while it is on screen
- **GIVEN** a pack is active and its asset becomes unreadable
- **WHEN** the product attempts to reload it
- **THEN** the shipped default pack replaces it without the pet being absent between the two

### Requirement: A pack carries the persona specification the pet speaks under

A pack SHALL carry the persona specification — the pet's name, the languages it speaks, how talkative it is, a
bounded free-text character description, and the acknowledgement line set localised per language — and the
persona in force SHALL be the one belonging to the active pack.

Source: decision-maker directive 2026-09-13, recorded in `proposal.md` — UNVERIFIED; the shape was fixed in
`clarifications.md` session 2026-09-13. The requirement exists because `docs/spec/capabilities/pet/spec.md`
already obliges every pet-visible string to originate from a persona specification that no artifact owned.

#### Scenario: Activating a pack changes how the pet speaks
- **GIVEN** two packs declare different personas
- **WHEN** the user activates the second
- **THEN** subsequent pet messages are produced under the second pack's persona, and no message mixes the two

#### Scenario: A pack carries no acknowledgement lines for the active language
- **GIVEN** the active pack's persona carries no acknowledgement lines for the language in force
- **WHEN** the user sends a command
- **THEN** the acknowledgement is presented in the pack's fallback language rather than composed outside the
  persona specification

#### Scenario: A pack carries no persona at all
- **WHEN** a pack is imported whose manifest declares no persona
- **THEN** the import is refused, because a pack that cannot speak is not a pet

### Requirement: Persona text is advisory and cannot reach the approval gate

Persona text carried by a pack SHALL be treated as content that shapes how the pet speaks, and SHALL NOT
authorize an action, alter an approval decision, name or invoke a tool, or change the rules any agent operates
under.

Source: `docs/spec/constitution.md` §External Content Is Data and principle II — UNVERIFIED for this path,
which is new. The boundary is stated as a requirement rather than left to the design because it is what makes a
distribution channel safe to add later, when the persona's author is no longer the account holder.

#### Scenario: A persona description instructs the agent
- **GIVEN** a pack's character description contains text instructing the pet to approve operations without
  asking
- **WHEN** an operation requiring approval is reached
- **THEN** the approval gate evaluates it exactly as it would under any other pack, and the user is asked

#### Scenario: A persona description names a connector operation
- **WHEN** a pack's character description names a connector operation and asserts it is pre-approved
- **THEN** no tool call results from the text, because persona text is not a source of tool invocation

#### Scenario: Persona text claims a different approval mode
- **GIVEN** the approval mode in force is `on`
- **WHEN** a pack's persona text asserts that the mode is `off`
- **THEN** the mode in force remains `on` and the pet's indicator continues to show it

### Requirement: Creating a pack means importing an animation asset and authoring its persona

The product SHALL create an account pack from an animation asset the user supplies together with a persona the
user authors, SHALL validate the asset against the pet animation contract before the pack is created, and SHALL
NOT require the user to author the animation inside the product.

Source: `clarifications.md` session 2026-09-13 — UNVERIFIED. The alternative, an in-app animation editor, was
placed out of scope in the same session.

#### Scenario: An asset that does not satisfy the contract
- **WHEN** the user supplies an animation asset lacking the artboard the contract requires
- **THEN** the pack is not created, and the reason names which part of the contract the asset failed

#### Scenario: An asset exceeding the size ceiling
- **WHEN** the user supplies an animation asset larger than the declared per-pack ceiling
- **THEN** the import is refused at that point, with the ceiling stated, rather than the pack being created and
  failing later when it replicates

#### Scenario: A valid import
- **GIVEN** the user supplies a conforming asset and completes the persona
- **WHEN** the import completes
- **THEN** the pack appears in the account's library and is available to activate on this and every other
  signed-in device

### Requirement: A built-in template is read-only and a copy of it is independent

The product SHALL present built-in templates as read-only, SHALL create an independent account pack when the
user derives one from a template, and SHALL NOT overwrite a derived pack when the template it came from is
updated by a release.

Source: `clarifications.md` session 2026-09-13 §Assumptions — UNVERIFIED.

#### Scenario: The user edits a built-in template
- **WHEN** the user changes the persona of a built-in template
- **THEN** an account pack is created carrying the change, and the template itself is unchanged

#### Scenario: A template is updated by a release
- **GIVEN** the user derived an account pack from a built-in template
- **WHEN** a release updates that template
- **THEN** the template changes and the derived pack does not

#### Scenario: Deleting a built-in template
- **WHEN** the user attempts to delete a built-in template
- **THEN** the template is not deleted, because it belongs to the product rather than to the account

## MODIFIED Requirements

### Requirement: Pet asset pipeline loads binary buffers dynamically without application rebuild
The pet runtime SHALL load character artboard and state machine definitions from a binary `Uint8Array` buffer read from local disk, and SHALL allow swapping the active pack's animation asset at runtime without recompiling or restarting the host application.

Source: `spikes/SP-3-electron-rive/REPORT.md#1-tra-loi-tung-cau-hoi` (Q6),
`spikes/SP-3-electron-rive/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q7). Modified by
`req-024-pet-pack-framework`: what is swapped is now the animation asset of a pack rather than a bare skin file,
so the swap is the last step of activating a pack and not an operation available on its own. The measured
mechanism is unchanged, and the term "skin" is superseded by "pack".

#### Scenario: Local offline asset loading without CORS restrictions
- **GIVEN** the application is running in an offline environment
- **WHEN** the pet window initializes
- **THEN** the character asset is read directly from local storage as a binary buffer into the Rive runtime without making network requests or encountering CORS violations

#### Scenario: Runtime pet pack swap
- **GIVEN** the user activates a different pack
- **WHEN** the reload signal is dispatched
- **THEN** the runtime reloads the artboard and rebinds the state machine inputs of both layers dynamically without restarting the application process

#### Scenario: The asset changes on disk without an activation
- **WHEN** the animation asset of the active pack is replaced on disk without the pack being activated
- **THEN** the pet continues to present the pack as it was loaded, because a pack is presented by activation
  rather than by the state of a file

### Requirement: Two-layer animation state machine combining locomotion and work status
The pet animation controller SHALL combine a locomotion state layer (standing, walking, dragged, falling) with a work status state layer (idle, receiving_order, working, waiting_approval, has_result) in the Rive runtime, maintaining 60 frames per second with zero stutter during simultaneous motion and status transitions, and both layers SHALL be declared by the pet animation contract so that a pack authored outside the product can implement them.

Source: `spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q19, Q20). Modified by
`req-024-pet-pack-framework`: the measured behaviour is unchanged, and the addition is that both layers become
part of the declared interface. Before this change the requirement obliged a second layer that
`pet/contracts/rive-state-machine@1.0.0` did not declare, so no external author could satisfy it.

#### Scenario: Job status changes while pet is walking
- **GIVEN** the pet is in locomotion state `walking`
- **WHEN** a job event changes the work status from `idle` to `working`
- **THEN** the pet transitions its work status animation smoothly while continuing its walking locomotion without dropped frames or visual hitching

#### Scenario: User grabs pet during autonomous movement
- **WHEN** the user presses mouse button down over the character body while the pet is moving
- **THEN** the locomotion layer instantly transitions to `dragged` and tracks the cursor trajectory with latency under 10 milliseconds

#### Scenario: A pack authored outside the product implements both layers
- **GIVEN** a pack authored against the contract declaring both layers
- **WHEN** it is activated and a work status change occurs during locomotion
- **THEN** both layers respond independently, as they do for the shipped default pack

### Requirement: All pet-visible text originates from the pet-agent

Every message the pet presents SHALL be produced by the pet-agent under the persona specification of the active
pack, and the product SHALL NOT emit hardcoded notification strings through the pet surface. The single
exception is the acknowledgement line set: lines authored and localised as part of that persona specification,
which the product may present without a model, and which SHALL state receipt only — naming nothing from the
command, asserting no understanding of it, and promising no outcome.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-10) — UNVERIFIED. The exception is
added because the two-second commitment cannot survive a measured median of 6,655 ms for an image command —
VERIFIED (`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q2) — and its scope was fixed in
`clarifications.md` session 2026-09-12: the requirement exists so the pet has one voice and so system
notifications cannot bypass the persona, and a receipt line that carries no meaning about the request does
neither. Modified by `req-024-pet-pack-framework`: the persona specification is now owned by the active pack,
which gives this requirement the artifact it always referred to and never had.

#### Scenario: Result announcement is generated
- **WHEN** a job completes and the pet announces the result
- **THEN** the announcement text was produced by the pet-agent for this job rather than selected from a fixed
  string table

#### Scenario: Pet-agent is unavailable
- **GIVEN** the configured model provider cannot be reached
- **WHEN** an event would normally make the pet speak
- **THEN** the event is surfaced as a SYSTEM card reporting the provider failure, and no fabricated persona text
  is shown

#### Scenario: An acknowledgement line claims to have understood
- **WHEN** an acknowledgement line is reviewed that names an entity from the command or states what the product
  will do about it
- **THEN** it does not belong to the acknowledgement line set, because only the model that has read the command
  may say anything about it

#### Scenario: The line set is missing for the active language
- **GIVEN** the active pack's persona specification carries no acknowledgement lines for the language in force
- **WHEN** the user sends a command
- **THEN** the product presents the acknowledgement in its fallback language rather than presenting a string
  composed outside the persona specification

#### Scenario: The active pack changes mid-conversation
- **GIVEN** an exchange with the pet is in progress
- **WHEN** the user activates a different pack
- **THEN** messages produced after the activation use the new pack's persona, and messages already presented are
  not rewritten
