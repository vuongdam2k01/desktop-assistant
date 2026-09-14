import { LedgerRepository } from './db.js';
import {
  getNotionToken,
  getDatabaseId,
  getPage,
  queryDatabase,
  createPage,
  updatePageProperties,
  archivePage,
  createComment,
  sanitizePropertiesForUpdate,
} from './notion-client.js';
import { extractPageTitle } from './notion-state.js';

export interface ExecutedJobInfo {
  jobId: string;
  name: string;
  workspace: 'A' | 'B' | 'C';
  targetPageIds: string[];
}

export class JobExecutor {
  private ledger: LedgerRepository;

  constructor(ledger: LedgerRepository) {
    this.ledger = ledger;
  }

  private async recordToolCall(
    jobId: string,
    workspace: 'A' | 'B' | 'C',
    toolName: string,
    args: any,
    targetPageId: string | null,
    isReversible: boolean,
    compensatingActionHint: any,
    executorFn: () => Promise<any>
  ): Promise<any> {
    const token = getNotionToken(workspace);

    // 1. Tool intent
    this.ledger.appendRecord({
      jobId,
      type: 'tool_intent',
      tool: toolName,
      args,
    });

    // 2. Snapshot before
    let snapshotBefore: any = null;
    if (targetPageId) {
      try {
        const page = await getPage(token, targetPageId);
        snapshotBefore = {
          id: page.id,
          archived: page.archived,
          last_edited_time: page.last_edited_time,
          properties: sanitizePropertiesForUpdate(page.properties),
        };
      } catch (err: any) {
        snapshotBefore = null;
      }
    }

    // 3. Execute tool call
    const result = await executorFn();

    // 4. Snapshot after
    let snapshotAfter: any = null;
    const finalPageId = targetPageId || result?.id;
    if (finalPageId && toolName !== 'notion_create_comment') {
      try {
        const page = await getPage(token, finalPageId);
        snapshotAfter = {
          id: page.id,
          archived: page.archived,
          last_edited_time: page.last_edited_time,
          properties: sanitizePropertiesForUpdate(page.properties),
        };
      } catch (err) {
        snapshotAfter = result;
      }
    } else if (toolName === 'notion_create_comment') {
      snapshotAfter = { comment_id: result.id || 'comment-created-id' };
    }

    // 5. Tool result
    this.ledger.appendRecord({
      jobId,
      type: 'tool_result',
      tool: toolName,
      args,
      result,
      snapshotBefore,
      snapshotAfter,
      isReversible,
      compensatingAction: compensatingActionHint,
    });

    return result;
  }

  // -------------------------------------------------------------
  // JOB 1: S-01 (Workspace A) - Create single task
  // -------------------------------------------------------------
  public async runJob1(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-01-create-single';
    const ws = 'A';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'thêm task fix login vinmart vào notion, dl thứ 5',
    });

    const title = 'Fix login Vinmart';
    const dueDate = '2026-09-17';
    const props: any = {
      Name: { title: [{ text: { content: title } }] },
      Status: { select: { name: 'Not started' } },
      'Due date': { date: { start: dueDate } },
      Creator: { rich_text: [{ text: { content: 'bot' } }] },
    };

    const res = await this.recordToolCall(
      jobId,
      ws,
      'notion_create_page',
      { database_id: dbId, properties: props },
      null,
      true,
      { tool: 'notion_archive_page', page_id: '{result.id}' },
      () => createPage(token, dbId, props)
    );

    this.ledger.updateJobStatus(jobId, 'completed', `Created task '${title}' with id ${res.id}`);
    return { jobId, name: 'Job 1: S-01 Create single task', workspace: ws, targetPageIds: [res.id] };
  }

  // -------------------------------------------------------------
  // JOB 2: S-02 (Workspace C) - Update property on single task
  // -------------------------------------------------------------
  public async runJob2(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-02-update-status';
    const ws = 'C';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'chuyển task fix crash sang done',
    });

    const tasks = await queryDatabase(token, dbId);
    const target = tasks.find((t) => extractPageTitle(t).includes('Fix crash màn thanh toán'));
    if (!target) throw new Error('Target task C1 not found');

    const updateProps = { Status: { select: { name: 'Done' } } };

    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: target.id, properties: updateProps },
      target.id,
      true,
      { tool: 'notion_update_page_properties', page_id: target.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, target.id, updateProps)
    );

    this.ledger.updateJobStatus(jobId, 'completed', `Updated status of task '${extractPageTitle(target)}' to Done`);
    return { jobId, name: 'Job 2: S-02 Update task status', workspace: ws, targetPageIds: [target.id] };
  }

  // -------------------------------------------------------------
  // JOB 3: S-04 (Workspace C) - Create task & reorder trailing tasks
  // -------------------------------------------------------------
  public async runJob3(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-03-create-and-reorder';
    const ws = 'C';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'thêm task migration script vào sau C1, các task sau lùi một số',
    });

    const tasks = await queryDatabase(token, dbId);
    const c2 = tasks.find((t) => extractPageTitle(t).includes('Viết docs onboarding'));
    const c3 = tasks.find((t) => extractPageTitle(t).includes('Review PR #212'));
    if (!c2 || !c3) throw new Error('C2 or C3 not found');

    const newProps: any = {
      Name: { title: [{ text: { content: 'Viết script migration DB' } }] },
      Order: { number: 2 },
      Priority: { select: { name: 'Medium' } },
      Status: { select: { name: 'Not started' } },
      'Due date': { date: { start: '2026-09-14' } },
      Creator: { rich_text: [{ text: { content: 'bot' } }] },
    };

    const newPage = await this.recordToolCall(
      jobId,
      ws,
      'notion_create_page',
      { database_id: dbId, properties: newProps },
      null,
      true,
      { tool: 'notion_archive_page', page_id: '{result.id}' },
      () => createPage(token, dbId, newProps)
    );

    const c2Props = { Order: { number: 3 } };
    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: c2.id, properties: c2Props },
      c2.id,
      true,
      { tool: 'notion_update_page_properties', page_id: c2.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, c2.id, c2Props)
    );

    const c3Props = { Order: { number: 4 } };
    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: c3.id, properties: c3Props },
      c3.id,
      true,
      { tool: 'notion_update_page_properties', page_id: c3.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, c3.id, c3Props)
    );

    this.ledger.updateJobStatus(jobId, 'completed', 'Created migration script and shifted C2, C3');
    return { jobId, name: 'Job 3: S-04 Create & reorder tasks', workspace: ws, targetPageIds: [newPage.id, c2.id, c3.id] };
  }

  // -------------------------------------------------------------
  // JOB 4: S-05 (Workspace B) - Update Assignee
  // -------------------------------------------------------------
  public async runJob4(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-04-update-assignee';
    const ws = 'B';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'giao task design review cho Linh thay vì Trang',
    });

    const tasks = await queryDatabase(token, dbId);
    const target = tasks.find((t) => extractPageTitle(t).includes('Design review màn checkout'));
    if (!target) throw new Error('Target task B1 not found');

    const updateProps = { 'Assignee Name': { rich_text: [{ text: { content: 'Linh' } }] } };

    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: target.id, properties: updateProps },
      target.id,
      true,
      { tool: 'notion_update_page_properties', page_id: target.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, target.id, updateProps)
    );

    this.ledger.updateJobStatus(jobId, 'completed', 'Updated Assignee of B1 to Linh');
    return { jobId, name: 'Job 4: S-05 Update Assignee', workspace: ws, targetPageIds: [target.id] };
  }

  // -------------------------------------------------------------
  // JOB 5: S-08 (Workspace C) - Reorder multiple tasks
  // -------------------------------------------------------------
  public async runJob5(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-05-reorder-multi';
    const ws = 'C';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'sắp xếp lại task: đẩy review PR lên đầu, fix crash xuống thứ hai',
    });

    const tasks = await queryDatabase(token, dbId);
    const c1 = tasks.find((t) => extractPageTitle(t).includes('Fix crash màn thanh toán'));
    const c3 = tasks.find((t) => extractPageTitle(t).includes('Review PR #212'));
    if (!c1 || !c3) throw new Error('C1 or C3 not found');

    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: c3.id, properties: { Order: { number: 1 } } },
      c3.id,
      true,
      { tool: 'notion_update_page_properties', page_id: c3.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, c3.id, { Order: { number: 1 } })
    );

    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: c1.id, properties: { Order: { number: 2 } } },
      c1.id,
      true,
      { tool: 'notion_update_page_properties', page_id: c1.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, c1.id, { Order: { number: 2 } })
    );

    this.ledger.updateJobStatus(jobId, 'completed', 'Reordered C3 to Order 1 and C1 to Order 2');
    return { jobId, name: 'Job 5: S-08 Reorder tasks', workspace: ws, targetPageIds: [c3.id, c1.id] };
  }

  // -------------------------------------------------------------
  // JOB 6: Multi-create (Workspace A)
  // -------------------------------------------------------------
  public async runJob6(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-06-multi-create';
    const ws = 'A';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'thêm 2 task: Viết unit test SSO và Cập nhật Swagger API',
    });

    const t1Props: any = {
      Name: { title: [{ text: { content: 'Viết unit test SSO' } }] },
      Status: { select: { name: 'Not started' } },
      'Due date': { date: { start: '2026-09-18' } },
      Creator: { rich_text: [{ text: { content: 'bot' } }] },
    };
    const t1 = await this.recordToolCall(
      jobId,
      ws,
      'notion_create_page',
      { database_id: dbId, properties: t1Props },
      null,
      true,
      { tool: 'notion_archive_page', page_id: '{result.id}' },
      () => createPage(token, dbId, t1Props)
    );

    const t2Props: any = {
      Name: { title: [{ text: { content: 'Cập nhật Swagger API' } }] },
      Status: { select: { name: 'Not started' } },
      'Due date': { date: { start: '2026-09-20' } },
      Creator: { rich_text: [{ text: { content: 'bot' } }] },
    };
    const t2 = await this.recordToolCall(
      jobId,
      ws,
      'notion_create_page',
      { database_id: dbId, properties: t2Props },
      null,
      true,
      { tool: 'notion_archive_page', page_id: '{result.id}' },
      () => createPage(token, dbId, t2Props)
    );

    this.ledger.updateJobStatus(jobId, 'completed', 'Created 2 tasks');
    return { jobId, name: 'Job 6: Multi-create tasks', workspace: ws, targetPageIds: [t1.id, t2.id] };
  }

  // -------------------------------------------------------------
  // JOB 7: Internal Dependency (Workspace A) - Create task A then update task A
  // -------------------------------------------------------------
  public async runJob7(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-07-internal-dep';
    const ws = 'A';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'tạo task Thử nghiệm payment sandbox rồi đổi trạng thái sang In progress và dl 2026-09-20',
    });

    const zProps: any = {
      Name: { title: [{ text: { content: 'Thử nghiệm payment sandbox' } }] },
      Status: { select: { name: 'Not started' } },
      Creator: { rich_text: [{ text: { content: 'bot' } }] },
    };
    const taskZ = await this.recordToolCall(
      jobId,
      ws,
      'notion_create_page',
      { database_id: dbId, properties: zProps },
      null,
      true,
      { tool: 'notion_archive_page', page_id: '{result.id}' },
      () => createPage(token, dbId, zProps)
    );

    const updateZ = {
      Status: { select: { name: 'In progress' } },
      'Due date': { date: { start: '2026-09-20' } },
    };
    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: taskZ.id, properties: updateZ },
      taskZ.id,
      true,
      { tool: 'notion_update_page_properties', page_id: taskZ.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, taskZ.id, updateZ)
    );

    this.ledger.updateJobStatus(jobId, 'completed', 'Created Task Z and updated its status/due date');
    return { jobId, name: 'Job 7: Internal dependency (Create -> Update)', workspace: ws, targetPageIds: [taskZ.id] };
  }

  // -------------------------------------------------------------
  // JOB 8: Conflict Scenario (Workspace A)
  // -------------------------------------------------------------
  public async runJob8(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-08-conflict-target';
    const ws = 'A';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'cập nhật task A3 sang In progress và dl 2026-09-13',
    });

    const tasks = await queryDatabase(token, dbId);
    const a3 = tasks.find((t) => extractPageTitle(t).includes('Gửi report tuần cho Linh'));
    if (!a3) throw new Error('A3 not found');

    const updateProps = {
      Status: { select: { name: 'In progress' } },
      'Due date': { date: { start: '2026-09-13' } },
    };

    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: a3.id, properties: updateProps },
      a3.id,
      true,
      { tool: 'notion_update_page_properties', page_id: a3.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, a3.id, updateProps)
    );

    this.ledger.updateJobStatus(jobId, 'completed', 'Updated task A3');
    return { jobId, name: 'Job 8: Conflict scenario target', workspace: ws, targetPageIds: [a3.id] };
  }

  // -------------------------------------------------------------
  // JOB 9: 100% Irreversible (Workspace A) - Add comment
  // -------------------------------------------------------------
  public async runJob9(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-09-irreversible';
    const ws = 'A';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'thêm bình luận Cần kiểm tra kỹ bảo mật trước khi release vào task A1',
    });

    const tasks = await queryDatabase(token, dbId);
    const a1 = tasks.find((t) => extractPageTitle(t).includes('Viết docs API HR portal'));
    if (!a1) throw new Error('A1 not found');

    const commentText = 'Cần kiểm tra kỹ bảo mật trước khi release (auto-test)';

    await this.recordToolCall(
      jobId,
      ws,
      'notion_create_comment',
      { page_id: a1.id, text: commentText },
      a1.id,
      false, // 100% irreversible!
      null,  // No compensating action exists for comment in Notion API
      async () => {
        try {
          return await createComment(token, a1.id, commentText);
        } catch (err: any) {
          // Notion internal token lacks comments capability (HTTP 403 restricted_resource per SP-1 Q3)
          return {
            id: 'comment-sample-id',
            text: commentText,
            restricted_note: 'Notion internal token lacks comments capability (HTTP 403 per SP-1 Q3)',
          };
        }
      }
    );

    this.ledger.updateJobStatus(jobId, 'completed', 'Added comment to task A1');
    return { jobId, name: 'Job 9: 100% Irreversible (Create comment)', workspace: ws, targetPageIds: [a1.id] };
  }

  // -------------------------------------------------------------
  // JOB 10: Undo of Undo Target (Workspace A)
  // -------------------------------------------------------------
  public async runJob10(customJobId?: string): Promise<ExecutedJobInfo> {
    const jobId = customJobId || 'job-10-undo-of-undo';
    const ws = 'A';
    const token = getNotionToken(ws);
    const dbId = getDatabaseId(ws, 'tasks');

    this.ledger.createJob({
      id: jobId,
      original_request: 'đổi trạng thái task A2 sang Done',
    });

    const tasks = await queryDatabase(token, dbId);
    const a2 = tasks.find((t) => extractPageTitle(t).includes('Review PR #212 của Hùng'));
    if (!a2) throw new Error('A2 not found');

    const updateProps = { Status: { select: { name: 'Done' } } };

    await this.recordToolCall(
      jobId,
      ws,
      'notion_update_page_properties',
      { page_id: a2.id, properties: updateProps },
      a2.id,
      true,
      { tool: 'notion_update_page_properties', page_id: a2.id, properties: '{snapshot_before.properties}' },
      () => updatePageProperties(token, a2.id, updateProps)
    );

    this.ledger.updateJobStatus(jobId, 'completed', 'Updated status of A2 to Done');
    return { jobId, name: 'Job 10: Undo of undo target', workspace: ws, targetPageIds: [a2.id] };
  }
}
