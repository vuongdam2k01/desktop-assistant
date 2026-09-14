export interface paths {
    "/replication/handshake": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Agree protocol version and descriptor set, obtain a lease, learn what is not yet transferred.
         * @description Version discovery happens here, before any record is exchanged. Within one protocol MAJOR both sides operate at the lower MINOR and ignore unknown optional fields; across a MAJOR nothing is exchanged at all, because a device that misunderstands a resolution outcome can destroy data without knowing it.
         */
        post: operations["handshake"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/replication/pull": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Read records the account holds and this device does not, resumably.
         * @description A cursor is per device and per store, so one store's large transfer cannot force another to restart and an interrupted enrolment resumes where it stopped. LEASE_EXPIRED never appears here: a device must be able to catch up precisely when its lease has lapsed.
         */
        post: operations["pull"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/replication/push": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Offer this device's records to the account and learn how each was resolved.
         * @description Resolution is the descriptor's, not the protocol's. A record already held returns reconciled, so re-delivery after an interrupted exchange is idempotent and never appends a duplicate. A push that would replace a record in an append-only store writes nothing.
         */
        post: operations["push"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/replication/lease": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Obtain this device's current lease.
         * @description The lease is derived, never asserted: it is issued by the backend and cannot be extended by the device. An expired lease stops the device using replicated connector authorisation; it does not stop the device reading or writing its own local working copy.
         */
        post: operations["lease"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        RecordEnvelope: {
            recordId: string;
            storeId: components["schemas"]["StoreId"];
            originDevice: string;
            /** @description Monotonic within originDevice and never reused. */
            originSequence: number;
            causalPosition: components["schemas"]["CausalPosition"];
            /**
             * Format: date-time
             * @description For display only. Never used to order.
             */
            recordedAt: string;
            /** @description Mutable stores only; 0 for append-only. A non-zero version on an append-only store is an attempt to replace history. */
            version: number;
            payload: components["schemas"]["EncryptedPayload"];
        };
        CausalPosition: {
            /** @description Per-device high-water marks the originating device had observed when it wrote the record. The backend orders by this and by originSequence, and never inspects the payload to order. */
            observed: {
                [key: string]: number;
            };
        };
        EncryptedPayload: {
            ciphertext: string;
            keyId: string;
        };
        StoreId: string;
        /** @description Opaque. The checkpoint position, meaningful only to the backend. */
        Cursor: string;
        Handshake: {
            protocolVersion: string;
            descriptorVersion: string;
            /** @description Per sync/contracts/replicated-store-descriptor@0.1.0, which owns their shape. */
            descriptors: Record<string, never>[];
            deviceId: string;
            /** @description Per store. A null cursor means this device holds nothing for that store yet. */
            cursors: {
                [key: string]: string | null;
            };
        };
        HandshakeResult: {
            accountId: string;
            protocolVersion: string;
            /** @description The backend's registered set, for comparison against the device's. */
            descriptors: Record<string, never>[];
            lease: components["schemas"]["Lease"];
            /** @description Stores for which this device must still complete a full transfer. It is how a device knows it is not yet complete and does not present partial state as whole. */
            enrolmentRequired: components["schemas"]["StoreId"][];
        };
        Lease: {
            /** Format: date-time */
            issuedAt: string;
            /** Format: date-time */
            expiresAt: string;
            /** @enum {string} */
            state: "active" | "expired" | "revoked";
        };
        LeaseRequest: {
            deviceId: string;
        };
        PullRequest: {
            storeId: components["schemas"]["StoreId"];
            /** @description Null begins a full transfer of that store. */
            cursor: string | null;
            maxRecords: number;
        };
        PullResult: {
            storeId: components["schemas"]["StoreId"];
            records: components["schemas"]["RecordEnvelope"][];
            cursor: components["schemas"]["Cursor"];
            complete: boolean;
        };
        PushRequest: {
            storeId: components["schemas"]["StoreId"];
            records: components["schemas"]["RecordEnvelope"][];
        };
        PushResult: {
            storeId: components["schemas"]["StoreId"];
            accepted: string[];
            resolutions: components["schemas"]["Resolution"][];
            cursor: components["schemas"]["Cursor"];
        };
        Resolution: {
            recordId: string;
            /** @enum {string} */
            outcome: "reconciled" | "current" | "superseded";
            /** @description Present when the outcome is superseded. */
            supersededBy?: string;
            /** @description The record appended to the descriptor's supersededTarget, so the user can read what was replaced. */
            supersededVersionRecordId?: string;
        };
        ReplicationError: {
            /** @enum {string} */
            code: "SESSION_INVALID" | "DEVICE_REVOKED" | "ACCOUNT_DELETED" | "PROTOCOL_VERSION_UNSUPPORTED" | "DESCRIPTOR_SET_MISMATCH" | "CURSOR_INVALID" | "STORE_UNKNOWN" | "KEY_UNAVAILABLE" | "LEASE_EXPIRED" | "RECORD_REJECTED" | "APPEND_ONLY_VIOLATION";
            message?: string;
            storeId?: string;
            recordId?: string;
        };
    };
    responses: {
        /** @description No session, or one that has expired. The device refreshes its session and retries. */
        SessionInvalid: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description DEVICE_REVOKED. Terminal on every operation: the device stops using replicated authorisation at once and begins erasure. The backend enforces revocation whether or not the device ever asks, so this response is the device learning something already true. */
        DeviceRefused: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description The account was deleted while this device was offline; the device erases the account's data. */
        AccountDeleted: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description The device and backend do not share a protocol MAJOR. No partial replication is attempted; the product states that an update is required. */
        ProtocolVersionUnsupported: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description A store the device declares is unknown to the backend, or two descriptors for one store disagree. The mismatched store is excluded and named to the user; other stores continue. */
        DescriptorSetMismatch: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description A cursor no longer resolves. The device restarts that store's transfer from null; nothing is lost, because a full transfer reconciles against what is already held. */
        CursorInvalid: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description A store identifier with no registered descriptor. That store does not replicate and is named as not current. */
        StoreUnknown: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description The key needed to serve a record cannot be obtained, or its access could not be audited. There is no plaintext fallback: the request fails and the device continues against its local working copy. */
        KeyUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description The device pushed after its lease bound passed with no successful exchange. It re-handshakes to obtain a lease and retries; local work continues throughout. */
        LeaseExpired: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
        /** @description RECORD_REJECTED for a malformed envelope or one whose originating device is not enrolled to this account, or APPEND_ONLY_VIOLATION for a push that would replace or remove a record in an append-only store. In the second case nothing is written and the attempt is itself recorded. */
        PushRefused: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ReplicationError"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    handshake: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Handshake"];
            };
        };
        responses: {
            /** @description The backend's registered descriptor set, a lease, and the stores this device must still transfer. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HandshakeResult"];
                };
            };
            401: components["responses"]["SessionInvalid"];
            403: components["responses"]["DeviceRefused"];
            409: components["responses"]["DescriptorSetMismatch"];
            410: components["responses"]["AccountDeleted"];
            426: components["responses"]["ProtocolVersionUnsupported"];
        };
    };
    pull: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PullRequest"];
            };
        };
        responses: {
            /** @description A batch of envelopes and the cursor that follows them. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PullResult"];
                };
            };
            401: components["responses"]["SessionInvalid"];
            403: components["responses"]["DeviceRefused"];
            404: components["responses"]["StoreUnknown"];
            409: components["responses"]["CursorInvalid"];
            503: components["responses"]["KeyUnavailable"];
        };
    };
    push: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PushRequest"];
            };
        };
        responses: {
            /** @description What was accepted, and the resolution of each record offered. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PushResult"];
                };
            };
            401: components["responses"]["SessionInvalid"];
            403: components["responses"]["DeviceRefused"];
            404: components["responses"]["StoreUnknown"];
            409: components["responses"]["PushRefused"];
            423: components["responses"]["LeaseExpired"];
        };
    };
    lease: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LeaseRequest"];
            };
        };
        responses: {
            /** @description The lease as the backend holds it. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Lease"];
                };
            };
            401: components["responses"]["SessionInvalid"];
            403: components["responses"]["DeviceRefused"];
        };
    };
}


export const REPLICATION_PROTOCOL_OPENAPI = {
  "openapi": "3.1.0",
  "info": {
    "title": "Replication Protocol",
    "version": "0.1.0",
    "summary": "The four request-response exchanges by which a device and the account's stored data agree.",
    "description": "Normative wire surface for sync/contracts/replication-protocol@0.1.0. Every replicated store is carried uniformly: stores differ by their descriptor, never by their transport, so adding a store adds no endpoint and changes no payload shape here. The payload of a record is opaque to this surface and to the backend - ordering, resolution and cursor advancement read only the envelope, which is why causalPosition and originSequence sit outside the encrypted payload. One channel of the contract is deliberately absent from this file: replication.changes, the server-to-device stream, is an optimisation over polling and never the only path. A device that loses it stays correct by pulling from its cursor, so the frozen surface is the one a correct device can rely on alone. The path layer is introduced by this file, following the layout the backend slice established; the channel names in the contract map to the operations below in order."
  },
  "servers": [
    {
      "url": "https://api.example.invalid/v1",
      "description": "Placeholder. The deployed origin is service configuration, not part of this contract."
    }
  ],
  "tags": [
    {
      "name": "replication",
      "description": "Every operation requires a session. Revocation is answered here, never negotiated."
    }
  ],
  "paths": {
    "/replication/handshake": {
      "post": {
        "tags": [
          "replication"
        ],
        "operationId": "handshake",
        "summary": "Agree protocol version and descriptor set, obtain a lease, learn what is not yet transferred.",
        "description": "Version discovery happens here, before any record is exchanged. Within one protocol MAJOR both sides operate at the lower MINOR and ignore unknown optional fields; across a MAJOR nothing is exchanged at all, because a device that misunderstands a resolution outcome can destroy data without knowing it.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Handshake"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "The backend's registered descriptor set, a lease, and the stores this device must still transfer.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HandshakeResult"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/SessionInvalid"
          },
          "403": {
            "$ref": "#/components/responses/DeviceRefused"
          },
          "409": {
            "$ref": "#/components/responses/DescriptorSetMismatch"
          },
          "410": {
            "$ref": "#/components/responses/AccountDeleted"
          },
          "426": {
            "$ref": "#/components/responses/ProtocolVersionUnsupported"
          }
        }
      }
    },
    "/replication/pull": {
      "post": {
        "tags": [
          "replication"
        ],
        "operationId": "pull",
        "summary": "Read records the account holds and this device does not, resumably.",
        "description": "A cursor is per device and per store, so one store's large transfer cannot force another to restart and an interrupted enrolment resumes where it stopped. LEASE_EXPIRED never appears here: a device must be able to catch up precisely when its lease has lapsed.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/PullRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "A batch of envelopes and the cursor that follows them.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/PullResult"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/SessionInvalid"
          },
          "403": {
            "$ref": "#/components/responses/DeviceRefused"
          },
          "404": {
            "$ref": "#/components/responses/StoreUnknown"
          },
          "409": {
            "$ref": "#/components/responses/CursorInvalid"
          },
          "503": {
            "$ref": "#/components/responses/KeyUnavailable"
          }
        }
      }
    },
    "/replication/push": {
      "post": {
        "tags": [
          "replication"
        ],
        "operationId": "push",
        "summary": "Offer this device's records to the account and learn how each was resolved.",
        "description": "Resolution is the descriptor's, not the protocol's. A record already held returns reconciled, so re-delivery after an interrupted exchange is idempotent and never appends a duplicate. A push that would replace a record in an append-only store writes nothing.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/PushRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "What was accepted, and the resolution of each record offered.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/PushResult"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/SessionInvalid"
          },
          "403": {
            "$ref": "#/components/responses/DeviceRefused"
          },
          "404": {
            "$ref": "#/components/responses/StoreUnknown"
          },
          "409": {
            "$ref": "#/components/responses/PushRefused"
          },
          "423": {
            "$ref": "#/components/responses/LeaseExpired"
          }
        }
      }
    },
    "/replication/lease": {
      "post": {
        "tags": [
          "replication"
        ],
        "operationId": "lease",
        "summary": "Obtain this device's current lease.",
        "description": "The lease is derived, never asserted: it is issued by the backend and cannot be extended by the device. An expired lease stops the device using replicated connector authorisation; it does not stop the device reading or writing its own local working copy.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LeaseRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "The lease as the backend holds it.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Lease"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/SessionInvalid"
          },
          "403": {
            "$ref": "#/components/responses/DeviceRefused"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "accessToken": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Issued by backend/contracts/client-session-api@0.1.0."
      }
    },
    "schemas": {
      "RecordEnvelope": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "recordId",
          "storeId",
          "originDevice",
          "originSequence",
          "causalPosition",
          "recordedAt",
          "version",
          "payload"
        ],
        "properties": {
          "recordId": {
            "type": "string",
            "minLength": 1
          },
          "storeId": {
            "$ref": "#/components/schemas/StoreId"
          },
          "originDevice": {
            "type": "string",
            "minLength": 1
          },
          "originSequence": {
            "type": "integer",
            "minimum": 0,
            "description": "Monotonic within originDevice and never reused."
          },
          "causalPosition": {
            "$ref": "#/components/schemas/CausalPosition"
          },
          "recordedAt": {
            "type": "string",
            "format": "date-time",
            "description": "For display only. Never used to order."
          },
          "version": {
            "type": "integer",
            "minimum": 0,
            "description": "Mutable stores only; 0 for append-only. A non-zero version on an append-only store is an attempt to replace history."
          },
          "payload": {
            "$ref": "#/components/schemas/EncryptedPayload"
          }
        }
      },
      "CausalPosition": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "observed"
        ],
        "properties": {
          "observed": {
            "type": "object",
            "description": "Per-device high-water marks the originating device had observed when it wrote the record. The backend orders by this and by originSequence, and never inspects the payload to order.",
            "additionalProperties": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      },
      "EncryptedPayload": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ciphertext",
          "keyId"
        ],
        "properties": {
          "ciphertext": {
            "type": "string"
          },
          "keyId": {
            "type": "string"
          }
        }
      },
      "StoreId": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]{1,62}$"
      },
      "Cursor": {
        "type": "string",
        "description": "Opaque. The checkpoint position, meaningful only to the backend."
      },
      "Handshake": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "protocolVersion",
          "descriptorVersion",
          "descriptors",
          "deviceId",
          "cursors"
        ],
        "properties": {
          "protocolVersion": {
            "type": "string"
          },
          "descriptorVersion": {
            "type": "string"
          },
          "descriptors": {
            "type": "array",
            "description": "Per sync/contracts/replicated-store-descriptor@0.1.0, which owns their shape.",
            "items": {
              "type": "object"
            }
          },
          "deviceId": {
            "type": "string",
            "minLength": 1
          },
          "cursors": {
            "type": "object",
            "description": "Per store. A null cursor means this device holds nothing for that store yet.",
            "additionalProperties": {
              "type": [
                "string",
                "null"
              ]
            }
          }
        }
      },
      "HandshakeResult": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "accountId",
          "protocolVersion",
          "descriptors",
          "lease",
          "enrolmentRequired"
        ],
        "properties": {
          "accountId": {
            "type": "string"
          },
          "protocolVersion": {
            "type": "string"
          },
          "descriptors": {
            "type": "array",
            "description": "The backend's registered set, for comparison against the device's.",
            "items": {
              "type": "object"
            }
          },
          "lease": {
            "$ref": "#/components/schemas/Lease"
          },
          "enrolmentRequired": {
            "type": "array",
            "description": "Stores for which this device must still complete a full transfer. It is how a device knows it is not yet complete and does not present partial state as whole.",
            "items": {
              "$ref": "#/components/schemas/StoreId"
            }
          }
        }
      },
      "Lease": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "issuedAt",
          "expiresAt",
          "state"
        ],
        "properties": {
          "issuedAt": {
            "type": "string",
            "format": "date-time"
          },
          "expiresAt": {
            "type": "string",
            "format": "date-time"
          },
          "state": {
            "type": "string",
            "enum": [
              "active",
              "expired",
              "revoked"
            ]
          }
        }
      },
      "LeaseRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "deviceId"
        ],
        "properties": {
          "deviceId": {
            "type": "string",
            "minLength": 1
          }
        }
      },
      "PullRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storeId",
          "cursor",
          "maxRecords"
        ],
        "properties": {
          "storeId": {
            "$ref": "#/components/schemas/StoreId"
          },
          "cursor": {
            "type": [
              "string",
              "null"
            ],
            "description": "Null begins a full transfer of that store."
          },
          "maxRecords": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "PullResult": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storeId",
          "records",
          "cursor",
          "complete"
        ],
        "properties": {
          "storeId": {
            "$ref": "#/components/schemas/StoreId"
          },
          "records": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/RecordEnvelope"
            }
          },
          "cursor": {
            "$ref": "#/components/schemas/Cursor"
          },
          "complete": {
            "type": "boolean"
          }
        }
      },
      "PushRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storeId",
          "records"
        ],
        "properties": {
          "storeId": {
            "$ref": "#/components/schemas/StoreId"
          },
          "records": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/RecordEnvelope"
            }
          }
        }
      },
      "PushResult": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storeId",
          "accepted",
          "resolutions",
          "cursor"
        ],
        "properties": {
          "storeId": {
            "$ref": "#/components/schemas/StoreId"
          },
          "accepted": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "resolutions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Resolution"
            }
          },
          "cursor": {
            "$ref": "#/components/schemas/Cursor"
          }
        }
      },
      "Resolution": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "recordId",
          "outcome"
        ],
        "properties": {
          "recordId": {
            "type": "string"
          },
          "outcome": {
            "type": "string",
            "enum": [
              "reconciled",
              "current",
              "superseded"
            ]
          },
          "supersededBy": {
            "type": "string",
            "description": "Present when the outcome is superseded."
          },
          "supersededVersionRecordId": {
            "type": "string",
            "description": "The record appended to the descriptor's supersededTarget, so the user can read what was replaced."
          }
        }
      },
      "ReplicationError": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code"
        ],
        "properties": {
          "code": {
            "type": "string",
            "enum": [
              "SESSION_INVALID",
              "DEVICE_REVOKED",
              "ACCOUNT_DELETED",
              "PROTOCOL_VERSION_UNSUPPORTED",
              "DESCRIPTOR_SET_MISMATCH",
              "CURSOR_INVALID",
              "STORE_UNKNOWN",
              "KEY_UNAVAILABLE",
              "LEASE_EXPIRED",
              "RECORD_REJECTED",
              "APPEND_ONLY_VIOLATION"
            ]
          },
          "message": {
            "type": "string"
          },
          "storeId": {
            "type": "string"
          },
          "recordId": {
            "type": "string"
          }
        }
      }
    },
    "responses": {
      "SessionInvalid": {
        "description": "No session, or one that has expired. The device refreshes its session and retries.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "DeviceRefused": {
        "description": "DEVICE_REVOKED. Terminal on every operation: the device stops using replicated authorisation at once and begins erasure. The backend enforces revocation whether or not the device ever asks, so this response is the device learning something already true.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "AccountDeleted": {
        "description": "The account was deleted while this device was offline; the device erases the account's data.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "ProtocolVersionUnsupported": {
        "description": "The device and backend do not share a protocol MAJOR. No partial replication is attempted; the product states that an update is required.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "DescriptorSetMismatch": {
        "description": "A store the device declares is unknown to the backend, or two descriptors for one store disagree. The mismatched store is excluded and named to the user; other stores continue.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "CursorInvalid": {
        "description": "A cursor no longer resolves. The device restarts that store's transfer from null; nothing is lost, because a full transfer reconciles against what is already held.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "StoreUnknown": {
        "description": "A store identifier with no registered descriptor. That store does not replicate and is named as not current.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "KeyUnavailable": {
        "description": "The key needed to serve a record cannot be obtained, or its access could not be audited. There is no plaintext fallback: the request fails and the device continues against its local working copy.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "LeaseExpired": {
        "description": "The device pushed after its lease bound passed with no successful exchange. It re-handshakes to obtain a lease and retries; local work continues throughout.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      },
      "PushRefused": {
        "description": "RECORD_REJECTED for a malformed envelope or one whose originating device is not enrolled to this account, or APPEND_ONLY_VIOLATION for a push that would replace or remove a record in an append-only store. In the second case nothing is written and the attempt is itself recorded.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ReplicationError"
            }
          }
        }
      }
    }
  },
  "security": [
    {
      "accessToken": []
    }
  ]
} as const;
