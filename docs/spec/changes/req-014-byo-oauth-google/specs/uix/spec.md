## ADDED Requirements

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
