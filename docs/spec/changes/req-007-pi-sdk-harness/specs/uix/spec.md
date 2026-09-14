## MODIFIED Requirements

### Requirement: Composer accepts text and images with declared limits

The composer SHALL accept typed text and images by paste and by drag-and-drop, at most 3 images per command,
at most 10 MB per image and no smaller than 14 pixels in either dimension, and SHALL accept a new command while
other jobs are running.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-04),
`docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-13) — UNVERIFIED; both
size limits are marked as proposed in the source. The minimum dimension is VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien`): the vision endpoint refuses an image smaller than 14
pixels in either direction with a protocol error, so an image that reached the provider would fail the job
instead of the composer explaining itself. One product-wide floor rather than a per-provider floor was decided in
`clarifications.md` §Assumptions.

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
