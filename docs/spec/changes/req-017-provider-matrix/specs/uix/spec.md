## ADDED Requirements

### Requirement: A provider failure reaches the user as a system card

When a model request fails with a classified cause, the dialog surface SHALL present it as a SYSTEM card
carrying the profile it concerns, the cause in the words the classification declared, and the single control
that opens the settings area where it is repaired; SHALL update the waiting card rather than queue a second one
when the same cause recurs for the same profile; and SHALL withdraw the card once the condition is repaired,
without the user dismissing it.

Source: `spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5) — VERIFIED: each of the three
exercised failures produced a card of this shape with a remedy control, and the badge persisted until the
configuration was corrected; `spikes/SP-17-provider-matrix/evidence/system-cards.json`. The card type is the
existing SYSTEM type — no eighth type is introduced — and the update-rather-than-accumulate rule follows the one
the `uix` capability already applies to a connector that has stopped working.

#### Scenario: A credential is refused while a job runs
- **WHEN** a job fails because the provider refused the credential
- **THEN** the job's own ERROR card reports the failed job and one SYSTEM card reports the configuration
  condition, rather than the same condition being raised once per job

#### Scenario: The same cause recurs on the same profile
- **GIVEN** a SYSTEM card for a refused credential on one profile is waiting
- **WHEN** another job meets the same cause on that profile
- **THEN** the waiting card is updated and the queue length is unchanged

#### Scenario: A different cause on the same profile
- **GIVEN** a SYSTEM card for an exhausted quota is waiting
- **WHEN** a request to the same profile fails because the model is no longer available
- **THEN** a second SYSTEM card is raised, because the two conditions are repaired in different places

#### Scenario: The user repairs the configuration
- **GIVEN** a SYSTEM card for a refused credential is waiting
- **WHEN** the user saves a credential the provider accepts
- **THEN** the card is withdrawn without the user having to dismiss it

#### Scenario: Do-Not-Disturb is in force
- **WHEN** a provider failure is classified while Do-Not-Disturb is in force
- **THEN** the card is queued and the badge count increases, and nothing expands over the user's work

### Requirement: An acknowledgement card may exist before its job does

The dialog surface SHALL present an acknowledgement card for a command that has not yet produced a job, showing
the common card frame without a job name; SHALL adopt the job's name on that card once the job is created; and
SHALL let that job's first PROGRESS, RESULT or ERROR card replace it under the queue's existing replacement
rule.

Source: `spikes/SP-17-provider-matrix/REPORT.md#2-tac-dong-len-adr-prd` item 3 — VERIFIED as the architecture
that keeps the response commitment: the acknowledgement is presented on send, before any model has answered and
therefore before a job exists.

#### Scenario: The card appears before the job
- **WHEN** the user sends a command
- **THEN** an ACK card is displayed carrying the card frame without a job name, and it does not wait for a job
  identity to exist

#### Scenario: The job is created a moment later
- **GIVEN** an ACK card is displayed for a command
- **WHEN** the pet-agent creates the job for that command
- **THEN** the card shows that job's shortened name, and its Open-in-app control opens that job

#### Scenario: No job is ever created
- **GIVEN** an ACK card is displayed and the pet-agent answers without creating a job
- **WHEN** the acknowledgement's dismissal time is reached
- **THEN** the card hides itself under the rule for its type, leaving nothing that points at a job that does not
  exist

#### Scenario: The command fails before a job exists
- **GIVEN** an ACK card is displayed
- **WHEN** the model request fails with a classified cause before a job is created
- **THEN** the SYSTEM card for that cause is queued and the acknowledgement card is not rewritten into an error

## MODIFIED Requirements

### Requirement: Composer accepts text and images with declared limits

The composer SHALL accept typed text and images by paste and by drag-and-drop, at most 3 images per command,
at most 10 MB per image and no smaller than 14 pixels in either dimension, and SHALL accept a new command while
other jobs are running. When the pet image role has no assignment the composer SHALL present its image
attachment controls as unavailable, SHALL state that the configured models cannot read images and where that is
changed, and SHALL refuse an image arriving by any other path rather than allowing a request that the provider
would reject or answer with nothing.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-04),
`docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-13) — UNVERIFIED; both
size limits are marked as proposed in the source. The minimum dimension is VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien`): the vision endpoint refuses an image smaller than 14
pixels in either direction with a protocol error, so an image that reached the provider would fail the job
instead of the composer explaining itself. One product-wide floor rather than a per-provider floor was decided in
`clarifications.md` §Assumptions. The capability gate is added here and is VERIFIED as necessary
(`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q1,
`spikes/SP-17-provider-matrix/REPORT.md#4-rui-ro-moi-phat-hien`): two text models rejected images outright, and
one of those rejections returned an empty response with no error at all, so the composer is the last place the
condition can be explained rather than merely observed.

#### Scenario: Oversized image is refused with an explanation
- **WHEN** the user pastes an image larger than 10 MB
- **THEN** the composer refuses that image, states the limit, and keeps any text already typed

#### Scenario: Fourth image
- **GIVEN** three images are already attached
- **WHEN** the user drops a fourth
- **THEN** the composer refuses it and states the per-command limit

#### Scenario: Undersized image is refused before the job exists
- **WHEN** the user pastes an image narrower or shorter than 14 pixels
- **THEN** the composer refuses that image and states the minimum, and no job is created that would fail at the
  provider

#### Scenario: An image at the boundary is accepted
- **WHEN** the user attaches an image exactly 14 pixels in its smaller dimension
- **THEN** the composer accepts it, because the floor is the smallest accepted size rather than the largest
  refused one

#### Scenario: Keyboard conventions
- **WHEN** the user presses Enter, Shift+Enter or Escape in the composer
- **THEN** the command is sent, a line break is inserted, or the composer closes, respectively

#### Scenario: No image-capable model is configured
- **GIVEN** the pet image role has no assignment
- **WHEN** the user opens the composer
- **THEN** the image attachment controls are unavailable and carry an explanation naming where an image-capable
  model is configured

#### Scenario: An image is dropped while attachment is unavailable
- **GIVEN** the pet image role has no assignment
- **WHEN** the user drops an image onto the composer
- **THEN** the image is refused with the same explanation and no request carrying it is sent

#### Scenario: An image-capable model is configured while the composer is open
- **GIVEN** the composer is open with attachment unavailable
- **WHEN** the user assigns an image-capable model to the pet image role
- **THEN** the attachment controls become available without the composer being reopened

#### Scenario: A draft carrying images is opened on a device that cannot send them
- **GIVEN** a command draft carrying an image was composed on another device
- **WHEN** it is opened here and the pet image role is unusable on this device
- **THEN** the draft's text is kept, its images are held unsent with the reason stated, and nothing is sent that
  would return empty
