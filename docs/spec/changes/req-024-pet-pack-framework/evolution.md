# Evolution: pet

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `pet-pack-manifest@1.0.0` | Removing a required field; adding one, since every existing manifest would become invalid; changing the meaning of `packId`, `provenance` or `targetContractMajor` | Adding an optional field; adding a value to `declaredCapabilities` alongside a MINOR revision of `rive-state-machine` that adds the matching optional layer | Tightening a description; adjusting a bound that no existing manifest violates |
| `rive-state-machine@2.0.0` | Renaming artboard `Pet` or state machine `PetStateMachine`; renaming or removing a layer input; changing which number means which state in either enumeration; making an optional layer required | Adding a further optional layer or optional triggers, while every existing input keeps its name and numbering | Adjusting blend curves, vertex weights or timings inside an asset; clarifying wording |
| `pet-pack-store` descriptor instance | Changing `storeId`, `encryptionClass` or `resolutionRule`, since the backend and every device would disagree about how the store behaves | Adding a declared capability the protocol already defines | Adjusting `name` or `membership` wording |

The MINOR row of `pet-pack-manifest` is the one that carries weight. It is written so that adding an animation
layer never invalidates an existing pack: a pack that does not declare the new capability degrades by the
substitution rule already specified rather than by a rule invented at the time. That property is what makes the
reserved third layer affordable, and it is a property of the two contracts together — neither can deliver it
alone.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `rive-state-machine@1.0.0` | `rive-state-machine@2.0.0` | Not applicable | None exists | No pack authored outside the product exists to migrate, because until this change no external author could produce one. This is why the major revision is affordable now and would not be a year from now |
| Shipped asset, single input | Shipped default pack, two layers | By release | The shipped asset itself | The asset is re-authored to declare both layer inputs. The work status numbering is unchanged, so its existing transitions are carried rather than rebuilt; what is added is the locomotion layer and what is renamed is the input |
| A device with no library | A device with a library of one | Yes | The shipped asset | The device gains the relations of `contracts/pet-pack-store.sql` in the existing Local Store file, and a library containing the shipped default pack, active. Nothing is lost, because there was nothing a user could have created |
| Initial draft | `pet-pack-manifest@1.0.0` | Yes | None | First frozen baseline of the pack format |

### Rolling back

Reverting to a build implementing contract major 1 leaves account packs in the store declaring
`targetContractMajor: 2`. They are refused with `INCOMPATIBLE_REVISION` and the shipped default pack is
presented; packs are not deleted, so rolling forward restores them. This is the concrete reason the
incompatibility refusal must be distinguishable from damage in the interface: after a rollback it is the
expected state rather than a fault, and a user told their packs are damaged would reasonably delete them.

## Deprecation

**The term "skin" is deprecated** in favour of "pack". `req-005-electron-rive-pet-render` uses it throughout and
that change is not rewritten by this one, so a reader moving between the two needs the bridge: what that change
calls a skin is the animation asset inside what this change calls a pack. The difference is not only wording. A
skin was a file that could be swapped on its own; an asset is a part of a pack and is never presented except by
activating the pack that describes it.

**The channel `pet:loadSkin` is deprecated and removed** at `rive-state-machine@2.0.0`, replaced by
`pet:activatePack`. The replacement carries the resolved capability set in addition to the buffer and the
identifier, because the renderer must know which layers to bind from this asset and which from the shipped
default — information that did not exist when an asset was taken whole or not at all.

**The input `state` is deprecated and removed**, replaced by `workStatus`. Its five values and their numbering
are carried over unchanged.

**Direct animation playback by string name remains forbidden**, unchanged from `1.0.0`, because it bypasses the
blend curves an asset declares.

## Extension Procedure

To author a pet pack:

1. In the animation editor, create an artboard named exactly `Pet`.
2. Create a state machine named exactly `PetStateMachine`.
3. Add a `Number` input named `workStatus`, with states 0 idle, 1 receiving an order, 2 working, 3 waiting for
   an approval, 4 holding a result. This layer is required: a pack without it cannot be presented.
4. Optionally add a `Number` input named `locomotion`, with states 0 standing, 1 walking, 2 dragged, 3 falling.
   Omitting it is a valid choice, not an incomplete pack — the pet will move using the shipped default's gait,
   and the library states so before anyone activates it.
5. Author the two layers so that a transition on one does not restart or interrupt the other. Nothing in the
   schema can check this, and it is what separates a pack that satisfies the contract from one that satisfies
   the specification.
6. Set transition blend durations between 150 ms and 250 ms.
7. Export the asset, keeping it at or under 5 MB.
8. Write the manifest against `contracts/pet-pack-manifest.schema.json`, declaring identity, provenance,
   `targetContractMajor: 2`, the capabilities actually present in the asset, and the asset's size and digest.
9. Write the persona: name, languages, fallback language, talkativeness, the character description, and the
   acknowledgement lines for each language. Acknowledgement lines state receipt only — they name nothing from
   the command, assert no understanding of it, and promise no outcome, because only a model that has read the
   command may say anything about it.
10. Place the manifest, the persona and the asset in one directory under the account pack location, or supply
    them through the product's creation surface, which performs steps 8 and 9 as a form and computes the digest.

A note for whoever writes step 9. The character description is the one place a pack's author writes free prose,
and it is tempting to use it to make the pet more capable — to tell it which connector to prefer, or when not to
ask. That text will have no such effect, by construction rather than by filtering: it is composed only into
advisory positions, and the approval gate runs in the application layer where no prompt content reaches it.
Writing instructions there produces a pet with a strange-sounding personality and no change in behaviour.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| A third animation layer | Phase 2 | `req-018-pet-liveness` reserves perched interaction behaviours — animations for sitting on a specific application's title bar. A third layer would be a capability a pack declares exactly as the two existing ones are | A MINOR revision of `rive-state-machine@2.x` adds the optional layer and `pet-pack-manifest@1.x` adds its capability value. Existing packs stay valid and borrow the default for it |
| Pack distribution channel | Post-MVP | The decision-maker deferred a public marketplace on 2026-09-13. The manifest already carries the identity, version, author and asset digest a channel would need to describe a pack it did not produce, which is why those fields exist now rather than being added then | A decision to accept packs whose author is neither the product nor the account holder. That is also the moment the persona trust boundary stops being a precaution and becomes load-bearing, and the moment `author` must become verifiable rather than free text |
| Three-dimensional rendering surface | Phase 3 | Carried forward from `req-005-electron-rive-pet-render`. A pack's asset format would change; its manifest, persona, provenance and replication would not | User demand for an interactive three-dimensional pet, with the transparent window architecture preserved per ADR-002 |

Each slot states its phase, its rationale and the condition that activates it, as `docs/spec/constitution.md`
§Reserved By Design requires. None is silent future-proofing: the first two are load-bearing on decisions
already taken — the deferred marketplace and the reserved perched behaviours — and the third is inherited with
its original justification intact.
