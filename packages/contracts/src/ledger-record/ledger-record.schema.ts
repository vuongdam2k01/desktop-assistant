/**
 * One entry in the product's history. Normative shape for ledger/contracts/ledger-record@0.1.0. The record is written once and never edited (INV-LG-10); anything learned later is a new record naming this one in references. Rules this schema cannot express — that a correlation identifier is never reused, that a result matches an open intent, and that a successful result for a reversible call carries a compensating action — are relations between records and are held by ledger/contracts/ledger-store@0.1.0.
 */
export type LedgerRecord = {
  /**
   * Identity of this record within the account.
   */
  recordId: string;
  /**
   * The job this record accounts for.
   */
  jobId: string;
  /**
   * Dense and strictly increasing within the job (INV-LG-02).
   */
  position: number;
  /**
   * The closed set of things a record can be. Adding a value is a MAJOR change: every reader decides what it may present and compensate from this field.
   */
  type: "intent" | "result" | "decision" | "error" | "information" | "removal_announcement" | "superseded_version";
  /**
   * The device that wrote the record.
   */
  originDevice: string;
  /**
   * Monotonic within originDevice, never reused, assigned at write time and never recomputed, including on a replica (INV-LG-09, INV-SYNC-05).
   */
  originSequence: number;
  /**
   * ISO-8601. Displayed, never used to order (INV-SYNC-06).
   */
  recordedAt: string;
  /**
   * Joins exactly one intent to at most one result (INV-LG-04). Required on intent and result, absent on every other type.
   */
  correlationId?: string;
  /**
   * The records this one corrects, answers, or announces the removal of.
   */
  references?: string[];
  /**
   * Shape determined by type; see the conditional branches below.
   */
  content: {
    [k: string]: unknown;
  };
};


export const LEDGER_RECORD_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://spec.desktop-assistant.local/ledger/ledger-record/0.1.0",
  "title": "LedgerRecord",
  "description": "One entry in the product's history. Normative shape for ledger/contracts/ledger-record@0.1.0. The record is written once and never edited (INV-LG-10); anything learned later is a new record naming this one in references. Rules this schema cannot express — that a correlation identifier is never reused, that a result matches an open intent, and that a successful result for a reversible call carries a compensating action — are relations between records and are held by ledger/contracts/ledger-store@0.1.0.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "recordId",
    "jobId",
    "position",
    "type",
    "originDevice",
    "originSequence",
    "recordedAt",
    "content"
  ],
  "properties": {
    "recordId": {
      "type": "string",
      "minLength": 1,
      "description": "Identity of this record within the account."
    },
    "jobId": {
      "type": "string",
      "minLength": 1,
      "description": "The job this record accounts for."
    },
    "position": {
      "type": "integer",
      "minimum": 0,
      "description": "Dense and strictly increasing within the job (INV-LG-02)."
    },
    "type": {
      "description": "The closed set of things a record can be. Adding a value is a MAJOR change: every reader decides what it may present and compensate from this field.",
      "enum": [
        "intent",
        "result",
        "decision",
        "error",
        "information",
        "removal_announcement",
        "superseded_version"
      ]
    },
    "originDevice": {
      "type": "string",
      "minLength": 1,
      "description": "The device that wrote the record."
    },
    "originSequence": {
      "type": "integer",
      "minimum": 0,
      "description": "Monotonic within originDevice, never reused, assigned at write time and never recomputed, including on a replica (INV-LG-09, INV-SYNC-05)."
    },
    "recordedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO-8601. Displayed, never used to order (INV-SYNC-06)."
    },
    "correlationId": {
      "type": "string",
      "minLength": 1,
      "description": "Joins exactly one intent to at most one result (INV-LG-04). Required on intent and result, absent on every other type."
    },
    "references": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "The records this one corrects, answers, or announces the removal of."
    },
    "content": {
      "type": "object",
      "description": "Shape determined by type; see the conditional branches below."
    }
  },
  "allOf": [
    {
      "$comment": "correlationId is present exactly on intent and result.",
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "enum": [
              "intent",
              "result"
            ]
          }
        }
      },
      "then": {
        "required": [
          "correlationId"
        ]
      },
      "else": {
        "not": {
          "required": [
            "correlationId"
          ]
        }
      }
    },
    {
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "intent"
          }
        }
      },
      "then": {
        "properties": {
          "content": {
            "$ref": "#/$defs/IntentContent"
          }
        }
      }
    },
    {
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "result"
          }
        }
      },
      "then": {
        "properties": {
          "content": {
            "$ref": "#/$defs/ResultContent"
          }
        }
      }
    },
    {
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "decision"
          }
        }
      },
      "then": {
        "properties": {
          "content": {
            "$ref": "#/$defs/DecisionContent"
          }
        }
      }
    },
    {
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "error"
          }
        }
      },
      "then": {
        "properties": {
          "content": {
            "$ref": "#/$defs/ErrorContent"
          }
        }
      }
    },
    {
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "information"
          }
        }
      },
      "then": {
        "properties": {
          "content": {
            "$ref": "#/$defs/InformationContent"
          }
        }
      }
    },
    {
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "removal_announcement"
          }
        }
      },
      "then": {
        "properties": {
          "content": {
            "$ref": "#/$defs/RemovalAnnouncementContent"
          }
        }
      }
    },
    {
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "superseded_version"
          }
        }
      },
      "then": {
        "properties": {
          "content": {
            "$ref": "#/$defs/SupersededVersionContent"
          }
        }
      }
    }
  ],
  "$defs": {
    "IntentContent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "connector",
        "tool",
        "parameters",
        "before",
        "reversibility",
        "reconciliation"
      ],
      "properties": {
        "connector": {
          "type": "string",
          "minLength": 1
        },
        "tool": {
          "type": "string",
          "minLength": 1
        },
        "parameters": {
          "description": "As they will be sent. External content, never instruction."
        },
        "before": {
          "$ref": "#/$defs/SnapshotOrUnavailable"
        },
        "reversibility": {
          "$ref": "#/$defs/Reversibility"
        },
        "reconciliation": {
          "type": "object",
          "description": "Shape owned by job/contracts/tool-reconciliation@0.1.0. Copied when the record is written and never resolved when it is read (INV-LG-05), which is why it is carried here rather than referenced."
        }
      }
    },
    "ResultContent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "outcome",
        "establishedBy"
      ],
      "properties": {
        "outcome": {
          "enum": [
            "succeeded",
            "failed"
          ]
        },
        "establishedBy": {
          "enum": [
            "observed",
            "reconciled",
            "user_confirmed"
          ],
          "description": "Never presented as stronger than it is: observed means the platform's response was seen, reconciled means it was inferred from the platform's later state, user_confirmed means the user said so."
        },
        "response": {
          "description": "As returned. Absent when the outcome was established by reconciliation."
        },
        "after": {
          "$ref": "#/$defs/SnapshotOrUnavailable"
        },
        "compensatingAction": {
          "$ref": "#/$defs/CompensatingAction"
        },
        "failure": {
          "$ref": "#/$defs/FailureDetail"
        }
      }
    },
    "DecisionContent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "decision",
        "decidedBy"
      ],
      "properties": {
        "decision": {
          "enum": [
            "approve",
            "deny",
            "cancel",
            "confirm_undo",
            "confirm_outcome"
          ]
        },
        "decidedBy": {
          "enum": [
            "user",
            "risk_judge"
          ]
        },
        "scope": {
          "type": "string"
        },
        "reason": {
          "type": "string"
        },
        "answers": {
          "type": "string",
          "minLength": 1
        }
      },
      "allOf": [
        {
          "$comment": "A decision the risk judge took states why.",
          "if": {
            "required": [
              "decidedBy"
            ],
            "properties": {
              "decidedBy": {
                "const": "risk_judge"
              }
            }
          },
          "then": {
            "required": [
              "reason"
            ]
          }
        }
      ]
    },
    "ErrorContent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "message"
      ],
      "properties": {
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string"
        },
        "interrupted": {
          "type": "boolean",
          "description": "True when recovery concluded the call never reached the platform."
        }
      }
    },
    "InformationContent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "summary"
      ],
      "properties": {
        "summary": {
          "type": "string",
          "minLength": 1
        },
        "detail": {}
      }
    },
    "RemovalAnnouncementContent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "reason",
        "requestedBy",
        "range"
      ],
      "properties": {
        "reason": {
          "enum": [
            "retention_expiry",
            "user_deletion"
          ]
        },
        "requestedBy": {
          "enum": [
            "system",
            "user"
          ]
        },
        "range": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "fromRecordedAt",
            "toRecordedAt",
            "recordCount"
          ],
          "properties": {
            "fromRecordedAt": {
              "type": "string",
              "format": "date-time"
            },
            "toRecordedAt": {
              "type": "string",
              "format": "date-time"
            },
            "recordCount": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      }
    },
    "SupersededVersionContent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "supersededRecord",
        "supersedingRecord",
        "supersededPayload",
        "supersededDevice"
      ],
      "properties": {
        "supersededRecord": {
          "type": "string",
          "minLength": 1
        },
        "supersedingRecord": {
          "type": "string",
          "minLength": 1
        },
        "supersededPayload": {
          "description": "The displaced payload, held whole."
        },
        "supersededDevice": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "SnapshotOrUnavailable": {
      "description": "State held whole rather than as a difference. A snapshot that could not be taken is explicit rather than absent, because 'no state recorded' and 'state recorded as empty' lead to different undo decisions.",
      "oneOf": [
        {
          "$ref": "#/$defs/Snapshot"
        },
        {
          "$ref": "#/$defs/SnapshotUnavailable"
        }
      ]
    },
    "Snapshot": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "captured",
        "target",
        "state"
      ],
      "properties": {
        "captured": {
          "const": true
        },
        "target": {
          "type": "string",
          "minLength": 1
        },
        "state": {
          "description": "The complete state of the target at that moment."
        }
      }
    },
    "SnapshotUnavailable": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "captured",
        "reason"
      ],
      "properties": {
        "captured": {
          "const": false
        },
        "target": {
          "type": "string"
        },
        "reason": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "Reversibility": {
      "description": "Declared on the intent, before the call, never inferred from the result.",
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "snapshotMethod"
          ],
          "properties": {
            "kind": {
              "const": "reversible"
            },
            "snapshotMethod": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "reason"
          ],
          "properties": {
            "kind": {
              "const": "irreversible"
            },
            "reason": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ]
    },
    "CompensatingAction": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "connector",
        "tool",
        "parameters"
      ],
      "properties": {
        "connector": {
          "type": "string",
          "minLength": 1
        },
        "tool": {
          "type": "string",
          "minLength": 1
        },
        "parameters": {
          "description": "Replayed by undo against current state, never diffed from two snapshots."
        }
      }
    },
    "FailureDetail": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "message",
        "retriable"
      ],
      "properties": {
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string"
        },
        "retriable": {
          "type": "boolean"
        }
      }
    }
  }
} as const;
