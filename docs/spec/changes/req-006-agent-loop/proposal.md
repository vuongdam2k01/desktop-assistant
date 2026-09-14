> **Constitution notice**: this change is the evidentiary basis for principle V (Capability Over Input Normalization) and must not be narrowed into a requirement that users phrase commands correctly.

## Why

Harvested from `spikes/SP-4-agent-loop/REPORT.md`. The spike ran twenty end-to-end work scenarios through a full agentic loop against real Notion and measured whole-process outcomes rather than single-turn parse accuracy.

## Problem

The product's central promise is that a rough instruction produces finished work. That promise fails silently if the agent gathers context, plans, acts and then reports success without checking what it actually did — or if it asks the user a question in a channel where the user has no way to answer.

- Final-state correctness reached 85.0% (17/20 scenarios) against an acceptance floor of 80% — VERIFIED (`spikes/SP-4-agent-loop/REPORT.md#0-ket-luan`).
- The agent self-verified before reporting completion in 95.0% of scenarios (19/20) — VERIFIED (`spikes/SP-4-agent-loop/REPORT.md#0-ket-luan`).
- Median latency for a simple job was 16.9 s against a 30 s ceiling, with zero redundant clarifying questions — VERIFIED (`spikes/SP-4-agent-loop/REPORT.md#0-ket-luan`).

## Cost of inaction

Two measured defects have no owner otherwise. The agent sometimes asks its question as ordinary prose instead of calling the ask tool, which the user never sees and cannot answer; and the vision model prefers an attached image over the user's typed instruction when the two disagree, quietly inverting who is in charge.

## Options

### Option A — Enforce the ask tool and fix source precedence in the prompt contract
- **Sketch**: the system prompt mandates the ask tool for any clarification and states that typed user text outranks attached image content. Both become regression cases in the scenario suite.
- **Appetite**: medium (weeks).
- **Trade-offs**: directly closes both measured defects; prompt-level enforcement is advisory, so a model may still occasionally drift.
- **Rabbit holes**: escalating into a full linting layer over model output before there is evidence one is needed.

### Option B — Enforce the ask tool mechanically in the harness
- **Sketch**: the harness detects a clarifying question emitted as prose and rejects the turn, forcing a tool call.
- **Appetite**: large (months).
- **Trade-offs**: makes the guarantee structural rather than advisory; detecting "this prose is a question to the user" is itself a model judgement and may misfire on legitimate reporting.
- **Rabbit holes**: the detector becomes a second agent.

## Recommendation

Option A now, with the scenario suite retained as the regression harness so that Option B can be justified by measurement if prompt-level enforcement proves insufficient.

## What Changes

- The worker system prompt mandates calling the ask tool for any user clarification, explicitly forbidding questions in ordinary message text, because the user has no interface to answer them — VERIFIED (`spikes/SP-4-agent-loop/REPORT.md#2-tac-dong-len-adr-prd`).
- Multimodal source precedence is specified: when typed user text conflicts with an attached image, the typed text is the highest-priority instruction — VERIFIED (`spikes/SP-4-agent-loop/REPORT.md#2-tac-dong-len-adr-prd`).
- Every connector tool returns results to the agent in a fixed shape (`content` plus `details`) — VERIFIED (`spikes/SP-4-agent-loop/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).
- All date computation is anchored to the user's machine timezone with an explicit time anchor in the system prompt, which removes the observed week-calculation errors — VERIFIED (`spikes/SP-4-agent-loop/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat`).

## Capabilities

REQUIRES spec-impact — modifies the tool result contract and the job execution model.

### New Capabilities
- `agent`: agentic loop contract, self-verification obligation, clarification discipline, multimodal source precedence.

### Modified Capabilities
- `job`: latency expectations for a simple job derive from measured medians rather than estimates.

## Impact

Worker system prompt, tool definition shape for every connector tool, timezone handling across the job pipeline. The spike runner is reusable as the CI regression harness.

## Refs

None — no upstream traceability anchor.

## Constitution check

Principle V — this change is its evidence: the 85% figure measures whole-process outcome across multiple turns, which is the measurement discipline the principle mandates. No violation.

## Assumptions

- The twenty-scenario corpus is representative enough to serve as the release gate; widening it is a separate decision.
