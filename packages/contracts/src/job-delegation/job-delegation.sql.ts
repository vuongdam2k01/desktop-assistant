// Generated from job-delegation.sql

export interface JobRow {
  id: string;
}

export interface JobChildLinkRow {
  child_job_id: string;
  parent_job_id: string;
  child_role_id: string;
  assignment: string;
  depth: number;
  created_at: string;
}
