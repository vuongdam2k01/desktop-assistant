const { ToolExecutionEngine } = require('./engine');

const dbPath = process.env.DB_PATH;
const notionStatePath = process.env.NOTION_STATE_PATH;
const crashPoint = process.env.CRASH_POINT;
const jobId = process.env.JOB_ID || 'job_default';
const pageId = process.env.PAGE_ID || 'page_task_101';

console.log(`[WORKER ${process.pid}] Started with CrashPoint=${crashPoint}, JobId=${jobId}`);

const engine = new ToolExecutionEngine({
  dbPath,
  notionStatePath,
  crashPoint,
  logFn: console.log
});

try {
  const result = engine.runJobWithToolCall({
    jobId,
    requestText: 'Chuyển trạng thái task sang In Progress',
    pageId,
    targetPropertyUpdate: {
      Status: { id: 'status', type: 'status', status: { name: 'In Progress', color: 'yellow' } }
    },
    approvalMode: 'smart'
  });
  console.log(`[WORKER ${process.pid}] Job execution completed normally:`, result);
  process.exit(0);
} catch (err) {
  console.error(`[WORKER ${process.pid}] Fatal error:`, err);
  process.exit(1);
}
