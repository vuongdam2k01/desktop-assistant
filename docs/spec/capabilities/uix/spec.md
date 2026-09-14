# uix Specification

## Purpose
Owns the conversational interaction between the user and the pet: the input composer with text and images, the card types and their blocking behaviour, mid-run questions and their answers, system status cards, and the placement rules that keep a card inside the visible work area.

Seeded by `specdocs:harvest` from `docs/raw-idea/prd-mvp.md#10-yeu-cau-chuc-nang-chi-tiet-fr` — UNVERIFIED (background material, not measured evidence).

## Requirements

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
surface SHALL accept keyboard input only after the user clicks it, enforced at the operating system level
via native window styles and pre-warmed window surfaces.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-04),
`docs/raw-idea/prd-mvp.md#a-3-may-trang-thai-o-thoai`,
`spikes/SP-7-pet-window-os/REPORT.md#0-ket-luan` — VERIFIED: 10/10 typing test pass achieved when backed by
Rust native module with `WS_EX_NOACTIVATE` and HWND pre-warming.

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

### Requirement: A connector that has stopped working reaches the user as a system card

When a connector moves to a state that needs the user — its authorisation expired, its permission short, or its
authorisation withdrawn — the dialog surface SHALL present it as a SYSTEM card naming the connector, the reason
in the words the connector declared, and a control that opens the connectors area at that connector, and SHALL
NOT introduce a card type for it or raise a fresh card each time the same connector fails again.

Source: `docs/raw-idea/prd-mvp.md#10-9-module-tuong-tac-hoi-thoai-pet-amp-o-thoai-int` (FR-INT-02),
`spikes/SP-13-byo-oauth-google/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED that an authorisation obtained through
an unverified client stops working on a fixed cadence, which makes this the most frequent interruption the
product has and the one that must not accumulate cards.

#### Scenario: An authorisation expires while the user is away
- **WHEN** a connector moves to expired
- **THEN** a SYSTEM card states which connector and why, and offers a control that opens the connectors area at
  that connector

#### Scenario: The same connector fails again
- **GIVEN** a SYSTEM card for a connector is already waiting
- **WHEN** another job meets the same failing connector
- **THEN** the waiting card is updated rather than a second card being queued

#### Scenario: The connector is repaired from the application
- **GIVEN** a SYSTEM card for an expired connector is waiting
- **WHEN** the user completes reconnect in the connectors area
- **THEN** the card is withdrawn without the user having to dismiss it

#### Scenario: Do-Not-Disturb is in force
- **WHEN** a connector fails while Do-Not-Disturb is in force
- **THEN** the card is queued and the badge count increases, and nothing expands over the user's work

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

### Requirement: A non-blocking SYSTEM status card announces backend disruption and activates a pet badge

When a command cannot be immediately dispatched due to backend service disruption, the interface SHALL present a `SYSTEM` status card conforming to Appendix A.2 that is non-blocking (`isBlocking: false`), does not auto-dismiss (`autoDismiss: false`), displays a single-line explanation of local queueing and a single-line recovery action, and displays an active indicator badge on the pet window.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q9 — VERIFIED that the SYSTEM card reports the `BACKEND_DISRUPTED` condition, remains non-blocking so the composer stays usable, and anchors a visible badge to the pet.

#### Scenario: Backend disruption triggers status card and pet badge
- **GIVEN** a command failed to reach the backend service and entered the local offline queue
- **WHEN** the queueing event completes
- **THEN** a `SYSTEM` card appears explaining that commands are safely queued locally, the composer remains interactive, and a status badge appears on the pet

#### Scenario: Multiple queued commands share a single status card
- **GIVEN** a `SYSTEM` card is already active for backend disruption
- **WHEN** a second command enters the offline queue
- **THEN** no duplicate card is created; the existing status card updates its counter to reflect the total count of queued items

### Requirement: Disruption status card and badge dismiss automatically upon queue drain

When the offline command queue has drained all `QUEUED_OFFLINE` items and confirmed synchronization with the backend, the interface SHALL automatically dismiss the backend disruption `SYSTEM` card and remove the associated badge from the pet window without requiring manual user dismissal.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q9, Q10 — VERIFIED that completion of the queue sync automatically clears the disruption notification and deactivates the pet badge.

#### Scenario: Queue completes drain on connection recovery
- **GIVEN** an active `SYSTEM` card and pet badge indicating queued offline commands
- **WHEN** the background drain worker finishes syncing the last queued command
- **THEN** the `SYSTEM` status card is automatically dismissed and the badge is cleared from the pet window

### Requirement: Interactive inquiry card presents structured options and free-text input

When an agent invokes `ask_user`, the user interface SHALL render an interactive prompt displaying the question text, clickable chips for each provided option (up to 4), and a text entry field if `allow_free_text` is true, and upon timeout SHALL collapse into a pet badge.

Source: `spikes/SP-21-ask-user-offline/REPORT.md` §1 Q1, Q6 — VERIFIED that options and free-text fields are rendered, and unanswered cards collapse to badges on timeout.

#### Scenario: Inquiry renders option chips and text input
- **GIVEN** an agent calls `ask_user` with three options and `allow_free_text: true`
- **WHEN** the card renders for the user
- **THEN** three distinct option buttons and a text input box are displayed

#### Scenario: Timeout collapses inquiry into pet badge
- **GIVEN** an active inquiry card has been displayed for 30 minutes without interaction
- **WHEN** the timeout expires
- **THEN** the expanded card is dismissed and a badge indicating pending input is pinned to the pet window

### Requirement: A card is placed relative to the pet and stays inside the work area
The dialogue card layout manager SHALL position the card window adjacent to the pet window, dynamically flipping horizontally and clamping vertically to ensure the entire card geometry remains strictly inside the target display's usable work area without overflowing into screen borders or taskbars.

Source: `spikes/SP-7-pet-window-os/REPORT.md#1-tra-loi-tung-cau-hoi` (Q5),
`spikes/SP-7-pet-window-os/REPORT.md#3-2-thuat-toan-xu-ly-man-hinh-va-toa-do-q4-q5`.

#### Scenario: Pet positioned at top-right screen corner
- **GIVEN** the pet is placed against the top-right edge of the work area
- **WHEN** a card expands
- **THEN** the layout manager flips the card horizontally to open to the left of the pet, keeping all card pixels inside the work area

#### Scenario: Pet positioned at bottom-right screen corner
- **GIVEN** the pet is placed against the bottom-right corner of the screen above the taskbar
- **WHEN** a card expands
- **THEN** the layout manager flips the card to open to the left and upward relative to the pet, preventing any overlap with the system taskbar

### Requirement: Dialogue card adheres to adaptive edge flipping relative to moving pet
When a dialogue card is triggered while the pet is positioned at dynamic desktop locations, the card layout manager SHALL calculate orientation relative to the pet's current moving coordinates, flipping horizontally and vertically to remain fully visible within the current display's work area.

Source: `spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q21),
`spikes/SP-18-pet-liveness/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`.

#### Scenario: Card opens while pet is at dynamic screen boundary
- **GIVEN** the pet is walking along the right screen margin
- **WHEN** a system or result card is displayed
- **THEN** the card layout flips to render to the left of the pet, preventing clipping against the screen edge

### Requirement: The pet is withheld from screen sharing and screen recording

The pet window and its speech bubble SHALL be excluded from the frames another application captures when the
user shares or records their screen, so that presenting or recording does not broadcast the pet or the contents
of its bubble to an audience.

Source: `spikes/SP-18-pet-liveness/macos/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`,
`spikes/SP-18-pet-liveness/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q29) — VERIFIED on macOS: window content
protection removes the window from other applications' capture streams while leaving it visible to the user.

#### Scenario: The user shares their screen in a meeting

- **GIVEN** the pet is on screen with a notification in its bubble
- **WHEN** the user shares their screen
- **THEN** the audience sees the desktop without the pet and without the bubble's contents

#### Scenario: The user records their screen

- **WHEN** a screen recording is made
- **THEN** the resulting file does not contain the pet

#### Scenario: The user is looking at their own screen

- **WHEN** sharing is active
- **THEN** the pet remains visible to the user on their own display, and remains usable

### Requirement: A refused operating-system permission degrades one feature and explains it

When the user refuses a permission that a feature needs, that feature SHALL stop offering itself rather than
failing repeatedly, a system card SHALL state which feature is unavailable and what to grant to restore it, and
the card SHALL NOT reappear unprompted after the user has dismissed it once.

Source: `spikes/SP-22-macos-permissions/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`,
`spikes/SP-22-macos-permissions/REPORT.md#2-tac-dong-len-adr-prd` — VERIFIED for the detection: the product can
read whether a permission is held without raising a prompt, which is what allows the feature to withdraw
quietly instead of provoking the operating system.

#### Scenario: The user declines a permission a feature needs

- **GIVEN** a feature that needs a privacy permission
- **WHEN** the user declines it
- **THEN** a system card names the feature, says what is needed and how to grant it, and the feature stops
  presenting itself

#### Scenario: The user dismisses the card

- **WHEN** the user dismisses the card without granting the permission
- **THEN** the card does not return on its own, and the feature stays withdrawn until the user asks for it

#### Scenario: The permission is granted later

- **WHEN** the user grants the permission afterwards
- **THEN** the feature becomes available again without the user having to reinstall or reconfigure anything
