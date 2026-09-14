/**
 * Normative shape of a provider failure notice for agent/contracts/provider-failure@0.1.0 - what crosses the boundary to a window and what a SYSTEM card renders. The taxonomy is closed and the cause is derived only from what the product observed, never from what the provider said, so that a provider - or anything that can make a provider respond - cannot choose what the product tells the user. The mapping was measured rather than imagined: a refused credential, an unknown model and an exhausted quota were each sent to a real service and each converted into a card of this shape - VERIFIED (spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q5, spikes/SP-17-provider-matrix/evidence/error-responses.json, spikes/SP-17-provider-matrix/evidence/system-cards.json). RESPONSE_UNUSABLE exists because of a fourth case found by accident: a response that completes with no content and no error at all.
 */
export interface FailureNotice {
  /**
   * The closed taxonomy. Every failed model request maps to exactly one member, and RESPONSE_UNUSABLE is the floor of that total mapping.
   */
  cause:
    | "CREDENTIAL_REFUSED"
    | "MODEL_UNAVAILABLE"
    | "QUOTA_EXHAUSTED"
    | "ENDPOINT_UNREACHABLE"
    | "RESPONSE_UNUSABLE"
    | "CONFIGURATION_AHEAD";
  profileId: string;
  /**
   * Every role currently affected by this cause on this profile. The list accumulates as further roles meet the same condition; a notice naming none could not tell the user what has stopped working, which is why at least one is required.
   *
   * @minItems 1
   */
  roles: [
    "pet-text" | "pet-image" | "worker" | "rule-elicitation" | "undo" | "risk-judge",
    ...("pet-text" | "pet-image" | "worker" | "rule-elicitation" | "undo" | "risk-judge")[]
  ];
  /**
   * Where the cause is repaired. One destination per cause, never two, and chosen by the main process rather than by the window - so a window cannot navigate the user to a settings page of its own choosing.
   */
  remedy: {
    kind: "profile-credential" | "role-assignment" | "provider-account" | "network" | "product-update";
    profileId?: string;
    role?: string;
  };
  /**
   * The words of the provider, carried for the user to read and never interpreted. It is displayed as text and nothing else: it never selects the remedy, never becomes a link, never reaches a model, and is bounded in length so that a hostile or enormous message cannot become the card.
   */
  providerDetail?: string;
  observedAt: string;
  /**
   * The identity of the condition - profile and cause - and never the identity of a request. This is what makes twenty jobs meeting one refused credential produce one standing notice and one card rather than twenty.
   */
  dedupeKey: string;
}


export const PROVIDER_FAILURE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/provider-failure/0.1.0.json",
  "title": "FailureNotice",
  "description": "Normative shape of a provider failure notice for agent/contracts/provider-failure@0.1.0 - what crosses the boundary to a window and what a SYSTEM card renders. The taxonomy is closed and the cause is derived only from what the product observed, never from what the provider said, so that a provider - or anything that can make a provider respond - cannot choose what the product tells the user. The mapping was measured rather than imagined: a refused credential, an unknown model and an exhausted quota were each sent to a real service and each converted into a card of this shape - VERIFIED (spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q5, spikes/SP-17-provider-matrix/evidence/error-responses.json, spikes/SP-17-provider-matrix/evidence/system-cards.json). RESPONSE_UNUSABLE exists because of a fourth case found by accident: a response that completes with no content and no error at all.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "cause",
    "profileId",
    "roles",
    "remedy",
    "observedAt",
    "dedupeKey"
  ],
  "properties": {
    "cause": {
      "enum": [
        "CREDENTIAL_REFUSED",
        "MODEL_UNAVAILABLE",
        "QUOTA_EXHAUSTED",
        "ENDPOINT_UNREACHABLE",
        "RESPONSE_UNUSABLE",
        "CONFIGURATION_AHEAD"
      ],
      "description": "The closed taxonomy. Every failed model request maps to exactly one member, and RESPONSE_UNUSABLE is the floor of that total mapping."
    },
    "profileId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$"
    },
    "roles": {
      "type": "array",
      "minItems": 1,
      "items": {
        "enum": [
          "pet-text",
          "pet-image",
          "worker",
          "rule-elicitation",
          "undo",
          "risk-judge"
        ]
      },
      "description": "Every role currently affected by this cause on this profile. The list accumulates as further roles meet the same condition; a notice naming none could not tell the user what has stopped working, which is why at least one is required."
    },
    "remedy": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind"
      ],
      "description": "Where the cause is repaired. One destination per cause, never two, and chosen by the main process rather than by the window - so a window cannot navigate the user to a settings page of its own choosing.",
      "properties": {
        "kind": {
          "enum": [
            "profile-credential",
            "role-assignment",
            "provider-account",
            "network",
            "product-update"
          ]
        },
        "profileId": {
          "type": "string"
        },
        "role": {
          "type": "string"
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "kind": {
                "const": "profile-credential"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "required": [
              "profileId"
            ]
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "provider-account"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "required": [
              "profileId"
            ]
          }
        },
        {
          "if": {
            "properties": {
              "kind": {
                "const": "role-assignment"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "required": [
              "role"
            ]
          }
        }
      ]
    },
    "providerDetail": {
      "type": "string",
      "maxLength": 500,
      "description": "The words of the provider, carried for the user to read and never interpreted. It is displayed as text and nothing else: it never selects the remedy, never becomes a link, never reaches a model, and is bounded in length so that a hostile or enormous message cannot become the card."
    },
    "observedAt": {
      "type": "string",
      "minLength": 1
    },
    "dedupeKey": {
      "type": "string",
      "pattern": "^[a-z0-9-]+:[A-Z_]+$",
      "description": "The identity of the condition - profile and cause - and never the identity of a request. This is what makes twenty jobs meeting one refused credential produce one standing notice and one card rather than twenty."
    }
  }
} as const;
