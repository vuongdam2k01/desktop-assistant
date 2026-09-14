# Evolution: platform, backend (macOS delta)

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `platform/contracts/window-integration-module` | An operation changes what it guarantees, or is removed. Every consumer states its behaviour in terms of the guarantee, so a changed guarantee is a changed product on both operating systems. | An operation is added, or an existing operation gains an optional argument that does not alter its guarantee. | Wording, examples, or a clarification that leaves both implementations conforming. |
| `backend/contracts/update-feed` | An existing manifest name serves something different, or is withdrawn. A released client has that name compiled into it and cannot be told a new one. | A manifest name is added for a further operating system, or an optional member is added to the manifest document. | The origin moves, or wording changes. Nothing a client parses is affected. |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `update-feed@1.0.0` | `update-feed@1.1.0` | Yes, by publishing | None | A client written against 1.0.0 reads `latest.yml` and receives the Windows feed, which is all that name ever meant. No client action is required and no client breaks. |
| Ledger store opened without the physical-flush guarantee | The same store opened with it | Yes, on next open | Readable unchanged | The setting governs how a write is flushed, not what is written, so no record is rewritten and no downgrade path is needed. |
| A build signed with a development identity | A build signed with the release identity | No | Stored credentials and granted permissions are lost | This is a one-way step and the reason the requirement forbids it in the update path. It is performed once, before the first distributed build, while there is nothing on any user machine to lose. |

## Deprecation

`update-feed@1.0.0` is not deprecated by 1.1.0; it is the same feed read by an older client, and it continues
to be served. A manifest name would be withdrawn only after the release channel shows no client reading it,
which the origin's request log answers directly. The notice period is one release cycle beyond the last
observed read.

The window integration contract has no external consumer, so deprecating an operation means updating the
consumers listed in the contract and nothing beyond the repository. The procedure is still to add the
replacement, move consumers, then remove — because the two implementations are updated separately and a
simultaneous swap would leave one operating system briefly without the operation.

## Extension Procedure

**Adding an operating system.** Provide an implementation of `window-integration-module` for it, reporting
honestly through `capabilities()` which operations it performs natively, which the desktop framework provides,
and which are unavailable. Add a manifest name and a package format to `update-feed`, which is MINOR. Decide
the durability setting for the ledger by measuring power loss on that operating system rather than by reading
its documentation, and record the measurement as evidence. Nothing in `pet`, `app` or `uix` changes; if
something has to, the contract was bypassed somewhere.

**Adding an operation to the window contract.** Add it with its guarantee and its failure behaviour, implement
it on both operating systems or report it unavailable on one, and give it a scenario in the capability that
consumes it. An operation with no consumer scenario is not verifiable and does not belong in the contract.

**Adding a feature that needs a privacy permission.** Confirm first that the core behaviour still needs none —
that requirement is what keeps a refusal survivable. Then specify what the feature does when the permission is
absent, refused, and revoked after being granted, because all three occur and only the first is obvious.

## Reserved Slots

| Reserved Point | Target Phase | Rationale |
| --- | --- | --- |
| Permission-dependent feature | M3 | Screen awareness is the first feature that will need a privacy permission. The slot is declared now so that the requirement holding the core free of permissions is written while it is still true, rather than reconstructed afterwards around whatever was built. |
