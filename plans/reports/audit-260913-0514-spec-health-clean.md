# Documentation health audit — every check clean

**Date**: 2026-09-13 · **Scope**: the `order` and `depth` debt, plus everything else the audit surfaces
**Result**: `spec-check` all clean (0 critical/high/medium/low), `validate --all --strict` 34/34,
`--schema-validate` 34/34, `contract-test` 21/21 changes.

## 1. Dependency cycle (`order`) — root cause was the tool's model of a contract

The cycle across req-003/007/009/012/013/014/015/017/019 came from `connector-manifest` being published by four
changes (0.1.0 in req-001, 1.0.0 in req-019, 1.1.0 in req-003, 1.2.0 in req-015). `spec-check order` treated
every publisher as a producer, so a change that merely *revises* a contract was ordered before every change that
consumes it. Two changes each revising a contract the other consumes then became mutually dependent, although
each only needs the version the other did not write.

`cmdOrder` now reads the version each change publishes and attributes production to the **introducing** change:
the lowest version precedes both its consumers and every later revision, and the revisions form a chain
(req-001 → req-019 → req-003 → req-015). The cycle disappears without dropping a single real constraint. A
revision that publishes the same version as an earlier change is now reported as `ORDER_CONTRACT_VERSION_CLASH`.

That check immediately found one: `rule-representation` was published at `0.1.0` by both req-001 (its baseline
draft) and req-009 (the frozen version). req-001's own text says the draft "is frozen by
`req-009-rule-ir-hardgate`", so req-009's contract is now **1.0.0**, with a Migration section listing what
changed from the draft (verdict set, `representationVersion`, closed leaf set, bounded counts, confirmed
restatement, evaluator interface moved to `gate-evaluation`) and with `design.md` and `evolution.md` updated to
match — the same pattern req-019 used for `connector-manifest@1.0.0`.

The two roadmap conflicts turned out to be six: dependencies the roadmap states in prose that no change recorded
in metadata. `depends_on` now carries them for req-004, req-006, req-010, req-011, req-016 and req-021, exactly
as the roadmap's own rows read. `order` is **CLEAN**.

## 2. Depth (`depth`) — 39 findings, none of them a missing document

Every finding was "`capabilities/<cap>/model.md` does not exist". That is true and expected: in this repository
the living capabilities hold `spec.md` only, because model and design reach a capability at sync, and no change
has been archived yet. The material exists in the 22 open changes.

`cmdDepth` now consults, for a living capability, the open changes that deliver it — those whose
`specs/<cap>/spec.md` exists — and reports `DEPTH_PENDING_SYNC` (info) naming the file that carries each
dimension. A dimension no change supplies is still a medium finding. All twelve capabilities resolve through
their changes, so `depth` is **CLEAN** with twelve informational lines that say where the material is waiting.

## 3. The rest of the audit, fixed in the same pass

**`xcut` — 11 medium.** Each item was checked against the living requirements before touching anything. Ten are
genuinely covered in different words, so `docs/spec/config.yaml` now declares the project's vocabulary for them
(`crash`, `backend disruption`, `onboarding`, `mode change`, `conflict-resolution`, `sign-in alone`, `revocable`,
`key access` and so on), each anchored to a requirement that exists.

The eleventh, **schema migration**, is only narrowly covered: `connector` requires a manifest written for a later
schema version to be refused, and nothing else does. The ledger store schema, the rule catalogue and the
replicated store descriptor state their version policy in contracts only. Per your decision this is recorded
rather than invented: the gap is written into `config.yaml` beside the entry and listed under open questions
below.

**`evidence` — 1 medium.** SP-2 §5 ("what could not be answered and why") was cited nowhere. Its substance — the
elicitation benchmark was driven by a simulated user, so the convergence and turn-count thresholds hold for
scripted intent only — now appears as an *Open Measurement Gaps* section in
`req-004-rule-elicitation/verification.md`, citing that section and tying it to the usability sessions the plan
already lists as a manual check.

**`--schema-validate` — 19 failures across 10 contracts.** All false: `typeof []` is `object` in JavaScript, so
every `"type": "array"` property failed. Fixed in the engine; that flag now reports 34/34 with no non-INFO issue.

**`contract-test` — 21 of 22 changes failing.** Three distinct causes, fixed at the level each belonged to:

| Cause | Fix |
| --- | --- |
| Every contract was required to publish a JSON Schema; 23 of 44 are interface, wire-protocol or prose contracts, and 4 more delegate their descriptor to another contract | The test applies only to a contract that declares a descriptor schema of its own; the others report "not applicable" |
| Examples were taken by position — block 2 valid, block 3 rejected — so a contract with two valid examples had its second one tested as if it were rejected, and contracts publishing two schemas had examples read against the wrong one | Examples are classified by the label above the fence ("**Valid** — …", "**Rejected** — …"), attached to the schema above them, and a document whose keys the schema does not know is skipped |
| Ten contracts genuinely had a rejected example their schema accepted | Each rule is now encoded in the schema, and the engine's validator was extended to evaluate it |

The constraints encoded, each transcribed from the contract's own prose: a write tool carries exactly one of
`compensation` or `irreversible: true` (`connector-manifest`, all four versions); a recallable side effect names
`withdrawn_by` (1.1.0, 1.2.0); a write tool declares `tool_coordination` (1.2.0); `method: "none"` carries no
read-back, `readback` carries both its fields (`tool-reconciliation`); a `select` or `status` property is kept
and restored by option identity (`notion-property-compensation`); an `evidence` line names a path under
`spikes/` or begins with `unmeasured` (`drive-content-projection`); a setup guide contains the step that accepts
the credentials file and gives every console step its page address (`byo-setup-guide`).

The engine's example validator now covers `const`, `allOf`/`anyOf`/`oneOf`/`not`, `if`/`then`/`else`,
`dependentRequired`, array `items`/`contains`/`minItems`/`uniqueItems`, string lengths, numeric bounds and
nested objects. Keywords outside that subset are ignored rather than guessed at.

Two rejected examples are deliberately well-formed — `byo-authorisation-client` ("it satisfies the schema and is
still wrong": a web client cannot complete the loopback route, which is a measured platform fact) and one half
of `byo-setup-guide` (a step's position in a sequence). The contracts say so in the prose under the example, and
`contract-test` now records that as a review judgement instead of a failure. Where a schema did take over part
of the argument, the prose was corrected to say which half it catches — `drive-content-projection` and
`byo-setup-guide`.

## 4. Evidence

| Command | Before | After |
| --- | --- | --- |
| `spec-check order` | 1 critical (9-change cycle) + 2 medium | **0** |
| `spec-check depth` | 39 medium | **0** (12 info, pending sync) |
| `spec-check xcut` | 11 medium | **0** |
| `spec-check evidence` | 1 medium | **0** |
| `spec-check rtm` / `surfaces` / `consumers` | clean | clean, `docs/spec/rtm.md` byte-identical |
| `validate --all --strict` | 34/34 | **34/34** |
| `validate --all --strict --schema-validate` | 24/34 | **34/34** |
| `contract-test` (44 contracts) | 21 of 22 changes failing | **all 21 changes with contracts pass** |
| `doctor` | healthy | healthy |

## 5. Files changed

Tool: `plugins/specdocs/scripts/spec-check.mjs` (order attribution, depth pending-sync),
`plugins/specdocs/bin/specdocs.mjs` (JSON type detection, example classification, validator subset,
conditional descriptor test), `plugins/specdocs/README.md`, `references/machine-readable-contracts.md`,
`schemas/design/templates/contract.md`.

Documentation: `docs/spec/config.yaml` (crosscutting vocabulary), `docs/spec/changes/req-009-rule-ir-hardgate/`
(contract 1.0.0 + design + evolution), six `.change.yaml` files (`depends_on`),
`req-004-rule-elicitation/verification.md` (open measurement gaps), and the ten contract schemas listed above.

## Unresolved questions

1. **`schema migration` coverage stays narrow.** Only the connector manifest requires a stored artifact's schema
   version to be honoured. Whether the ledger store, the rule catalogue and the replicated store descriptor get
   requirements of their own is a decision-maker's call; the policies already exist in those contracts, so it
   would be a `lite` change drafted from them.
2. **`rule-representation@1.0.0` narrows its consumers** from the draft's `[agent, connector, app, uix, ledger]`
   to `[agent, uix, sync]`. That was the author's choice and is left untouched, but it is worth confirming that
   `connector`, `app` and `ledger` genuinely no longer read the representation.
3. **`verification.md` shape.** Twenty-one changes still carry the 0.1.0 "Definition of Done" section, which the
   0.2.0 migration asks to be rewritten as acceptance criteria at the next edit. No check enforces it, and this
   pass rewrote only `req-004`'s file where the evidence citation belonged.
