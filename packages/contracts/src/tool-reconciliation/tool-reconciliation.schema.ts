export type ReconciliationDeclaration = {
  method: "readback" | "none";
  read_operation?: string;
  comparison?: {
    path: string;
    against: ("before" | "intended")[];
    equality?: "exact" | "normalised";
  };
  ambiguous_outcome?: "ask_user" | "treat_as_unperformed";
  reason?: string;
};


export const TOOL_RECONCILIATION_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ReconciliationDeclaration",
  "type": "object",
  "required": [
    "method"
  ],
  "additionalProperties": false,
  "properties": {
    "method": {
      "type": "string",
      "enum": [
        "readback",
        "none"
      ]
    },
    "read_operation": {
      "type": "string"
    },
    "comparison": {
      "type": "object",
      "required": [
        "path",
        "against"
      ],
      "additionalProperties": false,
      "properties": {
        "path": {
          "type": "string"
        },
        "against": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "before",
              "intended"
            ]
          }
        },
        "equality": {
          "type": "string",
          "enum": [
            "exact",
            "normalised"
          ]
        }
      }
    },
    "ambiguous_outcome": {
      "type": "string",
      "enum": [
        "ask_user",
        "treat_as_unperformed"
      ]
    },
    "reason": {
      "type": "string"
    }
  },
  "allOf": [
    {
      "if": {
        "required": [
          "method"
        ],
        "properties": {
          "method": {
            "const": "none"
          }
        }
      },
      "then": {
        "not": {
          "anyOf": [
            {
              "required": [
                "read_operation"
              ]
            },
            {
              "required": [
                "comparison"
              ]
            }
          ]
        }
      }
    },
    {
      "if": {
        "required": [
          "method"
        ],
        "properties": {
          "method": {
            "const": "readback"
          }
        }
      },
      "then": {
        "required": [
          "read_operation",
          "comparison"
        ]
      }
    }
  ]
} as const;
