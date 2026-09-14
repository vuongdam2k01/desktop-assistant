// Generated from rule-representation.sql

export interface RuleRow {
  id: string;
  representation_version: string;
  name: string;
  restatement: string;
  origin: string;
  verdict: string;
  condition_json: string;
  confirmed_at: string;
  updated_at: string;
}

export interface AllowlistEntryRow {
  id: string;
  connector: string;
  tool: string;
  object_type: string;
  object_id: string;
  added_at: string;
}
