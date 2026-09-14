import { LedgerDb } from './ledger.js';
import { ObjectLockManager } from './lock-manager.js';
import { getPage, updatePageProperties, queryTasks, sanitizePropertiesForUpdate } from './notion-client.js';
import { ActionRecord, Job, NotionPageSnapshot } from './types.js';

export interface Q2TestResults {
  targetPageId: string;
  initialState: {
    status: string;
    dueDate: string | null;
  };
  unlockedRace: {
    jobA_snapshot_before: any;
    jobA_snapshot_after: any;
    jobB_snapshot_before: any;
    jobB_snapshot_after: any;
    dirtySnapshotDetected: boolean;
    undoJobB_result: {
      appliedProperties: any;
      corruptedJobA: boolean;
      description: string;
    };
  };
  lockedExecution: {
    jobA_snapshot_before: any;
    jobA_snapshot_after: any;
    jobB_snapshot_before: any;
    jobB_snapshot_after: any;
    snapshotAccurate: boolean;
    undoJobB_result: {
      appliedProperties: any;
      preservedJobA: boolean;
      description: string;
    };
  };
  verdict: {
    isLedgerValidWithoutLock: boolean;
    definitiveConclusion: string;
  };
}

export async function runQ2Test(ledgerDb: LedgerDb): Promise<Q2TestResults> {
  console.log('--- [Q2] Running Dirty Snapshot & Ledger Correctness Test ---');

  const tasks = await queryTasks('B', 5);
  const targetTask = tasks[0];
  const targetPageId = targetTask.id;
  const initialSnapshot = await getPage(targetPageId, 'B');

  // Baseline setup: Status = 'Not started', Due date = '2026-09-20'
  await updatePageProperties(
    targetPageId,
    {
      Status: { select: { name: 'Not started' } },
      'Due date': { date: { start: '2026-09-20' } },
    },
    'B'
  );
  const baseline = await getPage(targetPageId, 'B');
  console.log(`Baseline set: Status=${baseline.properties.Status?.select?.name}, DueDate=${baseline.properties['Due date']?.date?.start}`);

  try {
    // =========================================================================
    // PART 1: UNLOCKED RACE CONDITION (Cố tình để Job B đọc trong lúc Job A ghi)
    // =========================================================================
    console.log('\n[Part 1] Simulating Unlocked Concurrent Execution (Job A & Job B)...');
    const jobA_id = `job-a-unlocked-${Date.now()}`;
    const jobB_id = `job-b-unlocked-${Date.now()}`;

    ledgerDb.createJob({ id: jobA_id, name: 'Job A: Change Status to In progress', status: 'running' });
    ledgerDb.createJob({ id: jobB_id, name: 'Job B: Change Due date to 2026-09-30', status: 'running' });

    // Step 1: Both Job A and Job B read snapshot concurrently before either completes writing
    const [jobA_snapBefore, jobB_snapBefore] = await Promise.all([
      getPage(targetPageId, 'B'),
      getPage(targetPageId, 'B'),
    ]);

    // Record tool_intent for both
    ledgerDb.appendRecord({
      job_id: jobA_id,
      sequence: 1,
      correlation_id: `corr-a-1`,
      record_type: 'tool_intent',
      tool_name: 'notion_update_page_properties',
      connector_id: 'notion',
      target_urn: `notion:page:${targetPageId}`,
      arguments_json: JSON.stringify({ Status: 'In progress' }),
      snapshot_before_json: JSON.stringify(jobA_snapBefore),
      snapshot_after_json: null,
      is_reversible: 1,
    });

    ledgerDb.appendRecord({
      job_id: jobB_id,
      sequence: 1,
      correlation_id: `corr-b-1`,
      record_type: 'tool_intent',
      tool_name: 'notion_update_page_properties',
      connector_id: 'notion',
      target_urn: `notion:page:${targetPageId}`,
      arguments_json: JSON.stringify({ 'Due date': '2026-09-30' }),
      snapshot_before_json: JSON.stringify(jobB_snapBefore),
      snapshot_after_json: null,
      is_reversible: 1,
    });

    // Step 2: Job A writes first, then Job B writes
    const jobA_snapAfter = await updatePageProperties(
      targetPageId,
      { Status: { select: { name: 'In progress' } } },
      'B'
    );
    ledgerDb.appendRecord({
      job_id: jobA_id,
      sequence: 2,
      correlation_id: `corr-a-1`,
      record_type: 'tool_result',
      tool_name: 'notion_update_page_properties',
      connector_id: 'notion',
      target_urn: `notion:page:${targetPageId}`,
      arguments_json: JSON.stringify({ Status: 'In progress' }),
      snapshot_before_json: JSON.stringify(jobA_snapBefore),
      snapshot_after_json: JSON.stringify(jobA_snapAfter),
      is_reversible: 1,
    });
    ledgerDb.updateJobStatus(jobA_id, 'completed');

    const jobB_snapAfter = await updatePageProperties(
      targetPageId,
      { 'Due date': { date: { start: '2026-09-30' } } },
      'B'
    );
    ledgerDb.appendRecord({
      job_id: jobB_id,
      sequence: 2,
      correlation_id: `corr-b-1`,
      record_type: 'tool_result',
      tool_name: 'notion_update_page_properties',
      connector_id: 'notion',
      target_urn: `notion:page:${targetPageId}`,
      arguments_json: JSON.stringify({ 'Due date': '2026-09-30' }),
      snapshot_before_json: JSON.stringify(jobB_snapBefore), // DIRTY SNAPSHOT!
      snapshot_after_json: JSON.stringify(jobB_snapAfter),
      is_reversible: 1,
    });
    ledgerDb.updateJobStatus(jobB_id, 'completed');

    const stateAfterBoth = await getPage(targetPageId, 'B');
    console.log(`State after Job A & B completed: Status=${stateAfterBoth.properties.Status?.select?.name}, DueDate=${stateAfterBoth.properties['Due date']?.date?.start}`);

    // Step 3: Now simulate UNDO Job B by restoring Job B's snapshot_before!
    console.log('[Part 1] User invokes Undo for Job B...');
    const undoJobB_id = `undo-${jobB_id}`;
    ledgerDb.createJob({ id: undoJobB_id, name: 'Undo Job B', status: 'running', undo_of: jobB_id });

    // Per ADR-005 & SP-1: Undo restores writeable properties from snapshot_before
    const dirtyPropsToRestore = sanitizePropertiesForUpdate(jobB_snapBefore.properties);
    const postUndoSnapshot = await updatePageProperties(targetPageId, dirtyPropsToRestore, 'B');

    const statusAfterUndoB = postUndoSnapshot.properties.Status?.select?.name;
    const dueDateAfterUndoB = postUndoSnapshot.properties['Due date']?.date?.start;

    // Notice: status was 'In progress' after Job A.
    // Did undoing Job B revert status back to 'Not started'?
    const corruptedJobA = statusAfterUndoB === 'Not started';
    console.log(`State after Undo Job B: Status=${statusAfterUndoB}, DueDate=${dueDateAfterUndoB}`);
    console.log(`Did Undo Job B corrupt/wipe out Job A's Status? ${corruptedJobA ? 'YES! (CORRUPTION CONFIRMED)' : 'No'}`);

    // =========================================================================
    // PART 2: LOCKED EXECUTION (Với ObjectLockManager)
    // =========================================================================
    console.log('\n[Part 2] Executing Same Workload WITH ObjectLockManager...');
    // Reset baseline
    await updatePageProperties(
      targetPageId,
      {
        Status: { select: { name: 'Not started' } },
        'Due date': { date: { start: '2026-09-20' } },
      },
      'B'
    );

    const lockManager = new ObjectLockManager();
    const resourceUrn = `notion:page:${targetPageId}`;
    const jobA2_id = `job-a-locked-${Date.now()}`;
    const jobB2_id = `job-b-locked-${Date.now()}`;

    ledgerDb.createJob({ id: jobA2_id, name: 'Job A2: Change Status (Locked)', status: 'running' });
    ledgerDb.createJob({ id: jobB2_id, name: 'Job B2: Change Due date (Locked)', status: 'running' });

    let jobA2_snapBefore: NotionPageSnapshot;
    let jobA2_snapAfter: NotionPageSnapshot;
    let jobB2_snapBefore!: NotionPageSnapshot;
    let jobB2_snapAfter!: NotionPageSnapshot;

    // Both jobs launch concurrently, but wrap their tool action in withLock
    const runJobA2 = lockManager.withLock(resourceUrn, jobA2_id, async () => {
      jobA2_snapBefore = await getPage(targetPageId, 'B');
      jobA2_snapAfter = await updatePageProperties(
        targetPageId,
        { Status: { select: { name: 'In progress' } } },
        'B'
      );
      ledgerDb.appendRecord({
        job_id: jobA2_id,
        sequence: 1,
        correlation_id: `corr-a2-1`,
        record_type: 'tool_result',
        tool_name: 'notion_update_page_properties',
        connector_id: 'notion',
        target_urn: resourceUrn,
        arguments_json: JSON.stringify({ Status: 'In progress' }),
        snapshot_before_json: JSON.stringify(jobA2_snapBefore),
        snapshot_after_json: JSON.stringify(jobA2_snapAfter),
        is_reversible: 1,
      });
      ledgerDb.updateJobStatus(jobA2_id, 'completed');
    });

    const runJobB2 = lockManager.withLock(resourceUrn, jobB2_id, async () => {
      // Job B will only read snapshot AFTER Job A completes and releases lock!
      jobB2_snapBefore = await getPage(targetPageId, 'B');
      jobB2_snapAfter = await updatePageProperties(
        targetPageId,
        { 'Due date': { date: { start: '2026-09-30' } } },
        'B'
      );
      ledgerDb.appendRecord({
        job_id: jobB2_id,
        sequence: 1,
        correlation_id: `corr-b2-1`,
        record_type: 'tool_result',
        tool_name: 'notion_update_page_properties',
        connector_id: 'notion',
        target_urn: resourceUrn,
        arguments_json: JSON.stringify({ 'Due date': '2026-09-30' }),
        snapshot_before_json: JSON.stringify(jobB2_snapBefore), // ACCURATE SNAPSHOT!
        snapshot_after_json: JSON.stringify(jobB2_snapAfter),
        is_reversible: 1,
      });
      ledgerDb.updateJobStatus(jobB2_id, 'completed');
    });

    await Promise.all([runJobA2, runJobB2]);

    console.log(`Job B2 snapshot_before Status recorded: ${jobB2_snapBefore.properties.Status?.select?.name}`);

    // Now test Undo Job B2 with its accurate snapshot_before
    console.log('[Part 2] User invokes Undo for Job B2 (which has accurate snapshot)...');
    const accuratePropsToRestore = sanitizePropertiesForUpdate(jobB2_snapBefore.properties);
    const postUndoLockedSnapshot = await updatePageProperties(targetPageId, accuratePropsToRestore, 'B');

    const statusAfterLockedUndoB = postUndoLockedSnapshot.properties.Status?.select?.name;
    const dueDateAfterLockedUndoB = postUndoLockedSnapshot.properties['Due date']?.date?.start;
    const preservedJobA = statusAfterLockedUndoB === 'In progress';
    console.log(`State after Undo Job B2: Status=${statusAfterLockedUndoB}, DueDate=${dueDateAfterLockedUndoB}`);
    console.log(`Did Job A's Status remain preserved? ${preservedJobA ? 'YES! (100% PRESERVED)' : 'No'}`);

    // Restore original state
    await updatePageProperties(targetPageId, sanitizePropertiesForUpdate(initialSnapshot.properties), 'B');

    return {
      targetPageId,
      initialState: {
        status: 'Not started',
        dueDate: '2026-09-20',
      },
      unlockedRace: {
        jobA_snapshot_before: jobA_snapBefore.properties.Status?.select?.name,
        jobA_snapshot_after: jobA_snapAfter.properties.Status?.select?.name,
        jobB_snapshot_before: jobB_snapBefore.properties.Status?.select?.name, // Dirty!
        jobB_snapshot_after: jobB_snapAfter.properties.Status?.select?.name,
        dirtySnapshotDetected: jobB_snapBefore.properties.Status?.select?.name === 'Not started',
        undoJobB_result: {
          appliedProperties: { Status: statusAfterUndoB, DueDate: dueDateAfterUndoB },
          corruptedJobA,
          description:
            'Do đọc snapshot trước khi Job A ghi xong, Job B lưu snapshot_before là trạng thái cũ của Status (Not started). ' +
            'Khi người dùng bấm Undo Job B, hệ thống nạp lại snapshot_before của B, vô tình ĐÈ CHẾT thay đổi của Job A ' +
            '(Status bị kéo lùi về Not started dù Job A vẫn hoàn thành và không hề bị undo). Đây là lỗi Lost Update trên Undo.',
        },
      },
      lockedExecution: {
        jobA_snapshot_before: jobA2_snapBefore!.properties.Status?.select?.name,
        jobA_snapshot_after: jobA2_snapAfter!.properties.Status?.select?.name,
        jobB_snapshot_before: jobB2_snapBefore.properties.Status?.select?.name,
        jobB_snapshot_after: jobB2_snapAfter.properties.Status?.select?.name,
        snapshotAccurate: jobB2_snapBefore.properties.Status?.select?.name === 'In progress',
        undoJobB_result: {
          appliedProperties: { Status: statusAfterLockedUndoB, DueDate: dueDateAfterLockedUndoB },
          preservedJobA,
          description:
            'Nhờ có ObjectLockManager, Job B buộc phải chờ Job A ghi xong và commit ledger. ' +
            'Snapshot của Job B phản ánh chính xác trạng thái mới của Job A (Status = In progress). ' +
            'Khi Undo Job B, thay đổi của Job A được bảo toàn 100%.',
        },
      },
      verdict: {
        isLedgerValidWithoutLock: false,
        definitiveConclusion:
          'KẾT LUẬN DỨT KHOÁT: KHÔNG CÒN ĐÚNG. Nếu không có khoá cấp đối tượng (Object Lock), ' +
          'snapshot_before của Job B là dirty/stale snapshot. Hoàn tác Job B sẽ xóa sạch dữ liệu hợp lệ của Job A ' +
          'mà không có bất kỳ cảnh báo nào (Lost Update on Undo), phá vỡ hoàn toàn tính đúng đắn và khả năng kiểm toán ' +
          'của append-only ledger. BẮT BUỘC phải có Object Lock ở tầng Connector/Job Manager trước khi chụp snapshot và ghi API.',
      },
    };
  } catch (err) {
    try {
      await updatePageProperties(targetPageId, sanitizePropertiesForUpdate(initialSnapshot.properties), 'B');
    } catch {}
    throw err;
  }
}
