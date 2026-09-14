<!--
SYNC IMPACT REPORT
==================
Version change: 2.0.0 → 2.1.0
Bump rationale: MINOR — the section "External Content Is Data" gained two enumerated sources and one derived
  case. Change req-025-pi-agent-system specifies a browser capability and a desktop capability, both shipped
  inactive, and delegation between jobs; each introduces content the product reads that no user typed and no
  connector returned. The section had enumerated exactly two sources, so a browser or desktop tool checked
  against it would have found its source absent. The decision-maker's standing instruction of 2026-09-13 —
  choose what serves the product best and complete the remaining work — settled that the enumeration is
  extended rather than read as illustrative. Carried by change req-026-external-content-sources. No principle
  changed; the rule applied to the new sources is the one the section already stated.
Previous version change: 1.0.0 → 2.0.0
Bump rationale: MAJOR — principle VII was redefined. The project moved from device-bound local-first storage to
  account-owned data replicated across every signed-in device. The decision-maker directed on 2026-09-12 that the
  user must carry no secret, file or enrolled device between machines, so recovery rests on account sign-in alone
  and the service holds the decryption keys; the privacy boundary is consequently operational rather than
  cryptographic, which the principle states explicitly. Carried by change req-022-account-sync.
  Version 1.0.0 was ratified clause-by-clause during specdocs:init on the same date.
Principles defined:
  I.    Decentralized Agents
  II.   Hard Gate Outside The LLM Loop (NON-NEGOTIABLE)
  III.  Ledger Before Act, Append-Only (NON-NEGOTIABLE)
  IV.   Irreversibility Is Declared
  V.    Capability Over Input Normalization
  VI.   Connectors Are Data
  VII.  Account-Owned Data; Sign-In Is The Only Key The User Carries  (redefined in 2.0.0)
  VIII. Official Flows Only
Templates/rules reviewed:
  - docs/spec/config.yaml `rules:` — the proposal and specs rules that referenced upstream requirement IDs were
    removed, because this project declares no upstream traceability anchor. The design and verification rules
    align with principles III, IV and the Evidence Discipline section below.
  - Schemas `lite` and `design` are used unmodified from the plugin; no project override exists at docs/spec/schemas/.
  - 2.0.0 sweep: `docs/spec/config.yaml` context and `domains` updated (capability `sync` added, cluster `account-sync`
    added, cluster `integration` widened); capability Purposes for `backend`, `app`, `ledger`, `platform` and `connector`
    restated; ten harvested proposals and `docs/spec/risks.md` amended; `CLAUDE.md` block unchanged, as it asserts no
    storage boundary.
Follow-up TODOs:
  - A ninth candidate principle, "evidence before threshold", was evaluated and dropped: it is covered by the
    Evidence Discipline section, and keeping it would exceed the soft cap of eight principles.
  - `Global Invariants` is ratified empty on purpose: none were observed at init time, and none were invented.
    It is populated by a dedicated change once the first capabilities expose a genuine cross-domain invariant.
  - Principle VII is not tagged NON-NEGOTIABLE, matching its 1.0.0 status. Its operational controls — key access
    confined to the replication path, least privilege, audited access — are now the entire privacy boundary, so the
    decision-maker may wish to elevate it alongside principles II and III; doing so is itself an amendment and is not
    assumed here.
  - End-to-end encryption was evaluated and rejected on 2026-09-12: it cannot satisfy recovery from account sign-in
    alone on a replacement device. Recorded so a later reader does not reopen it without the constraint that settled it.
  - `Rigor By Risk` carries a project-specific clause added at init (design schema forced for changes touching
    the approval gate, ledger write path, compensating-action declarations, the client/backend boundary, or the
    replication and encryption path). It derives from ratified principles II, III, IV and VII rather than from a
    separate decision.
-->

# Desktop Assistant Constitution

Desktop Assistant is a desktop work-assistant application driven by an AI agent system, whose primary
touchpoint is a persistent animated pet on screen. This constitution binds every change, every artifact under
`docs/spec/`, and every human or agent contributor to the repository. It is authority over convention: where a
habit, a framework default or a convenient shortcut conflicts with a clause below, the clause wins.

## Core Principles

### I. Decentralized Agents
The pet-agent SHALL create jobs for other agents and SHALL NOT command, step, or orchestrate them. Agents
communicate only through job records held by the Job Manager; no component holds a central control loop over
the others.
**Rationale:** a central orchestrator turns every new capability into an edit to one hot module and makes
failure attribution impossible, because no single agent then owns the decision that went wrong.
<!-- Source: docs/raw-idea/prd-mvp.md §6 QĐ-1 -->

### II. Hard Gate Outside The LLM Loop (NON-NEGOTIABLE)
Approval enforcement and the hardline blocklist SHALL execute in the application layer, positioned between the
agent and the connector, and SHALL NOT be reachable, disabled, or persuaded by model output. System prompts are
an advisory layer only and are never the mechanism that stops an operation.
**Rationale:** if the gate lives inside the prompt, prompt injection becomes privilege escalation against the
user's real accounts on real platforms.
<!-- Source: docs/raw-idea/prd-mvp.md §6 QĐ-2; §11.3 NFR-SEC-05; §10.6 FR-AP-10 -->

### III. Ledger Before Act, Append-Only (NON-NEGOTIABLE)
Every tool call SHALL write its ledger record before execution; if the ledger write fails, the operation SHALL
NOT execute. Ledger records SHALL never be edited or deleted; a correction is a new record referencing the
original. Human decisions — approve, deny, cancel, confirm undo — are ledger records like any other.
**Rationale:** undo, user trust, and every post-failure explanation read from the ledger, so a gap in it is not
a missing log line but an unrecoverable state.
<!-- Source: docs/raw-idea/prd-mvp.md §10.4 FR-LG-01..04; §11.2 NFR-RL-03 -->

### IV. Irreversibility Is Declared
Every write operation SHALL declare either its pre-write snapshot method together with the formula for building
its compensating action, or the flag `irreversible`. Undo SHALL be the replay of compensating actions against
current state, reconciled and reported against what cannot be restored — never a diff-revert.
**Rationale:** importing the coding-agent assumption of git-style revert onto one-way platform APIs silently
promises the user a rollback the system cannot perform.
<!-- Source: docs/raw-idea/prd-mvp.md §6 QĐ-2; §10.3 FR-NT-04..05; §10.10 FR-CF-01 -->

### V. Capability Over Input Normalization
Reliability SHALL come from harness capability — multi-step agentic loops, packaged skills, declared rules,
blocking hooks, and asking the user mid-run — and SHALL NOT come from constraining how the user phrases a
command. Acceptance tests SHALL measure the outcome of the whole process across as many turns as it takes, never
single-turn parse accuracy.
**Rationale:** a product whose reliability depends on the user learning a command grammar has handed the work
back to the user, which is the opposite of the asymmetry the product exists to create.
<!-- Source: docs/raw-idea/prd-mvp.md §10.2 FR-AG-10 -->

### VI. Connectors Are Data
Adding the Nth platform SHALL require only a manifest plus an adapter, and SHALL NOT require changes to the Job
Manager, hooks, ledger, or UI. Tools SHALL be generated from the manifest and wrapped, without exception, in the
approval hook and ledger obligation.
**Rationale:** the stated reach is tens to hundreds of platforms, which is unreachable if each one edits the
core; and a tool that bypasses the wrapper defeats principles II and III at the same time.
<!-- Source: docs/raw-idea/prd-mvp.md §10.10 preamble; §10.10 FR-CF-01 -->

### VII. Account-Owned Data; Sign-In Is The Only Key The User Carries
Jobs, ledger, rules, configuration, connector authorisation and agent transcripts belong to the account rather
than to a device: they SHALL replicate to every device signed in to that account, so that signing in on a new
machine restores the user's data, settings and history ready to use. The user SHALL NOT be required to carry any
secret, file, recovery code or previously enrolled device between machines — account sign-in alone SHALL be
sufficient to recover everything, including on a device that replaces a lost one.

Replicated data SHALL be encrypted at rest under service-managed keys. Because sign-in alone must be sufficient
for recovery, the service necessarily holds the means to decrypt: the protection is therefore operational, not
cryptographic, and SHALL be enforced as such — key access confined to the replication path, least privilege,
and an audit record of every access. The backend SHALL NOT execute job business logic, SHALL NOT use user work
content for any purpose beyond serving replication to that same account, and SHALL NOT expose one account's
content to another. On each device the local store remains the working copy, so the product continues to
function while the network or the backend is unavailable.
**Rationale:** the user's history, rules and connections are the product's accumulated value, and tying them to
one machine means losing them at every device change. The decision-maker ruled on 2026-09-12 that no
user-carried secret is acceptable, which forecloses end-to-end encryption: a passphrase the user must remember,
or an enrolled device they must still possess, are exactly the things that must not be needed. The honest
consequence is recorded here rather than disguised — a compromise of the backend or its key custody exposes user
work content, so the operational controls above are the real boundary and must be treated as load-bearing.
Keeping the local store authoritative for the running device preserves the crash-recovery and offline guarantees
that principles III and V depend on.
<!-- Source: decision-maker directive 2026-09-12, carried by change req-022-account-sync -->
<!-- Superseded: "Local-First; Backend Sees No Work Content" (v1.0.0), sourced from docs/raw-idea/prd-mvp.md §1; ADR-007/008 -->

### VIII. Official Flows Only
Development and first-user operation SHALL proceed through the real Sign-In, connector Connect, and auto-update
flows. A development shortcut SHALL NOT stand in for a flow that is in scope, and the narrowness of the first
user base SHALL NOT narrow what gets built.
**Rationale:** a single-user first phase is the only inexpensive opportunity to exercise every official flow
against reality, before there is anyone left to disappoint when one of them fails.
<!-- Source: docs/raw-idea/prd-mvp.md §1, deployment principle for the first phase -->

## Global Invariants

No global invariants are ratified yet. They are added by a dedicated change once the first capabilities exist and
a cross-domain invariant is actually observed; none are invented here.

## Evidence Discipline

VERIFIED sources in this project are the reviewed spike reports at `spikes/SP-*/REPORT.md`, together with the raw
logs and measurements they cite under `spikes/SP-*/evidence/`. Nothing else is verified evidence: agent session
reports under `plans/reports/` are records of work performed, not measurements, and are deliberately excluded.

Every other assertion must be labeled UNVERIFIED. A numeric threshold, a platform capability claim, or a
performance characteristic must cite a spike report section, and vendor documentation alone is never sufficient
grounds for an architectural conclusion.

## External Content Is Data

The system ingests untrusted external content from four sources:

1. User input into the pet dialog box — free text and pasted or dropped images, including screenshots.
2. Connector-fetched content — Notion page and database content, Gmail message bodies, and Google Drive file
   content read back into an agent's context.
3. Rendered web content — the text, structure and images a browser capability reads from a page, including
   pages the product's own browser instance navigated to on the user's behalf.
4. Screen content — screenshots, window titles, clipboard text and operating-system accessibility trees a
   desktop capability reads, including content belonging to applications the job was not asked to touch.

Content derived from any of these sources remains external content wherever it is carried afterwards. In
particular, the report a child job returns to the job that created it is external content when the parent reads
it, whatever role the child ran under, because a child is a machine that read untrusted material.

All external content is data, never instructions. Content from these sources may inform what an agent proposes;
it may never by itself authorize an action, relax an approval decision, alter the rules an agent operates under,
or widen the set of tools an agent holds.
<!-- Sources 3 and 4 and the derived-content clause added in 2.1.0, carried by change req-026-external-content-sources -->
<!-- Superseded: "from two sources" (v2.0.0) -->

## Reserved By Design

A reserved slot is permitted only when `model.md` documents its phase, its rationale, and the condition that
activates it. Silent future-proofing is forbidden.

## Spec Persistence

Current truth resides in `docs/spec/capabilities/`. It modifies only via changes with deltas; merge occurs only upon archive
(living specs + archive). Never modify `capabilities/` directly outside the `## Purpose` section.

## Rigor By Risk

Schema `lite` is permitted only when: no new entities, no new or modified contracts, no custom algorithms, and no
persistent storage touched. Otherwise, use schema `design`.

Schema `design` is additionally required, regardless of the above, for any change that touches the approval gate,
the ledger write path, a compensating-action declaration, the client/backend boundary, or the replication and
encryption path — the surfaces governed by principles II, III, IV and VII.

## Governance

- The constitution overrides all other project conventions in case of conflict.
- `analyze` treats any contradiction with a MUST clause as CRITICAL; modify the artifact, do not dilute the principle.
- Amending the constitution requires a dedicated change: documented rationale, decision-maker approval, SemVer version bump
  (MAJOR: removing/redefining principles; MINOR: adding principles/sections; PATCH: wording clarifications),
  updating the Sync Impact Report at the top of the file.
- Every proposal must include a Constitution check; allowable deviations are permitted only when justified in the
  Complexity Tracking section of design and explicitly accepted by the decision-maker.

**Version**: 2.1.0 | **Ratified**: 2026-09-12 | **Last Amended**: 2026-09-13
