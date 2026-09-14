/**
 * Normative shape of one connector's content projection rules, for connector/contracts/drive-content-projection@0.1.0. One row per file kind the connector can read, saying by which route it is read, what form the job receives, and at what size it stops. The kind decides the route and the kind comes from the platform: nothing here is inferred from a name or an extension. Two rules the file carries directly are the ones that keep this honest - a file kind absent from the rules is unsupported and can be nothing else, and every row states where it was measured or says the word unmeasured with its reason, so a row may not argue from resemblance to another row. What the file cannot express, and what the contract document holds instead: that a ceiling owned by the product is the product's own decision rather than the platform's limit, and that content produced under these rules is untrusted data that reaches an agent only under the connector's declared sanitization.
 */
export interface ContentProjectionRules {
  connector_id: string;
  version: string;
  /**
   * The only permitted answer for a file kind the rules do not name. It is a member with one value rather than an omission, so that a build cannot quietly acquire a default route for kinds nobody measured.
   */
  unknown_kind_outcome: "unsupported";
  /**
   * @minItems 1
   */
  routes: [
    {
      file_kind: string;
      route: "export" | "download";
      produced_form: string;
      alternative_forms?: string[];
      ceiling_bytes: number;
      /**
       * Whether the limit is the platform's or the product's own. A product ceiling is a decision argued in design.md and is named as the product's when the user meets it, never presented as the platform refusing.
       */
      ceiling_owner: "platform" | "product";
      /**
       * Where this row was measured: a path under spikes/, or the word unmeasured followed by why. A row may not be silent about it, and may not argue from resemblance.
       */
      evidence: string;
    },
    ...{
      file_kind: string;
      route: "export" | "download";
      produced_form: string;
      alternative_forms?: string[];
      ceiling_bytes: number;
      /**
       * Whether the limit is the platform's or the product's own. A product ceiling is a decision argued in design.md and is named as the product's when the user meets it, never presented as the platform refusing.
       */
      ceiling_owner: "platform" | "product";
      /**
       * Where this row was measured: a path under spikes/, or the word unmeasured followed by why. A row may not be silent about it, and may not argue from resemblance.
       */
      evidence: string;
    }[]
  ];
}


export const DRIVE_CONTENT_PROJECTION_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/connector/drive-content-projection/0.1.0.json",
  "title": "ContentProjectionRules",
  "description": "Normative shape of one connector's content projection rules, for connector/contracts/drive-content-projection@0.1.0. One row per file kind the connector can read, saying by which route it is read, what form the job receives, and at what size it stops. The kind decides the route and the kind comes from the platform: nothing here is inferred from a name or an extension. Two rules the file carries directly are the ones that keep this honest - a file kind absent from the rules is unsupported and can be nothing else, and every row states where it was measured or says the word unmeasured with its reason, so a row may not argue from resemblance to another row. What the file cannot express, and what the contract document holds instead: that a ceiling owned by the product is the product's own decision rather than the platform's limit, and that content produced under these rules is untrusted data that reaches an agent only under the connector's declared sanitization.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "connector_id",
    "version",
    "routes",
    "unknown_kind_outcome"
  ],
  "properties": {
    "connector_id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_-]*$"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "unknown_kind_outcome": {
      "type": "string",
      "enum": [
        "unsupported"
      ],
      "description": "The only permitted answer for a file kind the rules do not name. It is a member with one value rather than an omission, so that a build cannot quietly acquire a default route for kinds nobody measured."
    },
    "routes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "file_kind",
          "route",
          "produced_form",
          "ceiling_bytes",
          "ceiling_owner",
          "evidence"
        ],
        "properties": {
          "file_kind": {
            "type": "string"
          },
          "route": {
            "type": "string",
            "enum": [
              "export",
              "download"
            ]
          },
          "produced_form": {
            "type": "string"
          },
          "alternative_forms": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "ceiling_bytes": {
            "type": "integer"
          },
          "ceiling_owner": {
            "type": "string",
            "enum": [
              "platform",
              "product"
            ],
            "description": "Whether the limit is the platform's or the product's own. A product ceiling is a decision argued in design.md and is named as the product's when the user meets it, never presented as the platform refusing."
          },
          "evidence": {
            "type": "string",
            "pattern": "^(unmeasured\\b|spikes/)",
            "description": "Where this row was measured: a path under spikes/, or the word unmeasured followed by why. A row may not be silent about it, and may not argue from resemblance."
          }
        }
      }
    }
  }
} as const;
