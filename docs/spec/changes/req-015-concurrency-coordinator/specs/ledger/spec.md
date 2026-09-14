## ADDED Requirements

### Requirement: A recorded before state is captured under exclusive access to its target

The before state an intent record carries SHALL be read while the call holds exclusive access to the target, and
that access SHALL be held until the result record for the call is durable, so that no other job can change the
target between the moment the state is recorded and the moment the outcome is.

Source: `spikes/SP-15-concurrency/REPORT.md` §1 Q2 — VERIFIED, and this requirement exists because of what was
measured: without the exclusive span, a second job read its before state while the first was mid-write, recorded
a state that was already false, and the later compensation of that second job restored it and erased the first
job's completed work, which the first job's own history said was still in place. With the span, the second job's
recorded before state matched what the first job had left, and compensating it preserved that work. The evidence
is `spikes/SP-15-concurrency/evidence/q2-dirty-snapshot.json` and records 3 to 6 of
`spikes/SP-15-concurrency/evidence/sp15-ledger.db`.

#### Scenario: Two jobs write to one object
- **GIVEN** one job is between reading its before state and recording its result on an object
- **WHEN** a second job begins a write to the same object
- **THEN** the second job's before state is read only after the first job's result record is durable, so it
  records what the first job left rather than what preceded it

#### Scenario: Undoing the second job preserves the first
- **GIVEN** two jobs wrote to one object in sequence under exclusive access
- **WHEN** the user undoes the second job
- **THEN** the first job's change is still in place afterwards, because the state the second job compensated
  against was true when it was recorded

#### Scenario: A read takes no exclusive access
- **WHEN** a job reads an object without writing to it
- **THEN** it neither waits for nor blocks a write on that object, because a read records no before state to be
  made false

#### Scenario: The process stops while access is held
- **GIVEN** a job holds exclusive access to an object
- **WHEN** the process stops
- **THEN** the next start finds no access held by anything, and the interrupted call is classified from its
  unresolved intent record exactly as any other interrupted call is

### Requirement: A call whose recorded before state no longer matches its target does not execute

When exclusive access to a target was released after the before state was recorded and before the call executed,
the call SHALL re-obtain that access and compare the target with the recorded before state, SHALL execute only
when they still match, and SHALL otherwise be refused with a recorded reason naming the change rather than
executing against a state its own record misdescribes.

Source: `docs/spec/changes/req-015-concurrency-coordinator/clarifications.md` Q-1 — the decision that an
approval waiting on a person releases the exclusive span rather than holding it. The failure this guards against
is the one measured in `spikes/SP-15-concurrency/REPORT.md` §1 Q2, reached by a different route: an approval
that waits while another job writes to the same object leaves exactly the stale recorded state that
compensation later restores. `docs/spec/constitution.md` principles III and IV — a record that is accurate about
the call and wrong about the world is what makes a compensating action destructive.

#### Scenario: The target is unchanged when the decision arrives
- **GIVEN** a call was held for approval and its target was not changed while the user decided
- **WHEN** the user approves it
- **THEN** the call executes, and the before state already recorded for it remains the state it is compensated
  against

#### Scenario: The target changed while the user was deciding
- **GIVEN** a call was held for approval and another job changed its target in the meantime
- **WHEN** the user approves it
- **THEN** the call does not execute, the refusal names that the object changed since the request was raised,
  and the refusal is recorded against the call

#### Scenario: The agent may propose the operation again
- **GIVEN** a call was refused because its target had changed
- **WHEN** the agent receives the refusal
- **THEN** it may propose the operation again as a new call, which reads its own before state and is judged
  afresh, rather than the refused call being resumed against its stale record

#### Scenario: The comparison is against what was recorded, not against what was intended
- **WHEN** the target is compared before a held call executes
- **THEN** it is compared with the before state the intent record holds, so an object that was changed and then
  changed back is treated as unchanged
