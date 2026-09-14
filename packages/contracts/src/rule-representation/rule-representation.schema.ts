/**
 * Totally ordered by strictness: refuse is strictest, allow is weakest. When several rules match one call the strictest verdict wins. There is no priority, weight or ordering member anywhere in this schema, and adding one is a MAJOR change.
 */
export type Verdict = "refuse" | "hold" | "allow";
/**
 * A finite tree whose leaves are drawn only from the closed set below. No node carries text that is executed rather than compared.
 */
export type Condition =
  | AllCondition
  | AnyCondition
  | NotCondition
  | ToolLeaf
  | ScopeLeaf
  | FieldLeaf
  | OwnershipLeaf
  | CountLeaf
  | TimeLeaf
  | IrreversibleLeaf
  | PermissionLeaf;
export type StringOrStrings = string | [string, ...string[]];
/**
 * A scalar. A rule never compares against a structure, because a structural comparison is a computation and this representation carries none.
 */
export type JsonValue = string | number | boolean | null;
/**
 * currentUser resolves at evaluation time to the signed-in account; product is the assistant acting on the user's behalf; any other value is an identifier as the connector states it.
 */
export type Principal = string;

/**
 * Normative shape of one stored rule for approval/contracts/rule-representation@1.0.0. A rule that does not satisfy this file is not stored, and a catalogue holding one does not load. The closed leaf set below is the safety argument recorded in model.md (INV-APPROVAL-02): an evaluator whose inputs cannot be enumerated cannot be reasoned about. Derived from the representation measured in spikes/SP-8-rule-ir-hardgate/src/ir/schema.json against the frozen adversarial corpus, with the four changes the contract's Migration section states: the priority field is gone, targeting is connector-neutral, counts carry an explicit boundary, and every rule carries the version it was written against.
 */
export interface Rule {
  /**
   * The version of the rule-representation contract this rule was written against. Carried on the rule as well as on the catalogue so that a rule copied between catalogues still states its origin version. A build meeting a version ahead of its own refuses the catalogue whole (RULE_VERSION_AHEAD).
   */
  representationVersion: string;
  /**
   * Stable, opaque, unique within the account.
   */
  id: string;
  /**
   * Short label shown in the rule list.
   */
  name: string;
  /**
   * The restatement the user confirmed, in their own language. Displayed, never parsed.
   */
  restatement: string;
  /**
   * Stored rules carry no other origin. Hardline rules and the smart tier's static patterns use the same condition language but ship inside the build, so no catalogue edit, corruption or replication can introduce or remove one (INV-APPROVAL-04). A stored rule claiming another origin is RULE_ORIGIN_FORBIDDEN.
   */
  origin: "user";
  verdict: Verdict;
  condition: Condition;
  /**
   * ISO-8601 instant at which the user confirmed the restatement. A rule binds from this moment and not before (INV-APPROVAL-08).
   */
  confirmedAt: string;
}
export interface AllCondition {
  kind: "all";
  /**
   * @minItems 1
   */
  of: [Condition, ...Condition[]];
}
export interface AnyCondition {
  kind: "any";
  /**
   * @minItems 1
   */
  of: [Condition, ...Condition[]];
}
export interface NotCondition {
  kind: "not";
  of: Condition;
}
/**
 * Which platform and which operation. Both values are declared by a connector manifest; naming one no loaded manifest declares is RULE_REFERENCE_UNKNOWN at compile time.
 */
export interface ToolLeaf {
  kind: "tool";
  connector?: StringOrStrings;
  tool?: StringOrStrings;
}
/**
 * What the operation acts on. Addressed by connector-declared type and immutable identifier only: there is deliberately no member holding a display name, because renaming an object would otherwise step around the rule protecting it (spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi, Q5 case A-20).
 */
export interface ScopeLeaf {
  kind: "scope";
  objectType?: StringOrStrings;
  objectId?:
    | string
    | {
        /**
         * @minItems 1
         */
        in: [string, ...string[]];
      };
  ancestor?:
    | {
        contains: string;
      }
    | {
        /**
         * @minItems 1
         */
        containsAny: [string, ...string[]];
      };
}
/**
 * Which fields the operation changes, and what they end up holding. Field names are compared after the normalisation the contract's Semantics section states, so one rule matches every spelling a connector uses.
 */
export interface FieldLeaf {
  kind: "field";
  changes?: {
    includes?: string;
    /**
     * @minItems 1
     */
    includesAny?: [string, ...string[]];
    /**
     * Matches when, after removing the listed fields, the call still changes something.
     *
     * @minItems 1
     */
    remainderNotEmpty?: [string, ...string[]];
  };
  becomes?: {
    field: string;
    equals?: JsonValue;
    /**
     * @minItems 1
     */
    oneOf?: [JsonValue, ...JsonValue[]];
    /**
     * @minItems 1
     */
    noneOf?: [JsonValue, ...JsonValue[]];
    /**
     * A pattern compared against the resulting value rendered as text. Matching only: never executed, never given the power to call out, never applied to anything but that one field's resulting value. A pattern that will not compile or exceeds this bound makes the whole rule unstorable (RULE_PATTERN_INVALID) rather than making this leaf vacuous.
     */
    matches?: string;
  };
  removes?:
    | true
    | string
    | {
        /**
         * @minItems 1
         */
        in: [string, ...string[]];
      };
}
/**
 * Who the object belongs to. Read from the connector's own record of the object, never from the call's arguments (INV-APPROVAL-06); the schema cannot express that boundary, and the gate enforces it.
 */
export interface OwnershipLeaf {
  kind: "ownership";
  createdBy?: {
    /**
     * @minItems 1
     */
    in?: [Principal, ...Principal[]];
    /**
     * @minItems 1
     */
    notIn?: [Principal, ...Principal[]];
  };
  assignedTo?: {
    includes?: string;
    excludes?: string;
    /**
     * @minItems 1
     */
    in?: [Principal, ...Principal[]];
    /**
     * @minItems 1
     */
    notIn?: [Principal, ...Principal[]];
  };
}
/**
 * How much of something has already happened within a stated boundary. Counted from the account's ledger records rather than session memory, so a restart does not reset it and a second signed-in device does not start from zero.
 */
export interface CountLeaf {
  kind: "count";
  metric: "writes" | "creates" | "distinctObjects" | "fieldChanges";
  boundary: "job" | "calendarDay";
  /**
   * Names the field being counted. Required when metric is fieldChanges; absent then it is RULE_COUNT_FIELD_MISSING.
   */
  field?: string;
  operator: "gt" | "gte" | "eq";
  value: number;
}
/**
 * When the operation is attempted, evaluated in the time zone recorded for the user rather than the machine's, so two devices in different zones agree about whether a rule about working hours matched.
 */
export interface TimeLeaf {
  kind: "time";
  /**
   * Matches when the local time falls outside the given window.
   *
   * @minItems 2
   * @maxItems 2
   */
  outside?: [string, string];
  /**
   * @minItems 1
   */
  onDays?: [
    "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
    ...("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[]
  ];
}
/**
 * Reads the connector manifest's irreversibility declaration for this tool. The gate keeps no list of its own; a tool whose manifest is silent is MANIFEST_DECLARATION_MISSING and its calls are refused.
 */
export interface IrreversibleLeaf {
  kind: "irreversible";
  is: boolean;
}
/**
 * Reads the connector manifest's permission-change declaration for this tool.
 */
export interface PermissionLeaf {
  kind: "permission";
  changes: boolean;
}


export const RULE_REPRESENTATION_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/approval/rule-representation/1.0.0.json",
  "title": "Rule",
  "description": "Normative shape of one stored rule for approval/contracts/rule-representation@1.0.0. A rule that does not satisfy this file is not stored, and a catalogue holding one does not load. The closed leaf set below is the safety argument recorded in model.md (INV-APPROVAL-02): an evaluator whose inputs cannot be enumerated cannot be reasoned about. Derived from the representation measured in spikes/SP-8-rule-ir-hardgate/src/ir/schema.json against the frozen adversarial corpus, with the four changes the contract's Migration section states: the priority field is gone, targeting is connector-neutral, counts carry an explicit boundary, and every rule carries the version it was written against.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "representationVersion",
    "id",
    "name",
    "restatement",
    "origin",
    "verdict",
    "condition",
    "confirmedAt"
  ],
  "properties": {
    "representationVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "The version of the rule-representation contract this rule was written against. Carried on the rule as well as on the catalogue so that a rule copied between catalogues still states its origin version. A build meeting a version ahead of its own refuses the catalogue whole (RULE_VERSION_AHEAD)."
    },
    "id": {
      "type": "string",
      "minLength": 1,
      "description": "Stable, opaque, unique within the account."
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Short label shown in the rule list."
    },
    "restatement": {
      "type": "string",
      "minLength": 1,
      "description": "The restatement the user confirmed, in their own language. Displayed, never parsed."
    },
    "origin": {
      "const": "user",
      "description": "Stored rules carry no other origin. Hardline rules and the smart tier's static patterns use the same condition language but ship inside the build, so no catalogue edit, corruption or replication can introduce or remove one (INV-APPROVAL-04). A stored rule claiming another origin is RULE_ORIGIN_FORBIDDEN."
    },
    "verdict": {
      "$ref": "#/$defs/Verdict"
    },
    "condition": {
      "$ref": "#/$defs/Condition"
    },
    "confirmedAt": {
      "type": "string",
      "minLength": 1,
      "description": "ISO-8601 instant at which the user confirmed the restatement. A rule binds from this moment and not before (INV-APPROVAL-08)."
    }
  },
  "$defs": {
    "Verdict": {
      "enum": [
        "refuse",
        "hold",
        "allow"
      ],
      "description": "Totally ordered by strictness: refuse is strictest, allow is weakest. When several rules match one call the strictest verdict wins. There is no priority, weight or ordering member anywhere in this schema, and adding one is a MAJOR change."
    },
    "RuleCatalogue": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "representationVersion",
        "rules"
      ],
      "description": "What is stored and replicated as a whole. A catalogue holding zero rules is valid and means the user has written none; a catalogue that does not satisfy this shape is not an empty catalogue and stops writes until it is repaired.",
      "properties": {
        "representationVersion": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+$"
        },
        "rules": {
          "type": "array",
          "items": {
            "$ref": "#"
          }
        }
      }
    },
    "Condition": {
      "description": "A finite tree whose leaves are drawn only from the closed set below. No node carries text that is executed rather than compared.",
      "oneOf": [
        {
          "$ref": "#/$defs/AllCondition"
        },
        {
          "$ref": "#/$defs/AnyCondition"
        },
        {
          "$ref": "#/$defs/NotCondition"
        },
        {
          "$ref": "#/$defs/ToolLeaf"
        },
        {
          "$ref": "#/$defs/ScopeLeaf"
        },
        {
          "$ref": "#/$defs/FieldLeaf"
        },
        {
          "$ref": "#/$defs/OwnershipLeaf"
        },
        {
          "$ref": "#/$defs/CountLeaf"
        },
        {
          "$ref": "#/$defs/TimeLeaf"
        },
        {
          "$ref": "#/$defs/IrreversibleLeaf"
        },
        {
          "$ref": "#/$defs/PermissionLeaf"
        }
      ]
    },
    "AllCondition": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "of"
      ],
      "properties": {
        "kind": {
          "const": "all"
        },
        "of": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/Condition"
          }
        }
      }
    },
    "AnyCondition": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "of"
      ],
      "properties": {
        "kind": {
          "const": "any"
        },
        "of": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/Condition"
          }
        }
      }
    },
    "NotCondition": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "of"
      ],
      "properties": {
        "kind": {
          "const": "not"
        },
        "of": {
          "$ref": "#/$defs/Condition"
        }
      }
    },
    "ToolLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind"
      ],
      "description": "Which platform and which operation. Both values are declared by a connector manifest; naming one no loaded manifest declares is RULE_REFERENCE_UNKNOWN at compile time.",
      "properties": {
        "kind": {
          "const": "tool"
        },
        "connector": {
          "$ref": "#/$defs/StringOrStrings"
        },
        "tool": {
          "$ref": "#/$defs/StringOrStrings"
        }
      }
    },
    "ScopeLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind"
      ],
      "description": "What the operation acts on. Addressed by connector-declared type and immutable identifier only: there is deliberately no member holding a display name, because renaming an object would otherwise step around the rule protecting it (spikes/SP-8-rule-ir-hardgate/REPORT.md#1-tra-loi-tung-cau-hoi, Q5 case A-20).",
      "properties": {
        "kind": {
          "const": "scope"
        },
        "objectType": {
          "$ref": "#/$defs/StringOrStrings"
        },
        "objectId": {
          "oneOf": [
            {
              "type": "string",
              "minLength": 1
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "in"
              ],
              "properties": {
                "in": {
                  "type": "array",
                  "minItems": 1,
                  "items": {
                    "type": "string"
                  }
                }
              }
            }
          ]
        },
        "ancestor": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "contains"
              ],
              "properties": {
                "contains": {
                  "type": "string",
                  "minLength": 1
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "containsAny"
              ],
              "properties": {
                "containsAny": {
                  "type": "array",
                  "minItems": 1,
                  "items": {
                    "type": "string"
                  }
                }
              }
            }
          ]
        }
      }
    },
    "FieldLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind"
      ],
      "description": "Which fields the operation changes, and what they end up holding. Field names are compared after the normalisation the contract's Semantics section states, so one rule matches every spelling a connector uses.",
      "properties": {
        "kind": {
          "const": "field"
        },
        "changes": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "includes": {
              "type": "string",
              "minLength": 1
            },
            "includesAny": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "string"
              }
            },
            "remainderNotEmpty": {
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "string"
              },
              "description": "Matches when, after removing the listed fields, the call still changes something."
            }
          }
        },
        "becomes": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "field"
          ],
          "properties": {
            "field": {
              "type": "string",
              "minLength": 1
            },
            "equals": {
              "$ref": "#/$defs/JsonValue"
            },
            "oneOf": {
              "type": "array",
              "minItems": 1,
              "items": {
                "$ref": "#/$defs/JsonValue"
              }
            },
            "noneOf": {
              "type": "array",
              "minItems": 1,
              "items": {
                "$ref": "#/$defs/JsonValue"
              }
            },
            "matches": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200,
              "description": "A pattern compared against the resulting value rendered as text. Matching only: never executed, never given the power to call out, never applied to anything but that one field's resulting value. A pattern that will not compile or exceeds this bound makes the whole rule unstorable (RULE_PATTERN_INVALID) rather than making this leaf vacuous."
            }
          }
        },
        "removes": {
          "oneOf": [
            {
              "const": true
            },
            {
              "type": "string",
              "minLength": 1
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "in"
              ],
              "properties": {
                "in": {
                  "type": "array",
                  "minItems": 1,
                  "items": {
                    "type": "string"
                  }
                }
              }
            }
          ]
        }
      }
    },
    "OwnershipLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind"
      ],
      "description": "Who the object belongs to. Read from the connector's own record of the object, never from the call's arguments (INV-APPROVAL-06); the schema cannot express that boundary, and the gate enforces it.",
      "properties": {
        "kind": {
          "const": "ownership"
        },
        "createdBy": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "in": {
              "type": "array",
              "minItems": 1,
              "items": {
                "$ref": "#/$defs/Principal"
              }
            },
            "notIn": {
              "type": "array",
              "minItems": 1,
              "items": {
                "$ref": "#/$defs/Principal"
              }
            }
          }
        },
        "assignedTo": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "includes": {
              "type": "string",
              "minLength": 1
            },
            "excludes": {
              "type": "string",
              "minLength": 1
            },
            "in": {
              "type": "array",
              "minItems": 1,
              "items": {
                "$ref": "#/$defs/Principal"
              }
            },
            "notIn": {
              "type": "array",
              "minItems": 1,
              "items": {
                "$ref": "#/$defs/Principal"
              }
            }
          }
        }
      }
    },
    "Principal": {
      "type": "string",
      "minLength": 1,
      "description": "currentUser resolves at evaluation time to the signed-in account; product is the assistant acting on the user's behalf; any other value is an identifier as the connector states it."
    },
    "CountLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "metric",
        "boundary",
        "operator",
        "value"
      ],
      "description": "How much of something has already happened within a stated boundary. Counted from the account's ledger records rather than session memory, so a restart does not reset it and a second signed-in device does not start from zero.",
      "properties": {
        "kind": {
          "const": "count"
        },
        "metric": {
          "enum": [
            "writes",
            "creates",
            "distinctObjects",
            "fieldChanges"
          ]
        },
        "boundary": {
          "enum": [
            "job",
            "calendarDay"
          ]
        },
        "field": {
          "type": "string",
          "minLength": 1,
          "description": "Names the field being counted. Required when metric is fieldChanges; absent then it is RULE_COUNT_FIELD_MISSING."
        },
        "operator": {
          "enum": [
            "gt",
            "gte",
            "eq"
          ]
        },
        "value": {
          "type": "integer",
          "minimum": 0
        }
      },
      "if": {
        "properties": {
          "metric": {
            "const": "fieldChanges"
          }
        },
        "required": [
          "metric"
        ]
      },
      "then": {
        "required": [
          "field"
        ]
      }
    },
    "TimeLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind"
      ],
      "description": "When the operation is attempted, evaluated in the time zone recorded for the user rather than the machine's, so two devices in different zones agree about whether a rule about working hours matched.",
      "properties": {
        "kind": {
          "const": "time"
        },
        "outside": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": {
            "type": "string",
            "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"
          },
          "description": "Matches when the local time falls outside the given window."
        },
        "onDays": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "enum": [
              "mon",
              "tue",
              "wed",
              "thu",
              "fri",
              "sat",
              "sun"
            ]
          }
        }
      }
    },
    "IrreversibleLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "is"
      ],
      "description": "Reads the connector manifest's irreversibility declaration for this tool. The gate keeps no list of its own; a tool whose manifest is silent is MANIFEST_DECLARATION_MISSING and its calls are refused.",
      "properties": {
        "kind": {
          "const": "irreversible"
        },
        "is": {
          "type": "boolean"
        }
      }
    },
    "PermissionLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "changes"
      ],
      "description": "Reads the connector manifest's permission-change declaration for this tool.",
      "properties": {
        "kind": {
          "const": "permission"
        },
        "changes": {
          "type": "boolean"
        }
      }
    },
    "StringOrStrings": {
      "oneOf": [
        {
          "type": "string",
          "minLength": 1
        },
        {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string",
            "minLength": 1
          }
        }
      ]
    },
    "JsonValue": {
      "type": [
        "string",
        "number",
        "boolean",
        "null"
      ],
      "description": "A scalar. A rule never compares against a structure, because a structural comparison is a computation and this representation carries none."
    }
  }
} as const;
