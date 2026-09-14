// Generated from pet-pack-store.sql

export interface PetPackRow {
  pack_id: string;
  pack_version: string;
  provenance: string;
  manifest: string;
  target_contract_major: number;
  state: string;
  asset_digest: string;
  asset_size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface PetPackSelectionRow {
  id: number;
  pack_id: string;
  selected_at: string;
}

export interface PetPackBoundCapabilityRow {
  pack_id: string;
  capability: string;
  from_pack: number;
}
