# OMP brain/worker routing — gpt-5.6-sol as brain, gemini-3.8-flash as worker

> Superseded in part on 2026-09-15: the default model role is back on gemini-3.8-flash and brain-guard now defaults to plan-only with grep/glob allowed. See `report-260915-0222-omp-stall-root-cause-and-rollback.md` for the measured reason.


Date: 2026-09-14 · OMP 18.1.19 · host: this machine (`~/.omp`)

## A. Current OMP installation

| Item | Value |
|---|---|
| Binary | `~/.local/bin/omp` (Bun single-file executable, 201 MB, not stripped) |
| Version | `omp/18.1.19` |
| Global config (settings) | `~/.omp/agent/config.yml` (YAML; `omp config get/set`) plus `~/.omp/agent/settings.json` (extensions list) |
| Project config | `<repo>/.omp/config.yml` (none in this repo), `<repo>/.omp/agents/*.md` (16 AgentKit agents), `<repo>/.omp/rules/*.md` |
| User agents / rules / extensions | `~/.omp/agent/agents/`, `~/.omp/agent/rules/`, `~/.omp/agent/extensions/` (ambiently discovered) |
| Sessions | `~/.omp/agent/sessions/<cwd-slug>/<ts>_<id>.jsonl`; subagent transcripts in a sibling directory, each starting with a `session_init` entry (`agent`, `resolvedModel`, `readOnly`) |
| Model roles present | `plan, default, tiny, smol, slow, vision, commit, task, advisor` (setting `modelRoles`) |
| Per-agent override | setting `task.agentModelOverrides` (record agent-name → model pattern) |
| Bundled subagents | `scout` (@smol, read-only), `sonic` (@smol, full tools), `task` (@task, full tools), `reviewer` (no model → inherits parent), `security-reviewer` (no model → inherits parent) |
| Plan Mode | `/plan`, `--plan-yolo`; planner switches to `modelRoles.plan`; subagents spawned in plan mode are forced to `read, grep, glob, web_search(, ast_grep)` and load no extensions; `write` only accepts `local://` drafts |
| Vibe Mode | `/vibe`: director keeps `read` + `todo` + `vibe_spawn/vibe_send/vibe_wait` only; workers `fast` → bundled `sonic`, `good` → bundled `task`; worker model resolved from `task.agentModelOverrides` then agent role |
| Extension API | `pi.on("tool_call")` returns `{block, reason}` or `{input}` (rewrite args); `pi.on("before_agent_start")` returns `{systemPrompt}`; `pi.registerCommand`; `pi.setActiveTools`; ctx exposes `model`, `sessionManager`, `cwd`, `mode` |
| Subagent detection from an extension | `ctx.sessionManager.getBranch()` contains a `session_init` entry only for subagents |
| Plan-mode detection from an extension | last `mode_change` entry (`plan`, `plan_paused`, `vibe`, `goal`, `none`); headless `--plan-yolo` writes no `mode_change` but injects a `plan-mode-context` custom message |
| Subagent model precedence (`fIo`) | task-tool `model` argument → `task.agentModelOverrides[name]` → agent frontmatter role → **parent's active model** → `modelRoles.default` |

The last row is the unwanted fallback: any agent without a `model` field (bundled `reviewer`, `security-reviewer`, project `ui-ux-designer`) would run on the parent's model, i.e. on Sol when Sol is the brain.

## B. Changes made

Backup: `~/.omp/backups/brain-worker-20260914-125201/` (config.yml, settings.json, both pre-existing extensions, project `.omp/rules`).

| File | Change | Why |
|---|---|---|
| `~/.omp/agent/config.yml` → `modelRoles` | `default` changed from `gemini-3.8-flash:high` to `gpt-5.6-sol:high`. `plan` (sol:xhigh), `slow` (sol:max), `advisor` (sol:high) kept. `tiny/smol/vision/commit/task` stay on flash. | The top-level session must start on the brain; plan mode already used Sol. |
| `~/.omp/agent/config.yml` → `task.agentModelOverrides` | Every known agent pinned to `google-antigravity/gemini-3.8-flash:high`: bundled `scout, sonic, task, reviewer, security-reviewer` and project `Explore, advisor, brainstormer, code-reviewer, code-simplifier, debugger, docs-manager, fullstack-developer, git-manager, journal-writer, kongming, planner, project-manager, researcher, tester, ui-ux-designer`. | Closes the parent-model fallback and moves the four project agents that were on `@plan` (Sol) and two on `@advisor` (Sol) to the worker model. Written with `omp config set`, which preserved the rest of the file. |
| `~/.omp/agent/extensions/brain-guard.ts` (new) | Hard enforcement, see capability matrix. Runtime command `/brain-guard status|strict|plan-only|off`; env `BRAIN_GUARD_MODE`, `BRAIN_GUARD_READ_BUDGET` (default 6), `BRAIN_GUARD_DEBUG=1` → `~/.omp/logs/brain-guard.log`. | Prompt-only policy is not enforcement. |
| `~/.omp/agent/rules/brain-worker-policy.md` (new, `alwaysApply: true`) | The six policy sentences requested, plus the plan loop, execution loop, failure handling and the worker report format. | Sticky across turns and projects; verified present in the system prompt (`rulesLoaded=true`). |

No file in the repository was modified. Existing provider/auth config, `retry`, `providers.maxInFlightRequests`, the two other extensions, and the specdocs plugin are untouched.

## C. Final model mapping

| Role / agent | Model | Responsibility |
|---|---|---|
| Top-level session (`modelRoles.default`) | openai-codex/gpt-5.6-sol:high | Brain: understand, decompose, delegate, review, decide |
| Plan Mode planner (`modelRoles.plan`) | openai-codex/gpt-5.6-sol:xhigh | Brain in plan mode |
| `slow` role, `advisor` role (turn reviewer runtime) | openai-codex/gpt-5.6-sol | Brain-side deep reasoning / review |
| `scout` (bundled) | google-antigravity/gemini-3.8-flash | Read-only research, grep/glob/read, compact report |
| `task` (bundled) | google-antigravity/gemini-3.8-flash | Implementation worker: code, edit, bash, tests |
| `sonic` (bundled) | google-antigravity/gemini-3.8-flash | Fast mechanical worker |
| `reviewer`, `security-reviewer` (bundled) | google-antigravity/gemini-3.8-flash | Review workers (were inheriting parent model) |
| All 16 project agents in `.omp/agents/` | google-antigravity/gemini-3.8-flash | Workers |
| Vibe Director (current session model) | openai-codex/gpt-5.6-sol | Director: spawn/steer/review workers; toolset read+todo+vibe tools |
| Vibe fast worker (`sonic`) | google-antigravity/gemini-3.8-flash | Worker |
| Vibe good worker (`task`) | google-antigravity/gemini-3.8-flash | Worker |
| `tiny`, `smol`, `vision`, `commit` roles | google-antigravity/gemini-3.8-flash | Utility completions (titles, compaction fallback, commit messages, image description) |
| Any `task` spawn of an agent not pinned in `task.agentModelOverrides` | blocked by brain-guard (OMP ignores per-spawn `model` rewrites; see E2) | Hard guarantee: no worker on Sol or on a third model |
| specdocs plugin agents `critic`, `drafter` | google-antigravity/gemini-3.8-flash | Workers (previously inherited Sol / resolved to claude-opus-4-6) |

## D. Capability matrix (enforced by brain-guard when the top-level model is Sol)

| Role | read | grep/glob/find/ls | edit/write | bash | test/build | lsp/ast/web | task (delegate) | review/decide |
|---|---|---|---|---|---|---|---|---|
| Brain (Sol, top-level, any mode) | ≤ 6 repo files per prompt cycle; `local://`, `skill://` unlimited | blocked | blocked (write allowed only to `local://` plan drafts) | blocked | blocked (no bash) | blocked | allowed, model forced to Flash | allowed (todo, hub, ask, plan tools) |
| Brain in Plan Mode | same | blocked | plan draft only | blocked | blocked | blocked | allowed; OMP itself forces plan-mode subagents read-only | allowed |
| Vibe Director (Sol) | budgeted | not in toolset | not in toolset | not in toolset | not in toolset | not in toolset | vibe_spawn/send/wait | allowed |
| Worker `scout` (Flash) | yes | yes | no (agent tool list) | no | no | web_search | no | reports |
| Worker `task` / `sonic` / vibe workers (Flash) | yes | yes | yes | yes | yes | yes | `task` may spawn nested workers (also forced Flash) | reports |
| Top-level manually switched to Flash (`/model flash`) | unrestricted | unrestricted | unrestricted | unrestricted | unrestricted | unrestricted | forced Flash | — |

Guard modes: `strict` (default) enforces in every mode while the session model is Sol; `plan-only` enforces only in plan mode (worker-model pinning stays on); `off` disables blocking and the policy prompt.

## E. Verification

### Unit test of the guard (deterministic, fake runtime, Node 24 type-stripping)
21/21 checks pass (`scratchpad/guard-unit.mjs`): grep/bash/edit/write blocked for the brain in plan, normal and `--plan-yolo` sessions; `local://` writes allowed; `task` without `model`, with `model: sol`, with `@plan`, and batch `tasks[]` all rewritten to Flash; already-Flash spawns untouched; subagent sessions (`session_init`) bypass; Flash top-level bypass; 7th read blocked at budget 6; `skill://` reads not budgeted; policy appended only to the brain's system prompt; `/brain-guard plan-only` and `off` behave as specified.

### Test 1 — Plan Mode, live (headless `omp -p --plan-yolo`, repo cwd, two runs)
- Extension loaded in the real runtime; system prompt contained the rule file (`rulesLoaded=true`); plan mode detected (`mode=plan`).
- Sol's own tool calls across both runs: `task` ×3 (spawning 4 scouts total), `read` ×6 (two `skill://` files, three slices of `spec-check.mjs`, one directory), `todo` ×1, `hub` ×23 (polling worker status). Zero grep/glob/find/ls/bash/edit/write attempts, so no BLOCK was needed.
- Every scout's `session_init` shows `resolvedModel: google-antigravity/gemini-3.8-flash:high`; the `task` calls were rewritten by the guard (`model:<unset> → gemini-3.8-flash`, including a 2-item batch).
- All scouts died immediately with `Cloud Code Assist API error (429) RESOURCE_EXHAUSTED` (0 tokens). Sol then waited/polled and, after 14 minutes of dead workers in run 1, fell back to reading three slices of the target file itself (allowed by the read budget) before the run hit its time cap. No plan was produced because the workers never returned findings. Repository stayed clean (`git status` empty).
- The 429s are a live provider condition: `omp usage` shows the Google account at 2.3 % weekly / 0 % five-hour, yet even a one-word `gemini-3.8-flash:low` call hung in OMP's silent retry during the test window, and today's logs show earlier 429 bursts at 01:4x and 04:0x before any change was made.

### Test 3 — Live hard block in normal mode (Sol only, no workers needed)
Prompt asked the brain to call `bash ls …` and `grep 'function main' …` directly and to report the results verbatim. Guard log: `BLOCK bash`, `BLOCK grep`; session transcript shows both tool results are the guard's refusal text with the delegation hint, and Sol reported them and stopped. This proves the enforcement path in the real runtime, outside any prompt.

### Test 2 — Execution, live
Blocked in this session by the provider: from 13:16 to at least 13:43 UTC every call to Google Antigravity (Flash at any thinking level, and Pro as a diagnostic) returned `429 RESOURCE_EXHAUSTED` while `omp usage` reported the account near 0 %. An unattended runner was left in place instead of waiting interactively:

- Script: `~/.omp/brain-worker-tests/run-test2.sh` (detached with `setsid nohup`; probes Flash every 10 minutes for up to 3 hours, then runs the test once).
- Task: in the isolated scratch project `~/.omp/brain-worker-tests/exec-test` (tiny Node project with a passing `npm test`), the brain must deliver `truncateSlug()` plus tests by delegating to a Flash worker, then review and decide pass/fail.
- Results: `~/.omp/brain-worker-tests/test2/summary.md` (brain tool calls, worker `resolvedModel` and tools, guard BLOCK/REWRITE lines, `git status` and `npm test` of the scratch project, the brain's final text). Progress in `~/.omp/brain-worker-tests/test2/runner.log`.

Expected outcome, given the proven mechanics: the brain's `task` spawn is rewritten to Flash, the worker performs edit/bash/test, any direct edit or bash attempt by the brain is blocked, and the brain's messages are review and decision only.

## E2. Incident 14:06–16:00 UTC: stalled implementation sessions (diagnosed after rollout)

Symptom reported by the user: a normally 15-minute implementation ran for hours, with workers cancelled, IRC waits timing out, and TODO stages at 0/1.

What the session logs show (worktree f02, session 14:06, 116 Sol turns, 7.63 USD):

| Cause | Evidence | Fix applied |
|---|---|---|
| Flash workers spawned three at a time while three brain sessions (f02, f04, f06) ran concurrently; Google Antigravity answered `429 RESOURCE_EXHAUSTED` and every parallel scout batch died (55 Flash 429s in three hours). Single workers in the same window completed 128 and 52 tool turns. | spawn log: 3 scouts at 14:07, 3 at 14:20, 2 at 14:34, all `error, aborted`; `providers.maxInFlightRequests` is shared across local OMP processes, but 3 slots plus per-session bursts still exceeded the provider's rate limit. | `task.maxConcurrency` 32 → 2; `providers.maxInFlightRequests.google-antigravity` 3 → 2 (shared across all OMP processes). |
| Sol burned turns waiting: 92 `hub` polls. `async.pollWaitDuration=smart` starts at 5 s and resets after a minute of other activity, so each poll returned quickly and cost a full Sol turn on a 100k+ token context. | 92 of 116 Sol turns were `hub`; cached input 13.0M tokens. | `async.pollWaitDuration` smart → `5m` (a hub wait now blocks up to five minutes and returns when a job settles). |
| A worker that hit 429 could sleep up to 35 minutes inside OMP's retry ceiling, so it looked dead and the brain respawned it. | `retry.maxDelayMs` was 2,100,000 (default is 300,000). | `retry.maxDelayMs` → 120,000. Note: the 35-minute value was pre-existing; if it was deliberate, revert with `omp config set retry.maxDelayMs 2100000`. |
| The specdocs plugin agent `critic` (frontmatter `model: fable`, a Claude Code alias) was not in `task.agentModelOverrides`; OMP could not resolve `fable`, recorded `resolvedModel: null` and ran it on the parent model Sol: 37 turns, 4.8M input tokens, 3.65 USD. `drafter` (`model: opus`) would run on `google-antigravity/claude-opus-4-6`, a third model. | `F2ConstitutionCritic.jsonl`: all 37 assistant messages `openai-codex/gpt-5.6-sol`. Live replay: unpinned `drafter` → `resolvedModel: google-antigravity/claude-opus-4-6`. | `critic` and `drafter` added to `task.agentModelOverrides` (verified: pinned `critic` → `gemini-3.8-flash:high`). |
| The guard's per-spawn `model` rewrite is **not honoured by OMP** (the rewritten argument was recorded in the transcript but resolution ignored it). The earlier report's "hard guarantee via rewrite" was wrong. | Same live replay: rewrite present in args, worker still ran Opus. | Guard now reads `task.agentModelOverrides` from `config.yml` and **blocks** any `task` spawn whose agent is not pinned to Flash, listing the pinned agents. Unit-tested (5 new checks) and replayed live below. |

The guard itself worked during the incident: the transcript contains 7 guard refusals (grep ×2, read-budget ×1, and others), Sol never ran bash/edit, and all Sol writes went to `local://` plan drafts.

## F. Remaining limitations

- Hard-enforced: manual-work tools blocked for the brain, read budget, worker-model pinning on every `task` spawn (including batches), policy injected into the brain prompt, subagents untouched. All at the application layer via `tool_call`/`before_agent_start`, unreachable by model output.
- Soft only: the brain choosing *good* delegations and asking for compact reports; falling back to its own reads after workers fail (bounded to 6 reads per prompt cycle, not forbidden). `hub` polling while workers are stuck costs Sol tokens; that is OMP's built-in wait pattern.
- Tools the guard does not know are allowed (allow-by-default for unknown names, deny-list for known manual tools) so plan/approval tools keep working. `read` of very large files counts as one read; the cap is by count, not bytes.
- Vibe mode's worker model is resolved by OMP from `task.agentModelOverrides` (now Flash); `vibe_spawn` has no per-spawn `model` argument, so the guard does not need to rewrite it, but it also cannot see the resolution.
- `--plan-yolo` with the default `--plan-yolo-into` (smol) hands execution to Flash as the *top-level* model, not to Sol as director; pass `--plan-yolo-into openai-codex/gpt-5.6-sol:high` to keep the brain/worker split after approval.
- Switching the top-level model to Flash (`/model flash`) intentionally disables the guard (worker model doing manual work is allowed by design).
- Live behavioural evidence for the worker side is limited by the Google Antigravity 429 throttling observed during the test window; model pinning and Sol's delegation behaviour are proven, worker completion is not.
