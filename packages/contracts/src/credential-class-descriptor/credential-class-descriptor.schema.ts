export interface CredentialClassDescriptor {
  /**
   * Stable identifier of the class. Entries derive their class from their key, so this never changes.
   */
  class_id: string;
  /**
   * Semver of this descriptor. A change to erase_on or restoration_route is a major change.
   */
  version: string;
  /**
   * Human-recognisable name, used where the product states what sign-out or account deletion erases.
   */
  name: string;
  /**
   * Key shape claimed by this class, in the segments of the naming scheme. Patterns may not overlap.
   */
  key_pattern: string;
  /**
   * Capability path accountable for writing and reading entries of this class.
   */
  owner: string;
  /**
   * Whether entries of this class belong to the account's replicated set.
   */
  replicates: boolean;
  /**
   * How an unreadable entry of this class is replaced. Constrained by INV-PLT-06.
   */
  restoration_route: "replication" | "account_sign_in";
  /**
   * Events that erase entries of this class. sign_out, device_revocation, account_deletion and uninstall are mandatory for every class.
   *
   * @minItems 4
   */
  erase_on: [
    "connector_disconnect" | "sign_out" | "device_revocation" | "account_deletion" | "uninstall",
    "connector_disconnect" | "sign_out" | "device_revocation" | "account_deletion" | "uninstall",
    "connector_disconnect" | "sign_out" | "device_revocation" | "account_deletion" | "uninstall",
    "connector_disconnect" | "sign_out" | "device_revocation" | "account_deletion" | "uninstall",
    ...("connector_disconnect" | "sign_out" | "device_revocation" | "account_deletion" | "uninstall")[]
  ];
  /**
   * Exhaustive list of non-secret fields the class may hold beside the ciphertext, readable without decrypting.
   */
  metadata_fields: string[];
  /**
   * Optional size range entries are expected to occupy, used for store sizing.
   */
  expected_size?: string;
  /**
   * Optional rationale for a reader of the registry who did not write the class.
   */
  notes?: string;
}


export const CREDENTIAL_CLASS_DESCRIPTOR_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CredentialClassDescriptor",
  "type": "object",
  "required": [
    "class_id",
    "version",
    "name",
    "key_pattern",
    "owner",
    "replicates",
    "restoration_route",
    "erase_on",
    "metadata_fields"
  ],
  "additionalProperties": false,
  "properties": {
    "class_id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*$",
      "description": "Stable identifier of the class. Entries derive their class from their key, so this never changes."
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semver of this descriptor. A change to erase_on or restoration_route is a major change."
    },
    "name": {
      "type": "string",
      "description": "Human-recognisable name, used where the product states what sign-out or account deletion erases."
    },
    "key_pattern": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*:.+$",
      "description": "Key shape claimed by this class, in the segments of the naming scheme. Patterns may not overlap."
    },
    "owner": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Capability path accountable for writing and reading entries of this class."
    },
    "replicates": {
      "type": "boolean",
      "description": "Whether entries of this class belong to the account's replicated set."
    },
    "restoration_route": {
      "type": "string",
      "enum": [
        "replication",
        "account_sign_in"
      ],
      "description": "How an unreadable entry of this class is replaced. Constrained by INV-PLT-06."
    },
    "erase_on": {
      "type": "array",
      "minItems": 4,
      "items": {
        "type": "string",
        "enum": [
          "connector_disconnect",
          "sign_out",
          "device_revocation",
          "account_deletion",
          "uninstall"
        ]
      },
      "description": "Events that erase entries of this class. sign_out, device_revocation, account_deletion and uninstall are mandatory for every class."
    },
    "metadata_fields": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Exhaustive list of non-secret fields the class may hold beside the ciphertext, readable without decrypting."
    },
    "expected_size": {
      "type": "string",
      "description": "Optional size range entries are expected to occupy, used for store sizing."
    },
    "notes": {
      "type": "string",
      "description": "Optional rationale for a reader of the registry who did not write the class."
    }
  }
} as const;
