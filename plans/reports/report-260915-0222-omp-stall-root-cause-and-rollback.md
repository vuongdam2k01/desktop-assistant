# OMP brain/worker setup: stall root cause and partial rollback

Date: 2026-09-15 02:22 UTC. Follows `report-260914-1328-omp-brain-worker-routing.md`.

## Verdict

The 2026-09-14 setup made planning and implementation slower and more expensive than the configuration it replaced. Two of the three causes were introduced by that setup; the third (Google Antigravity 429 throttling of gemini-3.8-flash) pre-existed but was amplified by it. The harmful parts are rolled back below; the parts that save tokens in plan mode are kept.

## Evidence: before vs after

Sessions read from `~/.omp/agent/sessions/`. Token figures are per top-level session.

| Phase | Session | Main model | Assistant turns | `hub` polls | Sol cache-read tokens | Outcome |
|---|---|---|---|---|---|---|
| Before, plan | f01 03:29 | Sol + Flash scouts | 57 | 0 | 6.1M | plan done in 28 min |
| Before, plan | f10 03:57 | Sol + Flash scouts | 65 | 0 | 6.1M | plan done in 22 min |
| Before, execute | f01 03:57 | Flash (default) | 301 | 6 | 0 | feature implemented in 50 min |
| Before, execute | f10 04:19 | Flash (default) | 258 | 18 | 0 | feature implemented in 40 min |
| After, plan | f02 14:06 | Sol only | 116 | 92 | 13.0M | no plan after 91 min |
| After, plan | f04 14:06 | Sol only | 63 | 44 | 6.5M | no plan after 119 min |
| After, plan | f06 14:06 | Sol only | 81 | 57 | 7.5M | no plan after 119 min |
| After, execute | f02 15:37 | Sol only | 40 | 36 | 2.0M | one worker still editing at 28 min when killed |

Before the setup, five features were planned and implemented between 03:29 and 05:58 with the same 429 pressure (16 Flash 429s in the 04:00 hour, all absorbed by retries inside the Flash main agent). After the setup, three sessions ran two hours and produced nothing.

## Root causes

1. `modelRoles.default` was moved from Flash to Sol. Every execution session therefore started on Sol, was forbidden by brain-guard from editing or running commands, and had to reach the code through Flash workers. Before, the execution session ran on Flash directly, did 250 to 300 tool turns itself, and finished. This is the single largest regression and it was introduced by the setup.
2. brain-guard blocked grep/glob and capped the brain at 6 reads per turn. Before, the Sol planning session did 70 to 99 reads and 15 to 20 greps itself (cached input, cheap) and finished in 20 to 30 minutes. After, the brain compensated with repeated scout batches: 9 `task` calls in f02, 8 to 12 scouts per session, launched in batches of 3 to 5 across three concurrent sessions. That burst is exactly what the Google account throttles.
3. Flash 429 RESOURCE_EXHAUSTED under bursts (pre-existing). 29 worker failures between 14:00 and 16:00. Each failed scout retried for 10 to 45 minutes under the old `retry.maxDelayMs` of 35 minutes before giving up, while the brain polled `hub` on Sol (92 polls in f02). Surviving scouts ran 60 to 130 throttled turns and took up to two hours to return. Policy text told the brain to re-delegate rather than fall back, so it re-spawned the same batches and waited again.

Confirmed unrelated: `async.pollWaitDuration` is a maximum, not a forced delay. The `hub` wait races job completion against the window and returns as soon as a worker settles.

## Changes applied now

Backup of the previous state: `~/.omp/backups/brain-worker-20260915-0225/` (config.yml, brain-guard.ts, brain-worker-policy.md).

| Setting | Was | Now | Reason |
|---|---|---|---|
| `modelRoles.default` | Sol:high | Flash:high | execution sessions run on Flash again, as before the setup |
| brain-guard default mode | strict | plan-only | the guard only enforces inside plan mode; a Sol session outside plan mode may fall back to doing work itself |
| brain-guard `MANUAL_TOOLS` | includes grep, glob | grep, glob removed | targeted search by the brain is cheaper than a scout round-trip |
| brain-guard read budget | 6 per turn | 25 per turn | matches what a productive Sol plan session actually reads |
| policy text (extension and rule) | re-delegate on any failure | at most two workers at a time; on provider errors narrow to one worker or do the bounded piece directly; never wait in a `hub` loop for quota | stops the respawn and poll loop |

Kept from the 2026-09-14 setup: `modelRoles.plan` = Sol:xhigh; all 23 agents pinned to Flash in `task.agentModelOverrides`; unpinned agents refused; `task.maxConcurrency` 2; `providers.maxInFlightRequests.google-antigravity` 2; `retry.maxDelayMs` 2 min (was 35 min); `async.pollWaitDuration` 5m.

Verification: 16 unit checks pass against the edited extension (plan-only default, grep/glob allowed, bash/edit/worktree-write blocked in plan mode, read budget 25, unpinned agent refused, policy injected for the brain only). A live `omp -p` run on Flash at 02:28 logs `LOADED mode=plan-only readBudget=25` and `rulesLoaded=true`. A single Flash probe at 02:23 answered normally, so the quota has recovered since yesterday.

## What this means for daily use

- Plan mode: still Sol as brain with Flash scouts pinned, which is the saving the user asked for. The brain may now grep and read directly instead of spawning a scout for every question.
- Execution: Flash, as before the setup. `/vibe` still works; the director is Flash unless the user switches model.
- Sessions opened before this change keep the old extension until restarted.

## Open decisions for the user

- Whether to keep Sol as director in execution at all. Evidence says Flash alone implemented five features in one morning; Sol as director adds coordinator tokens and a dependency on Flash quota with no measured benefit. Current default is Flash.
- Whether to run at most two OMP sessions concurrently. Three sessions each spawning scouts is what exhausts the shared Google account.
