const { createDatabase } = require('./db');
const { LedgerRepository } = require('./ledger');
const { JobRepository } = require('./job-repository');
const { MockNotionService } = require('./mock-notion');
const { CardQueue } = require('./card-queue');

class RecoveryManager {
  constructor({ dbPath, notionStatePath, logFn = console.log }) {
    this.db = createDatabase(dbPath);
    this.ledger = new LedgerRepository(this.db);
    this.jobs = new JobRepository(this.db);
    this.notion = new MockNotionService(notionStatePath);
    this.cardQueue = new CardQueue();
    this.log = logFn;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  recover() {
    this.log(`\n======================================================`);
    this.log(`🔄 [RECOVERY MANAGER] Starting crash recovery protocol...`);
    this.log(`======================================================`);

    // 1. Fetch active (uncompleted) jobs
    const activeJobs = this.jobs.getActiveJobs();
    this.log(`📋 Found ${activeJobs.length} active/unfinalized job(s) in SQLite database.`);

    const recoveryReport = {
      jobsRecovered: [],
      cardsEnqueued: [],
      unmatchedIntentsResolved: 0
    };

    for (const job of activeJobs) {
      this.log(`\n🔍 Inspecting Job ${job.id} (Status: ${job.status})...`);
      const lastRecord = this.ledger.getLastRecord(job.id);
      this.log(`   Last Ledger Record: ${lastRecord ? `[seq=${lastRecord.seq}, type=${lastRecord.type}]` : 'NONE'}`);

      // Check for pending approval
      if (job.status === 'waiting_approval') {
        const pendingAppr = this.jobs.getPendingApprovalByJobId(job.id);
        if (pendingAppr) {
          this.log(`   📌 Job is waiting for user approval. Re-enqueuing APPROVAL card.`);
          const card = {
            id: `card_${pendingAppr.id}`,
            jobId: job.id,
            type: 'APPROVAL',
            title: `Phê duyệt thao tác Notion: ${pendingAppr.tool_name}`,
            params: JSON.parse(pendingAppr.tool_params),
            createdAt: pendingAppr.created_at
          };
          this.cardQueue.enqueue(card);
          recoveryReport.cardsEnqueued.push(card);
          recoveryReport.jobsRecovered.push({ id: job.id, recoveredStatus: 'waiting_approval' });
          continue;
        }
      }

      // Check for pending ask / waiting_input
      if (job.status === 'waiting_input') {
        this.log(`   📌 Job is waiting for user input. Re-enqueuing ASK card.`);
        const card = {
          id: `card_ask_${job.id}`,
          jobId: job.id,
          type: 'ASK',
          title: `Cần thông tin bổ sung`,
          createdAt: job.updated_at || job.created_at
        };
        this.cardQueue.enqueue(card);
        recoveryReport.cardsEnqueued.push(card);
        recoveryReport.jobsRecovered.push({ id: job.id, recoveredStatus: 'waiting_input' });
        continue;
      }

      // Handle running or pending jobs
      if (job.status === 'running' || job.status === 'pending') {
        // Find if there is an unmatched tool_intent
        const unmatchedIntents = this.ledger.getUnmatchedIntents().filter(i => i.job_id === job.id);

        if (unmatchedIntents.length > 0) {
          const intent = unmatchedIntents[0];
          this.log(`   ⚠️ Found UNMATCHED 'tool_intent' [correlationId=${intent.correlation_id}]!`);
          this.log(`   🔎 Conducting external reconciliation against Notion API...`);

          const pageId = intent.args.pageId;
          const targetProps = intent.args.targetProperties;
          const snapshotBefore = intent.snapshot_before;

          const currentPage = this.notion.getPage(pageId);
          const currentProps = currentPage.properties;

          // Compare current properties with target and before
          const targetStatusName = targetProps.Status && targetProps.Status.status ? targetProps.Status.status.name : null;
          const currentStatusName = currentProps.Status && currentProps.Status.status ? currentProps.Status.status.name : null;
          const beforeStatusName = snapshotBefore && snapshotBefore.Status && snapshotBefore.Status.status ? snapshotBefore.Status.status.name : null;

          this.log(`   📊 State Comparison:`);
          this.log(`      - Snapshot Before Status : '${beforeStatusName}'`);
          this.log(`      - Current Notion Status  : '${currentStatusName}'`);
          this.log(`      - Target Intended Status : '${targetStatusName}'`);

          if (currentStatusName === targetStatusName) {
            // Case: Process died AFTER API call succeeded, BEFORE tool_result was written (Crash Point 4)
            this.log(`   ✅ RECONCILIATION RESULT: External call SUCCEEDED before crash!`);
            this.log(`   📝 Committing reconciled 'tool_result' to ledger...`);

            this.ledger.appendRecord({
              jobId: job.id,
              type: 'tool_result',
              tool: intent.tool,
              result: { success: true, reconciled_after_crash: true },
              snapshotBefore,
              snapshotAfter: currentProps,
              isReversible: 1,
              compensatingAction: {
                tool: intent.tool,
                args: { pageId, properties: snapshotBefore }
              },
              correlationId: intent.correlation_id,
              timestamp: new Date().toISOString()
            });

            this.jobs.updateJobStatus(job.id, 'completed', 'Reconciled and completed after crash recovery');
            const card = {
              id: `card_result_${job.id}`,
              jobId: job.id,
              type: 'RESULT',
              title: `Hoàn thành (Đã đối soát sau crash)`,
              createdAt: new Date().toISOString()
            };
            this.cardQueue.enqueue(card);
            recoveryReport.cardsEnqueued.push(card);
            recoveryReport.unmatchedIntentsResolved++;
            recoveryReport.jobsRecovered.push({ id: job.id, recoveredStatus: 'completed' });
          } else {
            // Case: Process died BEFORE API call was made (Crash Point 3)
            this.log(`   ℹ️ RECONCILIATION RESULT: External call was NEVER EXECUTED before crash.`);
            this.log(`   🛡️ Recording crash info to ledger (fail-closed integrity preserved).`);

            this.ledger.appendRecord({
              jobId: job.id,
              type: 'error',
              tool: intent.tool,
              args: { correlationId: intent.correlation_id },
              result: { error: 'Process crashed before external API execution. State clean, safe to resume or retry.' },
              correlationId: intent.correlation_id,
              timestamp: new Date().toISOString()
            });

            // Per NFR-RL-01: "hoặc resume an toàn hoặc chuyển failed kèm phần đã làm; KHÔNG bao giờ mất tích job"
            this.jobs.updateJobStatus(job.id, 'failed', 'Interrupted by crash before external execution');
            const card = {
              id: `card_err_${job.id}`,
              jobId: job.id,
              type: 'ERROR',
              title: `Job bị gián đoạn trước khi gọi API (Đã khôi phục an toàn)`,
              createdAt: new Date().toISOString()
            };
            this.cardQueue.enqueue(card);
            recoveryReport.cardsEnqueued.push(card);
            recoveryReport.unmatchedIntentsResolved++;
            recoveryReport.jobsRecovered.push({ id: job.id, recoveredStatus: 'failed' });
          }
        } else if (lastRecord && lastRecord.type === 'tool_result') {
          // Crash Point 5: Tool result was recorded, but job status update was interrupted
          this.log(`   ✅ Last record is 'tool_result'. Advancing job status to 'completed'.`);
          this.jobs.updateJobStatus(job.id, 'completed', 'Job completed successfully');
          const card = {
            id: `card_result_${job.id}`,
            jobId: job.id,
            type: 'RESULT',
            title: `Hoàn thành`,
            createdAt: lastRecord.timestamp
          };
          this.cardQueue.enqueue(card);
          recoveryReport.cardsEnqueued.push(card);
          recoveryReport.jobsRecovered.push({ id: job.id, recoveredStatus: 'completed' });
        } else if (lastRecord && lastRecord.type === 'approval') {
          // Crash Point 2: Approved, but died before intent write
          this.log(`   ℹ️ Job was approved before crash. Resetting to 'waiting_approval' or re-triggering intent.`);
          this.jobs.updateJobStatus(job.id, 'waiting_approval');
          const card = {
            id: `card_appr_${job.id}`,
            jobId: job.id,
            type: 'APPROVAL',
            title: `Yêu cầu phê duyệt lại sau crash`,
            createdAt: new Date().toISOString()
          };
          this.cardQueue.enqueue(card);
          recoveryReport.cardsEnqueued.push(card);
          recoveryReport.jobsRecovered.push({ id: job.id, recoveredStatus: 'waiting_approval' });
        } else {
          // General unhandled running job
          this.jobs.updateJobStatus(job.id, 'failed', 'Interrupted by crash');
          const card = {
            id: `card_err_${job.id}`,
            jobId: job.id,
            type: 'ERROR',
            title: `Job bị gián đoạn do crash hệ thống`,
            createdAt: new Date().toISOString()
          };
          this.cardQueue.enqueue(card);
          recoveryReport.cardsEnqueued.push(card);
          recoveryReport.jobsRecovered.push({ id: job.id, recoveredStatus: 'failed' });
        }
      }
    }

    this.log(`\n======================================================`);
    this.log(`🗂️ RECONSTRUCTED CARD QUEUE (Priority Order per PRD A.4):`);
    const allCards = this.cardQueue.getAll();
    allCards.forEach((c, idx) => {
      this.log(`   [${idx + 1}] Type: ${c.type.padEnd(8)} | Job: ${c.jobId.padEnd(12)} | Title: ${c.title}`);
    });
    this.log(`======================================================\n`);

    return {
      recoveryReport,
      cardQueue: allCards
    };
  }
}

module.exports = {
  RecoveryManager
};
