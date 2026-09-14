/**
 * Normative shape of the restatement a user confirms before a rule exists, for approval/contracts/rule-elicitation@0.1.0. This is the whole of the user's consent: what they see here is what will bind, and anything the conversation could not compile has to be visible in it. The member that carries that obligation is unsupportedClauses - present and possibly empty, never omitted - because an intention quietly dropped between the sentence and the rule is the silent downgrade FR-AP-04 exists to forbid, measured at 25 per cent on the cheap model in spikes/SP-2-rule-elicitation/REPORT.md section 1 Q3.
 */
export interface RuleSummaryTable {
  /**
   * The rule in one sentence, in the user's own language. It is what they read and confirm; it is displayed afterwards and never parsed.
   */
  summary: string;
  /**
   * Every operation the rule intercepts, named as a connector's manifest names it. A rule about deletion carries both the archive and the block-deletion operation, because on Notion a page put in the trash and a block destroyed are different calls and a user who said 'delete' meant both (INV-AP-18).
   *
   * @minItems 1
   */
  toolScope: [string, ...string[]];
  /**
   * What the rule protects, as an immutable identifier where the platform has one. A display name is not admissible as an anchor: renaming the object would step around the rule, which is a measured evasion.
   */
  targetResource: string;
  /**
   * Whether protection reaches the children of the target. Stated explicitly rather than defaulted, because a container rule that stops at the container protects nothing a user would recognise as protection (INV-AP-19).
   */
  includesDescendants: boolean;
  /**
   * The objective predicates the rule compiles to. An empty array is admissible and means the rule holds for every call in its tool scope.
   */
  conditions: string[];
  /**
   * The cases the user asked to be let through. Empty means no exception, which is the safer reading and the one a fail-closed interpretation arrives at.
   */
  exceptions: string[];
  /**
   * Every part of what the user said that could not be compiled, in their own words. Required and possibly empty: an empty array is a claim that nothing was dropped, and the difference between that claim and an absent member is the whole of FR-AP-04. A rule whose subjective part was compiled away into an objective proxy lists the subjective part here.
   */
  unsupportedClauses: string[];
  /**
   * What happens when the rule matches: hold the call for the user's decision, or refuse it outright. There is no allow verdict here - elicitation produces protections, and a conversation cannot be a way to widen what the product may do unasked.
   */
  verdict: "hold" | "refuse";
}


export const RULE_ELICITATION_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/approval/rule-elicitation/0.1.0.json",
  "title": "RuleSummaryTable",
  "description": "Normative shape of the restatement a user confirms before a rule exists, for approval/contracts/rule-elicitation@0.1.0. This is the whole of the user's consent: what they see here is what will bind, and anything the conversation could not compile has to be visible in it. The member that carries that obligation is unsupportedClauses - present and possibly empty, never omitted - because an intention quietly dropped between the sentence and the rule is the silent downgrade FR-AP-04 exists to forbid, measured at 25 per cent on the cheap model in spikes/SP-2-rule-elicitation/REPORT.md section 1 Q3.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "summary",
    "toolScope",
    "targetResource",
    "includesDescendants",
    "conditions",
    "exceptions",
    "unsupportedClauses",
    "verdict"
  ],
  "properties": {
    "summary": {
      "type": "string",
      "minLength": 1,
      "description": "The rule in one sentence, in the user's own language. It is what they read and confirm; it is displayed afterwards and never parsed."
    },
    "toolScope": {
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "description": "Every operation the rule intercepts, named as a connector's manifest names it. A rule about deletion carries both the archive and the block-deletion operation, because on Notion a page put in the trash and a block destroyed are different calls and a user who said 'delete' meant both (INV-AP-18).",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "targetResource": {
      "type": "string",
      "minLength": 1,
      "description": "What the rule protects, as an immutable identifier where the platform has one. A display name is not admissible as an anchor: renaming the object would step around the rule, which is a measured evasion."
    },
    "includesDescendants": {
      "type": "boolean",
      "description": "Whether protection reaches the children of the target. Stated explicitly rather than defaulted, because a container rule that stops at the container protects nothing a user would recognise as protection (INV-AP-19)."
    },
    "conditions": {
      "type": "array",
      "description": "The objective predicates the rule compiles to. An empty array is admissible and means the rule holds for every call in its tool scope.",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "exceptions": {
      "type": "array",
      "description": "The cases the user asked to be let through. Empty means no exception, which is the safer reading and the one a fail-closed interpretation arrives at.",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "unsupportedClauses": {
      "type": "array",
      "description": "Every part of what the user said that could not be compiled, in their own words. Required and possibly empty: an empty array is a claim that nothing was dropped, and the difference between that claim and an absent member is the whole of FR-AP-04. A rule whose subjective part was compiled away into an objective proxy lists the subjective part here.",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "verdict": {
      "enum": [
        "hold",
        "refuse"
      ],
      "description": "What happens when the rule matches: hold the call for the user's decision, or refuse it outright. There is no allow verdict here - elicitation produces protections, and a conversation cannot be a way to widen what the product may do unasked."
    }
  }
} as const;
