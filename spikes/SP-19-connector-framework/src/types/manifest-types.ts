/**
 * Connector Framework Manifest Types (v0 for M1)
 * Aligns with PRD §10.10, FR-CF-01, FR-CF-04, FR-CF-05, FR-CF-07, FR-AP-05, FR-NT-04/05
 */

export type AuthType = "oauth2" | "bearer_token" | "api_key";

export interface EndpointDefinition {
  authorize_url?: string;
  token_url?: string;
  revoke_url?: string;
  api_base_url?: string;
}

export interface CapabilityDefinition {
  name: string;
  description: string;
  default_scopes?: string[];
}

/**
 * FR-CF-04: Scope profile per release channel (e.g. BYO vs Central distribution)
 * Maps profile name -> capability ID -> array of scopes
 */
export type ScopeProfiles = Record<string, Record<string, string[]>>;

export interface AuthConfiguration {
  type: AuthType;
  endpoints: EndpointDefinition;
  pkce?: boolean;
  capabilities: Record<string, CapabilityDefinition>;
  scope_profiles?: ScopeProfiles;
}

export type ToolCategory = "read" | "write";

export interface SnapshotContract {
  enabled: boolean;
  target_id_param?: string;
  operation?: string;
  /**
   * Sanitization rules per SP-1: read-only fields to exclude from snapshot before compensation
   * (e.g. formula, rollup, created_time, created_by, last_edited_time, last_edited_by)
   */
  sanitization?: string[];
}

export interface CompensationContract {
  type: "static_formula" | "none";
  formula_type?: "restore_properties" | "archive_page" | "unarchive_page" | "custom";
  target_operation?: string;
  notes?: string;
}

export interface ParameterPropertySchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
  items?: ParameterPropertySchema;
  properties?: Record<string, ParameterPropertySchema>;
  default?: any;
}

export interface ParameterSchema {
  type: "object";
  properties: Record<string, ParameterPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  category: ToolCategory;
  required_capability?: string;
  parameters: ParameterSchema;

  // Contracts for write operations (FR-CF-01, FR-NT-04, FR-NT-05)
  snapshot?: SnapshotContract;
  compensation?: CompensationContract;

  // Security & governance flags (FR-CF-07, FR-AP-05)
  irreversible?: boolean;
  changes_permission?: boolean;
}

export interface ConnectorManifest {
  schema_version: "v0" | "1.0.0";
  id: string;
  name: string;
  version: string;
  icon: string;
  description: string;
  auth: AuthConfiguration;
  tools: ToolDefinition[];
}

export interface ManifestMetadata {
  connectorId: string;
  connectorName: string;
  toolId: string;
  category: ToolCategory;
  snapshot?: SnapshotContract;
  compensation?: CompensationContract;
  isIrreversible: boolean;
  changesPermission: boolean;
  requiredCapability?: string;
}

export type ConnectorHealthStatus =
  | "connected"
  | "token_expired"
  | "permission_error"
  | "revoked"
  | "disconnected"
  | "error";

export interface ConnectorStatusResult {
  status: ConnectorHealthStatus;
  canRefresh?: boolean;
  error?: string;
  checkedAt: string;
}

export interface ConnectorAuthCredentials {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  extra?: Record<string, any>;
}
