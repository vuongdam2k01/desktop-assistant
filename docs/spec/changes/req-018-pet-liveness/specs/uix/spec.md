## ADDED Requirements

### Requirement: Dialogue card adheres to adaptive edge flipping relative to moving pet
When a dialogue card is triggered while the pet is positioned at dynamic desktop locations, the card layout manager SHALL calculate orientation relative to the pet's current moving coordinates, flipping horizontally and vertically to remain fully visible within the current display's work area.

Source: `spikes/SP-18-pet-liveness/REPORT.md#1-tra-loi-tung-cau-hoi` (Q21),
`spikes/SP-18-pet-liveness/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`.

#### Scenario: Card opens while pet is at dynamic screen boundary
- **GIVEN** the pet is walking along the right screen margin
- **WHEN** a system or result card is displayed
- **THEN** the card layout flips to render to the left of the pet, preventing clipping against the screen edge
