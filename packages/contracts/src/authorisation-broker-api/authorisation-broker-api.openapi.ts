export interface paths {
    "/oauth/{provider}/authorize-url": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The provider identifier a descriptor declares. It is part of the client-facing surface, so renaming one breaks every device holding an authorisation obtained under the old name. */
                provider: components["parameters"]["Provider"];
            };
            cookie?: never;
        };
        /**
         * Start a connect. Issue the binding that threads the untrusted round trip.
         * @description The binding is issued against the session that started the connect, names the provider and the redirect address, is single-use and expires. It carries nothing of value itself, because it travels through the browser and the operating system's URL handling.
         */
        get: operations["authorizeUrl"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/{provider}/exchange": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The provider identifier a descriptor declares. It is part of the client-facing surface, so renaming one breaks every device holding an authorisation obtained under the old name. */
                provider: components["parameters"]["Provider"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Redeem an authorisation code for the platform's tokens, using the server-held client secret.
         * @description The binding is consumed on attempt, not on success, so a failed exchange leaves nothing reusable behind and recovery is to start Connect again. An exchange whose redirectUri differs from the one the binding was issued for is refused before the provider is contacted.
         */
        post: operations["exchangeCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/{provider}/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The provider identifier a descriptor declares. It is part of the client-facing surface, so renaming one breaks every device holding an authorisation obtained under the old name. */
                provider: components["parameters"]["Provider"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Refresh a platform token that the platform will refresh only for a confidential client.
         * @description No binding: the device already holds the authorisation, and supplies the refresh token per call. The server holds only the client secret, by name.
         */
        post: operations["refreshProviderToken"];
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
        AuthorizeUrlResult: {
            providerId: string;
            authorizeUrl: string;
            binding: components["schemas"]["BindingValue"];
            /** @description How long the exchange may be completed. */
            expiresInSeconds: number;
        };
        /** @description Opaque and single-use. Carries no credential, because it travels through the browser and the operating system's URL handling. */
        BindingValue: string;
        ExchangeRequest: {
            /** @description The authorisation code as returned to the loopback address. */
            code: string;
            /** @description Must equal the one the binding was issued for. */
            redirectUri: string;
            binding: components["schemas"]["BindingValue"];
        };
        ProviderRefreshRequest: {
            /** @description Held by the device. The server keeps no copy. */
            refreshToken: string;
        };
        ProviderTokens: {
            providerId: string;
            accessToken: string;
            tokenType: string;
            /** @description Absent means the provider states no expiry. */
            expiresInSeconds?: number;
            /** @description Absent means the provider issues none. */
            refreshToken?: string;
            scope?: string;
            /** @description Provider-specific payload forwarded without interpretation - a workspace identifier, a bot identifier, an account label. Interpreting it would put platform knowledge in the broker. */
            providerExtras?: {
                [key: string]: unknown;
            };
        };
        BrokerError: {
            /** @enum {string} */
            code: "PROVIDER_UNSUPPORTED" | "BINDING_UNKNOWN" | "BINDING_CONSUMED" | "BINDING_EXPIRED" | "REDIRECT_MISMATCH" | "PROVIDER_REJECTED" | "PROVIDER_UNREACHABLE" | "TOKEN_MISSING" | "TOKEN_EXPIRED" | "TOKEN_INVALID" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE";
            providerId?: string;
            /** @description The platform's own words, present on PROVIDER_REJECTED. Displayed and never interpreted as an instruction. */
            providerReason?: string;
            retryAfterSeconds?: number;
        };
    };
    responses: {
        /** @description No descriptor declares this provider, or it is withheld. Retrying cannot succeed. */
        ProviderUnsupported: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BrokerError"];
            };
        };
        /** @description BINDING_UNKNOWN, BINDING_CONSUMED, BINDING_EXPIRED or REDIRECT_MISMATCH. The provider is never contacted, and the recovery is the same in every case - start Connect again. */
        BindingRefused: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BrokerError"];
            };
        };
        /** @description PROVIDER_REJECTED with the platform's own reason, or PROVIDER_UNREACHABLE. Distinct from our own outage, because they lead the user to different actions. */
        ProviderRefused: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BrokerError"];
            };
        };
        /** @description TOKEN_MISSING, TOKEN_EXPIRED or TOKEN_INVALID; renew or sign in per the client session API. */
        SessionRefused: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BrokerError"];
            };
        };
        /** @description Broker calls from this source exceeded the configured rate. */
        RateLimited: {
            headers: {
                /** @description Seconds the caller waits before retrying. */
                "Retry-After"?: number;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BrokerError"];
            };
        };
        /** @description Our backend or its store is unreachable. Running jobs and existing connectors are unaffected. */
        ServiceUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["BrokerError"];
            };
        };
    };
    parameters: {
        /** @description The provider identifier a descriptor declares. It is part of the client-facing surface, so renaming one breaks every device holding an authorisation obtained under the old name. */
        Provider: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    authorizeUrl: {
        parameters: {
            query: {
                /** @description A loopback address the device is already listening on. */
                redirectUri: string;
                /** @description Space-separated. Absent means the descriptor's default scopes. */
                scopes?: string;
            };
            header?: never;
            path: {
                /** @description The provider identifier a descriptor declares. It is part of the client-facing surface, so renaming one breaks every device holding an authorisation obtained under the old name. */
                provider: components["parameters"]["Provider"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The URL to open in the user's browser, and the binding that will be redeemed with the code. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthorizeUrlResult"];
                };
            };
            401: components["responses"]["SessionRefused"];
            404: components["responses"]["ProviderUnsupported"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    exchangeCode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The provider identifier a descriptor declares. It is part of the client-facing surface, so renaming one breaks every device holding an authorisation obtained under the old name. */
                provider: components["parameters"]["Provider"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExchangeRequest"];
            };
        };
        responses: {
            /** @description The platform's tokens, returned to the device and retained nowhere. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderTokens"];
                };
            };
            400: components["responses"]["BindingRefused"];
            401: components["responses"]["SessionRefused"];
            404: components["responses"]["ProviderUnsupported"];
            424: components["responses"]["ProviderRefused"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    refreshProviderToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The provider identifier a descriptor declares. It is part of the client-facing surface, so renaming one breaks every device holding an authorisation obtained under the old name. */
                provider: components["parameters"]["Provider"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProviderRefreshRequest"];
            };
        };
        responses: {
            /** @description Refreshed platform tokens. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProviderTokens"];
                };
            };
            401: components["responses"]["SessionRefused"];
            404: components["responses"]["ProviderUnsupported"];
            424: components["responses"]["ProviderRefused"];
            429: components["responses"]["RateLimited"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
}


export const AUTHORISATION_BROKER_API_OPENAPI = {
  "openapi": "3.1.0",
  "info": {
    "title": "Authorisation Broker API",
    "version": "0.1.0",
    "summary": "Three calls that serve every platform, so that a confidential client secret is never on the device.",
    "description": "Normative wire surface for backend/contracts/authorisation-broker-api@0.1.0. The shape of this file is the evidence for the claim it exists to support: adding a provider adds nothing here. A provider appears only as a path parameter and a descriptor, per backend/contracts/authorisation-provider-descriptor@0.1.0. Nothing in ProviderTokens is retained by the service; the response is the only copy the server ever produced, which is why the retention claim is checkable by dumping the store rather than by reading code. The proof-key exchange, where a provider requires it, is handled entirely server-side and is deliberately absent from these payloads."
  },
  "servers": [
    {
      "url": "https://api.example.invalid/v1",
      "description": "Placeholder. The deployed origin is service configuration, not part of this contract."
    }
  ],
  "tags": [
    {
      "name": "broker",
      "description": "Rate-limit class \"brokering\"; every call requires a session."
    }
  ],
  "paths": {
    "/oauth/{provider}/authorize-url": {
      "parameters": [
        {
          "$ref": "#/components/parameters/Provider"
        }
      ],
      "get": {
        "tags": [
          "broker"
        ],
        "operationId": "authorizeUrl",
        "summary": "Start a connect. Issue the binding that threads the untrusted round trip.",
        "description": "The binding is issued against the session that started the connect, names the provider and the redirect address, is single-use and expires. It carries nothing of value itself, because it travels through the browser and the operating system's URL handling.",
        "parameters": [
          {
            "name": "redirectUri",
            "in": "query",
            "required": true,
            "description": "A loopback address the device is already listening on.",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "scopes",
            "in": "query",
            "required": false,
            "description": "Space-separated. Absent means the descriptor's default scopes.",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "The URL to open in the user's browser, and the binding that will be redeemed with the code.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuthorizeUrlResult"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/SessionRefused"
          },
          "404": {
            "$ref": "#/components/responses/ProviderUnsupported"
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
    "/oauth/{provider}/exchange": {
      "parameters": [
        {
          "$ref": "#/components/parameters/Provider"
        }
      ],
      "post": {
        "tags": [
          "broker"
        ],
        "operationId": "exchangeCode",
        "summary": "Redeem an authorisation code for the platform's tokens, using the server-held client secret.",
        "description": "The binding is consumed on attempt, not on success, so a failed exchange leaves nothing reusable behind and recovery is to start Connect again. An exchange whose redirectUri differs from the one the binding was issued for is refused before the provider is contacted.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ExchangeRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "The platform's tokens, returned to the device and retained nowhere.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ProviderTokens"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/BindingRefused"
          },
          "401": {
            "$ref": "#/components/responses/SessionRefused"
          },
          "404": {
            "$ref": "#/components/responses/ProviderUnsupported"
          },
          "424": {
            "$ref": "#/components/responses/ProviderRefused"
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
    "/oauth/{provider}/refresh": {
      "parameters": [
        {
          "$ref": "#/components/parameters/Provider"
        }
      ],
      "post": {
        "tags": [
          "broker"
        ],
        "operationId": "refreshProviderToken",
        "summary": "Refresh a platform token that the platform will refresh only for a confidential client.",
        "description": "No binding: the device already holds the authorisation, and supplies the refresh token per call. The server holds only the client secret, by name.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ProviderRefreshRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Refreshed platform tokens.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ProviderTokens"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/SessionRefused"
          },
          "404": {
            "$ref": "#/components/responses/ProviderUnsupported"
          },
          "424": {
            "$ref": "#/components/responses/ProviderRefused"
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
    "securitySchemes": {
      "accessToken": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Issued by backend/contracts/client-session-api@0.1.0."
      }
    },
    "parameters": {
      "Provider": {
        "name": "provider",
        "in": "path",
        "required": true,
        "description": "The provider identifier a descriptor declares. It is part of the client-facing surface, so renaming one breaks every device holding an authorisation obtained under the old name.",
        "schema": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]{1,31}$"
        }
      }
    },
    "schemas": {
      "AuthorizeUrlResult": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "providerId",
          "authorizeUrl",
          "binding",
          "expiresInSeconds"
        ],
        "properties": {
          "providerId": {
            "type": "string"
          },
          "authorizeUrl": {
            "type": "string"
          },
          "binding": {
            "$ref": "#/components/schemas/BindingValue"
          },
          "expiresInSeconds": {
            "type": "integer",
            "minimum": 1,
            "description": "How long the exchange may be completed."
          }
        }
      },
      "BindingValue": {
        "type": "string",
        "minLength": 1,
        "description": "Opaque and single-use. Carries no credential, because it travels through the browser and the operating system's URL handling."
      },
      "ExchangeRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code",
          "redirectUri",
          "binding"
        ],
        "properties": {
          "code": {
            "type": "string",
            "minLength": 1,
            "description": "The authorisation code as returned to the loopback address."
          },
          "redirectUri": {
            "type": "string",
            "minLength": 1,
            "description": "Must equal the one the binding was issued for."
          },
          "binding": {
            "$ref": "#/components/schemas/BindingValue"
          }
        }
      },
      "ProviderRefreshRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "refreshToken"
        ],
        "properties": {
          "refreshToken": {
            "type": "string",
            "minLength": 1,
            "description": "Held by the device. The server keeps no copy."
          }
        }
      },
      "ProviderTokens": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "providerId",
          "accessToken",
          "tokenType"
        ],
        "properties": {
          "providerId": {
            "type": "string"
          },
          "accessToken": {
            "type": "string"
          },
          "tokenType": {
            "type": "string"
          },
          "expiresInSeconds": {
            "type": "integer",
            "minimum": 0,
            "description": "Absent means the provider states no expiry."
          },
          "refreshToken": {
            "type": "string",
            "description": "Absent means the provider issues none."
          },
          "scope": {
            "type": "string"
          },
          "providerExtras": {
            "type": "object",
            "description": "Provider-specific payload forwarded without interpretation - a workspace identifier, a bot identifier, an account label. Interpreting it would put platform knowledge in the broker.",
            "additionalProperties": true
          }
        }
      },
      "BrokerError": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code"
        ],
        "properties": {
          "code": {
            "type": "string",
            "enum": [
              "PROVIDER_UNSUPPORTED",
              "BINDING_UNKNOWN",
              "BINDING_CONSUMED",
              "BINDING_EXPIRED",
              "REDIRECT_MISMATCH",
              "PROVIDER_REJECTED",
              "PROVIDER_UNREACHABLE",
              "TOKEN_MISSING",
              "TOKEN_EXPIRED",
              "TOKEN_INVALID",
              "RATE_LIMITED",
              "SERVICE_UNAVAILABLE"
            ]
          },
          "providerId": {
            "type": "string"
          },
          "providerReason": {
            "type": "string",
            "description": "The platform's own words, present on PROVIDER_REJECTED. Displayed and never interpreted as an instruction."
          },
          "retryAfterSeconds": {
            "type": "integer",
            "minimum": 0
          }
        }
      }
    },
    "responses": {
      "ProviderUnsupported": {
        "description": "No descriptor declares this provider, or it is withheld. Retrying cannot succeed.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/BrokerError"
            }
          }
        }
      },
      "BindingRefused": {
        "description": "BINDING_UNKNOWN, BINDING_CONSUMED, BINDING_EXPIRED or REDIRECT_MISMATCH. The provider is never contacted, and the recovery is the same in every case - start Connect again.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/BrokerError"
            }
          }
        }
      },
      "ProviderRefused": {
        "description": "PROVIDER_REJECTED with the platform's own reason, or PROVIDER_UNREACHABLE. Distinct from our own outage, because they lead the user to different actions.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/BrokerError"
            }
          }
        }
      },
      "SessionRefused": {
        "description": "TOKEN_MISSING, TOKEN_EXPIRED or TOKEN_INVALID; renew or sign in per the client session API.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/BrokerError"
            }
          }
        }
      },
      "RateLimited": {
        "description": "Broker calls from this source exceeded the configured rate.",
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
              "$ref": "#/components/schemas/BrokerError"
            }
          }
        }
      },
      "ServiceUnavailable": {
        "description": "Our backend or its store is unreachable. Running jobs and existing connectors are unaffected.",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/BrokerError"
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
