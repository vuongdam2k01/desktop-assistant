export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Report whether the service can serve, not whether the process is running.
         * @description The endpoint exercises the store. An instance whose store is unreachable reports unhealthy, never healthy, because liveness that cannot fail tells an operator nothing. It discloses nothing about accounts - no count, no address, no identifier - precisely because it must be callable by an operator or a load balancer.
         */
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/app/version": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Report the current client version and the minimum the service accepts.
         * @description Answered without a session so that a client too old to sign in can still learn why it was refused. This endpoint is the version-discovery mechanism for every other contract, which is why it is additive-only.
         */
        get: operations["version"];
        put?: never;
        post?: never;
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
        HealthResult: {
            /**
             * @description A reader that does not recognise a value treats it as not healthy. The direction of that default is fixed: a reader that guesses must guess towards reporting a problem.
             * @enum {string}
             */
            status: "healthy" | "degraded" | "unhealthy";
            /** @description False means the instance cannot serve any authenticated request, so status is unhealthy. The two together are a state, not two independent fields. */
            storeReachable: boolean;
            uptimeSeconds: number;
        };
        VersionResult: {
            /** @description Semver of the current released client. */
            currentVersion: string;
            /** @description Below this, the service refuses the client. */
            minimumSupportedVersion: string;
            /** @description A statement about the service, not a request to the user: it means the service will stop accepting this client, so the product presents the update as required. */
            mandatory: boolean;
            /** @description Absent means no update is published for this client, not that the check failed. The manifest's content is owned by platform under req-016-signing-update. */
            manifestUri?: string;
            releaseNotesUri?: string;
        };
        PublicError: {
            /** @enum {string} */
            code: "RATE_LIMITED" | "SERVICE_UNAVAILABLE";
            message?: string;
            /** @description Present on RATE_LIMITED only. */
            retryAfterSeconds?: number;
        };
    };
    responses: {
        /** @description Calls from this source exceeded the class threshold. Never presented as a failure of what the caller asked for, and distinguishable from an authentication failure. */
        RateLimited: {
            headers: {
                /** @description Seconds the caller waits before retrying. */
                "Retry-After"?: number;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["PublicError"];
            };
        };
        /** @description The instance or its store is unreachable. The application continues to run and reports that it could not check for updates; running jobs are unaffected. */
        ServiceUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["PublicError"];
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
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The service's own assessment of whether it can serve. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResult"];
                };
            };
            429: components["responses"]["RateLimited"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    version: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description What the service accepts, and where an update may be found. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionResult"];
                };
            };
            429: components["responses"]["RateLimited"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
}


export const PUBLIC_SERVICE_ENDPOINTS_OPENAPI = {
  "openapi": "3.1.0",
  "info": {
    "title": "Public Service Endpoints",
    "version": "0.1.0",
    "summary": "The two questions answerable before a device has a session.",
    "description": "Normative wire surface for backend/contracts/public-service-endpoints@0.1.0. Whether the service is serving, and whether this client is still a version the service accepts. Both are unauthenticated, which makes them the only surface reachable without a session and the one an unauthenticated flood arrives at first. Unauthenticated does not mean uncounted: both are in the rate-limit class \"public\", and rate limiting is evaluated before any session verification on every endpoint of every class."
  },
  "servers": [
    {
      "url": "https://api.example.invalid/v1",
      "description": "Placeholder. The deployed origin is service configuration, not part of this contract."
    }
  ],
  "tags": [
    {
      "name": "public",
      "description": "Rate-limit class \"public\". No session, and nothing disclosed about accounts."
    }
  ],
  "paths": {
    "/health": {
      "get": {
        "tags": [
          "public"
        ],
        "operationId": "health",
        "summary": "Report whether the service can serve, not whether the process is running.",
        "description": "The endpoint exercises the store. An instance whose store is unreachable reports unhealthy, never healthy, because liveness that cannot fail tells an operator nothing. It discloses nothing about accounts - no count, no address, no identifier - precisely because it must be callable by an operator or a load balancer.",
        "security": [],
        "responses": {
          "200": {
            "description": "The service's own assessment of whether it can serve.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResult"
                }
              }
            }
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          },
          "503": {
            "$ref": "#/components/responses/ServiceUnavailable"
          }
        }
      }
    },
    "/app/version": {
      "get": {
        "tags": [
          "public"
        ],
        "operationId": "version",
        "summary": "Report the current client version and the minimum the service accepts.",
        "description": "Answered without a session so that a client too old to sign in can still learn why it was refused. This endpoint is the version-discovery mechanism for every other contract, which is why it is additive-only.",
        "security": [],
        "responses": {
          "200": {
            "description": "What the service accepts, and where an update may be found.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/VersionResult"
                }
              }
            }
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          },
          "503": {
            "$ref": "#/components/responses/ServiceUnavailable"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "HealthResult": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status",
          "storeReachable",
          "uptimeSeconds"
        ],
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "healthy",
              "degraded",
              "unhealthy"
            ],
            "description": "A reader that does not recognise a value treats it as not healthy. The direction of that default is fixed: a reader that guesses must guess towards reporting a problem."
          },
          "storeReachable": {
            "type": "boolean",
            "description": "False means the instance cannot serve any authenticated request, so status is unhealthy. The two together are a state, not two independent fields."
          },
          "uptimeSeconds": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "VersionResult": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "currentVersion",
          "minimumSupportedVersion",
          "mandatory"
        ],
        "properties": {
          "currentVersion": {
            "type": "string",
            "description": "Semver of the current released client."
          },
          "minimumSupportedVersion": {
            "type": "string",
            "description": "Below this, the service refuses the client."
          },
          "mandatory": {
            "type": "boolean",
            "description": "A statement about the service, not a request to the user: it means the service will stop accepting this client, so the product presents the update as required."
          },
          "manifestUri": {
            "type": "string",
            "description": "Absent means no update is published for this client, not that the check failed. The manifest's content is owned by platform under req-016-signing-update."
          },
          "releaseNotesUri": {
            "type": "string"
          }
        }
      },
      "PublicError": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code"
        ],
        "properties": {
          "code": {
            "type": "string",
            "enum": [
              "RATE_LIMITED",
              "SERVICE_UNAVAILABLE"
            ]
          },
          "message": {
            "type": "string"
          },
          "retryAfterSeconds": {
            "type": "integer",
            "minimum": 0,
            "description": "Present on RATE_LIMITED only."
          }
        }
      }
    },
    "responses": {
      "RateLimited": {
        "description": "Calls from this source exceeded the class threshold. Never presented as a failure of what the caller asked for, and distinguishable from an authentication failure.",
        "headers": {
          "Retry-After": {
            "description": "Seconds the caller waits before retrying.",
            "schema": {
              "type": "integer"
            }
          }
        },
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/PublicError"
            }
          }
        }
      },
      "ServiceUnavailable": {
        "description": "The instance or its store is unreachable. The application continues to run and reports that it could not check for updates; running jobs are unaffected.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/PublicError"
            }
          }
        }
      }
    }
  }
} as const;
