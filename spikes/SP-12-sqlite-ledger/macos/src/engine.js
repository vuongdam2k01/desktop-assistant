const { createDatabase } = require('./db');
const { LedgerRepository } = require('./ledger');
const { JobRepository } = require('./job-repository');
const { MockNotionService } = require('./mock-notion');
const crypto = require('node:crypto');

class ToolExecutionEngine {
  constructor({ dbPath, notionStatePath, crashPoint = null, logFn = console.log }) {
    this.db = createDatabase(dbPath);
    this.ledger = new LedgerRepository(this.db);
    this.jobs = new JobRepository(this.db);
    this.notion = new MockNotionService(notionStatePath);
    this.crashPoint = crashPoint ? String(crashPoint) : null;
    this.log = logFn;
  }

  _maybeCrash(point, description) {
    if (this.crashPoint === String(point)) {
      this.log(`💥 [CRASH INJECTOR] TRIGGERING SIGKILL at Point ${point}: ${description}`);
      this.log(`💥 Process PID ${process.pid} terminating immediately...`);
      // Force immediate process kill with SIGKILL to simulate abrupt crash / power loss
      process.kill(process.pid, 'SIGKILL');
    }
  }

  runJobWithToolCall({
    jobId,
    requestText,
    pageId,
    targetPropertyUpdate,
    approvalMode = 'smart'
  }) {
    this.log(`\n▶ [ENGINE] Starting Job ${jobId} (Mode: ${approvalMode}, CrashPoint: ${this.crashPoint || 'NONE'})...`);

    // 1. Create or get Job
    let job = this.jobs.getJob(jobId);
    if (!job) {
      job = this.jobs.createJob({
        id: jobId,
        originalRequest: requestText,
        approvalMode
      });
      this.log(`✔ [ENGINE] Job ${jobId} created with status 'pending'`);
    }

    // 2. Evaluate Approval Hook
    const requiresApproval = approvalMode !== 'off';
    if (requiresApproval) {
      this.log(`⏳ [ENGINE] Approval required for Notion update.`);
      const approvalId = `appr_${jobId}`;
      let approvalReq = this.jobs.getPendingApprovalByJobId(jobId);
      if (!approvalReq) {
        approvalReq = this.jobs.createApprovalRequest({
          id: approvalId,
          jobId,
          toolName: 'notion_update_page',
          toolParams: { pageId, properties: targetPropertyUpdate }
        });
        this.jobs.updateJobStatus(jobId, 'waiting_approval');
        this.log(`✔ [ENGINE] Job ${jobId} transitioned to 'waiting_approval'. Approval card posted.`);
      }

      // CRASH POINT 1: Before approval decision
      this._maybeCrash(1, 'Before user approval decision (Job in waiting_approval)');

      // Simulate User Approving
      this.log(`👤 [USER ACTION] User approves tool execution for Job ${jobId}.`);
      this.jobs.updateApprovalRequest(approvalId, 'approved', 'user');

      // Record approval decision in ledger
      this.ledger.appendRecord({
        jobId,
        type: 'approval',
        tool: 'notion_update_page',
        args: { approvalId, decision: 'approved', decidedBy: 'user' },
        timestamp: new Date().toISOString()
      });
      this.jobs.updateJobStatus(jobId, 'running');
      this.log(`✔ [ENGINE] Approval recorded. Job ${jobId} set to 'running'.`);

      // CRASH POINT 2: After approval recorded, BEFORE intent is written
      this._maybeCrash(2, 'After approval recorded, BEFORE tool_intent is written');
    }

    // 3. Pre-execution: Read snapshot and prepare Intent
    this.log(`🔍 [ENGINE] Fetching pre-execution snapshot from Notion for ${pageId}...`);
    const preSnapshot = this.notion.getPage(pageId);
    const correlationId = `corr_${crypto.randomUUID()}`;

    this.log(`📝 [ENGINE] Committing 'tool_intent' to SQLite Ledger (Correlation: ${correlationId})...`);
    // Ghi ledger TRƯỚC khi gọi API (NFR-RL-03 fail-closed)
    this.ledger.appendRecord({
      jobId,
      type: 'tool_intent',
      tool: 'notion_update_page',
      args: { pageId, targetProperties: targetPropertyUpdate },
      snapshotBefore: preSnapshot.properties,
      correlationId,
      timestamp: new Date().toISOString()
    });
    this.log(`✔ [ENGINE] 'tool_intent' successfully committed to WAL.`);

    // CRASH POINT 3: After intent committed to ledger, BEFORE external API call
    this._maybeCrash(3, 'After tool_intent committed, BEFORE external API call (fetch)');

    // 4. External API Call
    this.log(`🌐 [ENGINE] Calling external Notion API updatePage(${pageId})...`);
    const updatedPage = this.notion.updatePage(pageId, targetPropertyUpdate);
    this.log(`✔ [ENGINE] External Notion API call returned HTTP 200 OK.`);

    // CRASH POINT 4: After API call succeeds, BEFORE tool_result committed to ledger
    this._maybeCrash(4, 'After external API call succeeded, BEFORE tool_result written to ledger');

    // 5. Post-execution: Record Result in ledger
    this.log(`📝 [ENGINE] Committing 'tool_result' to SQLite Ledger...`);
    const postSnapshot = this.notion.getPage(pageId);
    const compensatingAction = {
      tool: 'notion_update_page',
      args: {
        pageId,
        properties: preSnapshot.properties
      }
    };

    this.ledger.appendRecord({
      jobId,
      type: 'tool_result',
      tool: 'notion_update_page',
      result: { success: true, pageId, status: 'updated' },
      snapshotBefore: preSnapshot.properties,
      snapshotAfter: postSnapshot.properties,
      isReversible: 1,
      compensatingAction,
      correlationId,
      timestamp: new Date().toISOString()
    });
    this.log(`✔ [ENGINE] 'tool_result' successfully committed to WAL.`);

    // CRASH POINT 5: After tool_result committed, BEFORE Job marked 'completed'
    this._maybeCrash(5, 'After tool_result committed, BEFORE job status marked completed');

    // 6. Complete Job
    this.jobs.updateJobStatus(jobId, 'completed', 'Notion page status updated successfully');
    this.log(`🎉 [ENGINE] Job ${jobId} marked as 'completed'. Execution finished.`);
    return {
      status: 'completed',
      jobId
    };
  }
}

module.exports = {
  ToolExecutionEngine
};
