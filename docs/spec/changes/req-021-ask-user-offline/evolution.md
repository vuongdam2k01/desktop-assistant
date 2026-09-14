# Evolution: agent / app

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `agent/contracts/ask-user@0.1.0` | Changing required fields in `AskUserParams`, altering return structure `AskUserResult`, or changing runtime error codes | Adding optional parameters to `AskUserOption` or `AskUserParams` | Clarifying documentation, field descriptions, or validation error text |
| `app/contracts/offline-queue@0.1.0` | Modifying mandatory columns in `offline_command_queue`, changing wire protocol payload schema, or altering idempotency contract | Adding optional columns, status values, or queue metrics | Tuning index definitions, vacuum schedules, or retention window duration |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `v0.0.0` | `v0.1.0` | Yes | N/A (table newly created) | Migration script runs `CREATE TABLE offline_command_queue` and index creation during application startup migration runner |

## Deprecation

- If future versions expand `ask_user` parameters or alter return formats, legacy contracts will be maintained across at least two minor releases.
- Runtime log deprecation warnings will be emitted if an internal agent tool attempts to invoke deprecated interfaces.

## Extension Procedure

### Adding Custom Inquiry Options or Rich Input Controls (Reserved for Future Phases)
1. Propose extension to `AskUserOption` schema under `agent/contracts/ask-user`.
2. Ensure backward compatibility: `label` and `id` must remain mandatory; all new rich UI properties must be optional.
3. Update `TypeBox` validation schema in harness tool wrapper.
4. Verify using the SP-21 test harness suite (`npm test` under `spikes/SP-21-ask-user-offline/`).

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| **Multi-Device Queued Command Replication** | Post-MVP | Unsent commands belong strictly to the accepting device to prevent race conditions and duplicate executions | Multi-device coordination protocol agreed with explicit distributed consensus |
| **Rich Multi-Field Form Inquiries** | Post-MVP | MVP limits inquiries to consolidated single questions with up to 4 quick options plus free text | User testing indicates simple options and free text are insufficient for complex workflows |
