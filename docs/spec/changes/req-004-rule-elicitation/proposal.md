## Why

Harvested from `spikes/SP-2-rule-elicitation/REPORT.md`. The spike measured whether a multi-turn conversation can reliably turn a user's rough intent into a compilable approval rule, and which model may be trusted with that job.

## Problem

Approval rules are written by users in natural language and compiled into hard gates. If the elicitation conversation converges badly, or worse, quietly produces a weaker rule than the user asked for, the user believes they are protected when they are not.

- The strong model converged on 20/20 items in 4.35 turns on average, with zero silent downgrades — VERIFIED (`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`).
- The cheap model silently downgraded 25% of uncompilable cases and risked timeout or cancellation in 10% — VERIFIED (`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`).
- The v0 prompt under-blocked in 35% of cases until it was given explicit handling for the `delete_block` vocabulary trap and the ancestor hierarchy — VERIFIED (`spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan`).

## Cost of inaction

Silent downgrade is the failure mode that costs trust irrecoverably: the user states a constraint, the system reports it understood, and the constraint is not there. Left unaddressed, whichever model is cheapest at the time gets routed to this role.

## Options

### Option A — Pin the role to the strong model and ship the hardened prompt
- **Sketch**: rule elicitation is fixed to the strong model in the routing matrix, with a hard 4-turn ceiling after which the agent produces the safest interpretation and asks the user to confirm or declares the rule unsupported.
- **Appetite**: medium (weeks).
- **Trade-offs**: eliminates the measured failure; costs more per elicitation session and removes the user's freedom to run this role cheaply.
- **Rabbit holes**: re-tuning the prompt for every new model the user might configure.

### Option B — Minimum viable slice: allow any model, detect downgrade afterwards
- **Sketch**: any model may elicit; a separate check compares the compiled rule against the user's stated intent and flags divergence.
- **Appetite**: medium (weeks).
- **Trade-offs**: preserves user choice of provider; the detector is itself a model judgement, so it inherits the problem it is meant to catch.
- **Rabbit holes**: building a verifier more complex than the elicitation it verifies.

## Recommendation

Option A. Silent downgrade was measured on real transcripts against a frozen ground-truth corpus; a detector built on the same weak substrate is not a safeguard.

## What Changes

- Rule elicitation is routed unconditionally to the strong model; the cheap model is forbidden in this role — VERIFIED (`spikes/SP-2-rule-elicitation/REPORT.md#2-tac-dong-len-adr-prd`).
- A hard ceiling of four conversation turns applies to the elicitation agent; at turn three without clarity, it must produce the fail-closed interpretation and ask for confirmation or declare the rule unsupported — VERIFIED (`spikes/SP-2-rule-elicitation/REPORT.md#2-tac-dong-len-adr-prd`).
- The definition of "delete" at specification level must cover both `archive_page` and `delete_block`, because everyday language uses one word where the API has two — VERIFIED (`spikes/SP-2-rule-elicitation/REPORT.md#2-tac-dong-len-adr-prd`).
- Rule IR must support an ancestor check: blocking a page by id alone leaves child pages and databases unprotected — VERIFIED (`spikes/SP-2-rule-elicitation/REPORT.md#4-rui-ro-moi-phat-hien`).

## Capabilities

REQUIRES spec-impact — modifies the approval rule model and the model-routing configuration.

### New Capabilities
- `approval`: rule elicitation conversation contract, turn ceiling, fail-closed interpretation discipline.

### Modified Capabilities
- `agent`: model routing gains a forbidden-model constraint for the elicitation role.

## Impact

Elicitation system prompt, rule IR schema (consumed by `req-009-rule-ir-hardgate`), model routing matrix (shared with `req-017-provider-matrix`), and the seven condition axes the spike hands over — tool, object, property, time, ownership, threshold and exception — together with the boundary of what the representation deliberately cannot express — VERIFIED (`spikes/SP-2-rule-elicitation/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle II — an elicited rule becomes a hard gate, so a downgraded rule is a weakened gate. Principle V — the four-turn ceiling must not become a demand that users phrase rules correctly the first time; it ends in a safe interpretation, not a rejection of the user. No violation.

## Assumptions

- The frozen ground-truth corpus in `spikes/fixtures/` remains the regression set for this role.
