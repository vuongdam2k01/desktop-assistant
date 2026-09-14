import { LedgerRepository } from './db.js';
import { callLLM } from './client.js';
import {
  getNotionToken,
  getPage,
  updatePageProperties,
  archivePage,
  sanitizePropertiesForUpdate,
  NotionApiError,
} from './notion-client.js';
import type {
  ActionRecord,
  PlannedCompensatingItem,
  UndoPreview,
  UndoExecutionReport,
} from './types.js';

export class UndoAgent {
  private ledger: LedgerRepository;

  constructor(ledger: LedgerRepository) {
    this.ledger = ledger;
  }

  /**
   * LLM reads ledger and reasons the compensating chain with inverted order (FR-UD-01)
   */
  public async generateCompensatingPlanWithLLM(
    jobId: string,
    records: ActionRecord[]
  ): Promise<{ items: PlannedCompensatingItem[]; rawLLMResponse: string }> {
    const writeRecords = records.filter(
      (r) =>
        r.type === 'tool_result' &&
        r.tool &&
        ['notion_create_page', 'notion_update_page_properties', 'notion_archive_page', 'notion_create_comment'].includes(
          r.tool
        )
    );

    if (writeRecords.length === 0) {
      return { items: [], rawLLMResponse: 'No write records found' };
    }

    const simplifiedRecords = writeRecords.map((r) => ({
      seq: r.seq,
      tool: r.tool,
      target_page_id: r.args?.page_id || r.result?.id,
      args: r.args,
      is_reversible: r.is_reversible,
      snapshot_before: r.snapshot_before,
      snapshot_after: r.snapshot_after,
      compensating_hint: r.compensating_action,
    }));

    const systemPrompt = `You are the Desktop Assistant Undo-Agent (FR-UD-01).
Your mission is to read an execution ledger of actions performed on Notion and synthesize an inverted compensating chain.

RULES (FR-UD-01, Compensation Matrix):
1. Compensating action is REVERSE REASONING from ledger snapshots, NOT git rollback:
   - 'notion_create_page' -> compensating action is 'notion_archive_page' with { "page_id": "<created_id>" }
   - 'notion_update_page_properties' -> compensating action is 'notion_update_page_properties' with { "page_id": "<id>", "properties": <snapshot_before.properties> }
   - 'notion_archive_page' -> compensating action is 'notion_unarchive_page' with { "page_id": "<id>", "archived": false }
   - 'notion_create_comment' -> irreversible! Notion API does not support deleting comments. Set classification: 'irreversible', reason: 'Notion API does not support deleting or modifying comments.'
2. ORDER INVERSION:
   - The sequence of compensating actions MUST be strictly in reverse chronological/topological order of the original actions.
   - For internal dependencies on the same object (e.g., action 1 creates Page A, action 2 updates Page A):
     the reverse order MUST undo action 2 first (revert properties), then undo action 1 (archive Page A).
     NEVER archive Page A before attempting to update Page A!
3. Output MUST be valid JSON with this exact schema:
{
  "items": [
    {
      "original_seq": <number>,
      "original_tool": "<tool_name>",
      "target_object_id": "<uuid>",
      "classification": "reversible" | "irreversible",
      "reason": "<explanation if irreversible, else null>",
      "compensating_tool": "notion_archive_page" | "notion_update_page_properties" | "notion_unarchive_page" | null,
      "compensating_args": <object or null>,
      "order_rationale": "<brief explanation of reverse order placement>"
    }
  ]
}`;

    const userMessage = `Job ID: ${jobId}
Action records from ledger:
${JSON.stringify(simplifiedRecords, null, 2)}

Synthesize the compensating plan in reverse order. Return JSON only:`;

    const rawResponse = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.0 }
    );

    let parsed: any;
    try {
      const cleaned = rawResponse.replace(/```json\s*|\s*```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (err: any) {
      throw new Error(`Failed to parse LLM JSON response: ${err.message}\nResponse was:\n${rawResponse}`);
    }

    return {
      items: parsed.items || [],
      rawLLMResponse: rawResponse,
    };
  }

  /**
   * Conflict Detection & Preview Generation (FR-UD-02, FR-UD-03, FR-UD-06)
   * Must guarantee FALSE-NEGATIVE = 0 (PRD US-3.2 / AC3).
   */
  public async buildPreview(
    jobId: string,
    workspace: 'A' | 'B' | 'C',
    plannedItems: PlannedCompensatingItem[],
    records: ActionRecord[]
  ): Promise<UndoPreview> {
    const token = getNotionToken(workspace);
    const reversible_items: PlannedCompensatingItem[] = [];
    const irreversible_items: PlannedCompensatingItem[] = [];
    const conflict_items: PlannedCompensatingItem[] = [];

    for (const item of plannedItems) {
      // 1. Irreversible items (like create_comment)
      if (item.classification === 'irreversible' || !item.compensating_tool) {
        irreversible_items.push({
          ...item,
          classification: 'irreversible',
          reason: item.reason || 'Thao tác không thể hoàn nguyên qua Notion API.',
        });
        continue;
      }

      // 2. Check live Notion object for conflicts (FR-UD-02)
      const targetId = item.target_object_id;

      // Find the LAST record for this target object in the job to get its true state after the job finished
      const recordsForObject = records.filter(
        (r) =>
          r.type === 'tool_result' &&
          (r.args?.page_id === targetId || r.result?.id === targetId)
      );
      const lastRecordForObject =
        recordsForObject.length > 0 ? recordsForObject[recordsForObject.length - 1] : null;
      const expectedSnapshotAfter = lastRecordForObject?.snapshot_after;

      try {
        const livePage = await getPage(token, targetId);

        // Conflict check 1: Target object deleted or archived externally
        if (expectedSnapshotAfter && livePage.archived !== expectedSnapshotAfter.archived) {
          conflict_items.push({
            ...item,
            classification: 'conflict',
            reason: `Trạng thái archived bị thay đổi bên ngoài: hiện tại archived=${livePage.archived}, sau job archived=${expectedSnapshotAfter.archived}`,
          });
          continue;
        }

        // Conflict check 2: Compare live properties vs expected final properties after job
        const currentProps = sanitizePropertiesForUpdate(livePage.properties);
        const afterProps = expectedSnapshotAfter?.properties || {};

        let propertyDiff = false;
        let diffDetails = '';

        for (const [k, v] of Object.entries(afterProps)) {
          const curVal = JSON.stringify(currentProps[k] ?? null);
          const aftVal = JSON.stringify(v ?? null);
          if (curVal !== aftVal) {
            propertyDiff = true;
            diffDetails = `Thuộc tính '${k}' đã bị bên thứ ba sửa (hiện tại: ${curVal}, sau job: ${aftVal})`;
            break;
          }
        }

        // Conflict check 3: Last edited time is newer than job completion
        const jobEditedTime = expectedSnapshotAfter?.last_edited_time;
        const liveEditedTime = livePage.last_edited_time;
        const timeDiff = Boolean(jobEditedTime && liveEditedTime && liveEditedTime > jobEditedTime);

        if (propertyDiff || timeDiff) {
          conflict_items.push({
            ...item,
            classification: 'conflict',
            reason: diffDetails || `Đối tượng đã bị bên thứ ba sửa đổi lúc ${liveEditedTime} (sau khi job hoàn tất lúc ${jobEditedTime})`,
          });
          continue;
        }

        // Clean: Reversible
        reversible_items.push({
          ...item,
          classification: 'reversible',
        });
      } catch (err: any) {
        if (err instanceof NotionApiError && err.status === 404) {
          // Object deleted permanently or permission revoked (SP-1 Q7 finding)
          conflict_items.push({
            ...item,
            classification: 'conflict',
            reason: 'Đối tượng không tồn tại hoặc đã bị xoá vĩnh viễn / gỡ quyền truy cập (HTTP 404 object_not_found).',
          });
        } else {
          conflict_items.push({
            ...item,
            classification: 'conflict',
            reason: `Lỗi kết nối Notion API khi kiểm tra xung đột: ${err.message}`,
          });
        }
      }
    }

    const total = reversible_items.length + irreversible_items.length + conflict_items.length;

    // Check FR-UD-06: 100% irreversible disables Undo button
    let can_undo = true;
    let disabled_reason: string | undefined = undefined;

    if (reversible_items.length === 0 && irreversible_items.length > 0 && conflict_items.length === 0) {
      can_undo = false;
      disabled_reason =
        'Tất cả các thao tác trong job này đều không thể hoàn nguyên qua API (100% irreversible). Nút Undo bị vô hiệu hóa (FR-UD-06).';
    } else if (reversible_items.length === 0 && conflict_items.length > 0) {
      can_undo = false;
      disabled_reason =
        'Tất cả các thao tác đều bị xung đột do bên thứ ba đã sửa đổi hoặc xoá đối tượng. Không thể tự động hoàn nguyên.';
    }

    return {
      job_id: jobId,
      can_undo,
      disabled_reason,
      reversible_items,
      irreversible_items,
      conflict_items,
      total_items: total,
    };
  }

  /**
   * Execute Compensating Chain as a new Job with its own Ledger (FR-UD-04)
   */
  public async executeUndo(
    originalJobId: string,
    workspace: 'A' | 'B' | 'C',
    preview: UndoPreview
  ): Promise<UndoExecutionReport> {
    const token = getNotionToken(workspace);
    const undoJobId = `undo-${originalJobId}-${Date.now().toString().slice(-4)}`;

    this.ledger.createJob({
      id: undoJobId,
      original_request: `Undo of job ${originalJobId}`,
      undo_of: originalJobId,
      status: 'running',
    });

    const executedSteps: UndoExecutionReport['executed_steps'] = [];
    const manualHandling: UndoExecutionReport['manual_handling_required'] = [];

    for (const irr of preview.irreversible_items) {
      manualHandling.push({
        target_id: irr.target_object_id,
        reason: irr.reason || 'Irreversible action',
        classification: 'irreversible',
      });
    }

    for (const conf of preview.conflict_items) {
      manualHandling.push({
        target_id: conf.target_object_id,
        reason: conf.reason || 'Conflict detected',
        classification: 'conflict',
      });
    }

    let allSuccess = true;
    for (const item of preview.reversible_items) {
      const tool = item.compensating_tool;
      const targetId = item.target_object_id;
      const args = item.compensating_args;

      this.ledger.appendRecord({
        jobId: undoJobId,
        type: 'tool_intent',
        tool,
        args,
      });

      let snapshotBefore: any = null;
      try {
        const page = await getPage(token, targetId);
        snapshotBefore = {
          id: page.id,
          archived: page.archived,
          last_edited_time: page.last_edited_time,
          properties: sanitizePropertiesForUpdate(page.properties),
        };
      } catch (e) {
        snapshotBefore = null;
      }

      let stepSuccess = false;
      let stepResult: any = null;
      let stepError: string | undefined = undefined;

      try {
        if (tool === 'notion_archive_page') {
          stepResult = await archivePage(token, targetId, true);
          stepSuccess = true;
        } else if (tool === 'notion_unarchive_page') {
          stepResult = await archivePage(token, targetId, false);
          stepSuccess = true;
        } else if (tool === 'notion_update_page_properties') {
          stepResult = await updatePageProperties(token, targetId, args.properties);
          stepSuccess = true;
        } else {
          throw new Error(`Unsupported compensating tool: ${tool}`);
        }
      } catch (err: any) {
        stepSuccess = false;
        stepError = err.message;
        allSuccess = false;
      }

      let snapshotAfter: any = null;
      try {
        const page = await getPage(token, targetId);
        snapshotAfter = {
          id: page.id,
          archived: page.archived,
          last_edited_time: page.last_edited_time,
          properties: sanitizePropertiesForUpdate(page.properties),
        };
      } catch (e) {
        snapshotAfter = stepResult;
      }

      this.ledger.appendRecord({
        jobId: undoJobId,
        type: 'tool_result',
        tool,
        args,
        result: stepResult || { error: stepError },
        snapshotBefore,
        snapshotAfter,
        isReversible: 1,
        compensatingAction: null,
      });

      executedSteps.push({
        seq: executedSteps.length + 1,
        tool: tool || 'unknown',
        target_id: targetId,
        success: stepSuccess,
        result: stepResult,
        error: stepError,
      });
    }

    const finalStatus = allSuccess ? 'completed' : 'failed';
    const summary = `Undo completed: ${executedSteps.filter((s) => s.success).length}/${executedSteps.length} steps succeeded, ${manualHandling.length} items require manual handling.`;
    this.ledger.updateJobStatus(undoJobId, finalStatus, summary);

    return {
      undo_job_id: undoJobId,
      original_job_id: originalJobId,
      success: allSuccess,
      executed_steps: executedSteps,
      manual_handling_required: manualHandling,
    };
  }
}
