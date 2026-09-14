/**
 * Normative shape of one provider's rule for accepting an authorisation client the user created themselves, for connector/contracts/byo-authorisation-client@0.1.0. One descriptor per provider offering this route, shipped beside that connector's manifest. Acceptance happens before the browser opens: a supplied client is parsed, checked against this rule, and either stored whole or refused with a code and the guide step that remedies it (INV-GG-02). The reason it is data rather than a convenience is that every failure deferred past this point happens on the provider's page, after the user has left the application, where the product can neither explain it nor correct it. What the file cannot express, and what the contract document holds instead: whether the kinds a rule admits can actually complete a loopback redirect at that provider - a rule may satisfy this file and still be wrong, which is why a rule is reviewed by reading.
 */
export interface ClientAcceptanceRule {
  /**
   * The provider this rule accepts clients for. Matches auth.provider_id of the connector manifest.
   */
  provider_id: string;
  /**
   * The client kinds that can complete the loopback route at this provider. A supplied client of any other kind is refused before the browser opens.
   *
   * @minItems 1
   */
  accepted_client_kinds: ["installed" | "web" | "service_account", ...("installed" | "web" | "service_account")[]];
  /**
   * What must be present in the supplied file for the flow to be possible at all.
   *
   * @minItems 1
   */
  required_fields: [string, ...string[]];
  /**
   * The host forms this provider accepts in a loopback redirect. The port is acquired at connect time and is never listed here.
   *
   * @minItems 1
   */
  loopback_host_forms: ["localhost" | "127.0.0.1" | "[::1]", ...("localhost" | "127.0.0.1" | "[::1]")[]];
  /**
   * Whether the exchange must carry a proof of possession. False is permitted only where measured; it is never assumed.
   */
  requires_proof_key: boolean;
  /**
   * @minItems 1
   */
  refusals: [
    {
      code: "CLIENT_FILE_UNREADABLE" | "CLIENT_FIELD_MISSING" | "CLIENT_KIND_UNSUPPORTED" | "CLIENT_PROVIDER_MISMATCH";
      /**
       * The step of this connector's setup guide that produces a client this rule would accept.
       */
      remedy_step_id: string;
    },
    ...{
      code: "CLIENT_FILE_UNREADABLE" | "CLIENT_FIELD_MISSING" | "CLIENT_KIND_UNSUPPORTED" | "CLIENT_PROVIDER_MISMATCH";
      /**
       * The step of this connector's setup guide that produces a client this rule would accept.
       */
      remedy_step_id: string;
    }[]
  ];
}


export const BYO_AUTHORISATION_CLIENT_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/connector/byo-authorisation-client/0.1.0.json",
  "title": "ClientAcceptanceRule",
  "description": "Normative shape of one provider's rule for accepting an authorisation client the user created themselves, for connector/contracts/byo-authorisation-client@0.1.0. One descriptor per provider offering this route, shipped beside that connector's manifest. Acceptance happens before the browser opens: a supplied client is parsed, checked against this rule, and either stored whole or refused with a code and the guide step that remedies it (INV-GG-02). The reason it is data rather than a convenience is that every failure deferred past this point happens on the provider's page, after the user has left the application, where the product can neither explain it nor correct it. What the file cannot express, and what the contract document holds instead: whether the kinds a rule admits can actually complete a loopback redirect at that provider - a rule may satisfy this file and still be wrong, which is why a rule is reviewed by reading.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "provider_id",
    "accepted_client_kinds",
    "required_fields",
    "loopback_host_forms",
    "requires_proof_key",
    "refusals"
  ],
  "properties": {
    "provider_id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_-]*$",
      "description": "The provider this rule accepts clients for. Matches auth.provider_id of the connector manifest."
    },
    "accepted_client_kinds": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "enum": [
          "installed",
          "web",
          "service_account"
        ]
      },
      "description": "The client kinds that can complete the loopback route at this provider. A supplied client of any other kind is refused before the browser opens."
    },
    "required_fields": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string"
      },
      "description": "What must be present in the supplied file for the flow to be possible at all."
    },
    "loopback_host_forms": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string",
        "enum": [
          "localhost",
          "127.0.0.1",
          "[::1]"
        ]
      },
      "description": "The host forms this provider accepts in a loopback redirect. The port is acquired at connect time and is never listed here."
    },
    "requires_proof_key": {
      "type": "boolean",
      "description": "Whether the exchange must carry a proof of possession. False is permitted only where measured; it is never assumed."
    },
    "refusals": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "code",
          "remedy_step_id"
        ],
        "properties": {
          "code": {
            "type": "string",
            "enum": [
              "CLIENT_FILE_UNREADABLE",
              "CLIENT_FIELD_MISSING",
              "CLIENT_KIND_UNSUPPORTED",
              "CLIENT_PROVIDER_MISMATCH"
            ]
          },
          "remedy_step_id": {
            "type": "string",
            "description": "The step of this connector's setup guide that produces a client this rule would accept."
          }
        }
      }
    }
  }
} as const;
