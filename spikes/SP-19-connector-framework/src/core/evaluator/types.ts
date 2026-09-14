/**
 * SP-8 Rule IR v0: TypeScript Definitions
 * 
 * Closed, deterministic Intermediate Representation for Desktop Assistant Hard Gate.
 * Designed to represent all 20 rule patterns from SP-2 (R-01..R-20) and FR-AP-10 hardline rules.
 */

export type RuleAction = "APPROVAL" | "DENY" | "ALLOW";

export type LogicKind = "and" | "or" | "not";

export type LeafPredicateKind =
  | "tool"
  | "target_scope"
  | "property"
  | "ownership"
  | "threshold"
  | "temporal"
  | "irreversible"
  | "permission";

export interface AndPredicate {
  kind: "and";
  predicates: PredicateNode[];
}

export interface OrPredicate {
  kind: "or";
  predicates: PredicateNode[];
}

export interface NotPredicate {
  kind: "not";
  predicate: PredicateNode;
}

export interface ToolPredicate {
  kind: "tool";
  tool_name?: string | string[];
  connector?: string | string[];
}

export interface TargetScopePredicate {
  kind: "target_scope";
  target_type?: "database" | "page" | "block" | "schema" | "workspace";
  database_id?: string | { in: string[] } | { eq: string };
  page_id?: string | { in: string[] } | { eq: string };
  ancestor_ids?: { contains: string } | { contains_any: string[] };
}

export interface PropertyPredicate {
  kind: "property";
  changed_properties?: {
    contains?: string;
    contains_any?: string[];
    not_empty_after_excluding?: string[]; // e.g. changed_properties \ {'Status'} != empty
  };
  property_transition?: {
    property: string;
    from?: unknown;
    to?: unknown;
    to_in?: unknown[];
    to_not_in?: unknown[];
    to_matches?: string; // regex pattern string, e.g. "(?:^zzz|ignore|trash|deleted|bỏ)"
  };
  remove_property?: boolean | string | { in: string[] };
}

export interface OwnershipPredicate {
  kind: "ownership";
  created_by?: {
    in?: string[];
    not_in?: string[]; // e.g. not_in: ["current_user", "app_bot"]
  };
  assignee?: {
    contains?: string;
    not_contains?: string;
    in?: string[];
    not_in?: string[];
    not_equal_to_current_user?: boolean;
  };
}

export type ThresholdMetric =
  | "job_cumulative_writes"
  | "job_deadline_changes"
  | "job_distinct_pages"
  | "calendar_day_creates";

export type ThresholdOperator = "gt" | "gte" | "eq";

export interface ThresholdPredicate {
  kind: "threshold";
  metric: ThresholdMetric;
  operator: ThresholdOperator;
  value: number;
}

export interface TemporalPredicate {
  kind: "temporal";
  time_window?: {
    not_between: [string, string]; // "HH:mm", e.g. ["08:00", "18:00"]
  };
  days_of_week?: {
    in: Array<"Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday">;
  };
}

export interface IrreversiblePredicate {
  kind: "irreversible";
  is_irreversible: boolean;
}

export interface PermissionPredicate {
  kind: "permission";
  changes_permission: boolean;
}

export type LeafPredicate =
  | ToolPredicate
  | TargetScopePredicate
  | PropertyPredicate
  | OwnershipPredicate
  | ThresholdPredicate
  | TemporalPredicate
  | IrreversiblePredicate
  | PermissionPredicate;

export type PredicateNode =
  | AndPredicate
  | OrPredicate
  | NotPredicate
  | LeafPredicate;

export interface RuleIR {
  id: string;
  name: string;
  description?: string;
  action: RuleAction;
  priority: number; // Higher number = evaluated earlier. DENY rules default to >= 1000
  predicate: PredicateNode;
}

export interface RuleCatalog {
  version: "0.1.0";
  rules: RuleIR[];
}

/**
 * Scoped approval token for FR-AP-11 ("Approve loại thao tác này trong job này").
 * Explicitly binds to a specific rule, tool, and optional target scope to prevent evasion (A-19).
 */
export interface ActiveJobApproval {
  jobId: string;
  ruleId: string;
  toolName: string;
  databaseId?: string;
  createdAt: string;
}
