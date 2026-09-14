/**
 * Shape of the manifest that makes a directory a skill package, for agent/contracts/skill-manifest@1.0.0. A skill is a reusable playbook: instructions for a kind of work, plus the reference material those instructions cite. A directory without a document satisfying this schema is not a skill package — it is absent from the catalogue rather than partly available. The document declares identity, the version of its own content, the applicability text by which a job decides to load it, where the playbook is, and which reference material it cites. Two things this file settles mechanically that prose could only ask for: every path it admits is relative, stays inside the package directory, and ends in a text extension the product reads rather than runs (INV-AG-34); and no member exists through which a package could name a command, a script, an entry point or an install step, because the document admits no member beyond the eight declared here. What it cannot express is stated by the contract: whether the named files can actually be read, whether the package as a whole is within its size ceiling, and which of two packages declaring one identifier wins — all answered by reading the package directory rather than the document.
 */
export interface SkillManifest {
  /**
   * Which revision of this manifest shape the document was written against. A document written for a major revision the device does not implement is refused whole with MANIFEST_SCHEMA_UNSUPPORTED and is never read partially: a partly understood manifest could silently drop the one member that mattered — a reference path, or the applicability text a job matches on.
   */
  schemaVersion: string;
  /**
   * Stable identity of the playbook, and the key the catalogue resolves. It is what a role's preload list names and what a job records having loaded, so it must not change when the content is edited. Two packages declaring one skillId never merge: exactly one is selected by declared precedence and the other is recorded as shadowed (INV-AG-35).
   */
  skillId: string;
  /**
   * What the user sees in the catalogue listing. Distinct from skillId, which is the identity the product resolves and never shows as a label.
   */
  name: string;
  /**
   * The content's own version, advanced by whoever authored the playbook. It distinguishes revisions of one skill; it takes no part in precedence, because precedence is resolved by origin so that two devices holding the same two packages resolve the same way whatever versions they carry.
   */
  version: string;
  /**
   * What work this playbook is for, in the words a job matches against. This is the whole of what a skill advertises before its body is read: the catalogue carries it, a job sees it at start, and a body enters a context only when this text matched or a role preloaded the skill. Bounded so that advertising a full catalogue stays cheap — with the 256-entry catalogue ceiling the advertisement is bounded at roughly 100 KiB. Both figures are UNVERIFIED declared budgets from clarifications.md session 2026-09-13, not measurements.
   */
  appliesTo: string;
  /**
   * The playbook itself: either written into the manifest, or held in a file beside it. Exactly one of the two, never both and never neither — a manifest offering two bodies is a playbook nobody wrote, which is the same failure INV-AG-35 forbids across packages.
   */
  body: {
    [k: string]: unknown;
  } & {
    /**
     * The playbook, written into the manifest. Suited to a short playbook that cites nothing. The bound is the package ceiling itself; the ceiling governs the body and its reference material together and is enforced by measuring the package directory, not by trusting a declared figure.
     */
    inline?: string;
    /**
     * The playbook's file, relative to the package directory. The pattern is what confines it: no leading separator, so an absolute path is refused; no segment may begin with a dot, so '..' cannot appear and traversal is impossible; no backslash or colon, so a drive-qualified or UNC path is refused; and the name must end in a text extension the product reads rather than runs. A path is refused at validation, before any path is resolved, so the refusal never depends on where the package happens to sit.
     */
    path?: string;
  };
  /**
   * The reference material the body cites, by path relative to the package directory. Named rather than embedded, so the catalogue can list every skill by reading manifests alone and read material only when the skill is loaded. A package is loaded whole or not at all: if any path here cannot be read, the skill is absent rather than half-loaded, because a playbook missing the material it cites is a playbook that misleads. The list is bounded for the same reason the package is: a skill that needs more than this is two skills.
   *
   * @maxItems 32
   *
   * Items: One relative path inside the package directory. Confined exactly as body.path is, and additionally the reason this contract diverges from its reference architecture: the extension allowlist admits documents the product reads to a model and admits nothing the product could execute, so the manifest has no member through which a skill could name a script (INV-AG-34).
   */
  references?: string[];
  /**
   * When true, the skill takes no part in automatic matching and remains loadable by identifier — by a role's preload list, or by a job that names it. Absent means false. It exists so that a playbook written to be cited by another playbook does not compete for the attention of every job whose work brushes past its applicability text.
   */
  hidden?: boolean;
}


export const SKILL_MANIFEST_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/skill-manifest/1.0.0.json",
  "title": "SkillManifest",
  "description": "Shape of the manifest that makes a directory a skill package, for agent/contracts/skill-manifest@1.0.0. A skill is a reusable playbook: instructions for a kind of work, plus the reference material those instructions cite. A directory without a document satisfying this schema is not a skill package — it is absent from the catalogue rather than partly available. The document declares identity, the version of its own content, the applicability text by which a job decides to load it, where the playbook is, and which reference material it cites. Two things this file settles mechanically that prose could only ask for: every path it admits is relative, stays inside the package directory, and ends in a text extension the product reads rather than runs (INV-AG-34); and no member exists through which a package could name a command, a script, an entry point or an install step, because the document admits no member beyond the eight declared here. What it cannot express is stated by the contract: whether the named files can actually be read, whether the package as a whole is within its size ceiling, and which of two packages declaring one identifier wins — all answered by reading the package directory rather than the document.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "skillId",
    "name",
    "version",
    "appliesTo",
    "body"
  ],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Which revision of this manifest shape the document was written against. A document written for a major revision the device does not implement is refused whole with MANIFEST_SCHEMA_UNSUPPORTED and is never read partially: a partly understood manifest could silently drop the one member that mattered — a reference path, or the applicability text a job matches on."
    },
    "skillId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$",
      "description": "Stable identity of the playbook, and the key the catalogue resolves. It is what a role's preload list names and what a job records having loaded, so it must not change when the content is edited. Two packages declaring one skillId never merge: exactly one is selected by declared precedence and the other is recorded as shadowed (INV-AG-35)."
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64,
      "description": "What the user sees in the catalogue listing. Distinct from skillId, which is the identity the product resolves and never shows as a label."
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "The content's own version, advanced by whoever authored the playbook. It distinguishes revisions of one skill; it takes no part in precedence, because precedence is resolved by origin so that two devices holding the same two packages resolve the same way whatever versions they carry."
    },
    "appliesTo": {
      "type": "string",
      "minLength": 1,
      "maxLength": 400,
      "description": "What work this playbook is for, in the words a job matches against. This is the whole of what a skill advertises before its body is read: the catalogue carries it, a job sees it at start, and a body enters a context only when this text matched or a role preloaded the skill. Bounded so that advertising a full catalogue stays cheap — with the 256-entry catalogue ceiling the advertisement is bounded at roughly 100 KiB. Both figures are UNVERIFIED declared budgets from clarifications.md session 2026-09-13, not measurements."
    },
    "body": {
      "type": "object",
      "additionalProperties": false,
      "description": "The playbook itself: either written into the manifest, or held in a file beside it. Exactly one of the two, never both and never neither — a manifest offering two bodies is a playbook nobody wrote, which is the same failure INV-AG-35 forbids across packages.",
      "properties": {
        "inline": {
          "type": "string",
          "minLength": 1,
          "maxLength": 262144,
          "description": "The playbook, written into the manifest. Suited to a short playbook that cites nothing. The bound is the package ceiling itself; the ceiling governs the body and its reference material together and is enforced by measuring the package directory, not by trusting a declared figure."
        },
        "path": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-][A-Za-z0-9._-]*(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\\.(md|txt|json|csv|yaml|yml)$",
          "description": "The playbook's file, relative to the package directory. The pattern is what confines it: no leading separator, so an absolute path is refused; no segment may begin with a dot, so '..' cannot appear and traversal is impossible; no backslash or colon, so a drive-qualified or UNC path is refused; and the name must end in a text extension the product reads rather than runs. A path is refused at validation, before any path is resolved, so the refusal never depends on where the package happens to sit."
        }
      },
      "oneOf": [
        {
          "required": [
            "inline"
          ]
        },
        {
          "required": [
            "path"
          ]
        }
      ]
    },
    "references": {
      "type": "array",
      "uniqueItems": true,
      "maxItems": 32,
      "description": "The reference material the body cites, by path relative to the package directory. Named rather than embedded, so the catalogue can list every skill by reading manifests alone and read material only when the skill is loaded. A package is loaded whole or not at all: if any path here cannot be read, the skill is absent rather than half-loaded, because a playbook missing the material it cites is a playbook that misleads. The list is bounded for the same reason the package is: a skill that needs more than this is two skills.",
      "items": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_-][A-Za-z0-9._-]*(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\\.(md|txt|json|csv|yaml|yml)$",
        "description": "One relative path inside the package directory. Confined exactly as body.path is, and additionally the reason this contract diverges from its reference architecture: the extension allowlist admits documents the product reads to a model and admits nothing the product could execute, so the manifest has no member through which a skill could name a script (INV-AG-34)."
      }
    },
    "hidden": {
      "type": "boolean",
      "description": "When true, the skill takes no part in automatic matching and remains loadable by identifier — by a role's preload list, or by a job that names it. Absent means false. It exists so that a playbook written to be cited by another playbook does not compete for the attention of every job whose work brushes past its applicability text."
    }
  }
} as const;
