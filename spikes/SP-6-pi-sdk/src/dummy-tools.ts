import { Type, type Static, type TSchema } from "typebox";
import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@earendil-works/pi-agent-core";
import { MockLedger } from "./mock-ledger.js";

export interface ToolEvaluationResult {
  allowed: boolean;
  reason?: string;
  requireApproval?: boolean;
}

export type ToolEvaluator = (
  toolName: string,
  params: unknown,
  signal?: AbortSignal
) => Promise<ToolEvaluationResult> | ToolEvaluationResult;

export interface DummyStoreItem {
  id: string;
  title: string;
  status: string;
}

export class DummyEnvironment {
  public ledger: MockLedger = new MockLedger();
  public items: DummyStoreItem[] = [
    { id: "task-1", title: "Setup Project", status: "Done" },
    { id: "task-2", title: "Write Specs", status: "In Progress" },
  ];
  public readCallCount = 0;
  public writeCallCount = 0;

  reset() {
    this.ledger.clear();
    this.items = [
      { id: "task-1", title: "Setup Project", status: "Done" },
      { id: "task-2", title: "Write Specs", status: "In Progress" },
    ];
    this.readCallCount = 0;
    this.writeCallCount = 0;
  }
}

export function createWrappedTool<TParameters extends TSchema = TSchema, TDetails = any>(
  baseTool: AgentTool<TParameters, TDetails>,
  ledger: MockLedger,
  evaluator?: ToolEvaluator
): AgentTool<TParameters, TDetails> {
  const originalExecute = baseTool.execute;

  return {
    ...baseTool,
    execute: async (
      toolCallId: string,
      params: Static<TParameters>,
      signal?: AbortSignal,
      onUpdate?: AgentToolUpdateCallback<TDetails>
    ): Promise<AgentToolResult<TDetails>> => {
      // 1. Ghi Ledger Intent
      ledger.recordIntent(toolCallId, baseTool.name, params);

      // 2. Đánh giá Hook / Evaluator
      if (evaluator) {
        const evalResult = await evaluator(baseTool.name, params, signal);
        if (!evalResult.allowed) {
          const reason = evalResult.reason || "Operation blocked by evaluator";
          ledger.recordBlocked(toolCallId, baseTool.name, reason);
          // Hard gate: ném lỗi hoặc trả tool error result, KHÔNG GỌI originalExecute!
          return {
            content: [{ type: "text", text: `[HARD GATE BLOCKED] ${reason}` }],
            details: { blocked: true, reason } as unknown as TDetails,
          };
        }
      }

      // 3. Thực thi Thao Tác Thực Tế
      try {
        const result = await originalExecute(toolCallId, params, signal, onUpdate);

        // 4. Ghi Ledger Kết Quả
        ledger.recordResult(toolCallId, baseTool.name, result);
        return result;
      } catch (err: any) {
        ledger.recordBlocked(toolCallId, baseTool.name, `Execution failed: ${err.message}`);
        throw err;
      }
    },
  };
}

export function createReadTool(env: DummyEnvironment): AgentTool<any, any> {
  return {
    name: "read_data",
    label: "Read Tasks Data",
    description: "Read the list of current tasks from the database",
    parameters: Type.Object({
      filter: Type.Optional(Type.String({ description: "Optional filter for task title" })),
    }),
    execute: async (_toolCallId, params) => {
      env.readCallCount++;
      const filtered = params?.filter
        ? env.items.filter((i) => i.title.toLowerCase().includes(params.filter.toLowerCase()))
        : env.items;
      return {
        content: [{ type: "text", text: JSON.stringify(filtered) }],
        details: { count: filtered.length, items: filtered },
      };
    },
  };
}

export function createWriteTool(env: DummyEnvironment): AgentTool<any, any> {
  return {
    name: "write_data",
    label: "Write Task Data",
    description: "Create or update a task in the database",
    parameters: Type.Object({
      title: Type.String({ description: "Title of the task to add" }),
      status: Type.Optional(Type.String({ description: "Status of the task", default: "Todo" })),
    }),
    execute: async (_toolCallId, params) => {
      env.writeCallCount++;
      const newItem: DummyStoreItem = {
        id: `task-${env.items.length + 1}`,
        title: params.title,
        status: params.status || "Todo",
      };
      env.items.push(newItem);
      return {
        content: [{ type: "text", text: `Created item: ${JSON.stringify(newItem)}` }],
        details: { item: newItem },
      };
    },
  };
}
