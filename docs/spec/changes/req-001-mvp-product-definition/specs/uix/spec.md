## ADDED Requirements

### Requirement: Dialog surface shows exactly one card at a time

The dialog surface SHALL display at most one card at any moment, SHALL show the number of waiting cards as a
badge on the pet, and SHALL let the user step through the waiting cards with previous and next controls.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-01),
`docs/raw-idea/prd-mvp.md#a-1-mo-hinh-khai-niem-ba-lop-cua-pet-surface` — UNVERIFIED.

#### Scenario: Second card arrives while one is displayed
- **GIVEN** a RESULT card is displayed
- **WHEN** a second RESULT card is produced by another job
- **THEN** the displayed card is unchanged, the badge count increases to two, and the second card is reachable
  through the next control

#### Scenario: Stepping through the queue
- **GIVEN** three cards are waiting
- **WHEN** the user activates the next control twice
- **THEN** the third card is displayed and the other two remain in the queue

### Requirement: Only seven card types exist

Every message presented on the dialog surface SHALL be one of exactly seven card types — ACK, PROGRESS, ASK,
APPROVAL, RESULT, ERROR, SYSTEM — each rendered with the anatomy defined for its type.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-02),
`docs/raw-idea/prd-mvp.md#a-2-he-card-anatomy-chuan-tung-loai` — UNVERIFIED.

#### Scenario: A condition with no matching card type
- **WHEN** a condition arises that does not fit any of the seven types, such as a connector credential expiring
- **THEN** it is presented as a SYSTEM card, and no eighth card type is introduced

#### Scenario: Every card carries the common frame
- **WHEN** any card is displayed
- **THEN** it shows its type icon, the shortened job name when it relates to a job, an Open-in-app control and a
  close or collapse control

### Requirement: Dialog surface follows a defined state machine

The dialog surface SHALL occupy exactly one of the states HIDDEN, COMPOSER or CARD; clicking the pet SHALL open
the highest-priority waiting card when the queue is non-empty and the composer when it is empty; and the CARD
state SHALL always offer a route to the composer.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-03),
`docs/raw-idea/prd-mvp.md#a-3-may-trang-thai-o-thoai` — UNVERIFIED.

#### Scenario: Click with a blocking card waiting
- **GIVEN** an APPROVAL card and a RESULT card are waiting
- **WHEN** the user clicks the pet
- **THEN** the APPROVAL card is displayed, because it outranks RESULT

#### Scenario: Escape leaves a blocking card intact
- **GIVEN** an ASK card is displayed and unanswered
- **WHEN** the user presses Escape
- **THEN** the dialog surface closes, the ASK card returns to the queue as a badge, and it is not dismissed

#### Scenario: Handing over new work while reading a card
- **GIVEN** a RESULT card is displayed
- **WHEN** the user activates the route to the composer
- **THEN** the composer opens ready for a new command and the RESULT card returns to the queue

### Requirement: An auto-expanded card never takes keyboard focus

A card that expands on its own SHALL NOT take keyboard focus from the foreground application; the dialog
surface SHALL accept keyboard input only after the user clicks it.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-04),
`docs/raw-idea/prd-mvp.md#a-3-may-trang-thai-o-thoai` — UNVERIFIED; this is the interaction commitment the
product is built around and is measured in `req-008-pet-window-os`.

#### Scenario: Card expands while the user is typing elsewhere
- **GIVEN** the user is typing in another application
- **WHEN** an APPROVAL card expands on the dialog surface
- **THEN** every keystroke continues to reach the other application and the caret does not move

#### Scenario: User chooses to interact with the card
- **GIVEN** an expanded ASK card that has not been clicked
- **WHEN** the user clicks the card
- **THEN** the dialog surface takes keyboard focus and accepts typed input

### Requirement: Card queue follows a fixed priority order

The card queue SHALL order display by ASK and APPROVAL first — first-in-first-out between them — then ERROR,
then RESULT, then ACK and PROGRESS; a new card from a job SHALL replace that job's own waiting non-blocking
card; and a blocking card SHALL NOT be replaced automatically.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-05),
`docs/raw-idea/prd-mvp.md#a-4-hang-doi-amp-quy-tac-uu-tien` — UNVERIFIED.

#### Scenario: Progress superseded by a result from the same job
- **GIVEN** a PROGRESS card for job A is waiting
- **WHEN** job A completes and produces a RESULT card
- **THEN** the PROGRESS card is replaced by the RESULT card and the queue length is unchanged

#### Scenario: Blocking card is not displaced by an error
- **GIVEN** an unanswered APPROVAL card for job A is displayed
- **WHEN** job B fails and produces an ERROR card
- **THEN** the APPROVAL card remains displayed and the ERROR card waits in the queue

#### Scenario: Several cards arrive at once
- **WHEN** four cards are produced within the same second
- **THEN** the dialog surface expands once for the highest-priority card, and the rest enter the queue without
  further expansions

### Requirement: ASK card presents one question with bounded options

An ASK card SHALL present a single question, between zero and four option buttons whose labels are at most 30
characters, a free-text input enabled by default, an Open-in-app control and a skip-and-cancel-job control,
while the job stands in `waiting_input`.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-06),
`docs/raw-idea/prd-mvp.md#a-5-co-che-ask-dac-ta-tool-ask-user` — UNVERIFIED.

#### Scenario: Free text contradicts every option
- **GIVEN** an ASK card offering three options
- **WHEN** the user types an answer that matches none of them
- **THEN** the typed answer is taken as the authoritative answer and the job resumes with it

#### Scenario: User declines to answer
- **WHEN** the user activates skip-and-cancel-job on an ASK card
- **THEN** the job is cancelled at the current tool-call boundary and the user is offered an undo of what was
  already done

### Requirement: APPROVAL card renders hook data without model rewording

An APPROVAL card SHALL show the intended action, the target object, the expected before-and-after values and the
rule that triggered the block, and SHALL render those fields directly from the hook payload rather than from
model-generated text.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-08),
`docs/raw-idea/prd-mvp.md#a-6-approval-card-chi-tiet-hanh-vi` — UNVERIFIED.

#### Scenario: Dangerous operation is described verbatim
- **GIVEN** a hook blocks the archival of twelve tasks
- **WHEN** the APPROVAL card is rendered
- **THEN** the object list and the before-and-after values come from the hook payload, and no agent-authored
  paraphrase of the operation replaces them

#### Scenario: Decision taken in the application window
- **GIVEN** the same approval is visible in both the dialog surface and the application window
- **WHEN** the user approves it in the application window
- **THEN** the card leaves the dialog surface within one second and the queue count decreases

### Requirement: APPROVAL card offers all four decision levels

An APPROVAL card SHALL offer approve-once, approve-this-operation-type-within-this-job, add-to-permanent-
allowlist and deny; the permanent allowlist decision SHALL require one additional confirmation step.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-09) — UNVERIFIED.

#### Scenario: Accidental allowlist press is caught
- **WHEN** the user activates add-to-permanent-allowlist
- **THEN** a confirmation step is presented, and the allowlist entry is created only after that confirmation

#### Scenario: Job-scoped approval expires with the job
- **GIVEN** the user approved an operation type for the current job
- **WHEN** that job ends and a new job requests the same operation type
- **THEN** the operation is evaluated again and a new approval is requested

### Requirement: Card dismissal behaviour is defined per type

ACK cards SHALL hide themselves after 5 seconds and RESULT cards after 30 seconds, configurable between 10 and
120 seconds; ASK, APPROVAL, ERROR and SYSTEM cards SHALL NOT hide themselves and SHALL collapse to a badge
after 60 seconds of continuous display.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-10),
`docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-05) — UNVERIFIED.

#### Scenario: Unanswered approval collapses but is not lost
- **GIVEN** an APPROVAL card has been displayed for 60 seconds without a decision
- **WHEN** the collapse threshold is reached
- **THEN** the card collapses to a badge, the job stays in `waiting_approval`, and the card reopens on click

#### Scenario: Result summary length
- **WHEN** a RESULT card is rendered
- **THEN** its summary is at most 200 characters and opens the job detail page when activated

### Requirement: Do-Not-Disturb suppresses every automatic expansion

In Do-Not-Disturb mode no card SHALL expand on its own, every card SHALL accumulate in the badge, and the
mode SHALL be toggleable from the pet context menu and from the application window while remaining visible on
the pet.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-11) — UNVERIFIED.

#### Scenario: Blocking card during Do-Not-Disturb
- **GIVEN** Do-Not-Disturb is on
- **WHEN** an APPROVAL card is produced
- **THEN** it goes to the badge without expanding, and the job waits rather than proceeding

#### Scenario: Leaving Do-Not-Disturb
- **GIVEN** four cards accumulated during Do-Not-Disturb
- **WHEN** the user turns Do-Not-Disturb off
- **THEN** the dialog surface expands once with the highest-priority card and the remainder stay in the queue

### Requirement: Composer accepts text and images with declared limits

The composer SHALL accept typed text and images by paste and by drag-and-drop, at most 3 images per command and
at most 10 MB per image, and SHALL accept a new command while other jobs are running.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-04),
`docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-13) — UNVERIFIED; both
limits are marked as proposed in the source.

#### Scenario: Oversized image is refused with an explanation
- **WHEN** the user pastes an image larger than 10 MB
- **THEN** the composer refuses that image, states the limit, and keeps any text already typed

#### Scenario: Fourth image
- **GIVEN** three images are already attached
- **WHEN** the user drops a fourth
- **THEN** the composer refuses it and states the per-command limit

#### Scenario: Keyboard conventions
- **WHEN** the user presses Enter, Shift+Enter or Escape in the composer
- **THEN** the command is sent, a line break is inserted, or the composer closes, respectively

### Requirement: Approve and deny are equivalent on both surfaces

Approve and deny controls presented on the dialog surface SHALL have the same effect as the equivalent controls
in the application window, and a decision taken on one surface SHALL be reflected on the other within one
second.

Source: `docs/raw-idea/prd-mvp.md#10-1-module-pet-amp-o-thoai-pet` (FR-PET-06),
`docs/raw-idea/prd-mvp.md#a-9-dong-bo-o-thoai-cua-so-app` — UNVERIFIED.

#### Scenario: Both surfaces act at once
- **GIVEN** the same approval is open on both surfaces
- **WHEN** decisions are submitted from both within the same moment
- **THEN** exactly one decision is recorded and the later surface is told the request was already handled

### Requirement: Operating-system notifications are used only while the pet is hidden

While the pet is hidden, blocking cards and ERROR cards SHALL be delivered as operating-system notifications,
and while the pet is visible the dialog surface SHALL be the only notification channel.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-14),
`docs/raw-idea/prd-mvp.md#a-7-quy-tac-chong-xao-nhang-tong-hop-muc-bat-buoc` — UNVERIFIED.

#### Scenario: No duplicate announcement
- **GIVEN** the pet is visible
- **WHEN** an ERROR card is produced
- **THEN** it appears on the dialog surface only, with no operating-system notification

#### Scenario: Notification while hidden opens the right context
- **GIVEN** the pet is hidden and an approval is requested
- **WHEN** the user activates the operating-system notification
- **THEN** the application window opens at that approval request

### Requirement: Card queue is rebuilt after a restart

After a crash or restart, every blocking card SHALL be reconstructed from job state and the ledger, and the
queue SHALL be rebuilt in the defined priority order.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-15),
`docs/raw-idea/prd-mvp.md#a-10-edge-cases-bat-buoc-xu-ly` (E5) — UNVERIFIED.

#### Scenario: Crash with an unanswered approval
- **GIVEN** a job is in `waiting_approval` with an unanswered APPROVAL card
- **WHEN** the application is killed and started again
- **THEN** the job is still in `waiting_approval` and the APPROVAL card is present in the queue

#### Scenario: Job cancelled while a card was open
- **GIVEN** an ASK card is displayed for a job
- **WHEN** that job is cancelled
- **THEN** the card is withdrawn from both the dialog surface and the application window, and the cancellation is
  recorded in the ledger

### Requirement: Cards do not duplicate into a focused application window

When the application window has focus, a new card SHALL be surfaced in the application window rather than
expanding on the dialog surface.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-16, priority
Should) — UNVERIFIED.

#### Scenario: Result arrives while the user is reading the job list
- **GIVEN** the application window has focus
- **WHEN** a job completes
- **THEN** the result appears in the application window, the dialog surface does not expand, and the pet still
  changes animation

### Requirement: Every interface string passes through the localisation layer

All interface text SHALL be resolved through the localisation layer in Vietnamese and English, selectable in
settings and defaulting to the operating-system language, and SHALL NOT be hardcoded at the point of use.

Source: `docs/raw-idea/prd-mvp.md#11-4-kha-dung-amp-tuong-thich` (NFR-CP-03) — UNVERIFIED.

#### Scenario: Language switch takes effect
- **GIVEN** the interface is in Vietnamese
- **WHEN** the user selects English in settings
- **THEN** every interface string is presented in English without restarting the application

#### Scenario: Agent-generated text follows the conversation
- **WHEN** the user writes a command in Vietnamese while the interface language is English
- **THEN** the pet replies in Vietnamese, because agent-generated text follows the language of the conversation
  rather than the interface setting
