# Design: req-014-byo-oauth-google

## Context

The connector framework of `req-019-connector-framework` assumes the ordinary shape of connecting a platform: the
product owns an authorisation client, the backend holds its secret, and the device receives a code on a loopback
address and hands it to the broker — the shape `req-020-backend-slice` specified and measured. This change is the
one platform where that shape is unavailable. The provider's mass-market channel requires a verification and
security-assessment track that has been deferred on budget, so until it completes the only way a user reaches
their own mail and files is with an authorisation client they create themselves.

Everything about that route was measured end to end on a supported operating system
(`spikes/SP-13-byo-oauth-google/REPORT.md#0-ket-luan`): the loopback flow completes with no copy-and-paste step;
a desktop-kind client accepts a port chosen at run time without registering it; real mail and real files were
read, including a stored file above thirty megabytes and a spreadsheet exported to delimited text. Two things the
measurement also established shape everything below. The provider ends the authorisation on a fixed cadence while
the user's client is unverified — seven days — and the consent screen lets the user grant part of what was asked.
Neither is a defect to work around; both are ordinary states the product must hold well.

The constraint that makes this hard is not technical. The user performing these steps may not be technical at
all, and the provider's own path through consent runs through a screen designed to turn them back. The risk
register rates this route high for exactly that reason, and the design's job is to make an awkward route
survivable rather than to pretend it is short.

## Goals / Non-Goals

**Goals**

- Connect the provider with an authorisation client the user supplies, once, with no step performed outside the
  application except the ones that can only happen in the provider's console.
- Make the seven-day interruption a state with a one-action remedy, in words the user already read.
- Make the setup itself data, so that the second platform offering this route costs a descriptor rather than a
  screen.
- Read documents and files by declared routes with declared ceilings, so that "too large" and "not supported" are
  distinguishable answers.
- Keep everything the user supplied bound to the account, so a second device costs nothing.

**Non-Goals**

- Automating anything in the provider's console. It is the user's cloud account, the console is not an interface
  this product may drive, and principle-level constraints in `platform` forbid synthetic input into another
  application. The proposal named this rabbit hole and it stays named.
- Removing the provider's warning screen or the seven-day cadence. Both belong to the provider; the product's job
  is to predict them, explain them and absorb them.
- Writing to the provider. Every tool in this connector reads; no snapshot and no compensating action is declared
  because there is nothing to compensate.
- Serving the mass-market channel. That is the reserved point in `model.md`, activated by the verification track,
  and this change must not build half of it in advance.

## Structure

| Component | Responsibility | Model entity | Reached through |
| --- | --- | --- | --- |
| Google connector manifest | Declares the platform: its identity, its read capabilities, the scope profile for this channel, the bring-your-own route's availability and its lifetime caveat | Connector manifest | `connector/contracts/connector-manifest@1.1.0`, read unchanged |
| Google adapter | The four operations of `connector/contracts/connector-adapter@1.0.0` against the provider's mail and file services | Connector adapter | Only from inside a wrapped tool |
| Bring-your-own authorisation runtime | Accepts a supplied client, acquires the loopback port, runs the browser flow, exchanges and renews, compares granted scope | User-supplied authorisation client, loopback session, grant comparison, renewal refusal | `connector/contracts/byo-authorisation-client@0.1.0` |
| Setup guide descriptor and its illustrations | The sequence, the preamble, the expiry words, the troubleshooting entries | Setup guide descriptor, setup step | `connector/contracts/byo-setup-guide@0.1.0` |
| Setup surface in the connectors area | Renders steps, opens provider pages in the system browser, accepts the file, keeps progress | Setup progress | `app`, rendering the descriptor; it knows no platform |
| Content projection rules | Which route reads which file kind, into what form, up to what ceiling | Content route, content read outcome | `connector/contracts/drive-content-projection@0.1.0` |
| Credential holding | Stores the supplied client and the grant, erases them together | — | `platform/contracts/secure-storage@0.1.0`; replicated under `sync/contracts/replicated-store-descriptor@0.1.0` |

The shape to notice is what is absent. There is no Google-specific screen, no Google branch in the connectors
area, and no component outside the connector that names the provider. The application renders a descriptor; the
runtime applies rules; the adapter speaks one protocol. That is principle VI holding on the route most likely to
break it, and it is the property the third platform will be measured against.

## Execution Boundary & Protocol Topology

### Communication Channels & Protocols

| Channel | Direction | Pattern | Payload | Errors |
| --- | --- | --- | --- | --- |
| `connector:byo:supply-client` | Window process → connector runtime | Request-Response | The contents of the file the user chose | The four client refusals of `byo-authorisation-client@0.1.0`, each carrying the guide step that remedies it |
| `connector:byo:connect` / `:reconnect` | Window process → connector runtime | Request-Response, long-running | The connector identity only | Every authorisation error code; the window forms no verdict |
| `connector:byo:state` | Connector runtime → window process | Pub-Sub | Connection state with the instant it was observed | — |
| `connector:guide:get`, `:progress`, `:progress-changed` | Both ways between window and runtime | Request-Response and Pub-Sub | The descriptor, and how far the account has reached | An unvalidatable guide is absent rather than partial |
| System browser launch | Connector runtime → operating system | Fire-and-forget | The authorisation address under the user's client | A browser that cannot be opened fails Connect before any listener is left running |
| Loopback listener | Provider's browser redirect → device | Request-Response, once | The code and the binding value, or the provider's refusal | A redirect without this session's binding value is discarded silently |
| Provider token endpoint | Device → provider | Request-Response | Exchange and renewal, under the user's client | Exchange failures leave nothing stored; a renewal refusal moves the connector to expired, an unreachable provider moves nothing |
| Provider mail and file services | Device → provider | Request-Response, one streamed | Read calls made from inside wrapped tools | Mapped at the adapter's edge into the framework's declared error codes |

### Execution Boundaries & Isolation

The window process renders and collects; it holds no credential, forms no verdict and performs no exchange. The
file the user chooses is read in the window and passed once, immediately, to the runtime; it is not retained
there, and the client it contains exists in the window only long enough to hand over. The connector runtime lives
in the process that owns the credential store, the gate and the ledger — the arrangement `req-019` established
while every manifest is first-party — and it is the only party that ever holds a token.

The loopback listener is the one inbound surface this change opens on the user's machine. It exists only between
Connect and its deadline, binds to a loopback address, answers exactly one request and closes. It is reachable by
any process on the machine, which is why the binding value decides whether a redirect is acted on, and why the
proof of possession is not optional for a client whose secret the provider hands to the user in a file.

Nothing in this route crosses the boundary to the product's backend. That is a deliberate isolation rather than
an omission: it is what makes this the one connect route that works while the backend is down, and what keeps the
user's own client out of the product's servers.

### Trust Boundaries & Input Validation

The credential file is untrusted as data and secret as content: parsed structurally, never interpreted, accepted
only if it carries what the route needs and is of a kind that can complete it, and thereafter present only in the
credential store. The provider's redirect is untrusted until its binding value matches. The provider's answers are
observations with instants; its refusals are quoted rather than paraphrased. Everything the platform returns as
content is data under the constitution's External Content Is Data section and reaches an agent through the
connector's declared sanitization. The guide descriptor and its illustrations are first-party build resources,
validated whole, and never fetched from anywhere.

## Decisions

### D1 — Publish the setup as a descriptor beside the manifest, rather than amending the frozen manifest contract

- **Choice**: the guide is `connector/contracts/byo-setup-guide@0.1.0`, discovered by connector identity beside
  the manifest; `connector/contracts/connector-manifest@1.1.0` is read unchanged, using the `auth.byo_client`
  fields it already carries to declare that the route exists and what its lifetime caveat is.
- **Rationale**: the manifest's existing `guidance_steps` is a list of strings, and the measured guidance is not:
  it carries console addresses to open, illustrations of a warning screen, and per-step confirmations. Widening
  that field's item type would be a MAJOR change to a frozen contract every connector depends on, in order to
  serve one route. Discovery by identity is the shape `req-003-notion-compensation` already established for
  platform rules, and it keeps the pairing rule the framework uses for adapters.
- **Alternatives Considered**: *Bump the manifest to `1.2.0` with an optional pointer to the guide.* Rejected:
  the pointer's only content would be "look beside me", which identity already says; a frozen contract should not
  be amended to hold a redundant field. *Amend `guidance_steps` in place.* Rejected as MAJOR, for one consumer.
  *Write the sequence as a screen in the connectors area.* Rejected: it makes the second platform an interface
  change, which is the erosion principle VI forbids, and it puts words a reviewer must check inside code.

### D2 — Exchange on the device under the user's client, never through the broker

- **Choice**: the authorisation request, the code exchange, the renewal and the revocation are all made by the
  device, under the client the user supplied. The broker at `backend/contracts/authorisation-broker-api@0.1.0` is
  not in this path at all.
- **Rationale**: the broker exists to keep a confidential secret off the device. Here there is no such secret:
  the provider issues a desktop-kind client by handing its identifier and secret to the user in a downloadable
  file, so the secret is already on the user's machine and is not confidential in the sense the broker protects.
  Routing it through the product's servers would add a component that can fail, a place the user's own
  credentials come to rest, and a dependency on the backend for the one route that does not need one — measured
  as completing with no server in the path (`spikes/SP-13-byo-oauth-google/evidence/q1_loopback_run.log`).
- **Alternatives Considered**: *Broker the exchange anyway, for a uniform code path.* Rejected: uniformity bought
  by storing the user's credentials on the product's servers is a bad trade, and it would make this route fail
  exactly when the backend does. *Let the user paste their client into the backend once.* Rejected for the same
  reason plus a step the user should never be asked to take.

### D3 — Acquire the loopback port at connect time, and refuse an unusable client before the browser opens

- **Choice**: the device takes a free loopback port when Connect starts, builds the redirect from it, and accepts
  a supplied client only after checking that it is of a kind that can complete that flow.
- **Rationale**: both halves come from the same measurement. A desktop-kind client registering only the bare
  loopback address was accepted on three unrelated ports, on both host forms and with no port at all, while an
  address the client had not registered was refused outright (`REPORT.md#1-tra-loi-tung-cau-hoi` Q2). So a fixed
  port is an unnecessary way to fail when another process holds it, and a client of the wrong kind is a failure
  that happens in the browser, after the user has left the application, where the product can neither explain nor
  correct it. Checking first converts that into a sentence on the step that produces a correct file.
- **Alternatives Considered**: *A fixed port, documented in setup.* Rejected: it asks the user to register a
  redirect address — a technical step this route exists to avoid — and it still fails when the port is taken.
  *Accept any client and let the provider decide.* Rejected: the provider decides in the browser, which is the
  worst place for this failure. *Ask the user which kind they created.* Rejected: the file says so, and asking a
  non-technical user to classify their own credential is how the answer becomes wrong.

### D4 — Treat a refused renewal as an expected state with a one-consent remedy, and never pre-expire

- **Choice**: a refusal to renew moves the connector to expired, carrying the instant and the provider's words,
  and keeps the stored client so that reconnection is one consent. The expected lifetime is used to warn at setup
  and to explain afterwards; it never expires an authorisation the provider still accepts.
- **Rationale**: the cadence is the provider's policy for an unverified client, confirmed as standard behaviour
  rather than a defect (`REPORT.md#4-rui-ro-moi-phat-hien`). A product that expired an authorisation on its own
  clock would manufacture the failure it is trying to soften, and would be wrong the moment the provider's policy
  changed or the client became verified. Keeping the client is what makes the remedy one action: everything the
  console produced is already held.
- **Alternatives Considered**: *Pre-emptively re-consent before the window closes.* Rejected: it interrupts the
  user on a schedule to prevent an interruption, and it assumes a cadence the product cannot observe directly.
  *Ask for the credential file again on reconnect.* Rejected: it is the step users would refuse to repeat weekly,
  and principle VII says the user carries nothing between machines, let alone between Tuesdays.

### D5 — A product ceiling on direct downloads, below what the platform will serve

- **Choice**: stored files are downloaded up to a declared product ceiling of twenty megabytes; computed
  documents are exported and carry the platform's own ceiling, declared as the platform's.
- **Rationale**: the platform served a stored file of 30,749,685 bytes without complaint
  (`evidence/q6_drive_export_read.log`), so nothing forces a ceiling except the product: a desktop application
  holding a file in memory to turn it into text, and a model context that cannot take it anyway. Twenty megabytes
  is the figure the spike recommended for exactly those two reasons. It is a product decision and is recorded as
  one in the rules, so that the message a user meets says the application declined rather than that the platform
  refused.
- **Alternatives Considered**: *No ceiling.* Rejected: the first hundred-megabyte file in a user's drive becomes
  a memory failure with no explanation. *The platform's export ceiling for everything.* Rejected: it is a
  different platform's rule for a different route, and applying it to downloads would refuse files that work.
  *Stream and chunk rather than cap.* Not rejected, deferred: it is the right answer when the product extracts
  text from large binaries, it is a piece of work of its own, and the ceiling is what keeps the boundary honest
  until then.

### D6 — Hold the supplied client as account data, replicated, rather than as a file on one machine

- **Choice**: the supplied client is written through `platform/contracts/secure-storage@0.1.0` under the
  connector's keys and replicates with the account; the file the user chose is not retained; erasing the connector
  erases client and tokens together.
- **Rationale**: principle VII is explicit that the user carries no file between machines. If the client stayed on
  one device, signing in on a second would mean repeating six console steps, which is precisely the burden the
  constitution forbids shifting onto the user. The storage route was measured holding a client of this size under
  its own key (`spikes/SP-11-secure-storage/REPORT.md` §1 Q5).
- **Alternatives Considered**: *Keep the client on the device that created it.* Rejected against principle VII.
  *Keep the file and read it when needed.* Rejected: a credential in the filesystem, outside the store, readable
  by anything running as the user, and deleted by a tidy user at the worst moment.

### D7 — Compare what was granted against what was requested, at every consent

- **Choice**: every consent ends with a comparison of granted scopes against the profile's requested scopes;
  anything short leaves the connector presented as needing wider permission, with the affected capabilities named
  and their tools absent.
- **Rationale**: this provider's consent screen presents each scope as its own control
  (`evidence/ui_scope_consent.svg`), so a partial grant is a normal outcome of the screen the user is shown. A
  product that recorded the request as the grant would offer tools that fail at the moment a job needs them,
  which is the least recoverable place to discover it.
- **Alternatives Considered**: *Trust the request.* Rejected as above. *Refuse a partial grant outright and
  disconnect.* Rejected: reading mail without files is useful, and discarding a granted permission because
  another was withheld wastes the user's decision.

### D8 — One set of words, corrected where the spike's draft predates the constitution

- **Choice**: the guide descriptor is the single source of the preamble, the expiry notice and the troubleshooting
  text; the connectors area and the dialog card both render it. The draft guide's security section is restated
  before it ships: it tells the user their credentials never leave the machine, which was true under the
  superseded local-first principle and is false under principle VII as it stands at constitution 2.0.0.
- **Rationale**: the sentence a user reads at setup and the sentence they meet when the connection ends should be
  the same sentence, or the second one reads as a new problem. And a claim about where credentials live is
  exactly the kind of promise that must match the architecture: the client is account-owned and replicates
  encrypted under service-managed keys, which is what makes the second device free and is not the same as staying
  on one machine.
- **Alternatives Considered**: *Ship the draft as written.* Rejected: it would be the product telling the user
  something untrue about their credentials. *Write the words in the interface.* Rejected under D1.

## Extensibility & Fallback Strategy

### 1. Pluggable Lifecycle & Registration

- **Loading and registration**: the manifest, the guide descriptor, the acceptance rule and the content
  projection rules are build resources, read once at start-up, each validated whole, and paired with the adapter
  registered under the same connector identity. There is no discovery path, no download and no runtime
  installation, which is what keeps the mixed-version window empty and the review surface finite.
- **Isolation**: in-process, as `req-019-connector-framework` established while every manifest is first-party.
  The adapter holds no policy; the runtime that performs the authorisation holds no verdict; the window process
  holds no credential.
- **Resource management**: a loopback session is released at its deadline, on completion and on abandonment; a
  downloaded file is released as soon as its text form is produced and is never held across calls; setup progress
  is discarded when the connector connects or the route is abandoned. Nothing here caches provider state across
  jobs, because the provider changes it without telling the product.
- **Adding the Nth platform to this route**: declare `auth.byo_client.supported` in its manifest, publish a guide
  descriptor and an acceptance rule, and add content routes if it returns files. No interface changes, no core
  changes, and the procedure is written out in `evolution.md`.

### 2. Multi-Level Fallback Hierarchy

- **Tier 1 (specific → general)**: `the acquired port is taken` ──> another free port, silently. `the requested
  export form is unavailable` ──> the route's alternative form, where one is declared. `the provider states no
  size` ──> the transfer stops at the ceiling and reports too-large without inventing a size.
- **Tier 2 (declared → default)**: `the guide descriptor fails to validate` ──> the plain guidance the manifest
  carries; `and the manifest carries none` ──> the route is not offered, because the product does not invent
  instructions for someone's cloud console. `the stored client cannot be read at reconnect` ──> the sequence
  resumes at the file step rather than a consent that cannot succeed. `a scope was withheld` ──> the capabilities
  that still have their scope keep working, and only the affected tools disappear.
- **Tier 3 (degraded safe mode)**: `renewal refused` ──> expired with a one-action remedy, the client kept, and
  jobs that need the connector failing with a direct route to repair. `provider unreachable` ──> nothing is
  concluded about the authorisation, and the job's retry policy decides. `no loopback port at all` ──> Connect
  fails before the browser opens, with nothing left behind. `the backend is down` ──> this route is unaffected,
  which is the one place in the product where that is true. In every case the rest of the product continues and
  the ledger stays complete.

## Complexity Tracking

None. No constitutional principle is violated by this change.

Principle VIII is the reason the route is an official in-app flow with its own guidance rather than a developer
shortcut, and the reason nothing here is deferred to a document outside the product. Principle VII is what makes
the supplied client account-owned and forces D6 and D8. Principle VI is why the guide, the acceptance rule and
the content routes are declarations rather than screens and branches. Principle V is why the awkwardness is
absorbed by the product — a warning screen predicted, a cadence explained, a reconnection reduced to one action —
rather than handed to the user as something to learn. The Evidence Discipline section is why the content routes
carry an `evidence` field that may say `unmeasured`, and why the seven-day refusal code is scheduled for
measurement instead of quoted from documentation as though it had been observed.

## Research

### R1 — What does the provider actually return when the seven-day window ends?

- **Decision**: the refusal is handled by its shape — a refusal to renew, carrying the provider's own code and
  message — rather than by matching a specific code, and the specific code is measured before release.
- **Rationale**: the spike's authorisation was about seventeen hours old at measurement, so the window had not
  closed; the report names the exact instants at which it will (`2026-09-18 09:24 UTC` for the first grant,
  `2026-09-19 02:33 UTC` for the second). Handling by shape means the product is correct whatever the code turns
  out to be, and the measurement then confirms the words shown to the user.
- **Alternatives**: match the documented code and treat everything else as a general failure. Rejected: it would
  make a documented string load-bearing, which the constitution forbids as an architectural basis.
- **Source/Status**: `REPORT.md#1-tra-loi-tung-cau-hoi` Q3 — VERIFIED that renewal succeeds inside the window;
  the code returned after it is UNVERIFIED, from provider documentation only, and is Q-2 in `clarifications.md`.

### R2 — What should the product's download ceiling be?

- **Decision**: twenty megabytes, declared as the product's own, with export ceilings declared as the platform's.
- **Rationale**: the platform served above thirty megabytes, so the limit is the product's memory and the model's
  context, not the platform. The spike's recommendation names both reasons.
- **Alternatives**: recorded in D5.
- **Source/Status**: `evidence/q6_drive_export_read.log` — VERIFIED for what the platform serves; the ceiling
  itself is a product decision and is labelled as one in the rules.

### R3 — Is a proof of possession required for a client whose secret the user downloads?

- **Decision**: yes, and the acceptance rule declares it required for this provider.
- **Rationale**: the secret of a desktop-kind client is distributed to the user in a file and is not confidential.
  The loopback listener is reachable by any process on the machine, so the only things binding the exchange to
  the party that began it are the session's binding value and the proof of possession. The spike's flow used a
  challenge and verifier throughout and completed
  (`REPORT.md#1-tra-loi-tung-cau-hoi` Q1; `src/test_loopback_serve.py`).
- **Alternatives**: rely on the binding value alone. Rejected: it protects against a redirect this device did not
  start, not against an exchange performed by something else that saw the code.
- **Source/Status**: VERIFIED that the flow completes with it; that it is strictly required by the provider is
  UNVERIFIED and does not need to be, since the product requires it either way.

### R4 — What happens to a user inside a managed organisation?

- **Decision**: unknown, declared as unknown, and reserved in `model.md` rather than assumed in either direction.
- **Rationale**: the option that would answer it — a client created as internal to an organisation — is
  unavailable on a personal account, so the spike could not reach it. A managed organisation may not apply the
  unverified-client cadence at all, which would change the shape of this change's central remedy; guessing either
  way would be a design built on an assumption about someone else's policy.
- **Alternatives**: assume it behaves as a personal account. Rejected under the constitution's evidence rules.
- **Source/Status**: `REPORT.md#5-chua-tra-loi-duoc-vi-sao` — UNVERIFIED; Q-1 in `clarifications.md`.

### R5 — How long should the device wait for the user to come back from the browser?

- **Decision**: five minutes, after which the listener closes, the connector returns to its previous state and
  Connect can be started again.
- **Rationale**: the measured flow used a three-hundred-second wait and completed well inside it, with the
  four consent actions performed by hand. The figure is the product's choice of how long to hold an inbound
  listener open, and the cost of it being wrong is one repeated Connect rather than a failure.
- **Alternatives**: wait indefinitely. Rejected: it leaves a listener open on the user's machine with no event to
  close it.
- **Source/Status**: `REPORT.md#1-tra-loi-tung-cau-hoi` Q1 and `src/test_loopback_serve.py` — VERIFIED as the
  measured setting; as a product requirement it is UNVERIFIED and is listed in `verification.md`.

### R6 — Which file kinds have actually been read?

- **Decision**: declare a route per kind with the evidence in the row, and require every route to be exercised
  before release.
- **Rationale**: spreadsheets were exported to delimited text and to a document form, and stored files of four
  sizes were downloaded, all measured. Documents of the platform's own word-processing kind were not exported
  during the spike, and presentations were not touched at all. A rules table that did not say so would read as
  though all of it had been run.
- **Alternatives**: omit the unexercised kinds entirely. Not rejected but narrowed: presentations are omitted,
  because nothing is known about the form they would produce; the word-processing kind is declared with its
  evidence field reading `unmeasured`, because the route is the same mechanism as the measured one and the
  remaining question is only the form.
- **Source/Status**: `REPORT.md#1-tra-loi-tung-cau-hoi` Q6, `evidence/q6_drive_export_read.log` — VERIFIED for
  what is cited; the rest labelled in place.

## Migration & Rollback

No user data exists against any earlier form of this route, and no application code exists yet, so what follows
concerns contracts and stored credentials rather than a running product.

**Contracts.** Three contracts are introduced at `0.1.0`, all `draft`:
`connector/contracts/byo-authorisation-client@0.1.0`, `connector/contracts/byo-setup-guide@0.1.0` and
`connector/contracts/drive-content-projection@0.1.0`. `connector/contracts/connector-manifest@1.1.0` is read and
not amended, so no consumer of it needs updating and no version window opens. The three new contracts are frozen
by the change that first measures a second platform against them, not by this one: one provider is not a family.

**Stored credentials.** The supplied client and its grant are written under the connector's keys through
`platform/contracts/secure-storage@0.1.0`, in the credential class `req-012-secure-storage` defines for connector
authorisation. Erasure follows that class: disconnect, sign-out, device revocation, account deletion.

**Rollback.** Withdrawing this change means the connector no longer offers the route. The stored client and grant
must be erased as part of that withdrawal rather than left behind, because an authorisation nothing can renew is
a credential with no owner. The console project remains the user's, in their own cloud account, and the
withdrawal message must say so — the product cannot and should not delete it.

**If the reserved mass-market channel activates.** Users holding their own client are not migrated silently: the
profile an authorisation was granted under is recorded with it, so a build offering the product's own client
presents it as an alternative and the user chooses. Deciding that for them would discard a client they created
and a consent they gave.

## Risks / Trade-offs

- [A non-technical user cannot complete six console steps, and abandons the product at its first connector] →
  the sequence is in-application, resumable, illustrated at the steps that confuse, and preceded by an honest
  statement of what it costs; the manual check in `verification.md` is a real user completing it unaided, and a
  failure there is a product problem rather than a user one.
- [The seven-day interruption trains the user to expect breakage] → the interruption is predicted in the same
  words at setup and at failure, the remedy is one action from either the connectors area or a dialog card, and
  the stored client means nothing from the console is ever repeated. The residual cost is real and is the
  strongest argument for the verification track that retires this route.
- [The provider changes its console, and the guide's steps stop matching what the user sees] → the guide is data
  with illustrations, so correcting it is a descriptor change and a PATCH; the troubleshooting entries carry the
  symptoms users actually meet. It will still lag the provider, and no product can prevent that.
- [A user creates a client of the wrong kind] → refused before the browser opens, with the step that creates the
  right one named. Measured as the one failure the provider returns for an unregistered address.
- [A partial consent leaves the product half-connected and the user unaware] → the comparison names the
  unavailable capabilities, their tools disappear rather than failing, and re-consent is offered in place.
- [The loopback listener is reachable by anything on the machine] → one request, bound to a value this session
  issued, with a proof of possession on the exchange, closed at the deadline. A redirect that does not match
  changes nothing and is not shown to the user.
- [The user's own client carries their own quota, and heavy use exhausts it] → the connector paces under the
  manifest's rate policy per authorisation, as the framework requires; the quota is the user's and cannot be
  raised by the product. Not measured in this spike — UNVERIFIED, and listed in `verification.md`.
- [The account the user authorises is not the account they meant] → the account the grant was issued for is
  recorded and stated, so a mailbox that is not theirs is visible rather than silently in use.

## Open Questions

- Whether the connectors area should offer the bring-your-own route beside the standard connect action from the
  first release, or only once the product's own client exists for some provider and the two must be told apart.
  Postponable: the requirement says the route is offered where the platform declares it, and how the two are
  presented together is a question that arrives with the second route, not with this one.
- Whether the guide's illustrations ship as the spike's diagrams or are redrawn to the product's visual language.
  Postponable: the descriptor references resources by name and the words do not change either way.
