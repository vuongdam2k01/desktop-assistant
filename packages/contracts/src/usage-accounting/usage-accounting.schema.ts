/**
 * Normative shape of what one model request records, for agent/contracts/usage-accounting@0.1.0. Records are write-once and are read field by field by whatever build opens them, because a usage record is a report about the past and showing a job's tokens without a member an older build does not understand is better than showing the user nothing about a job they ran. Two decisions are visible in the shape and both are load-bearing. Money is decimal text, never binary floating point, and a cost is held to at least six decimal places because the measured per-call cost of the cheapest role was 0.000203 USD - VERIFIED (spikes/SP-10-risk-judge/REPORT.md#0-ket-luan) - so a representation that rounds records every such call as free. And a cost carries the basis it was computed from, so a user who corrects a price later still sees old jobs explaining themselves with the price that was in force (INV-AG-25).
 */
export type UsageRecord = {
  jobId: string;
  /**
   * The identity the ledger and the transcript already correlate by, so a usage record joins to its intent and its result without a second index. One record per request identity; a second write is refused (RECORD_DUPLICATE).
   */
  requestId: string;
  role: "pet-text" | "pet-image" | "worker" | "rule-elicitation" | "undo" | "risk-judge";
  profileId: string;
  model: string;
  /**
   * False when the provider returned no usage figures. Unreported usage is not zero: the record carries no token counts, is shown as not reported, and is excluded from the total, which is marked incomplete. Counting it as zero would understate a job in a way the user could never detect.
   */
  reported: boolean;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  /**
   * Present only when a unit price existed when the record was written. Nothing substitutes a price from another model, another profile, or a table the product shipped; a record with no price is written with its token counts and no cost.
   */
  cost?: {
    /**
     * Decimal text, held to at least six decimal places. Display rounds; the record does not.
     */
    amount: string;
    currency: string;
    /**
     * Kept with the cost so it can always be explained and recomputed. A cost without its basis is a number nothing can later account for, which is why this member is required rather than optional.
     */
    basis: {
      inputPricePerMillion: string;
      outputPricePerMillion: string;
      currency: string;
      priceEnteredAt: string;
    };
  };
  recordedAt: string;
};


export const USAGE_ACCOUNTING_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/usage-accounting/0.1.0.json",
  "title": "UsageRecord",
  "description": "Normative shape of what one model request records, for agent/contracts/usage-accounting@0.1.0. Records are write-once and are read field by field by whatever build opens them, because a usage record is a report about the past and showing a job's tokens without a member an older build does not understand is better than showing the user nothing about a job they ran. Two decisions are visible in the shape and both are load-bearing. Money is decimal text, never binary floating point, and a cost is held to at least six decimal places because the measured per-call cost of the cheapest role was 0.000203 USD - VERIFIED (spikes/SP-10-risk-judge/REPORT.md#0-ket-luan) - so a representation that rounds records every such call as free. And a cost carries the basis it was computed from, so a user who corrects a price later still sees old jobs explaining themselves with the price that was in force (INV-AG-25).",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "jobId",
    "requestId",
    "role",
    "profileId",
    "model",
    "reported",
    "durationMs",
    "recordedAt"
  ],
  "properties": {
    "jobId": {
      "type": "string",
      "minLength": 1
    },
    "requestId": {
      "type": "string",
      "minLength": 1,
      "description": "The identity the ledger and the transcript already correlate by, so a usage record joins to its intent and its result without a second index. One record per request identity; a second write is refused (RECORD_DUPLICATE)."
    },
    "role": {
      "enum": [
        "pet-text",
        "pet-image",
        "worker",
        "rule-elicitation",
        "undo",
        "risk-judge"
      ]
    },
    "profileId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$"
    },
    "model": {
      "type": "string",
      "minLength": 1
    },
    "reported": {
      "type": "boolean",
      "description": "False when the provider returned no usage figures. Unreported usage is not zero: the record carries no token counts, is shown as not reported, and is excluded from the total, which is marked incomplete. Counting it as zero would understate a job in a way the user could never detect."
    },
    "inputTokens": {
      "type": "integer",
      "minimum": 0
    },
    "outputTokens": {
      "type": "integer",
      "minimum": 0
    },
    "durationMs": {
      "type": "integer",
      "minimum": 0
    },
    "cost": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "amount",
        "currency",
        "basis"
      ],
      "description": "Present only when a unit price existed when the record was written. Nothing substitutes a price from another model, another profile, or a table the product shipped; a record with no price is written with its token counts and no cost.",
      "properties": {
        "amount": {
          "type": "string",
          "pattern": "^\\d+\\.\\d{6,}$",
          "description": "Decimal text, held to at least six decimal places. Display rounds; the record does not."
        },
        "currency": {
          "type": "string",
          "pattern": "^[A-Z]{3}$"
        },
        "basis": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "inputPricePerMillion",
            "outputPricePerMillion",
            "currency",
            "priceEnteredAt"
          ],
          "description": "Kept with the cost so it can always be explained and recomputed. A cost without its basis is a number nothing can later account for, which is why this member is required rather than optional.",
          "properties": {
            "inputPricePerMillion": {
              "type": "string",
              "pattern": "^\\d+(\\.\\d{1,6})?$"
            },
            "outputPricePerMillion": {
              "type": "string",
              "pattern": "^\\d+(\\.\\d{1,6})?$"
            },
            "currency": {
              "type": "string",
              "pattern": "^[A-Z]{3}$"
            },
            "priceEnteredAt": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      }
    },
    "recordedAt": {
      "type": "string",
      "minLength": 1
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "reported": {
            "const": true
          }
        },
        "required": [
          "reported"
        ]
      },
      "then": {
        "required": [
          "inputTokens",
          "outputTokens"
        ],
        "properties": {
          "inputTokens": {
            "minimum": 1,
            "description": "A reported request consumed a prompt, so a reported record claiming no input tokens is the shape an unreported response takes when someone treats absence as zero. The output count may legitimately be zero; the input count may not."
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "reported": {
            "const": false
          }
        },
        "required": [
          "reported"
        ]
      },
      "then": {
        "not": {
          "required": [
            "inputTokens"
          ]
        }
      }
    }
  ]
} as const;
