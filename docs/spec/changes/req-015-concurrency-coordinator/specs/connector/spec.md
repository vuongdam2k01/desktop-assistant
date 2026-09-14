## ADDED Requirements

### Requirement: Every platform call passes through one resource coordinator

Every call that reaches a platform SHALL pass through a single device-wide coordinator that grants the resources
the call declared and dispatches the request through that authorisation's shared queue, and no component outside
that coordinator SHALL hold a route by which a connector adapter is invoked.

Source: `spikes/SP-15-concurrency/REPORT.md#2-tac-dong-len-adr-prd`,
`spikes/SP-15-concurrency/REPORT.md` §1 Q3 — VERIFIED: worker agents run isolated from one another, so a queue
or a lock held inside one of them governs nothing outside it; both mechanisms were measured only as a single
shared instance, and the head-of-line measurement is meaningless against per-worker queues that cannot see each
other.

#### Scenario: Two agents call the same platform at the same time
- **GIVEN** two jobs are running in separate agent sessions against one connector authorisation
- **WHEN** both issue a platform call in the same moment
- **THEN** both calls are paced by one queue and counted against one budget, rather than each session pacing as
  though it were alone

#### Scenario: A component attempts to reach a platform directly
- **WHEN** any component other than the coordinator attempts to invoke a connector adapter
- **THEN** no such route exists, so the attempt cannot be made rather than being detected and refused

#### Scenario: The coordinator cannot admit the call
- **GIVEN** the coordinator is unavailable or is shutting down
- **WHEN** a tool call is made
- **THEN** the call does not reach the platform, the job fails with that stated reason, and no call is made
  outside the coordinator as a fallback

### Requirement: A resource is named by a normalised key derived from the call's own arguments

A resource SHALL be named by the key `<connector>:<type>:<identifier>`, the identifier SHALL be taken from the
argument path the tool declared and normalised by the rule the connector declared, and the key SHALL NOT be
taken from any value a model supplied for the purpose nor be qualified by the authorisation used.

Source: `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — VERIFIED for the key's
shape, which is the form the measured lock manager used; `spikes/SP-15-concurrency/REPORT.md` §1 Q1 — VERIFIED
for why the authorisation is excluded: concurrent writes to one object from separate callers are accepted and
silently resolved last-write-wins by the platform, so two callers reaching one object must contend for one key.
The decision is recorded as Q-2 in `clarifications.md`.

#### Scenario: The same object is named in two forms
- **GIVEN** a platform accepts an object's identifier both with and without separators
- **WHEN** two calls name the same object in the two different forms
- **THEN** they contend for one key, because the connector's declared normalisation maps both forms to it

#### Scenario: Two authorisations reach one object
- **GIVEN** two connected authorisations of the same platform can both address one object
- **WHEN** a job under each authorisation writes to that object
- **THEN** the two calls contend for one key, rather than each believing it holds exclusive access

#### Scenario: The call names a different object than the key would
- **WHEN** a tool call is prepared
- **THEN** the key is derived from the same argument the platform call will address, so no call can be made
  against an object other than the one whose key was granted

### Requirement: A write tool declares the resources it touches, or its manifest is refused

A tool that writes SHALL declare, in its connector manifest, every argument path naming a resource it may change
and the type of each, and a manifest containing a writing tool whose declaration is absent, malformed, or names
a path its parameter shape does not contain SHALL be refused whole, yielding no tool from that connector.

Source: `spikes/SP-15-concurrency/REPORT.md` §1 Q2 — VERIFIED: an unlocked write produced a stale recorded
snapshot whose later compensation erased another job's completed work, so a write that cannot be held
exclusively is a write whose record cannot be trusted. Refusing the manifest whole rather than withholding one
tool is the treatment the existing requirement that a manifest is loaded whole or not at all already fixes, and
the treatment `connector/contracts/connector-manifest@1.2.0` gives a write tool that declares neither a
compensation nor its irreversibility: a partially loaded connector would offer writes the product cannot keep
its promises about.

#### Scenario: A writing tool declares no resource
- **WHEN** a manifest declares a writing tool with no resource declaration
- **THEN** that connector yields no tool at all and is presented as unavailable naming the tool, while every
  other connector is unaffected

#### Scenario: The declaration names a parameter that does not exist
- **WHEN** a resource declaration names an argument path absent from the tool's parameter shape
- **THEN** the manifest is refused at registration and the connector's author is told which path is wrong,
  rather than the call failing later when the argument cannot be read

#### Scenario: A read tool declares nothing
- **WHEN** a tool that only reads declares no resource
- **THEN** the manifest loads normally, because a read records no prior state that another job could falsify

#### Scenario: A read tool declares a resource
- **WHEN** a tool that only reads declares a resource it touches
- **THEN** the manifest is refused, because a read takes no exclusive access and the declaration states
  something that cannot be true

### Requirement: Requests under one authorisation are dispatched fairly between jobs

Requests waiting under one authorisation SHALL be dispatched so that a job's wait does not grow with another
job's backlog and so that no job waiting to be dispatched is passed over indefinitely, and the pacing SHALL
remain within the request rate that authorisation's connector declares.

Source: `spikes/SP-15-concurrency/REPORT.md` §1 Q3 — VERIFIED: against a bulk job holding fifteen queued
requests, an interactive job's wait was 4,251 ms under first-in-first-out and 252 ms under round-robin across
per-job queues, 11.7 times faster, while the bulk job's own completion grew by about sixteen percent. The weight
per job class and the floor guaranteeing the background class a share are recommendations of the same report and
are unmeasured; they are declared defaults under
`connector/contracts/coordination-declaration@0.1.0` rather than part of this requirement, per Q-5 in
`clarifications.md`.

#### Scenario: A short job arrives behind a long one
- **GIVEN** a bulk job has many requests waiting under one authorisation
- **WHEN** a job the user just started issues one request under the same authorisation
- **THEN** that request is dispatched within a bounded number of dispatches rather than after the bulk job's
  backlog has drained

#### Scenario: A stream of short jobs arrives while a bulk job runs
- **GIVEN** a bulk job is waiting under an authorisation
- **WHEN** short jobs arrive continuously under the same authorisation
- **THEN** the bulk job continues to be dispatched and completes, rather than being deferred for as long as
  short jobs keep arriving

#### Scenario: The platform refuses a request for volume
- **WHEN** the platform refuses a request for volume and states a delay
- **THEN** dispatching under that authorisation pauses for at least that delay, and requests of every job under
  it wait together rather than one job absorbing the pause on behalf of the others

#### Scenario: Another authorisation is idle
- **GIVEN** one authorisation is paused after a refusal
- **WHEN** a job issues a request under a different authorisation
- **THEN** that request is dispatched at its own pace, because the queue is per authorisation

### Requirement: A call obtains every resource it declared at once, in a fixed order

A call SHALL obtain all of the resources it declared in one attempt, ordered canonically by key, SHALL obtain
none of them when any one cannot be obtained, and SHALL NOT obtain a further resource after it has begun; a job
that already holds a key SHALL obtain it again without waiting.

Source: `spikes/SP-15-concurrency/REPORT.md#4-rui-ro-moi-phat-hien` (RISK-049) — VERIFIED as the risk: a job
holding one platform's object while waiting for another's, against a second job holding them in the opposite
order, deadlocks; the report names canonical ordering and upfront acquisition as the two mitigations, and Q-1 in
`clarifications.md` records taking both rather than either.
`spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — VERIFIED for reentrancy within one
job.

#### Scenario: Two jobs need the same two resources in opposite orders
- **GIVEN** two jobs each need one object on each of two connectors
- **WHEN** both start at the same moment
- **THEN** both complete, because each obtains its whole set in one ordered attempt and neither holds one
  resource while waiting for the other

#### Scenario: A call discovers a resource it did not declare
- **WHEN** a call would need a resource its declaration did not name
- **THEN** the call is refused with that stated reason rather than obtaining a second resource while holding the
  first

#### Scenario: A job calls a tool twice on one object
- **GIVEN** a job holds the key for an object
- **WHEN** the same job makes a further call on that object
- **THEN** it proceeds without waiting, because a job does not contend with itself

#### Scenario: Part of the set is unavailable
- **GIVEN** a call declares two resources and another job holds one of them
- **WHEN** the call attempts to obtain them
- **THEN** it holds neither in the meantime, so the resource that was free is not withheld from other jobs while
  this call waits

### Requirement: A call that cannot obtain its resources within the wait limit is refused rather than made

A call SHALL wait at most the coordinator's configured limit, defaulting to 15 seconds, for the resources it
declared, SHALL then be refused with the coordinator's resource-held error code naming the job that holds them,
and SHALL NOT reach the platform.

Source: `spikes/SP-15-concurrency/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 1 — VERIFIED for the limit and
the distinct error code, which the report specifies precisely so the job manager can retry with backoff instead
of failing the job outright. `spikes/SP-15-concurrency/REPORT.md` §1 Q4 — VERIFIED for the magnitudes the limit
must accommodate: the longest queue wait measured at three concurrent jobs was 1,327 ms and at five was
3,332 ms.

#### Scenario: The holder finishes inside the limit
- **GIVEN** a job is waiting for a resource another job holds
- **WHEN** the holder releases it before the limit elapses
- **THEN** the waiting call proceeds normally and nothing is reported to the user

#### Scenario: The limit elapses
- **WHEN** the limit elapses with the resource still held
- **THEN** the call is refused with the resource-held code, the platform is not called, and the refusal names
  the job holding the resource so the wait can be explained rather than merely reported

#### Scenario: The refusal is distinguishable from a platform failure
- **WHEN** a call is refused because a resource was held
- **THEN** the recorded outcome identifies it as a coordinator refusal rather than as a failure of the platform,
  so no connector is presented as unhealthy because of it
