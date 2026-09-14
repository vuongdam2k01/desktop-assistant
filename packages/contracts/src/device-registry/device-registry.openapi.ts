export interface paths {
    "/account/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the account's enrolled devices as the user would recognise them.
         * @description The user's only visibility into the gate that admits a device to their entire history. A revoked entry is retained long enough for the user who revoked it to see the outcome and disappears afterwards.
         */
        get: operations["listDevices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/account/devices/{deviceId}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description What the protocol acts on. The label is for recognition and identifies nothing. */
                deviceId: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Shut a device out of the account, on the user's confirmed decision.
         * @description Revoking a device destroys that device's copy of the account's data and interrupts any job running on it, so it is never a side effect of another operation: a request that does not carry the user's confirmation is refused. Self-revocation is permitted and is signalled in the result, so the requesting device recognises that its own success response is also its sign-out.
         */
        post: operations["revokeDevice"];
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
        RegistryView: {
            accountId: string;
            devices: components["schemas"]["DeviceEntry"][];
            /** Format: date-time */
            revisedAt: string;
        };
        DeviceEntry: {
            deviceId: string;
            /** @description User-recognisable - machine name and operating system. Never unique, never authenticates anything. */
            label: string;
            /** Format: date-time */
            enrolledAt: string;
            /**
             * Format: date-time
             * @description Null means enrolled but never having completed an exchange.
             */
            lastReplicatedAt: string | null;
            state: components["schemas"]["DeviceState"];
            /** @description True for exactly one entry per requesting device. */
            isCurrentDevice: boolean;
        };
        /**
         * @description lease-expired and revoked are different claims and must be presented as such: the first is ordinary and self-healing, and one successful exchange returns the device to active; the second is terminal and is never re-entered into active. A client that does not recognise a value treats it as non-permissive - it may show the device as in an unrecognised state and offer revocation, and must never treat it as active.
         * @enum {string}
         */
        DeviceState: "enrolling" | "active" | "lease-expired" | "revoked";
        RevokeRequest: {
            /**
             * @description Asserts a decision; it does not make one. The wording the user confirmed - that the device loses access and erases its copy - is owned by app. Typed as the literal true so that omitting it is a type error rather than a falsy default.
             * @constant
             */
            confirmed: true;
        };
        RevokeResult: {
            deviceId: string;
            /** @constant */
            state: "revoked";
            sessionsWithdrawn: number;
            /** @description True when the revoked device is the requesting one. */
            selfRevocation: boolean;
        };
        RegistryError: {
            /** @enum {string} */
            code: "SESSION_INVALID" | "DEVICE_REVOKED" | "DEVICE_NOT_FOUND" | "DEVICE_NOT_IN_ACCOUNT" | "CONFIRMATION_REQUIRED" | "ACCOUNT_DELETED";
            message?: string;
            deviceId?: string;
        };
    };
    responses: {
        /** @description No session, or one that has expired. The device refreshes its session and retries. */
        SessionInvalid: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RegistryError"];
            };
        };
        /** @description The requesting device has itself been revoked. It states that it no longer has access to the account and begins erasing its copy. */
        DeviceRefused: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RegistryError"];
            };
        };
        /** @description DEVICE_NOT_FOUND for a device not in this account's registry or already revoked and removed, and DEVICE_NOT_IN_ACCOUNT for one belonging to another account, which is treated as not found. Neither discloses whether the device exists elsewhere, and a second revocation of an already-revoked device is not presented to the user as a failure. */
        DeviceNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RegistryError"];
            };
        };
        /** @description The request carried no confirmation. A defect in the calling surface rather than a user condition: the user is asked to confirm before the call is made, never after it fails. */
        ConfirmationRequired: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RegistryError"];
            };
        };
        /** @description The account was deleted while this device was offline; the device erases the account's data. */
        AccountDeleted: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["RegistryError"];
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
    listDevices: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The account's devices, one of them marked as the requesting device. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegistryView"];
                };
            };
            401: components["responses"]["SessionInvalid"];
            403: components["responses"]["DeviceRefused"];
            410: components["responses"]["AccountDeleted"];
        };
    };
    revokeDevice: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description What the protocol acts on. The label is for recognition and identifies nothing. */
                deviceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevokeRequest"];
            };
        };
        responses: {
            /** @description The device is revoked and the backend has already stopped serving it. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevokeResult"];
                };
            };
            400: components["responses"]["ConfirmationRequired"];
            401: components["responses"]["SessionInvalid"];
            403: components["responses"]["DeviceRefused"];
            404: components["responses"]["DeviceNotFound"];
            410: components["responses"]["AccountDeleted"];
        };
    };
}


export const DEVICE_REGISTRY_OPENAPI = {
  "openapi": "3.1.0",
  "info": {
    "title": "Device Registry",
    "version": "0.1.0",
    "summary": "The account's list of enrolled devices, and the surface through which the user revokes one.",
    "description": "Normative wire surface for sync/contracts/device-registry@0.1.0. Separate from the replication protocol deliberately: replication is data exchange, this is authority over which devices may exchange at all. The registry is the authority and the device is not consulted - revocation takes effect at the backend on the response, whether or not the revoked device is reachable. Everything the device then does is a second line rather than the mechanism. One channel of the contract is absent from this file: registry.changed, the backend-to-device event, is a convenience. Enforcement happens at the backend on every request, so a device that never receives the event is still shut out and sees the current registry at its next list. The path layer is introduced by this file, following the layout the backend slice established."
  },
  "servers": [
    {
      "url": "https://api.example.invalid/v1",
      "description": "Placeholder. The deployed origin is service configuration, not part of this contract."
    }
  ],
  "tags": [
    {
      "name": "registry",
      "description": "Every operation requires a session issued by the client session API."
    }
  ],
  "paths": {
    "/account/devices": {
      "get": {
        "tags": [
          "registry"
        ],
        "operationId": "listDevices",
        "summary": "List the account's enrolled devices as the user would recognise them.",
        "description": "The user's only visibility into the gate that admits a device to their entire history. A revoked entry is retained long enough for the user who revoked it to see the outcome and disappears afterwards.",
        "responses": {
          "200": {
            "description": "The account's devices, one of them marked as the requesting device.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RegistryView"
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
          "410": {
            "$ref": "#/components/responses/AccountDeleted"
          }
        }
      }
    },
    "/account/devices/{deviceId}/revoke": {
      "parameters": [
        {
          "name": "deviceId",
          "in": "path",
          "required": true,
          "description": "What the protocol acts on. The label is for recognition and identifies nothing.",
          "schema": {
            "type": "string",
            "minLength": 1
          }
        }
      ],
      "post": {
        "tags": [
          "registry"
        ],
        "operationId": "revokeDevice",
        "summary": "Shut a device out of the account, on the user's confirmed decision.",
        "description": "Revoking a device destroys that device's copy of the account's data and interrupts any job running on it, so it is never a side effect of another operation: a request that does not carry the user's confirmation is refused. Self-revocation is permitted and is signalled in the result, so the requesting device recognises that its own success response is also its sign-out.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RevokeRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "The device is revoked and the backend has already stopped serving it.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RevokeResult"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/ConfirmationRequired"
          },
          "401": {
            "$ref": "#/components/responses/SessionInvalid"
          },
          "403": {
            "$ref": "#/components/responses/DeviceRefused"
          },
          "404": {
            "$ref": "#/components/responses/DeviceNotFound"
          },
          "410": {
            "$ref": "#/components/responses/AccountDeleted"
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
      "RegistryView": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "accountId",
          "devices",
          "revisedAt"
        ],
        "properties": {
          "accountId": {
            "type": "string"
          },
          "devices": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DeviceEntry"
            }
          },
          "revisedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "DeviceEntry": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "deviceId",
          "label",
          "enrolledAt",
          "lastReplicatedAt",
          "state",
          "isCurrentDevice"
        ],
        "properties": {
          "deviceId": {
            "type": "string"
          },
          "label": {
            "type": "string",
            "description": "User-recognisable - machine name and operating system. Never unique, never authenticates anything."
          },
          "enrolledAt": {
            "type": "string",
            "format": "date-time"
          },
          "lastReplicatedAt": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time",
            "description": "Null means enrolled but never having completed an exchange."
          },
          "state": {
            "$ref": "#/components/schemas/DeviceState"
          },
          "isCurrentDevice": {
            "type": "boolean",
            "description": "True for exactly one entry per requesting device."
          }
        }
      },
      "DeviceState": {
        "type": "string",
        "description": "lease-expired and revoked are different claims and must be presented as such: the first is ordinary and self-healing, and one successful exchange returns the device to active; the second is terminal and is never re-entered into active. A client that does not recognise a value treats it as non-permissive - it may show the device as in an unrecognised state and offer revocation, and must never treat it as active.",
        "enum": [
          "enrolling",
          "active",
          "lease-expired",
          "revoked"
        ]
      },
      "RevokeRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "confirmed"
        ],
        "properties": {
          "confirmed": {
            "const": true,
            "description": "Asserts a decision; it does not make one. The wording the user confirmed - that the device loses access and erases its copy - is owned by app. Typed as the literal true so that omitting it is a type error rather than a falsy default."
          }
        }
      },
      "RevokeResult": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "deviceId",
          "state",
          "sessionsWithdrawn",
          "selfRevocation"
        ],
        "properties": {
          "deviceId": {
            "type": "string"
          },
          "state": {
            "const": "revoked"
          },
          "sessionsWithdrawn": {
            "type": "integer",
            "minimum": 0
          },
          "selfRevocation": {
            "type": "boolean",
            "description": "True when the revoked device is the requesting one."
          }
        }
      },
      "RegistryError": {
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
              "DEVICE_NOT_FOUND",
              "DEVICE_NOT_IN_ACCOUNT",
              "CONFIRMATION_REQUIRED",
              "ACCOUNT_DELETED"
            ]
          },
          "message": {
            "type": "string"
          },
          "deviceId": {
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
              "$ref": "#/components/schemas/RegistryError"
            }
          }
        }
      },
      "DeviceRefused": {
        "description": "The requesting device has itself been revoked. It states that it no longer has access to the account and begins erasing its copy.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RegistryError"
            }
          }
        }
      },
      "DeviceNotFound": {
        "description": "DEVICE_NOT_FOUND for a device not in this account's registry or already revoked and removed, and DEVICE_NOT_IN_ACCOUNT for one belonging to another account, which is treated as not found. Neither discloses whether the device exists elsewhere, and a second revocation of an already-revoked device is not presented to the user as a failure.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RegistryError"
            }
          }
        }
      },
      "ConfirmationRequired": {
        "description": "The request carried no confirmation. A defect in the calling surface rather than a user condition: the user is asked to confirm before the call is made, never after it fails.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RegistryError"
            }
          }
        }
      },
      "AccountDeleted": {
        "description": "The account was deleted while this device was offline; the device erases the account's data.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/RegistryError"
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
