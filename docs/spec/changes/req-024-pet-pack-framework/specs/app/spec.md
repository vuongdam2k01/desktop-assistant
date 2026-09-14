## ADDED Requirements

### Requirement: The settings area presents the product's catalogue and the account's own packs separately

The pet settings SHALL present built-in templates and the account's own packs as two distinguishable groups,
and SHALL state for each pack whether it is supplied by the product or belongs to the account.

Source: decision-maker directive 2026-09-13, recorded in `proposal.md` — UNVERIFIED. The separation is required
rather than cosmetic because the two groups differ in what the user may do to them: a template cannot be edited
or deleted, and an account pack can.

#### Scenario: Both groups are populated
- **WHEN** the user opens the pet settings with two account packs created and a catalogue available
- **THEN** the templates and the account's packs are presented as separate groups, each pack stating which it is

#### Scenario: The account has created nothing
- **WHEN** a user who has created no pack opens the pet settings
- **THEN** the account group states that it is empty and offers creation, rather than being absent from the
  surface

#### Scenario: The catalogue cannot be reached
- **GIVEN** the backend cannot be reached
- **WHEN** the user opens the pet settings
- **THEN** the templates already present on the device are listed and usable, and the surface states that the
  catalogue could not be refreshed

### Requirement: The user can see what a pack looks like before activating it

The pet settings SHALL present, for every pack it lists, the pack's name, the capabilities it declares, and a
preview of its character, before the user activates it.

Source: decision-maker directive 2026-09-13, recorded in `proposal.md` — UNVERIFIED.

#### Scenario: A pack declaring fewer capabilities
- **WHEN** a pack that does not implement the locomotion layer is listed
- **THEN** the listing states which capabilities it implements, so the user learns before activating that this
  pet will move using the default behaviour

#### Scenario: A pack that cannot be previewed
- **WHEN** a listed pack's asset cannot be read
- **THEN** the pack is listed as damaged with the reason, rather than being omitted silently or presented as
  activatable

### Requirement: Activation, creation and deletion of packs happen in the settings area

The pet settings SHALL allow the user to activate any listed pack, to create an account pack, and to delete an
account pack; and deletion of the active pack SHALL leave a pack active.

Source: decision-maker directive 2026-09-13, recorded in `proposal.md` — UNVERIFIED.

#### Scenario: Deleting the active pack
- **GIVEN** the active pack is an account pack
- **WHEN** the user deletes it
- **THEN** the deletion completes, a built-in template becomes active, and the surface states which pack is now
  active

#### Scenario: Deletion is confirmed before it happens
- **WHEN** the user deletes an account pack
- **THEN** the surface states that the pack will be removed from every device signed in to the account, and the
  deletion proceeds only on confirmation

#### Scenario: Activation of a pack that fails to load
- **WHEN** the user activates a pack whose asset cannot be read
- **THEN** the previously active pack stays on screen, the failure is reported with its reason, and the listing
  marks the pack as damaged

### Requirement: Creating a pack reports what the supplied asset failed

When the user supplies an animation asset that the product cannot accept, the pet settings SHALL state which
condition the asset failed, distinguishing an asset that does not satisfy the animation contract, an asset
larger than the permitted size, and an asset that cannot be read at all.

Source: `clarifications.md` session 2026-09-13 — UNVERIFIED. The distinction is required because the three have
different remedies: re-author the asset, reduce it, or supply a different file.

#### Scenario: An asset lacking a required part of the contract
- **WHEN** the user supplies an asset that does not carry the artboard the contract requires
- **THEN** the surface names the missing part, rather than reporting a generic failure

#### Scenario: An asset over the size ceiling
- **WHEN** the user supplies an asset exceeding the permitted size
- **THEN** the surface states both the asset's size and the ceiling

#### Scenario: A file that is not an animation asset at all
- **WHEN** the user supplies a file the runtime cannot read as an animation asset
- **THEN** the surface reports that the file could not be read, and no pack is created

## MODIFIED Requirements

### Requirement: The application window holds four areas

The application window SHALL provide a connectors area listing every available platform with its connection
state, its connect, reconnect and disconnect actions, and — where the platform declares one — the route in which
the user supplies their own authorisation client; a jobs area with the list and the detail view; an approval area
with the mode, the rules and the waiting queue; and a settings area covering the pet and its packs,
notifications, launch at login, and the account with its sync state and enrolled devices.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-01),
`docs/spec/changes/req-022-account-sync/proposal.md`,
`spikes/SP-13-byo-oauth-google/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` — UNVERIFIED for the areas themselves;
the bring-your-own route belongs in the connectors area because it is a way of connecting a platform, and it is
offered only for platforms whose data declares it. Modified by `req-024-pet-pack-framework`: the settings area's
pet coverage is named as covering its packs, because pack management is where the user changes which pet they
have and that surface had no home before.

#### Scenario: Every waiting decision is reachable in one place
- **WHEN** any approval or question is waiting
- **THEN** it is present in the approval area regardless of which surface raised it

#### Scenario: A platform that is not yet connected
- **WHEN** the connectors area is opened
- **THEN** platforms that are available but not connected are listed with a connect action, not hidden

#### Scenario: Reaching the account's devices
- **WHEN** the user opens the settings area
- **THEN** the account's sync state and its enrolled devices are reachable there

#### Scenario: A platform offering the bring-your-own route
- **WHEN** the connectors area shows a platform whose data declares the bring-your-own route
- **THEN** that route is offered beside the standard connect action, and for a platform that declares no such
  route it is absent

#### Scenario: Reaching the pet's packs
- **WHEN** the user opens the settings area
- **THEN** the catalogue of templates and the account's own packs are reachable there
