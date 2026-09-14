/**
 * Normative shape of what the client sends the intake service, for app/contracts/offline-queue@0.1.0 - whether the command goes straight through or has waited in the local queue for the backend to come back. The two exchanges are the same exchange, which is the point: a drained command is not a special kind of submission, it is an ordinary one that happened later. The idempotency key is what makes a retry safe, so it is required on every send and not only on a retry: a client that adds one only when retrying has no key to deduplicate against when the first attempt was the one that got through.
 */
export interface IntakeCommandPayload {
  /**
   * The instruction as the user typed it. An empty command is refused at submission and is never queued.
   */
  command_text: string;
  /**
   * Client-generated and stable across every attempt at one command. The backend answers a repeat of a key it has already processed as deduplicated, which the client records as a successful sync - so a drain that dispatches a command the backend already accepted produces no second job.
   */
  idempotency_key: string;
  /**
   * Milliseconds since the epoch, at the moment the user pressed send rather than at the moment of dispatch. It is the drain order, so that a backlog reaches the backend in the order the user meant it.
   */
  client_timestamp: number;
}


export const OFFLINE_QUEUE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/app/offline-queue/0.1.0.json",
  "title": "IntakeCommandPayload",
  "description": "Normative shape of what the client sends the intake service, for app/contracts/offline-queue@0.1.0 - whether the command goes straight through or has waited in the local queue for the backend to come back. The two exchanges are the same exchange, which is the point: a drained command is not a special kind of submission, it is an ordinary one that happened later. The idempotency key is what makes a retry safe, so it is required on every send and not only on a retry: a client that adds one only when retrying has no key to deduplicate against when the first attempt was the one that got through.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "command_text",
    "idempotency_key",
    "client_timestamp"
  ],
  "properties": {
    "command_text": {
      "type": "string",
      "minLength": 1,
      "description": "The instruction as the user typed it. An empty command is refused at submission and is never queued."
    },
    "idempotency_key": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      "description": "Client-generated and stable across every attempt at one command. The backend answers a repeat of a key it has already processed as deduplicated, which the client records as a successful sync - so a drain that dispatches a command the backend already accepted produces no second job."
    },
    "client_timestamp": {
      "type": "integer",
      "minimum": 0,
      "description": "Milliseconds since the epoch, at the moment the user pressed send rather than at the moment of dispatch. It is the drain order, so that a backlog reaches the backend in the order the user meant it."
    }
  }
} as const;
