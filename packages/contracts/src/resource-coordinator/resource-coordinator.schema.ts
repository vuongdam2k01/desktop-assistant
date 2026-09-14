/**
 * Normative shape of what the coordinator publishes about itself, for connector/contracts/resource-coordinator@0.1.0. This is the one thing the coordinator lets out: a read-only picture of what is held and what is waiting, returned on coordinator.inspect and used to explain a wait to a user in words - waiting for the object job 3 is changing - rather than showing an indefinite progress state. The coordinator's own operations are deliberately absent from it and from every channel: acquire, suspend, resume, dispatch and release are in-process only, because a coordinator reachable across a process boundary is a coordinator a compromised window could call, and the ability to release another job's lease is the ability to defeat everything the contract guarantees. The refusal shape is $defs/CoordinatorError, and it expresses the one rule that must not be got wrong by accident: the four conditions that are defects or terminal decisions are never marked retryable. What this file cannot express, and what the contract document holds instead: that a coordinator refusal is never presented as a platform failure and never carries a connector error code (INV-CN-20), and that a snapshot is read-only - reading it twice with nothing else happening leaves the same leases held by the same jobs.
 */
export interface CoordinatorSnapshot {
  /**
   * One entry per resource key currently held. A key is <connector>:<type>:<identifier> (INV-CN-16).
   */
  leases: {
    key: string;
    jobId: string;
    heldForMs: number;
    /**
     * Reentrancy count. A job that already holds a key obtains it again without waiting, and the lease is released only when the outermost bracket releases it (INV-CN-18) - which is why a depth below one is not a state that exists.
     */
    depth: number;
  }[];
  /**
   * One entry per call waiting for a set of keys. A waiting call holds none of them, so a wait can be explained by naming who holds what rather than merely reported.
   */
  waits: {
    jobId: string;
    /**
     * @minItems 1
     */
    keys: [string, ...string[]];
    waitingForMs: number;
    heldBy: string[];
  }[];
  /**
   * One entry per job queued under one authorisation. Dispatch rotates between the queues of one authorisation, so a job's wait is bounded by the number of jobs rather than by another job's backlog.
   */
  queues: {
    authorisationRef: string;
    jobId: string;
    depth: number;
    /**
     * Present while the platform's stated delay is being observed. The pause belongs to the authorisation, so every job under it waits together.
     */
    pausedUntil?: string;
  }[];
  /**
   * Admission against each connector account's concurrency limit. Slots are held only while a job is running; the coordinator keeps no waiting list, because the job manager already holds one.
   */
  slots: {
    authorisationRef: string;
    total: number;
    /**
     * How many of the total only the interactive class may take, so that a backlog of background work cannot make the product unusable to the person sitting in front of it.
     */
    reserved: number;
    held: string[];
  }[];
}


export const RESOURCE_COORDINATOR_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/connector/resource-coordinator/0.1.0.json",
  "title": "CoordinatorSnapshot",
  "description": "Normative shape of what the coordinator publishes about itself, for connector/contracts/resource-coordinator@0.1.0. This is the one thing the coordinator lets out: a read-only picture of what is held and what is waiting, returned on coordinator.inspect and used to explain a wait to a user in words - waiting for the object job 3 is changing - rather than showing an indefinite progress state. The coordinator's own operations are deliberately absent from it and from every channel: acquire, suspend, resume, dispatch and release are in-process only, because a coordinator reachable across a process boundary is a coordinator a compromised window could call, and the ability to release another job's lease is the ability to defeat everything the contract guarantees. The refusal shape is $defs/CoordinatorError, and it expresses the one rule that must not be got wrong by accident: the four conditions that are defects or terminal decisions are never marked retryable. What this file cannot express, and what the contract document holds instead: that a coordinator refusal is never presented as a platform failure and never carries a connector error code (INV-CN-20), and that a snapshot is read-only - reading it twice with nothing else happening leaves the same leases held by the same jobs.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "leases",
    "waits",
    "queues",
    "slots"
  ],
  "properties": {
    "leases": {
      "type": "array",
      "description": "One entry per resource key currently held. A key is <connector>:<type>:<identifier> (INV-CN-16).",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "key",
          "jobId",
          "heldForMs",
          "depth"
        ],
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1
          },
          "jobId": {
            "type": "string",
            "minLength": 1
          },
          "heldForMs": {
            "type": "integer",
            "minimum": 0
          },
          "depth": {
            "type": "integer",
            "minimum": 1,
            "description": "Reentrancy count. A job that already holds a key obtains it again without waiting, and the lease is released only when the outermost bracket releases it (INV-CN-18) - which is why a depth below one is not a state that exists."
          }
        }
      }
    },
    "waits": {
      "type": "array",
      "description": "One entry per call waiting for a set of keys. A waiting call holds none of them, so a wait can be explained by naming who holds what rather than merely reported.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "jobId",
          "keys",
          "waitingForMs",
          "heldBy"
        ],
        "properties": {
          "jobId": {
            "type": "string",
            "minLength": 1
          },
          "keys": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "waitingForMs": {
            "type": "integer",
            "minimum": 0
          },
          "heldBy": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      }
    },
    "queues": {
      "type": "array",
      "description": "One entry per job queued under one authorisation. Dispatch rotates between the queues of one authorisation, so a job's wait is bounded by the number of jobs rather than by another job's backlog.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "authorisationRef",
          "jobId",
          "depth"
        ],
        "properties": {
          "authorisationRef": {
            "type": "string",
            "minLength": 1
          },
          "jobId": {
            "type": "string",
            "minLength": 1
          },
          "depth": {
            "type": "integer",
            "minimum": 0
          },
          "pausedUntil": {
            "type": "string",
            "format": "date-time",
            "description": "Present while the platform's stated delay is being observed. The pause belongs to the authorisation, so every job under it waits together."
          }
        }
      }
    },
    "slots": {
      "type": "array",
      "description": "Admission against each connector account's concurrency limit. Slots are held only while a job is running; the coordinator keeps no waiting list, because the job manager already holds one.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "authorisationRef",
          "total",
          "reserved",
          "held"
        ],
        "properties": {
          "authorisationRef": {
            "type": "string",
            "minLength": 1
          },
          "total": {
            "type": "integer",
            "minimum": 1
          },
          "reserved": {
            "type": "integer",
            "minimum": 0,
            "description": "How many of the total only the interactive class may take, so that a backlog of background work cannot make the product unusable to the person sitting in front of it."
          },
          "held": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      }
    }
  },
  "$defs": {
    "CoordinatorErrorCode": {
      "type": "string",
      "description": "The closed refusal vocabulary of the coordinator. None of these is ever presented as a platform failure, and a connector error code is never returned in their place (INV-CN-20).",
      "enum": [
        "RESOURCE_HELD",
        "RESOURCE_UNDECLARED",
        "RESOURCE_KEY_UNRESOLVABLE",
        "STATE_CHANGED",
        "SLOT_UNAVAILABLE",
        "BRACKET_INVALID",
        "COORDINATOR_UNAVAILABLE",
        "CALL_CANCELLED"
      ]
    },
    "CoordinatorError": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "message",
        "retryable"
      ],
      "description": "What every coordinator operation returns instead of throwing, so that the wrapping layer can record an outcome for the intent it has already written.",
      "properties": {
        "code": {
          "$ref": "#/$defs/CoordinatorErrorCode"
        },
        "message": {
          "type": "string"
        },
        "retryable": {
          "type": "boolean"
        },
        "retryAfterMs": {
          "type": "integer",
          "minimum": 0
        },
        "heldBy": {
          "type": "string",
          "minLength": 1,
          "description": "For RESOURCE_HELD: the job holding the key, so the wait can be explained rather than merely reported."
        },
        "key": {
          "type": "string",
          "minLength": 1
        }
      },
      "if": {
        "required": [
          "code"
        ],
        "properties": {
          "code": {
            "enum": [
              "RESOURCE_UNDECLARED",
              "RESOURCE_KEY_UNRESOLVABLE",
              "BRACKET_INVALID",
              "CALL_CANCELLED"
            ]
          }
        }
      },
      "then": {
        "properties": {
          "retryable": {
            "const": false,
            "description": "Three of these are product defects and the fourth is the user's own decision; repeating any of them cannot change the answer."
          }
        }
      }
    }
  }
} as const;
