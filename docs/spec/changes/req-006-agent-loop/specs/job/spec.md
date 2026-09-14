## MODIFIED Requirements

### Requirement: A simple job completes within the expected time

A job that performs a single straightforward operation SHALL complete end to end with a median duration of at
most 30 seconds.

Source: `docs/raw-idea/prd-mvp.md#11-1-hieu-nang` (NFR-PF-05); `spikes/SP-4-agent-loop/REPORT.md` §1 Q4 — VERIFIED;
the measured median duration across 7 simple job runs on real Notion was 16.9 seconds, well within the 30-second
threshold.

#### Scenario: Creating one task
- **WHEN** the user hands over a command that creates a single task and the job runs to completion
- **THEN** the median measured duration across repeated runs is at most 30 seconds
