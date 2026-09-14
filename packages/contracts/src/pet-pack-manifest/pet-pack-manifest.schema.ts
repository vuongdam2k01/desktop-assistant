/**
 * Shape of the manifest that makes a pet pack a pack, for pet/contracts/pet-pack-manifest@1.0.0. A directory without a document satisfying this schema is not a pack: it is absent from the library rather than partly available. The manifest declares identity, provenance, which revision of pet/contracts/rive-state-machine the asset was authored against, what the pack claims to implement, and the persona the pet speaks under. What this file cannot express is stated by the contract document: whether the named asset exists, whether its digest matches, and whether a declared capability is actually present in the binary — all answered by reading the asset, and all of which the model settles in favour of the asset rather than the claim.
 */
export interface PetPackManifest {
  /**
   * Which revision of this manifest shape the document was written against. A document written for a major revision the device does not implement is refused whole rather than read partially, because a partly understood manifest could silently drop a declaration that mattered.
   */
  manifestVersion: string;
  /**
   * Stable identity, unique within a library. Replication addresses a pack by it, so it must not change when the pack is edited: an edit that changed the identity would arrive on another device as a second pack rather than as a new version of the first.
   */
  packId: string;
  /**
   * Distinguishes revisions of the same pack. It is what lets a replication edit that lost be preserved against the one that won, since both carry the same packId and differ only here.
   */
  packVersion: string;
  /**
   * What the user sees in the library. Distinct from the persona's name: the library entry may be called 'Office cat, dark' while the pet introduces itself as something else entirely.
   */
  displayName: string;
  /**
   * Where the pack came from, which fixes what may be done to it. A template is read-only, is replaced wholesale by a release, and never replicates; an account pack is editable, replicates, and is destroyed with its account. Immutable for the pack's lifetime — deriving from a template produces a new pack with a new packId rather than changing this field.
   */
  provenance: "built-in-template" | "account-pack";
  /**
   * The major revision of pet/contracts/rive-state-machine the asset was authored against. A pack declaring a revision this build does not implement is refused with INCOMPATIBLE_REVISION, which the user must be able to tell apart from a damaged file because the remedies differ: update the product, or re-author the asset.
   */
  targetContractMajor: number;
  /**
   * What the pack claims to implement, one entry per animation layer. A claim rather than an authority: where the declaration and the asset disagree, the asset decides and the capability is treated as absent, so the shipped default pack supplies it. 'work-status' is required in practice because a pack implementing no capability at all cannot be presented; the schema permits declaring only locomotion so that the refusal comes from the load path with a reason the user can read, rather than from a validation message about an array.
   *
   * @minItems 1
   */
  declaredCapabilities: ["work-status" | "locomotion", ...("work-status" | "locomotion")[]];
  /**
   * The animation asset this manifest describes. Named rather than embedded, so the library can list every pack by reading manifests alone and read an asset only on activation.
   */
  asset: {
    /**
     * The asset's file name within the pack directory. Constrained to a single name with no separators, because a manifest is authored content and a path that could traverse out of its own directory is the one way this document could reach something it does not own.
     */
    path: string;
    /**
     * The asset's size. The 5 MB ceiling is roughly ten times the under-500 KB budget req-005-electron-rive-pet-render sets for the shipped asset, fixed in clarifications.md session 2026-09-13 so that replicating a pack stays a record-sized transfer needing no separate blob channel. An import above it is refused at import, not at sync.
     */
    sizeBytes: number;
    /**
     * What the asset is verified against on arrival and at load. A mismatch is damage rather than a repairable condition, and it is what distinguishes a corrupted transfer from a file that was never the right one.
     */
    digest: string;
  };
  /**
   * Who the pet is and how it speaks. Required, because a pack that cannot speak is not a pet: the living pet specification obliges every pet-visible string to originate from a persona specification, and before this contract no artifact owned one. Every field here is advisory input to the pet-agent and reaches no position from which the approval gate or tool selection reads.
   */
  persona: {
    /**
     * What the pet calls itself.
     */
    name: string;
    /**
     * The languages this persona speaks.
     *
     * @minItems 1
     */
    languages: [string, ...string[]];
    /**
     * Which of the declared languages is used when the language in force is not among them. Declared per pack rather than per product, because a pack's voice is authored in the languages its author actually wrote.
     */
    fallbackLanguage: string;
    /**
     * How much the pet says unprompted. An enumeration rather than free text, because it governs how often the product interrupts the user and that is a behavioural setting rather than a matter of voice.
     */
    talkativeness: "terse" | "moderate" | "chatty";
    /**
     * Who the pet is, in the author's own words. The one free-text field, and the reason two packs sharing a catalogue style still sound like different characters. Bounded so that a description stays a description and the prompt cost of a pack is predictable. It is advisory text: it shapes voice and can never authorize an action, relax an approval, name a tool, or alter a rule — not because it is filtered, but because it is composed only into positions the approval gate does not read.
     */
    characterDescription?: string;
    /**
     * The receipt lines the product may present without a model, grouped by language. They exist because no measured model answers fast enough to hold the two-second commitment — VERIFIED (spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q2) — and they must state receipt only: naming nothing from the command, asserting no understanding of it, and promising no outcome. That constraint is judged by reading them, which is why the acceptance plan checks it and this schema only bounds their shape.
     */
    acknowledgementLines: {
      /**
       * @minItems 1
       */
      [k: string]: [string, ...string[]];
    };
  };
  /**
   * Who made the pack. Free text today, because both provenances are trusted: the product, or the account holder themselves. It is the field a distribution channel would later need to mean something verifiable, which is why it exists now rather than being added when that channel is built.
   */
  author?: string;
  /**
   * What the pack is, for the library listing. Distinct from the persona's character description, which is about who the pet is rather than what the pack contains.
   */
  description?: string;
  /**
   * A still image within the pack directory, so the library can show what a pack looks like without loading its asset.
   */
  preview?: string;
  /**
   * The template this account pack was created from. Recorded for the user's benefit and confers no update relationship: a release that updates the template leaves the derived pack untouched, which is the model's INV-PACK-01.
   */
  derivedFrom?: string;
}


export const PET_PACK_MANIFEST_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/pet/pet-pack-manifest/1.0.0.json",
  "title": "PetPackManifest",
  "description": "Shape of the manifest that makes a pet pack a pack, for pet/contracts/pet-pack-manifest@1.0.0. A directory without a document satisfying this schema is not a pack: it is absent from the library rather than partly available. The manifest declares identity, provenance, which revision of pet/contracts/rive-state-machine the asset was authored against, what the pack claims to implement, and the persona the pet speaks under. What this file cannot express is stated by the contract document: whether the named asset exists, whether its digest matches, and whether a declared capability is actually present in the binary — all answered by reading the asset, and all of which the model settles in favour of the asset rather than the claim.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "manifestVersion",
    "packId",
    "packVersion",
    "displayName",
    "provenance",
    "targetContractMajor",
    "declaredCapabilities",
    "asset",
    "persona"
  ],
  "properties": {
    "manifestVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Which revision of this manifest shape the document was written against. A document written for a major revision the device does not implement is refused whole rather than read partially, because a partly understood manifest could silently drop a declaration that mattered."
    },
    "packId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$",
      "description": "Stable identity, unique within a library. Replication addresses a pack by it, so it must not change when the pack is edited: an edit that changed the identity would arrive on another device as a second pack rather than as a new version of the first."
    },
    "packVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Distinguishes revisions of the same pack. It is what lets a replication edit that lost be preserved against the one that won, since both carry the same packId and differ only here."
    },
    "displayName": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64,
      "description": "What the user sees in the library. Distinct from the persona's name: the library entry may be called 'Office cat, dark' while the pet introduces itself as something else entirely."
    },
    "provenance": {
      "enum": [
        "built-in-template",
        "account-pack"
      ],
      "description": "Where the pack came from, which fixes what may be done to it. A template is read-only, is replaced wholesale by a release, and never replicates; an account pack is editable, replicates, and is destroyed with its account. Immutable for the pack's lifetime — deriving from a template produces a new pack with a new packId rather than changing this field."
    },
    "targetContractMajor": {
      "type": "integer",
      "minimum": 1,
      "description": "The major revision of pet/contracts/rive-state-machine the asset was authored against. A pack declaring a revision this build does not implement is refused with INCOMPATIBLE_REVISION, which the user must be able to tell apart from a damaged file because the remedies differ: update the product, or re-author the asset."
    },
    "declaredCapabilities": {
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "items": {
        "enum": [
          "work-status",
          "locomotion"
        ]
      },
      "description": "What the pack claims to implement, one entry per animation layer. A claim rather than an authority: where the declaration and the asset disagree, the asset decides and the capability is treated as absent, so the shipped default pack supplies it. 'work-status' is required in practice because a pack implementing no capability at all cannot be presented; the schema permits declaring only locomotion so that the refusal comes from the load path with a reason the user can read, rather than from a validation message about an array."
    },
    "asset": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "path",
        "sizeBytes",
        "digest"
      ],
      "description": "The animation asset this manifest describes. Named rather than embedded, so the library can list every pack by reading manifests alone and read an asset only on activation.",
      "properties": {
        "path": {
          "type": "string",
          "pattern": "^[A-Za-z0-9._-]+$",
          "description": "The asset's file name within the pack directory. Constrained to a single name with no separators, because a manifest is authored content and a path that could traverse out of its own directory is the one way this document could reach something it does not own."
        },
        "sizeBytes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5242880,
          "description": "The asset's size. The 5 MB ceiling is roughly ten times the under-500 KB budget req-005-electron-rive-pet-render sets for the shipped asset, fixed in clarifications.md session 2026-09-13 so that replicating a pack stays a record-sized transfer needing no separate blob channel. An import above it is refused at import, not at sync."
        },
        "digest": {
          "type": "string",
          "pattern": "^sha256:[0-9a-f]{64}$",
          "description": "What the asset is verified against on arrival and at load. A mismatch is damage rather than a repairable condition, and it is what distinguishes a corrupted transfer from a file that was never the right one."
        }
      }
    },
    "persona": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "name",
        "languages",
        "fallbackLanguage",
        "talkativeness",
        "acknowledgementLines"
      ],
      "description": "Who the pet is and how it speaks. Required, because a pack that cannot speak is not a pet: the living pet specification obliges every pet-visible string to originate from a persona specification, and before this contract no artifact owned one. Every field here is advisory input to the pet-agent and reaches no position from which the approval gate or tool selection reads.",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 40,
          "description": "What the pet calls itself."
        },
        "languages": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "pattern": "^[a-z]{2}(-[A-Z]{2})?$"
          },
          "description": "The languages this persona speaks."
        },
        "fallbackLanguage": {
          "type": "string",
          "pattern": "^[a-z]{2}(-[A-Z]{2})?$",
          "description": "Which of the declared languages is used when the language in force is not among them. Declared per pack rather than per product, because a pack's voice is authored in the languages its author actually wrote."
        },
        "talkativeness": {
          "enum": [
            "terse",
            "moderate",
            "chatty"
          ],
          "description": "How much the pet says unprompted. An enumeration rather than free text, because it governs how often the product interrupts the user and that is a behavioural setting rather than a matter of voice."
        },
        "characterDescription": {
          "type": "string",
          "maxLength": 1200,
          "description": "Who the pet is, in the author's own words. The one free-text field, and the reason two packs sharing a catalogue style still sound like different characters. Bounded so that a description stays a description and the prompt cost of a pack is predictable. It is advisory text: it shapes voice and can never authorize an action, relax an approval, name a tool, or alter a rule — not because it is filtered, but because it is composed only into positions the approval gate does not read."
        },
        "acknowledgementLines": {
          "type": "object",
          "minProperties": 1,
          "additionalProperties": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120
            }
          },
          "propertyNames": {
            "pattern": "^[a-z]{2}(-[A-Z]{2})?$"
          },
          "description": "The receipt lines the product may present without a model, grouped by language. They exist because no measured model answers fast enough to hold the two-second commitment — VERIFIED (spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q2) — and they must state receipt only: naming nothing from the command, asserting no understanding of it, and promising no outcome. That constraint is judged by reading them, which is why the acceptance plan checks it and this schema only bounds their shape."
        }
      }
    },
    "author": {
      "type": "string",
      "maxLength": 80,
      "description": "Who made the pack. Free text today, because both provenances are trusted: the product, or the account holder themselves. It is the field a distribution channel would later need to mean something verifiable, which is why it exists now rather than being added when that channel is built."
    },
    "description": {
      "type": "string",
      "maxLength": 300,
      "description": "What the pack is, for the library listing. Distinct from the persona's character description, which is about who the pet is rather than what the pack contains."
    },
    "preview": {
      "type": "string",
      "pattern": "^[A-Za-z0-9._-]+$",
      "description": "A still image within the pack directory, so the library can show what a pack looks like without loading its asset."
    },
    "derivedFrom": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$",
      "description": "The template this account pack was created from. Recorded for the user's benefit and confers no update relationship: a release that updates the template leaves the derived pack untouched, which is the model's INV-PACK-01."
    }
  }
} as const;
