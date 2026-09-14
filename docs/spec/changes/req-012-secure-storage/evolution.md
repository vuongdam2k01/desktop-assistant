# Evolution: platform

Two contracts arrive with this change, and they age differently. `secure-storage` is a surface callers compile
against, so its evolution is the ordinary kind: a caller either builds or it does not. `credential-class-descriptor`
is the harder one, because a descriptor's `erase_on` and `restoration_route` describe what happens to credentials
that are already sitting on users' devices — including devices that will not run again for weeks. A change to a
descriptor is therefore a change to the behaviour of data in the field, not only to the shape of a declaration,
and that asymmetry governs most of what follows.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `platform/contracts/secure-storage` | A method is removed, a required parameter is added, a channel that returns a credential value is exposed across the process boundary, or any storage path is introduced that does not pass through the operating system's facility. The last two are major not because a caller breaks but because a guarantee this contract exists to make disappears | A method, an optional parameter, a presence-or-state channel, an erasure trigger, or an error code a caller can treat as it treats the nearest existing one is added | Wording, and error messages that do not change a code |
| `platform/contracts/credential-class-descriptor` | A field is removed, `key_pattern` is narrowed, a value is added to `restoration_route`, or a registered class changes its `erase_on` or `restoration_route`. The last is major even though no caller breaks, because credentials already on devices change what erases them | An optional field is added, an `erase_on` trigger classes may opt into is added, or a class widens `metadata_fields` | Wording, descriptions and notes |

Two rules cut across both. A `frozen` contract is edited only through a version bump with a Migration section
and updated consumers, with impact analysis run first. And a contract's version answers a different question
from a descriptor's own `version`: the first is the shape of a declaration, the second is the generation of one
class's policy, and they move independently on purpose — a class may reach 2.0.0 because its erasure triggers
changed while the descriptor contract stays at 0.1.0.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| No credential store | Shape 1 | Yes, at first start | None | The store file is created with its row shape before any class answers a call |
| Shape N | Shape N+1, additive | Yes, at start, before any other use | Entries keep their ciphertext untouched and receive no value for the new column | The ordinary case; a shape step never decrypts |
| Shape N | Shape N+1, restructuring | Yes, at start, inside one transaction | Ciphertext is copied across unchanged; it is never decrypted and re-encrypted merely to move it | An interruption leaves the store wholly at shape N |
| Shape N+1 | Shape N (downgrade) | No — the older product version refuses to open a newer shape | Credentials are re-established from account sign-in rather than restored from a copy | There is deliberately no credential backup to restore from; Tier 2 of the fallback hierarchy is the downgrade path and it costs the user one sign-in |
| `secure-storage` 0.x | 0.(x+1), minor | No migration needed | None | A caller that does not use the new method or channel is unaffected |
| `secure-storage` 0.x | 1.0 or any major | Callers updated in the same change | Entries are unaffected: the contract governs access, not storage | Never satisfied by adding a value-returning channel "temporarily" |
| Descriptor 0.x | 0.(x+1), minor | Registration picks it up at next start | Entries keep their class; a widened `metadata_fields` applies to writes from then on | Existing entries are not rewritten to carry newly permitted metadata |
| A class changes `erase_on` or `restoration_route` (major) | New descriptor version | Yes, at next start of each device | Entries already on disk fall under the new policy the moment that device starts | Stated plainly because it is easy to miss: a device offline for a month adopts the new policy a month late, and during that month its credentials are erased by the old rules |
| A class changes `key_pattern` | New descriptor version plus a key migration | Yes, one entry at a time | Each entry is written under its new key and the old entry erased afterwards | Never by rewriting a key in place: class follows key (INV-PLT-02), and a failure mid-rewrite would otherwise leave an entry no class claims |

## Deprecation

A `metadata_fields` entry is deprecated in three steps, and the timing is set by the devices rather than by a
calendar. First, the field is marked deprecated in the class's descriptor and the product stops writing it,
while every reader continues to accept it. Second, readers keep accepting it for at least as long as a device
may plausibly stay offline and then return, because until then entries carrying it are still being read for the
first time in a while. Third, only once no supported device can hold an entry carrying it may a reader stop
accepting it, and removing it from the descriptor is a major version of that class.

Retiring a whole credential class follows the same shape with one addition: the class must keep being registered
until every device has erased or replaced its entries, because a key matching no registered class is refused,
and a device returning from a long absence with entries under a retired class would be a device that cannot
erase its own credentials. The safe order is therefore to erase the class's entries, keep the registration for
at least one further release, and only then remove it.

Remaining consumers of a contract version are identified from the `consumers` list in each contract's
front-matter. Remaining holders of a *class* version cannot be identified from the repository at all: they are
devices, and the only honest answer is the release in which the change shipped plus the time a device may be
absent. That is why an `erase_on` change is major.

## Extension Procedure

**Adding a connector that keeps an authorisation.** Nothing in the store is edited. Write the connector's
credentials under the registered `connector_authorisation` class, using keys of the form
`connector:<provider>:<identity>:<field>`, with `connector:<provider>:` as the prefix that a disconnect erases.
If the connector needs an authorisation client the user supplies, use the class registered for that rather than
inventing a key under the token class, because the two differ in what a disconnect leaves behind. Test with the
key-taxonomy and erasure suites from `verification.md`, including the disconnect case, and confirm afterwards
that no entry survives the prefix erasure.

**Adding a credential class.** Register a descriptor satisfying
`platform/contracts/credential-class-descriptor@0.1.0`. The two fields worth deliberating are the ones that are
easy to get wrong and expensive to change later. `erase_on` must contain sign-out, device revocation, account
deletion and uninstall; adding `connector_disconnect` is the only choice. `restoration_route` must be
`account_sign_in` unless another signed-in device genuinely holds a replaceable copy — and a class holding
anything the device needs in order to replicate must be `account_sign_in` regardless of what it replicates, per
INV-PLT-06. Declare `metadata_fields` exhaustively and treat the list as a security boundary: every field on it
is readable without decrypting. Test with the class-descriptor validation suite, including the two rejections
that should stop the product at start.

**Adding a metadata field to an existing class.** A minor version of that class. Add it to `metadata_fields`,
and check that nothing authorises anything on the strength of it; the presence path exists to answer display
questions. Existing entries do not gain the field retrospectively, so every reader must treat its absence as
"written before this existed" rather than as a default.

**Adding an erasure trigger.** A minor version of the descriptor contract, and a major version of every class
that adopts it. Define the trigger in terms of an event the device can observe locally, since an erasure that
depends on reaching the network is one an offline device cannot perform, which is the position RISK-066 already
describes for revocation.

**Adding a platform.** Implement it behind the Cipher Gateway and nowhere else. A platform whose facility can
refuse — as the macOS keychain prompt can — introduces a state the current lifecycle does not have, and adding
that state is a change to `model.md` and `specs/platform/spec.md`, not an implementation detail of the gateway.

These procedures are the source for the external authoring guide under `docs/guides/`, written when the first
connector is authored by somebody who did not write this change.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| macOS credential behaviour, including the keychain permission prompt | Before the macOS branch reopens, ahead of M3 | `spikes/SP-11-secure-storage/REPORT.md#5-chua-tra-loi-duoc-vi-sao` records that the prompt is unmeasured: when it appears, what declining leaves behind, and whether it recurs after an update. A prompt the user can decline is a lifecycle state this model does not have, and specifying it from vendor documentation is exactly what the constitution's Evidence Discipline forbids | A dedicated macOS spike measures the prompt and the binding. Carried as Q-1 in `clarifications.md` |
| Re-encryption of stored entries under a new key | After the closed beta | The product holds no key of its own — the operating system does — so there is nothing for the product to rotate today, and building a rotation pass before there is key material to rotate is the rabbit hole `proposal.md` names | The first of a key-compromise event, or an obligation arising from RISK-067 that requires the product to demonstrate rotation of credentials it holds locally |
| A last-used time on presence, and a declared refresh cadence per class | After real usage exists | Both would let a surface distinguish a dormant authorisation from an active one, and both would be thresholds invented rather than measured if specified now. `design.md` carries them as open questions precisely because neither changes a requirement or a task in this change | An observation from beta usage showing that dormant authorisations are a problem users or support actually meet |
