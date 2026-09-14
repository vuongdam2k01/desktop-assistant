/**
 * Normative shape of the three-way undo preview, for undo/contracts/undo-pipeline@1.0.0. This is the document the user decides against: every action of a finished job, partitioned into what can be put back, what cannot, and what a third party has touched since. The partition is exhaustive by construction - an action belongs to exactly one category and none is omitted - because an action missing from the preview is an action the user believes was undone. Categories follow the classification measured in spikes/SP-9-undo-agent/REPORT.md section 1 Q2.
 */
export type UndoPreviewResponse = {
  /**
   * The finished job this preview is about. The undo itself runs as a job of its own that references this one (INV-UD-02).
   */
  jobId: string;
  /**
   * Whether an undo may be started at all. False when the job holds no reversible action, in which case the control is disabled rather than offered and left to fail (INV-UD-04).
   */
  canUndo: boolean;
  /**
   * Why undo is unavailable, in the user's own language. Required whenever canUndo is false: a disabled control with no stated reason reads as a defect rather than as a limit of the platform.
   */
  disabledReason?: string;
  /**
   * Every action of the job, in the order it was recorded. An empty array is admissible and means the job wrote nothing; it is not the same as a job whose actions are all irreversible, which carries items and canUndo false.
   */
  items: PreviewItem[];
  /**
   * Number of items in the reversible category. Stated separately from the array so the summary the user reads first cannot be derived wrongly by whatever renders it.
   */
  reversibleCount: number;
  /**
   * Number of items the platform offers no compensating operation for.
   */
  irreversibleCount: number;
  /**
   * Number of items whose live state no longer matches what this job left behind, including items that could not be read at all.
   */
  conflictCount: number;
};
/**
 * One recorded action as the user is shown it.
 */
export type PreviewItem = {
  /**
   * The action's position within the source job, as the ledger recorded it. It is the identifier the user confirms against, so it is the ledger's own position and never a display index the preview assigned.
   */
  sequence: number;
  /**
   * The tool that performed the original action.
   */
  toolName: string;
  /**
   * The closed partition. A fourth value cannot be added without a MAJOR bump, because a category a window does not know is one it would render as neither safe nor unsafe.
   */
  category: "reversible" | "irreversible" | "conflict";
  /**
   * What undoing this item would do, phrased for the user rather than for a log.
   */
  description: string;
  /**
   * The immutable identifier of the object the action touched, as the connector defines identity for that type. Never a display name: a renamed object must still be recognised as the same object.
   */
  targetId?: string;
  /**
   * Why this item cannot be put back. Required for an irreversible or conflicting item and absent for a reversible one, so that nothing is shown as un-undoable without saying why.
   */
  reason?: string;
  /**
   * For a conflicting item, the fields where the live object diverges from the state this job left. Present only for a conflict; it is the evidence behind the category, which is what lets a user judge a conflict instead of merely being told of one.
   *
   * @minItems 1
   */
  propertyDiff?: [
    {
      field: string;
      /**
       * The value this job left behind, taken from the latest record of the source job that touched this object (INV-UD-03). Any JSON value, including null.
       */
      expected: {
        [k: string]: unknown;
      };
      /**
       * The value read from the platform now. Any JSON value, including null; an object that could not be read at all carries no diff and is categorised as a conflict for being unreadable.
       */
      actual: {
        [k: string]: unknown;
      };
    },
    ...{
      field: string;
      /**
       * The value this job left behind, taken from the latest record of the source job that touched this object (INV-UD-03). Any JSON value, including null.
       */
      expected: {
        [k: string]: unknown;
      };
      /**
       * The value read from the platform now. Any JSON value, including null; an object that could not be read at all carries no diff and is categorised as a conflict for being unreadable.
       */
      actual: {
        [k: string]: unknown;
      };
    }[]
  ];
};


export const UNDO_PIPELINE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/undo/undo-pipeline/1.0.0.json",
  "title": "UndoPreviewResponse",
  "description": "Normative shape of the three-way undo preview, for undo/contracts/undo-pipeline@1.0.0. This is the document the user decides against: every action of a finished job, partitioned into what can be put back, what cannot, and what a third party has touched since. The partition is exhaustive by construction - an action belongs to exactly one category and none is omitted - because an action missing from the preview is an action the user believes was undone. Categories follow the classification measured in spikes/SP-9-undo-agent/REPORT.md section 1 Q2.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "jobId",
    "canUndo",
    "items",
    "reversibleCount",
    "irreversibleCount",
    "conflictCount"
  ],
  "properties": {
    "jobId": {
      "type": "string",
      "minLength": 1,
      "description": "The finished job this preview is about. The undo itself runs as a job of its own that references this one (INV-UD-02)."
    },
    "canUndo": {
      "type": "boolean",
      "description": "Whether an undo may be started at all. False when the job holds no reversible action, in which case the control is disabled rather than offered and left to fail (INV-UD-04)."
    },
    "disabledReason": {
      "type": "string",
      "minLength": 1,
      "description": "Why undo is unavailable, in the user's own language. Required whenever canUndo is false: a disabled control with no stated reason reads as a defect rather than as a limit of the platform."
    },
    "items": {
      "type": "array",
      "description": "Every action of the job, in the order it was recorded. An empty array is admissible and means the job wrote nothing; it is not the same as a job whose actions are all irreversible, which carries items and canUndo false.",
      "items": {
        "$ref": "#/$defs/previewItem"
      }
    },
    "reversibleCount": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of items in the reversible category. Stated separately from the array so the summary the user reads first cannot be derived wrongly by whatever renders it."
    },
    "irreversibleCount": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of items the platform offers no compensating operation for."
    },
    "conflictCount": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of items whose live state no longer matches what this job left behind, including items that could not be read at all."
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "canUndo": {
            "const": false
          }
        },
        "required": [
          "canUndo"
        ]
      },
      "then": {
        "required": [
          "disabledReason"
        ]
      }
    }
  ],
  "$defs": {
    "previewItem": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "sequence",
        "toolName",
        "category",
        "description"
      ],
      "description": "One recorded action as the user is shown it.",
      "properties": {
        "sequence": {
          "type": "integer",
          "minimum": 0,
          "description": "The action's position within the source job, as the ledger recorded it. It is the identifier the user confirms against, so it is the ledger's own position and never a display index the preview assigned."
        },
        "toolName": {
          "type": "string",
          "minLength": 1,
          "description": "The tool that performed the original action."
        },
        "category": {
          "enum": [
            "reversible",
            "irreversible",
            "conflict"
          ],
          "description": "The closed partition. A fourth value cannot be added without a MAJOR bump, because a category a window does not know is one it would render as neither safe nor unsafe."
        },
        "description": {
          "type": "string",
          "minLength": 1,
          "description": "What undoing this item would do, phrased for the user rather than for a log."
        },
        "targetId": {
          "type": "string",
          "minLength": 1,
          "description": "The immutable identifier of the object the action touched, as the connector defines identity for that type. Never a display name: a renamed object must still be recognised as the same object."
        },
        "reason": {
          "type": "string",
          "minLength": 1,
          "description": "Why this item cannot be put back. Required for an irreversible or conflicting item and absent for a reversible one, so that nothing is shown as un-undoable without saying why."
        },
        "propertyDiff": {
          "type": "array",
          "minItems": 1,
          "description": "For a conflicting item, the fields where the live object diverges from the state this job left. Present only for a conflict; it is the evidence behind the category, which is what lets a user judge a conflict instead of merely being told of one.",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "field",
              "expected",
              "actual"
            ],
            "properties": {
              "field": {
                "type": "string",
                "minLength": 1
              },
              "expected": {
                "description": "The value this job left behind, taken from the latest record of the source job that touched this object (INV-UD-03). Any JSON value, including null."
              },
              "actual": {
                "description": "The value read from the platform now. Any JSON value, including null; an object that could not be read at all carries no diff and is categorised as a conflict for being unreadable."
              }
            }
          }
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "category": {
                "enum": [
                  "irreversible",
                  "conflict"
                ]
              }
            },
            "required": [
              "category"
            ]
          },
          "then": {
            "required": [
              "reason"
            ]
          }
        }
      ]
    }
  }
} as const;
