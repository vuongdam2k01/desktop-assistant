/**
 * Normative shape of what a connector adapter returns, for connector/contracts/connector-adapter@1.0.0. The root is the result of execute(); the results of fetchSnapshot(), checkStatus() and revoke() are the members of $defs, and each is named from the contract document. The point of fixing these shapes is that the wrapping layer, the job manager and the ledger decide once - rather than per platform - what is retried, what ends a job cleanly and what reaches the user. Two rules are expressed here directly: a failure carries a code from the closed vocabulary, and the seven conditions that repeating cannot change are never marked retryable. Two rules are not expressible and are held by the contract document instead: that an adapter returns a failure rather than throwing one, so that a result record exists for every intent record, and that a success never carries a failure inside its value - the shape the job manager cannot classify.
 */
export type ConnectorToolResult =
  | {
      ok: true;
      /**
       * The platform's own response, unreinterpreted. Nothing platform-shaped travels further inward than the component that reads it.
       */
      value: {
        [k: string]: unknown;
      };
      /**
       * The state of the written object as the platform returned it, where the platform returns one. Recorded with the result; never reconstructed from the arguments.
       */
      after?: {
        [k: string]: unknown;
      };
    }
  | {
      ok: false;
      error: ConnectorError;
    };
/**
 * The closed failure vocabulary. A platform condition the set does not name is PLATFORM_ERROR carrying the platform's own words; a failure carrying no code at all is an adapter defect and is treated as permanent.
 */
export type ConnectorErrorCode =
  | "CONNECTOR_REVOKED"
  | "CONNECTOR_EXPIRED"
  | "CONNECTOR_DISCONNECTED"
  | "PERMISSION_DENIED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INVALID_PARAMS"
  | "CONFLICT"
  | "UNSUPPORTED"
  | "SNAPSHOT_UNREADABLE"
  | "UNREACHABLE"
  | "PLATFORM_ERROR";

export interface ConnectorError {
  code: ConnectorErrorCode;
  /**
   * The platform's own words, kept for the ledger and for the user, and never reinterpreted.
   */
  message: string;
  /**
   * Advice to the job's bounded retry policy that repeating the call could succeed. The budget and the delays belong to the job.
   */
  retryable: boolean;
  /**
   * The delay the platform stated, where it stated one.
   */
  retryAfterMs?: number;
}


export const CONNECTOR_ADAPTER_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/connector/connector-adapter/1.0.0.json",
  "title": "ConnectorToolResult",
  "description": "Normative shape of what a connector adapter returns, for connector/contracts/connector-adapter@1.0.0. The root is the result of execute(); the results of fetchSnapshot(), checkStatus() and revoke() are the members of $defs, and each is named from the contract document. The point of fixing these shapes is that the wrapping layer, the job manager and the ledger decide once - rather than per platform - what is retried, what ends a job cleanly and what reaches the user. Two rules are expressed here directly: a failure carries a code from the closed vocabulary, and the seven conditions that repeating cannot change are never marked retryable. Two rules are not expressible and are held by the contract document instead: that an adapter returns a failure rather than throwing one, so that a result record exists for every intent record, and that a success never carries a failure inside its value - the shape the job manager cannot classify.",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "ok",
        "value"
      ],
      "properties": {
        "ok": {
          "const": true
        },
        "value": {
          "description": "The platform's own response, unreinterpreted. Nothing platform-shaped travels further inward than the component that reads it."
        },
        "after": {
          "description": "The state of the written object as the platform returned it, where the platform returns one. Recorded with the result; never reconstructed from the arguments."
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "ok",
        "error"
      ],
      "properties": {
        "ok": {
          "const": false
        },
        "error": {
          "$ref": "#/$defs/ConnectorError"
        }
      }
    }
  ],
  "$defs": {
    "ConnectorErrorCode": {
      "type": "string",
      "description": "The closed failure vocabulary. A platform condition the set does not name is PLATFORM_ERROR carrying the platform's own words; a failure carrying no code at all is an adapter defect and is treated as permanent.",
      "enum": [
        "CONNECTOR_REVOKED",
        "CONNECTOR_EXPIRED",
        "CONNECTOR_DISCONNECTED",
        "PERMISSION_DENIED",
        "RATE_LIMITED",
        "NOT_FOUND",
        "INVALID_PARAMS",
        "CONFLICT",
        "UNSUPPORTED",
        "SNAPSHOT_UNREADABLE",
        "UNREACHABLE",
        "PLATFORM_ERROR"
      ]
    },
    "ConnectorError": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "message",
        "retryable"
      ],
      "properties": {
        "code": {
          "$ref": "#/$defs/ConnectorErrorCode"
        },
        "message": {
          "type": "string",
          "description": "The platform's own words, kept for the ledger and for the user, and never reinterpreted."
        },
        "retryable": {
          "type": "boolean",
          "description": "Advice to the job's bounded retry policy that repeating the call could succeed. The budget and the delays belong to the job."
        },
        "retryAfterMs": {
          "type": "integer",
          "minimum": 0,
          "description": "The delay the platform stated, where it stated one."
        }
      },
      "if": {
        "required": [
          "code"
        ],
        "properties": {
          "code": {
            "enum": [
              "CONNECTOR_REVOKED",
              "CONNECTOR_EXPIRED",
              "CONNECTOR_DISCONNECTED",
              "PERMISSION_DENIED",
              "INVALID_PARAMS",
              "NOT_FOUND",
              "UNSUPPORTED"
            ]
          }
        }
      },
      "then": {
        "properties": {
          "retryable": {
            "const": false,
            "description": "Repeating one of these cannot change the answer, and pretending otherwise turns one clean failure into four."
          }
        }
      }
    },
    "SnapshotResult": {
      "description": "What fetchSnapshot() returns. A snapshot leaves the adapter already stripped of the values the tool's exclude_computed names, so nothing downstream has to know which of a platform's values are computed.",
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ok",
            "snapshot"
          ],
          "properties": {
            "ok": {
              "const": true
            },
            "snapshot": {
              "not": {
                "type": "null"
              },
              "description": "The prior state of the write target, with the declared computed values already removed."
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ok",
            "snapshot",
            "reason"
          ],
          "properties": {
            "ok": {
              "const": true
            },
            "snapshot": {
              "type": "null"
            },
            "reason": {
              "const": "not_applicable",
              "description": "A write with no prior state to speak of, such as a creation. This is not SNAPSHOT_UNREADABLE, which is a refusal and makes the write irreversible for this call."
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ok",
            "error"
          ],
          "properties": {
            "ok": {
              "const": false
            },
            "error": {
              "$ref": "#/$defs/ConnectorError"
            }
          }
        }
      ]
    },
    "ConnectionStatus": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "state",
        "establishedAt",
        "canRenewHere"
      ],
      "description": "What checkStatus() returns. It is what the platform answered, not what a stored expiry implies, and it is an observation with a time (INV-CN-10).",
      "properties": {
        "state": {
          "type": "string",
          "enum": [
            "connected",
            "expired",
            "permission_short",
            "revoked"
          ],
          "description": "There is no state for a platform that could not be reached: UNREACHABLE concludes nothing, and the last established state is presented with the fact that it could not be confirmed."
        },
        "establishedAt": {
          "type": "string",
          "format": "date-time",
          "description": "ISO-8601 instant at which this state was established by asking the platform."
        },
        "canRenewHere": {
          "type": "boolean",
          "description": "Whether the device can renew without sending the user to the platform. It decides whether the user sees a renewal that costs them nothing or a reconnection."
        },
        "detail": {
          "type": "string",
          "description": "The platform's own words, where it gave any."
        }
      }
    },
    "RevokeOutcome": {
      "description": "What revoke() returns. The product's own copy of the authorisation is erased in all three cases; the difference between them is only what the user is told.",
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "withdrawn"
          ],
          "properties": {
            "withdrawn": {
              "const": true
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "withdrawn",
            "reason"
          ],
          "properties": {
            "withdrawn": {
              "const": false
            },
            "reason": {
              "const": "unsupported",
              "description": "The manifest declares no revocation endpoint, so the platform's own record of the integration stands and the user is sent to the settings address the manifest requires instead."
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "withdrawn",
            "reason",
            "error"
          ],
          "properties": {
            "withdrawn": {
              "const": false
            },
            "reason": {
              "const": "refused"
            },
            "error": {
              "$ref": "#/$defs/ConnectorError"
            }
          }
        }
      ]
    }
  }
} as const;
