/**
 * Job & Approval Request Repository (PRD §12.1)
 */
class JobRepository {
  constructor(db) {
    this.db = db;

    this.createJobStmt = this.db.prepare(`
      INSERT INTO jobs (id, original_request, status, approval_mode, summary_result, undo_of, created_at, updated_at)
      VALUES (@id, @originalRequest, @status, @approvalMode, @summaryResult, @undoOf, @createdAt, @updatedAt)
    `);

    this.updateStatusStmt = this.db.prepare(`
      UPDATE jobs
      SET status = @status,
          summary_result = COALESCE(@summaryResult, summary_result),
          updated_at = @updatedAt
      WHERE id = @id
    `);

    this.getJobStmt = this.db.prepare(`
      SELECT * FROM jobs WHERE id = ?
    `);

    this.getActiveJobsStmt = this.db.prepare(`
      SELECT * FROM jobs
      WHERE status IN ('pending', 'running', 'waiting_approval', 'waiting_input')
      ORDER BY created_at ASC
    `);

    this.createApprovalStmt = this.db.prepare(`
      INSERT INTO approval_requests (id, job_id, tool_name, tool_params, status, decided_by, decided_at, created_at)
      VALUES (@id, @jobId, @toolName, @toolParams, 'pending', NULL, NULL, @createdAt)
    `);

    this.updateApprovalStmt = this.db.prepare(`
      UPDATE approval_requests
      SET status = @status, decided_by = @decidedBy, decided_at = @decidedAt
      WHERE id = @id
    `);

    this.getPendingApprovalStmt = this.db.prepare(`
      SELECT * FROM approval_requests WHERE job_id = ? AND status = 'pending' LIMIT 1
    `);

    this.getAllPendingApprovalsStmt = this.db.prepare(`
      SELECT * FROM approval_requests WHERE status = 'pending' ORDER BY created_at ASC
    `);
  }

  createJob({ id, originalRequest, approvalMode = 'smart', undoOf = null }) {
    const now = new Date().toISOString();
    this.createJobStmt.run({
      id,
      originalRequest: typeof originalRequest === 'string' ? originalRequest : JSON.stringify(originalRequest),
      status: 'pending',
      approvalMode,
      summaryResult: null,
      undoOf,
      createdAt: now,
      updatedAt: now
    });
    return this.getJob(id);
  }

  updateJobStatus(id, status, summaryResult = null) {
    const now = new Date().toISOString();
    this.updateStatusStmt.run({
      id,
      status,
      summaryResult: summaryResult ? (typeof summaryResult === 'string' ? summaryResult : JSON.stringify(summaryResult)) : null,
      updatedAt: now
    });
    return this.getJob(id);
  }

  getJob(id) {
    return this.getJobStmt.get(id);
  }

  getActiveJobs() {
    return this.getActiveJobsStmt.all();
  }

  createApprovalRequest({ id, jobId, toolName, toolParams }) {
    const now = new Date().toISOString();
    this.createApprovalStmt.run({
      id,
      jobId,
      toolName,
      toolParams: typeof toolParams === 'string' ? toolParams : JSON.stringify(toolParams),
      createdAt: now
    });
    return this.getPendingApprovalStmt.get(jobId);
  }

  updateApprovalRequest(id, status, decidedBy = 'user') {
    const now = new Date().toISOString();
    this.updateApprovalStmt.run({
      id,
      status,
      decidedBy,
      decidedAt: now
    });
  }

  getPendingApprovalByJobId(jobId) {
    return this.getPendingApprovalStmt.get(jobId);
  }

  getAllPendingApprovals() {
    return this.getAllPendingApprovalsStmt.all();
  }
}

module.exports = {
  JobRepository
};
