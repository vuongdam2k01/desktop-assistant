## ADDED Requirements

### Requirement: Tools reach the harness only through the wrapping factory

Every tool held by any agent SHALL be produced by a single wrapping factory that takes a tool implementation and
returns a wrapped tool, the agent harness SHALL be started holding no tool the factory did not return, and a tool
that touches no external platform SHALL declare the internal origin and be evaluated like any other call rather
than being exempted; the product SHALL NOT depend on any call-interception facility the harness itself provides
for this guarantee.

Source: `spikes/SP-6-pi-sdk/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 and `spikes/SP-6-pi-sdk/REPORT.md`
§1 Q2 — VERIFIED; the wrapped tool refused a forbidden call with the implementation never invoked, and it refused
identically when the harness's own interception facility was deliberately left unconfigured, which is what
establishes that the guarantee does not rest on the harness. The harness loads no tools by default —
VERIFIED (`spikes/SP-6-pi-sdk/REPORT.md` §1 Q1). That the single path admits no trusted-tool exception was decided
in `clarifications.md` session 2026-09-12.

#### Scenario: The harness's own interception facility is not configured
- **GIVEN** a session is started without configuring the harness's call-interception facility
- **WHEN** the agent issues a call the gate refuses
- **THEN** the tool implementation is not invoked, and the refusal is identical to the one produced when the
  facility is configured

#### Scenario: The pet-agent's own tools take the same path
- **WHEN** the tools the pet-agent holds are enumerated
- **THEN** each one is a wrapped tool declaring the internal origin, and none of them reached the agent by a
  second registration route

#### Scenario: A tool implementation offered directly to the harness
- **WHEN** a session is constructed from anything other than the factory's output
- **THEN** the construction fails rather than starting a session holding an unwrapped tool

#### Scenario: The harness is started with no tools supplied
- **GIVEN** a session constructed without a tool set
- **WHEN** the agent's available tools are enumerated
- **THEN** the set is empty, and no file-system, shell or editing tool is present to be inherited

### Requirement: Each harness session holds its own state and shares nothing with another

Concurrent harness sessions in one process SHALL each hold their own transcript, their own tool set and their own
suspension state, SHALL NOT read or write any state belonging to another session, and no content from one
session SHALL appear in another's transcript or in the request it sends to a model provider.

Source: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q4 — VERIFIED; three sessions ran concurrently in one process, each
holding a distinct secret, and a cross-check of all three transcripts found no value belonging to another
session. The same section records that a downstream fork of the harness holds this state in a process-wide
singleton, which is why the identity requirement below is part of this guarantee rather than separate from it.

#### Scenario: Three jobs run at once
- **GIVEN** three jobs are running, each with its own session
- **WHEN** each session is asked for information only its own job was given
- **THEN** each answers from its own transcript alone, and none reproduces another's content

#### Scenario: One session is suspended while the others run
- **GIVEN** one session is suspended at a held call
- **WHEN** the other sessions continue
- **THEN** they continue unaffected, and the suspension is not observable in their transcripts

#### Scenario: One session fails
- **GIVEN** two sessions are running
- **WHEN** one fails with a provider error
- **THEN** the other completes normally and its transcript contains no trace of the failure

### Requirement: A resumed run continues at its suspension point without repeating completed work

When a run is resumed after a suspension, the tool calls already completed in that run SHALL NOT be issued again,
the resumed run SHALL continue from the turn that was suspended, and this SHALL hold whether the session was
still in memory or was rebuilt from the stored transcript after the process stopped.

Source: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q3 — VERIFIED in both modes; with the session still alive, the earlier
read was not re-issued when the held write was approved, and with the session rebuilt from stored turns after a
simulated stop, the earlier read was issued zero times while the approved write was issued once. That the stored
transcript is the state and the live suspension only an optimisation over it was decided in `clarifications.md`
session 2026-09-12.

#### Scenario: Approval arrives while the session is still alive
- **GIVEN** a run completed a read and is suspended at a held write
- **WHEN** the user approves
- **THEN** the write is executed, the read is not re-issued, and the run reports on both

#### Scenario: Approval arrives after the process stopped
- **GIVEN** a run was suspended at a held write and the process stopped afterwards
- **WHEN** the product starts again and the user approves
- **THEN** the session is rebuilt from the stored transcript, the approved write is executed once, the earlier
  read is not re-issued, and the run continues to its report

#### Scenario: The transcript is written before the job reports it is waiting
- **WHEN** a call is held
- **THEN** the turns completed so far are durable before the job is shown as waiting, so a stop at that instant
  loses no completed step

#### Scenario: Resume after cancellation is refused
- **GIVEN** a run was suspended and its job was then cancelled
- **WHEN** a decision for the held call arrives
- **THEN** nothing is executed and no session is rebuilt

### Requirement: The agent harness is pinned to one package identity and one version

The product SHALL depend on the agent harness only at the package identity and versions recorded as verified,
SHALL pin them in its dependency lockfile, and a build that resolves the similarly named alternative distribution
of the harness SHALL fail rather than ship.

Source: `spikes/SP-6-pi-sdk/REPORT.md` §1 Q9 and `spikes/SP-6-pi-sdk/REPORT.md#6-phien-ban-chinh-xac-cua-moi-package-cong-cu`
— VERIFIED; the canonical distribution is the one that was measured, and the alternative distribution targets a
different runtime and holds its pause state in a process-wide singleton, which would break the isolation
requirement above. `spikes/SP-6-pi-sdk/REPORT.md#4-rui-ro-moi-phat-hien` records the confusion between the two
namespaces as a risk in its own right.

#### Scenario: A build resolves the alternative distribution
- **WHEN** a dependency change causes the alternative distribution of the harness to be installed
- **THEN** the build fails and names the package it refused

#### Scenario: The harness version moves without a decision
- **WHEN** the installed harness version differs from the pinned one
- **THEN** the build fails rather than shipping an unmeasured runtime

#### Scenario: A harness upgrade is taken deliberately
- **GIVEN** a change raises the pinned harness version
- **WHEN** that change is proposed
- **THEN** the wrapping, suspension and isolation checks are re-run against the new version before the pin is
  accepted, because the pin is what the measured results are attached to

## MODIFIED Requirements

### Requirement: Model provider and role routing are configured on the client

The client SHALL let the user configure a provider profile carrying a credential for a named provider or a
custom endpoint that speaks a completion protocol the harness supports, SHALL NOT offer an interactive
provider sign-in, SHALL store provider credentials in operating-system secure storage, and SHALL hold the mapping
from role — pet-agent, worker-agent, rule elicitation, undo — to model as application configuration with
recommended defaults that the user can change without a new release.

Source: `docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-11) — the clause's interactive sign-in is
CORRECTED here: the embedded path exposes a per-provider credential and a custom endpoint descriptor and has no
interactive sign-in, and the harness's publisher sells no subscription — VERIFIED
(`spikes/SP-6-pi-sdk/REPORT.md` §1 Q5, `spikes/SP-6-pi-sdk/REPORT.md#2-tac-dong-len-adr-prd` item 2). A custom
endpoint was exercised end to end against a third-party service for a strong model, a cheap model and a vision
model — VERIFIED (same section). The role matrix itself is measured in `req-017-provider-matrix`.

#### Scenario: Changing the worker model
- **WHEN** the user selects a different model for the worker role
- **THEN** jobs created afterwards use that model, with no application update required

#### Scenario: Credential is rejected by the provider
- **WHEN** a configured credential is refused by the provider
- **THEN** a SYSTEM card reports the provider failure and points at the provider settings

#### Scenario: No provider is configured
- **GIVEN** no provider has been configured
- **WHEN** the user hands over a command
- **THEN** the product states that a provider must be configured and offers the settings, rather than failing a
  job silently

#### Scenario: A custom endpoint is configured
- **GIVEN** the user supplies an endpoint address, a credential and a model name for a service that speaks the
  supported completion protocol
- **WHEN** a job runs against that profile
- **THEN** it reasons, calls tools and accepts images through that endpoint without any change to the product

#### Scenario: The user looks for an interactive provider sign-in
- **WHEN** the user opens provider settings
- **THEN** the product offers a credential and a custom endpoint, and states that no interactive sign-in exists
  rather than presenting one that cannot work
