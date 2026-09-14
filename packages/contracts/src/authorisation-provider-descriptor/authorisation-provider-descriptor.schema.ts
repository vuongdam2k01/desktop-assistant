export interface AuthorisationProviderDescriptor {
  providerId: string;
  version: string;
  name: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  clientIdRef: string;
  clientSecretRef: string;
  tokenAuthMethod: "credentials-in-body" | "credentials-in-header";
  usesProofKey: boolean;
  defaultScopes: string[];
  extraAuthorizeParams?: {
    [k: string]: string;
  };
  revokeEndpoint?: string;
  status?: "offered" | "withheld";
}


export const AUTHORISATION_PROVIDER_DESCRIPTOR_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AuthorisationProviderDescriptor",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "providerId",
    "version",
    "name",
    "authorizeEndpoint",
    "tokenEndpoint",
    "clientIdRef",
    "clientSecretRef",
    "tokenAuthMethod",
    "usesProofKey",
    "defaultScopes"
  ],
  "properties": {
    "providerId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,31}$"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "authorizeEndpoint": {
      "type": "string",
      "pattern": "^https://"
    },
    "tokenEndpoint": {
      "type": "string",
      "pattern": "^https://"
    },
    "clientIdRef": {
      "type": "string",
      "minLength": 1
    },
    "clientSecretRef": {
      "type": "string",
      "minLength": 1
    },
    "tokenAuthMethod": {
      "type": "string",
      "enum": [
        "credentials-in-body",
        "credentials-in-header"
      ]
    },
    "usesProofKey": {
      "type": "boolean"
    },
    "defaultScopes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "extraAuthorizeParams": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      }
    },
    "revokeEndpoint": {
      "type": "string",
      "pattern": "^https://"
    },
    "status": {
      "type": "string",
      "enum": [
        "offered",
        "withheld"
      ]
    }
  }
} as const;
