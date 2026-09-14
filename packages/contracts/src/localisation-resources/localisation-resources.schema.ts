/**
 * Shape of one language's resource bundle, for uix/contracts/localisation-resources@0.1.0. Every interface string is resolved through a bundle rather than written at the point of use, so that Vietnamese and English are equal from the first release and a third language is a bundle rather than a sweep through the interface. What this file cannot express is stated by the contract document: that a key names the place a string is used and never its current wording, that resolution falls back to English and then to the visible key, and that agent-generated text and the hard data inside an approval request are outside the bundle entirely.
 */
export interface ResourceBundle {
  /**
   * The language tag this bundle carries. The two shipped tags are 'vi' and 'en'; the set is open, because a third language is a bundle rather than a code change.
   */
  language: string;
  /**
   * The resource version this bundle was authored against. A bundle from an older minor version resolves, with the keys added since falling back to English.
   */
  version: string;
  /**
   * Key to entry. A key is stable and describes where the string is used, which is what makes rewording a resource change and never a code change.
   */
  entries: {
    [k: string]: {
      /**
       * The string as shown. Named placeholders are written as {name}; a parameter named here and not supplied at resolution is rendered literally rather than silently dropped.
       */
      message: string;
      /**
       * The plural forms for a message whose wording depends on a count.
       */
      plural?: {
        one: string;
        other: string;
      };
      /**
       * Context for the translator: where the string appears and what it refers to. Never shown to the user.
       */
      description?: string;
    };
  };
}


export const LOCALISATION_RESOURCES_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/uix/localisation-resources/0.1.0.json",
  "title": "ResourceBundle",
  "description": "Shape of one language's resource bundle, for uix/contracts/localisation-resources@0.1.0. Every interface string is resolved through a bundle rather than written at the point of use, so that Vietnamese and English are equal from the first release and a third language is a bundle rather than a sweep through the interface. What this file cannot express is stated by the contract document: that a key names the place a string is used and never its current wording, that resolution falls back to English and then to the visible key, and that agent-generated text and the hard data inside an approval request are outside the bundle entirely.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "language",
    "version",
    "entries"
  ],
  "properties": {
    "language": {
      "type": "string",
      "pattern": "^[a-z]{2}(-[A-Za-z0-9]{2,8})*$",
      "description": "The language tag this bundle carries. The two shipped tags are 'vi' and 'en'; the set is open, because a third language is a bundle rather than a code change."
    },
    "version": {
      "type": "string",
      "description": "The resource version this bundle was authored against. A bundle from an older minor version resolves, with the keys added since falling back to English."
    },
    "entries": {
      "type": "object",
      "description": "Key to entry. A key is stable and describes where the string is used, which is what makes rewording a resource change and never a code change.",
      "propertyNames": {
        "pattern": "^[a-z][a-z0-9]*(\\.[a-z][a-z0-9]*)+$",
        "description": "A dotted path naming the place the string appears, from the widest surface to the element. A key that spells out its own sentence is refused, because rewording would then force a code change."
      },
      "additionalProperties": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "message"
        ],
        "properties": {
          "message": {
            "type": "string",
            "description": "The string as shown. Named placeholders are written as {name}; a parameter named here and not supplied at resolution is rendered literally rather than silently dropped."
          },
          "plural": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "one",
              "other"
            ],
            "description": "The plural forms for a message whose wording depends on a count.",
            "properties": {
              "one": {
                "type": "string"
              },
              "other": {
                "type": "string"
              }
            }
          },
          "description": {
            "type": "string",
            "description": "Context for the translator: where the string appears and what it refers to. Never shown to the user."
          }
        }
      }
    }
  }
} as const;
