# Evolution: product baseline — `connector`, `approval`, `agent`, `uix`

Four contracts are published by this change, all at version 0.1.0 in draft status. Two of them are frozen by a
later change that measured their claims; the other two remain draft until a consumer outside their owning
capability depends on them. This file states how each may move, what happens to data compiled under an earlier
version, and what a person does when they add a connector, a provider, a role or a language.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `connector/contracts/connector-manifest` | a tool is removed, a tool's direction changes, a scope profile is removed, or a tool moves from carrying a compensating formula to carrying `irreversible` | a tool, a scope profile or an optional field is added, or a parameter schema is widened to accept everything it accepted before | descriptions, icons, guidance steps, rate-policy figures |
| `approval/contracts/rule-representation` | a condition variant is removed, an existing variant changes meaning, or the evaluation order changes | a condition variant, a comparison operator or an optional field is added | display text and the shape of the structured restatement shown to the user |
| `agent/contracts/provider-configuration` | a role is removed, a role's meaning changes, or the credential reference becomes able to carry a secret value | a role, a provider kind or an optional descriptor field is added | display names, recommended defaults, cost figures |
| `uix/contracts/localisation-resources` | a key is removed or repurposed | a key, a language or a plural form is added | a message's wording within the same meaning |

The reason the reversibility change in the connector manifest is MAJOR rather than MINOR deserves stating: it
does not alter the shape of the manifest at all, only the truth of a declaration. But it changes what the
product has already promised the user about whether an operation can be undone, and that promise is the one the
fourth principle exists to protect.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| — | `connector-manifest@0.1.0` | not applicable | none | first publication; no connector exists yet |
| `connector-manifest@0.1.0` draft | frozen version, by `req-019-connector-framework` | yes | none | freezing carries the version bump and the consumer update; the contract's own compatibility rules apply from that point |
| `rule-representation@0.1.0` draft | frozen version, by `req-009-rule-ir-hardgate` | yes | none | same |
| any `rule-representation` major version | the next major version | no — deliberately | stored rules carry the version they were compiled under | a rule compiled under an earlier major version is re-elicited with the user rather than migrated; migrating would be the product guessing at intent it did not witness |
| any `connector-manifest` major version | the next major version | partly | existing connector authorisations | a manifest from a newer major version is refused rather than loaded partially; an existing authorisation is left untouched so it survives a bad release |
| any `provider-configuration` minor version | the next minor version | yes | stored configuration | a role added later resolves to its recommended default until the user chooses otherwise |
| any `localisation-resources` minor version | the next minor version | yes | resource bundles | keys added since the bundle was authored fall back to English |

## Deprecation

A contract element is deprecated before it is removed, never at the same time. The sequence is: mark the element
deprecated in the contract with the version that will remove it and the replacement to use; ship at least one
release in which both the deprecated element and its replacement work; then remove it in a MAJOR bump carrying a
Migration section.

Consumers are identified from the `consumers` field in each contract's front matter, which is why that field is
required rather than documentary. A change that adds a consumer updates the field in the same change, so the
list is never reconstructed by searching.

The one element that cannot follow this sequence is a rule condition variant whose meaning was wrong rather than
merely superseded. A condition that does not mean what the user was told it means is not deprecated over a
release cycle: the rules using it are moved to the draft state and re-elicited, because leaving them enforcing
the wrong thing for a release is worse than asking the user again.

## Extension Procedure

**Adding a connector.** Write a manifest against `connector-manifest` and an adapter implementing its four
operations. Every write tool must declare either a snapshot method with a compensating formula or the
`irreversible` flag; a write tool with a compensating formula must also declare a snapshot. Nominate the
parameter that determines bulk size so the static approval tier can count objects without connector-specific
knowledge. Declare sanitization if the connector returns document or message bodies. Verify by connecting the
connector, running a job that writes through it, and confirming three things: the ledger holds an intent and a
result record for every call, an operation the manifest declares irreversible raises an approval request in
`smart` mode, and the undo plan classifies each operation from the manifest's declaration. Nothing in the job
manager, the hooks, the ledger or the interface is edited — if something needed editing, the contract is wrong
rather than the connector.

**Adding a model provider or a role.** Extend `provider-configuration` with the provider kind or the role, give
the role a recommended default, and leave the credential in secure storage with the configuration holding only
a reference. Verify that the role resolves for a user who has never configured it, that a credential the
provider refuses produces a SYSTEM card rather than a silently failing job, and that no code path can write the
credential value into configuration.

**Adding a rule condition.** Extend `rule-representation` with the variant, keep the evaluator pure and total,
and extend the elicitation conversation to produce it. Verify against the adversarial corpus owned by
`req-009-rule-ir-hardgate` before the variant is offered to users, and confirm that a statement the new variant
cannot express is still reported as unsupported rather than compiled into something weaker.

**Adding a language.** Supply a resource bundle for the tag. Verify that a missing key falls back to English and
is visible rather than blank, and that agent-generated text still follows the conversation's language rather
than the interface setting. A persona voice must be defined for the language before the pet speaks it, which is
a product decision rather than a translation task.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Scheduling of jobs | Phase 2 | The fourth locked decision requires schedules to be creatable both conversationally and by hand, which shapes the job record now rather than later | the scheduler is built |
| Unattended execution posture | Phase 2, with the scheduler | Its rule — deny and pause, never self-approve — must exist before the first unattended trigger, not after it | the first non-interactive job trigger exists, whether a schedule or a webhook |
| Third-party tool servers | Phase 2 | Connector tool interfaces are shaped now for external protocol compatibility, so that accepting external tool servers later is not an architectural change | third-party connectors are accepted |

No other reserved slot is claimed. The constitution permits a reserved slot only where the model documents its
phase, its rationale and its activation condition, and the three above are the only points where a decision
already taken constrains the data model before its feature exists.
