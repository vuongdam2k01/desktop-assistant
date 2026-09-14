// Generated from agent-runtime-store.sql

export interface RoleEntryRow {
  role_id: string;
  schema_version: string;
  origin: string;
  source_pack_id: string | null;
  entry_version: string;
  entry: string;
  tier: string;
  may_delegate: number;
  validity: string;
  invalid_field: string | null;
  instructions_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface RoleRegistryDocumentRow {
  id: number;
  schema_version: string;
  state: string;
  evaluated_at: string;
}

export interface SkillCatalogueEntryRow {
  skill_id: string;
  source_id: string;
  origin: string;
  precedence_rank: number;
  in_effect: number;
  applies_to: string;
  hidden: number;
  validity: string;
  invalid_field: string | null;
  package_dir: string;
  content_bytes: number;
  discovered_at: string;
}

export interface SkillEnabledStateRow {
  skill_id: string;
  enabled: number;
  set_at: string;
}

export interface CapabilityPackRow {
  pack_id: string;
  schema_version: string;
  pack_version: string;
  state: string;
  invalid_field: string | null;
  activation_condition: string;
  evidence_reference: string | null;
  evidence_recorded_at: string | null;
  declared_bytes: number;
  updated_at: string;
}
