# Evolution: ledger

Three contracts arrive with this change, and one of them — the record shape — is the surface almost everything
else in the product eventually reads. It also has a property no other contract here has: records written under
an earlier version are still on disk years later, so a version of this contract is never fully retired while a
store holding those records exists. That asymmetry governs everything below.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `ledger/contracts/ledger-record` | A field is removed, its meaning is narrowed, or a value is added to `RecordType`. A new record type is major because every reader — undo, the job detail, replication — decides what it may do from the type, and a reader that has not been taught the new one cannot present or compensate it safely | An optional field is added, or an optional value is added to a field that already defines what its absence means | Wording is clarified with no change to what is written or how it is read |
| `ledger/contracts/ledger-store` | A method or channel is removed, a required parameter is added, or an append channel is exposed across the process boundary. The last is major not because a caller breaks but because a guarantee disappears | A method, an optional parameter, a channel, or an error code a caller can treat as it treats the nearest existing one is added | Wording, and error messages that do not change a code |
| `job/contracts/tool-reconciliation` | A value is added to `method`, a conclusion changes meaning, or a missing declaration stops meaning "cannot be read back". That last one would change every existing tool's crash behaviour without any tool being edited, which is the strongest kind of major change there is | An optional field is added, or an `UndeterminedReason` a caller can treat as it treats the others | Wording |

Two rules cut across all three. A `frozen` contract is edited only through a version bump with a Migration
section and updated consumers, with impact analysis run first. And a version is discovered from the contract
file itself; the store's own shape version is a separate number, discovered through `shape()`, and the two are
deliberately not tied — a shape change that adds a column need not change the record contract, and a contract
clarification need not touch the store.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| No store | Shape 1 | Yes, at first start | None | The store is created with its guard, its index and its configuration in one step |
| Shape N | Shape N+1, additive | Yes, at start, before any other use | Records keep exactly what they were written with and receive no value for the new field | The ordinary case. Verified: adding a field does not disturb the guard and does not touch existing records |
| Shape N | Shape N+1, restructuring | Yes, at start, inside one transaction | Every record is copied across unchanged; content is never rewritten | Guard removed and recreated inside the same transaction; an interruption leaves the store wholly at shape N |
| Shape N+1 | Shape N (downgrade) | No — deliberate and explicit | Restored from the copy taken before a restructuring step; records written after that step are not in the restored copy | An older product version refuses to open a newer shape rather than misreading it. The user is told what they are about to lose before the restore, not after |
| `ledger-record` 0.x | 0.(x+1), minor | No migration needed | Older records carry no value for the new optional field and are never backfilled | A reader treats an absent optional field as "written before this existed", never as a default |
| `ledger-record` 0.x | 1.0 or any major | Readers must be updated before the writer | Records written under the old version stay on disk and stay valid under it | A record is self-describing by type; a reader meeting a type it does not know presents it as an unintelligible step and refuses to compensate it, and never removes it |
| `tool-reconciliation` 0.x | any major | Connector manifests updated; recovery updated | Intent records carry their own copy of the declaration and keep being interpreted under the version in force when they were written | This is INV-LG-05 doing its second job: it makes contract evolution safe as well as manifest edits |

## Deprecation

A field of the record contract is deprecated in three steps, and the timing is set by the store rather than by a
calendar. First, the field is marked deprecated in the contract and the product stops writing it, while every
reader continues to accept it. Second, readers keep accepting it for at least as long as the maximum retention
period that any account may configure, because until then a store somewhere still holds records that carry it.
Third, only once no supported store can contain a record carrying that field may a reader stop accepting it, and
removing it from the contract is a major version.

There is no equivalent of "the last consumer upgraded, so we can drop it". Consumers here include records that
were written years ago and are still read; the ledger's own retention period is what retires them, and nothing
else does.

Remaining consumers of a contract version are identified from the `consumers` list in the contract's
front-matter together with `spec-check.mjs consumers`; remaining consumers of a *record* version are identified
by querying the store for records of the affected type and age, which is the only honest way to answer the
question.

## Extension Procedure

**Adding a tool that can be read back after a crash.** In the connector manifest, alongside the tool's existing
declaration, add a reconciliation declaration naming `method: "readback"`, the read operation from that same
connector, and the comparison — which part of the read result is set against the recorded prior state and
against what the call intended. Declare `equality: "normalised"` when the platform returns the same value in
more than one shape, which RISK-037 measured on one platform. Nothing in recovery is edited. Test with the
reconciliation suite from `verification.md`: the four outcomes — matched prior state, matched intended state,
matched neither, target gone — plus a refused read and an unreachable platform.

**Adding a tool whose effect cannot be read back.** Declare `method: "none"` and write a `reason` a user can
act on, because that reason becomes the question they are asked after a crash. Do not omit the declaration to
achieve the same effect: an absent declaration produces the same behaviour but says nothing about why, and the
next person reading the manifest cannot tell a decision from an oversight. Test that an interrupted call for
this tool reaches the confirmation state and that the reason appears in what the user is asked.

**Adding a record type.** This is a major version of the record contract and is not an extension point. Before
proposing one, check whether an `information` record with a distinct summary carries the meaning — it usually
does. If a genuinely new type is needed, every reader must be taught it in the same change: undo must know
whether it can compensate it, the job detail must know how to render it, and replication must know which
resolution rule its store declares.

**Changing the store's shape.** Add a step to the shape sequence and raise the product's target version. Prefer
an additive step; a restructuring step is permitted but must copy records unchanged and must recreate the guard
in the same transaction. Never write a step that updates existing records — the store refuses it, and the
refusal is the point rather than an obstacle. Test with the shape-change suite, including the interrupted case,
and confirm afterwards that the guard is present and still refusing.

**Adding a consumer of the record contract.** Add the capability to the contract's `consumers` list, and
observe the one rule that is easy to miss: `establishedBy` distinguishes an outcome the product observed from
one it inferred and one the user stated. A consumer that collapses the three is using the contract wrongly,
even though nothing will fail when it does.

These four procedures are the source for the external authoring guide under `docs/guides/`, which is written
when the first connector is authored by someone who did not write this change.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Compression of snapshot payloads | After the account-total sizing that `req-022-account-sync` owns | Measured at a 44.5 percent reduction against a 90-day store of 12.36 MB to 30.83 MB — `spikes/SP-12-sqlite-ledger/REPORT.md` §1 Q5. Per device that saving is not worth losing the ability to read the store directly while diagnosing a failure. Across an account and a beta population it may be, and RISK-069 records that nobody has measured it | A measured account total or replication transfer volume that justifies it. The same condition governs the compression slot in `req-022-account-sync`, deliberately, so the two activate together rather than one store compressing while another does not |
