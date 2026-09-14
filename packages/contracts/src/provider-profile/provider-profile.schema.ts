/**
 * Normative shape of a provider profile for agent/contracts/provider-profile@0.1.0, and what the settings surface validates against before it saves. A profile is the one descriptor the user writes by hand: where model requests go, which credential opens that door, and which models are on the other side of it. The shape is the reality the embedded path has - a credential per provider and a descriptor for any service speaking a completion dialect the engine implements - rather than the interactive provider sign-in the product definition once described, which VERIFIED (spikes/SP-6-pi-sdk/REPORT.md §1 Q5) does not exist off the command-line tool.
 */
export interface ProviderProfile {
  /**
   * The version of the provider-profile contract this profile was written against. Profiles replicate between devices that update at different times, so this is a real mixed-version window: a newer build reads an older profile unchanged, and an older build meeting a newer version refuses to use the profile (PROFILE_VERSION_AHEAD) rather than reading around what it does not recognise.
   */
  profileVersion: string;
  id: string;
  displayName: string;
  endpoint: {
    /**
     * Absolute https address of the service, and the destination of model requests only: it never resolves a tool, never fetches code, and never receives connector data that is not part of the request it serves. A mistyped address therefore exposes the credential configured for this profile and nothing beyond it. Not https is ADDRESS_INVALID, refused at save.
     */
    address: string;
    /**
     * A completion dialect the embedded engine implements. Anything else is DIALECT_UNSUPPORTED, refused at save so the failure reaches the person who can fix it at the moment they can fix it.
     */
    dialect: "openai-completions" | "anthropic-messages" | "google-generative";
    /**
     * Extra request headers. A value that is a credential is stored by reference and never inline.
     */
    headers?: {
      [k: string]: unknown;
    };
  };
  /**
   * A key into operating-system secure storage under platform/contracts/secure-storage@0.1.0, never the secret itself (INV-AG-08). The pattern is what refuses a profile carrying its own secret, and that refusal matters more than it looks: a profile replicates to the account, so a secret written here would be a secret the user never chose to replicate.
   */
  credential: string;
  /**
   * The models this profile offers. A profile offering none has nothing to route to, so the member is required rather than defaulted.
   *
   * @minItems 1
   */
  models: [
    {
      /**
       * The model identifier the service expects.
       */
      name: string;
      /**
       * What the user sees.
       */
      label: string;
      /**
       * Declared by the user and then checked: a command carrying images routed to a model that does not declare images is refused before the job starts, naming the mapping, rather than discovered as a provider rejection mid-run. A probe reports what it observed instead of correcting this declaration, because the declaration is the user's.
       *
       * @minItems 1
       */
      capabilities: ["text" | "images" | "reasoning" | "tools", ...("text" | "images" | "reasoning" | "tools")[]];
      /**
       * A floor higher than the product-wide 14 px, where a service demands one. The effective floor is the larger of the two and is applied where the image is attached, so the user is told by the composer rather than by a failed job.
       */
      minimumImagePixels?: number;
    },
    ...{
      /**
       * The model identifier the service expects.
       */
      name: string;
      /**
       * What the user sees.
       */
      label: string;
      /**
       * Declared by the user and then checked: a command carrying images routed to a model that does not declare images is refused before the job starts, naming the mapping, rather than discovered as a provider rejection mid-run. A probe reports what it observed instead of correcting this declaration, because the declaration is the user's.
       *
       * @minItems 1
       */
      capabilities: ["text" | "images" | "reasoning" | "tools", ...("text" | "images" | "reasoning" | "tools")[]];
      /**
       * A floor higher than the product-wide 14 px, where a service demands one. The effective floor is the larger of the two and is applied where the image is attached, so the user is told by the composer rather than by a failed job.
       */
      minimumImagePixels?: number;
    }[]
  ];
  /**
   * True for the well-known providers that ship with the product pre-filled. They are ordinary profiles: the user may edit, duplicate or delete them, and nothing in the product treats them as more trustworthy than one the user typed.
   */
  builtIn: boolean;
}


export const PROVIDER_PROFILE_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://desktop-assistant.local/schemas/agent/provider-profile/0.1.0.json",
  "title": "ProviderProfile",
  "description": "Normative shape of a provider profile for agent/contracts/provider-profile@0.1.0, and what the settings surface validates against before it saves. A profile is the one descriptor the user writes by hand: where model requests go, which credential opens that door, and which models are on the other side of it. The shape is the reality the embedded path has - a credential per provider and a descriptor for any service speaking a completion dialect the engine implements - rather than the interactive provider sign-in the product definition once described, which VERIFIED (spikes/SP-6-pi-sdk/REPORT.md §1 Q5) does not exist off the command-line tool.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "profileVersion",
    "id",
    "displayName",
    "endpoint",
    "credential",
    "models",
    "builtIn"
  ],
  "properties": {
    "profileVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "The version of the provider-profile contract this profile was written against. Profiles replicate between devices that update at different times, so this is a real mixed-version window: a newer build reads an older profile unchanged, and an older build meeting a newer version refuses to use the profile (PROFILE_VERSION_AHEAD) rather than reading around what it does not recognise."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$"
    },
    "displayName": {
      "type": "string",
      "minLength": 1
    },
    "endpoint": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "address",
        "dialect"
      ],
      "properties": {
        "address": {
          "type": "string",
          "pattern": "^https://",
          "description": "Absolute https address of the service, and the destination of model requests only: it never resolves a tool, never fetches code, and never receives connector data that is not part of the request it serves. A mistyped address therefore exposes the credential configured for this profile and nothing beyond it. Not https is ADDRESS_INVALID, refused at save."
        },
        "dialect": {
          "enum": [
            "openai-completions",
            "anthropic-messages",
            "google-generative"
          ],
          "description": "A completion dialect the embedded engine implements. Anything else is DIALECT_UNSUPPORTED, refused at save so the failure reaches the person who can fix it at the moment they can fix it."
        },
        "headers": {
          "type": "object",
          "description": "Extra request headers. A value that is a credential is stored by reference and never inline."
        }
      }
    },
    "credential": {
      "type": "string",
      "pattern": "^provider:[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$",
      "description": "A key into operating-system secure storage under platform/contracts/secure-storage@0.1.0, never the secret itself (INV-AG-08). The pattern is what refuses a profile carrying its own secret, and that refusal matters more than it looks: a profile replicates to the account, so a secret written here would be a secret the user never chose to replicate."
    },
    "models": {
      "type": "array",
      "minItems": 1,
      "description": "The models this profile offers. A profile offering none has nothing to route to, so the member is required rather than defaulted.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "name",
          "label",
          "capabilities"
        ],
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "description": "The model identifier the service expects."
          },
          "label": {
            "type": "string",
            "minLength": 1,
            "description": "What the user sees."
          },
          "capabilities": {
            "type": "array",
            "minItems": 1,
            "items": {
              "enum": [
                "text",
                "images",
                "reasoning",
                "tools"
              ]
            },
            "uniqueItems": true,
            "description": "Declared by the user and then checked: a command carrying images routed to a model that does not declare images is refused before the job starts, naming the mapping, rather than discovered as a provider rejection mid-run. A probe reports what it observed instead of correcting this declaration, because the declaration is the user's."
          },
          "minimumImagePixels": {
            "type": "integer",
            "minimum": 14,
            "description": "A floor higher than the product-wide 14 px, where a service demands one. The effective floor is the larger of the two and is applied where the image is attached, so the user is told by the composer rather than by a failed job."
          }
        }
      }
    },
    "builtIn": {
      "type": "boolean",
      "description": "True for the well-known providers that ship with the product pre-filled. They are ordinary profiles: the user may edit, duplicate or delete them, and nothing in the product treats them as more trustworthy than one the user typed."
    }
  }
} as const;
