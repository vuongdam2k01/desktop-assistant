## ADDED Requirements

### Requirement: A record the store reports as written survives sudden power loss

A ledger record SHALL NOT be reported as written until its bytes have reached durable media on the device,
including any write cache the storage hardware holds, so that a power failure or kernel panic immediately
afterwards leaves the record present rather than lost.

Source: `spikes/SP-12-sqlite-ledger/macos/REPORT.md#0-ket-luan`,
`spikes/SP-12-sqlite-ledger/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3) — VERIFIED on macOS: 200 of 200
injected crashes left every committed record present once the physical-flush setting was on. The same section
records that with the setting off the operating system reports success before the data has left the drive
cache, which is the condition this requirement forbids.

#### Scenario: Power is cut immediately after a record is reported written

- **GIVEN** the store has reported a ledger record as written
- **WHEN** the machine loses power before any further write
- **THEN** the record is present when the store is next opened

#### Scenario: The operating system acknowledges a write before the hardware does

- **GIVEN** the operating system reports a write as complete once the bytes reach the drive's own cache
- **WHEN** the ledger writes a record on that operating system
- **THEN** the store requests a flush that reaches durable media, and reports the record written only after
  that flush returns

#### Scenario: A tool call proceeds on a record that is not yet durable

- **WHEN** a tool call is about to execute against a record whose durable flush has not returned
- **THEN** the call does not execute, because the record it depends on is not yet guaranteed to exist

### Requirement: The cost of durability is confined to the ledger and the job store

The physical-flush guarantee SHALL apply to the ledger and the job store alone, and SHALL NOT be applied to
caches, scratch data, transcripts or any other local store, so that the throughput it costs is paid only where
a lost record would break the record of what happened.

Source: `spikes/SP-12-sqlite-ledger/macos/REPORT.md#1-tra-loi-tung-cau-hoi` (Q3),
`spikes/SP-12-sqlite-ledger/macos/REPORT.md#4-rui-ro-moi-phat-hien` — VERIFIED: the measurement records
28,000 writes per second without the guarantee and 241 with it, and commit latency rising from 0.028 ms to
4.033 ms at the median, which is why the scope is stated rather than left to the implementation.

#### Scenario: A cache or scratch store is opened

- **WHEN** the product opens a local store that is neither the ledger nor the job store
- **THEN** that store is opened without the physical-flush setting

#### Scenario: A write rate is assumed elsewhere in the design

- **GIVEN** a design assumes a ledger write rate
- **WHEN** that assumption is checked on an operating system requiring the physical flush
- **THEN** the rate assumed is no higher than the measured durable rate on that operating system
