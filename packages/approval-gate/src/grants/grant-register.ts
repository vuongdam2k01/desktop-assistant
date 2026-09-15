import type { ScopedApproval } from '../types.js';

/**
 * In-memory register for job-scoped approval tokens.
 * A grant strictly binds to the 4-tuple: (jobId, ruleId, tool, objectScope).
 * Automatically expires and gets purged when the job completes.
 */
export class GrantRegister {
  // Map from jobId to array of ScopedApproval
  readonly #grantsByJob = new Map<string, ScopedApproval[]>();

  /**
   * Adds a job-scoped approval token.
   */
  addGrant(grant: ScopedApproval): void {
    const list = this.#grantsByJob.get(grant.jobId) ?? [];
    // Check duplicates before adding
    const exists = list.some(
      (g) =>
        g.ruleId === grant.ruleId &&
        g.tool === grant.tool &&
        g.objectScope.type === grant.objectScope.type &&
        g.objectScope.id === grant.objectScope.id
    );
    if (!exists) {
      list.push(grant);
      this.#grantsByJob.set(grant.jobId, list);
    }
  }

  /**
   * Checks if an exact (jobId, ruleId, tool, objectScope) match exists.
   */
  hasGrant(
    jobId: string,
    ruleId: string,
    tool: string,
    objectScope?: { type: string; id: string }
  ): boolean {
    const list = this.#grantsByJob.get(jobId);
    if (!list || list.length === 0) return false;

    return list.some((g) => {
      if (g.ruleId !== ruleId) return false;
      if (g.tool !== tool) return false;
      if (objectScope) {
        if (g.objectScope.type !== objectScope.type || g.objectScope.id !== objectScope.id) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Retrieves all active grants for a job.
   */
  getGrantsForJob(jobId: string): readonly ScopedApproval[] {
    return this.#grantsByJob.get(jobId) ?? [];
  }

  /**
   * Revokes and cleans up all grants when a job terminates.
   */
  revokeGrantsForJob(jobId: string): void {
    this.#grantsByJob.delete(jobId);
  }

  /**
   * Clear all active grants across all jobs.
   */
  clear(): void {
    this.#grantsByJob.clear();
  }
}
