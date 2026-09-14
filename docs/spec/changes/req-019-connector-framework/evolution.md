# Evolution: connector

This change freezes the two surfaces every platform passes through, so it also has to say how they are allowed to
move afterwards. The rule behind everything below is one sentence: a platform may extend the manifest, and may
never extend the core. A change that would require the second is not an evolution of these contracts, it is a
different architecture, and it arrives as its own change with its own evidence.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `connector/contracts/connector-manifest@1.0.0` | A field is removed or its meaning changes; an optional field becomes required; a tool's `direction` changes; a tool moves from carrying `compensation` to carrying `irreversible`; an authorisation kind or an enumerated value is removed. Each changes what the product may already have promised a user about reversibility or reach | An optional field is added; an authorisation kind or enumerated value is added; a parameter schema is widened so that it accepts everything it accepted before; a new cross-field rule is added that no existing manifest breaks | Descriptions, labels, icons, guidance text, rate-policy figures, and the prose of this contract |
| `connector/contracts/connector-adapter@1.0.0` | An operation is added, removed or renamed; a success shape changes; an error code is removed or its meaning changes; a failure becomes a thrown exception; `checkStatus` stops being an observation with a time | An optional member is added to a returned type or to `ToolCall`; an error code is added whose handling the existing retry rules already cover | Wording, examples, and the text carried in `message` |

Two consequences are worth stating rather than leaving to be derived. Adding an error code is MINOR only because
the rules already say what an unrecognised failure means — it is permanent, and it is recorded as a defect — so a
release that does not know a new code still behaves safely. And a MAJOR bump on either contract is an instruction
to re-run the core-immutability and adapter conformance suites in `verification.md` before the change ships,
because those suites, not the prose, are what the zero-core-change claim rests on.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `connector-manifest@0.1.0` (draft, `req-001-mvp-product-definition`) | `connector-manifest@1.0.0` | Not applicable | None exists | A migration of documents rather than of a running product: no code, no manifest and no stored authorisation was written against the draft. The field-by-field account is in the contract's own Migration section |
| Four adapter signatures sketched inside `connector-manifest@0.1.0` | `connector-adapter@1.0.0` | Not applicable | None exists | First publication. The error codes take the measured SCREAMING_SNAKE names; `auth_expired` and `auth_revoked` become `CONNECTOR_EXPIRED` and `CONNECTOR_REVOKED` |
| Any future `1.x` manifest | A later `1.y` | Yes, by doing nothing | Manifests in the release | Additive fields; a release ignores a field it does not know only where the contract declared that field optional |
| A future `2.0.0` manifest | — | No | Manifests in the release | Every manifest in the release is converted in the same change that bumps the major version, because manifests ship with the release that reads them. A manifest whose major version exceeds the release's is refused naming the version it needs, which is the only mixed-version behaviour that exists today |

## Deprecation

A field, an error code or an enumerated value is deprecated in three steps, and never in fewer. First, it is
marked deprecated in the contract with the replacement named and the release in which it stops being read.
Second, the loader accepts it and records its use, so that the set of manifests still relying on it is a list
rather than a guess — and because every manifest ships with the release, that list is complete rather than a
sample. Third, it is removed, which is a MAJOR bump with every manifest converted in the same change.

The notice period is stated in releases rather than in weeks: at least one release in which the field is
deprecated and still read. This is shorter than a public API would warrant and is deliberate — the only consumers
are manifests inside the same release, and the reserved point below is the moment this paragraph must be
rewritten, because a third-party manifest is a consumer the product cannot convert on its behalf.

## Extension Procedure

**Adding the Nth platform.** This is the procedure the whole change exists to keep short, and it is the source
for the external guide at `docs/guides/`. Nothing in it touches the core.

1. Write the manifest: identity, display name, icon, the authorisation configuration including whether the
   platform publishes a way to withdraw an authorisation, the capabilities a user enables, one scope profile per
   release channel, and one declaration per tool.
2. For each write tool, declare either a snapshot with its compensation formula and the platform-computed values
   to exclude, or `irreversible: true`. Never both, never neither — the loader refuses the whole manifest
   otherwise, and it refuses it where the author is looking rather than where a user is.
3. For each tool of either direction, declare how an interrupted call is reconciled under
   `job/contracts/tool-reconciliation@0.1.0`. If the effect cannot be read back, say so: that routes an
   interrupted call to the user instead of repeating it.
4. Write the adapter: four operations, no policy, no ledger writes, no user interaction, every failure returned
   as a declared code with a truthful `retryable`.
5. Where the platform needs a confidential client, declare the server-side half as an
   `authorisation-provider-descriptor` under `backend/contracts/authorisation-provider-descriptor@0.1.0` and name
   it from the manifest's `provider_id`.
6. Register the pair at the point where the application wires itself together. This is the one line, and it is
   the only line outside the two new files.
7. Verify: run the manifest validation suite against the new manifest, the adapter conformance suite against the
   new adapter, and the core-immutability suite over the whole addition. The third is the one that matters most —
   a non-zero result means the platform is teaching the core about itself, and the manifest is where that
   knowledge belongs instead.

**Adding a field to the manifest schema.** Propose it as an optional field with a default that preserves every
existing manifest's meaning, state which platform needs it and why the existing fields cannot express it, add its
validation rule and its error code, extend the validation suite, and bump MINOR. A field that cannot be optional
is a MAJOR bump and converts every manifest in the release in the same change.

**Adding an error code.** State the platform condition it names, whether it is ever retryable, what a job does
with it, and what the user sees; add it to the adapter contract's matrix and to the conformance suite; bump
MINOR. A code that would require the job manager to behave in a new way is not a new code, it is a change to the
job's failure handling and belongs in `job` with its own requirements.

**Adding a release channel.** Add a scope profile to each connector's manifest, select it by the channel's
configuration, and record it with the authorisations it produces. No adapter and no core component is touched —
measured exactly so
(`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q8).

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Connectors the product did not write — third-party manifests, and tools imported from an external protocol server at runtime | M2 at the earliest, after a mass-market release channel exists | The shape is already compatible: an external tool description converted into a manifest declaration at no architectural distance — VERIFIED (`spikes/SP-19-connector-framework/REPORT.md#1-tra-loi-tung-cau-hoi` Q11). What is not settled is isolation: this change's adapters run in the process that owns the ledger, the gate and the credential store, which is sound only while every manifest is first-party and ships with the release | A decision-maker ruling to accept connectors the product did not write. That ruling reopens three things together, and they must be answered together: the execution boundary an adapter runs behind, how a manifest is reviewed before it is trusted, and how the deprecation procedure above works for manifests the product cannot convert |

No other point is reserved. The constitution permits a reserved slot only with a documented phase, rationale and
activation condition, and nothing else in this change has all three — a future need without them is a change,
not a slot.
