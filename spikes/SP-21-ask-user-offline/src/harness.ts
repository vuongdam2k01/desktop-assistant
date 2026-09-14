import { Agent, type AgentMessage, type AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { createModel, customStreamFn, LLM_MODEL_STRONG } from "./client.js";
import { SQLiteLedger } from "./ledger.js";
import { AskUserManager, createAskUserTool } from "./ask-user-tool.js";

export interface EnvironmentStore {
  tasks: Array<{ id: string; title: string; status: string; priority?: string; dbId?: string }>;
  databases: Array<{ id: string; name: string; isProtected: boolean }>;
  readCallCount: number;
  writeCallCount: number;
  deleteCallCount: number;
}

export type HookRule = (toolName: string, params: any) => { allowed: boolean; reason?: string; ruleId?: string };

export class TestHarness {
  public ledger: SQLiteLedger;
  public askManager: AskUserManager;
  public store: EnvironmentStore;
  public hookEvaluator?: HookRule;

  constructor(dbPath: string = ":memory:", defaultAskTimeoutMs = 30 * 60 * 1000) {
    this.ledger = new SQLiteLedger(dbPath);
    this.askManager = new AskUserManager(this.ledger, defaultAskTimeoutMs);
    this.store = {
      tasks: [
        { id: "task-1", title: "Review Q3 Report", status: "In Progress", priority: "Normal", dbId: "db-tasks" },
        { id: "task-2", title: "Fix Auth Bug", status: "Todo", priority: "High", dbId: "db-tasks" },
      ],
      databases: [
        { id: "db-tasks", name: "Tasks", isProtected: false },
        { id: "db-core-system", name: "Core System Production", isProtected: true },
      ],
      readCallCount: 0,
      writeCallCount: 0,
      deleteCallCount: 0,
    };
  }

  setHookEvaluator(evaluator: HookRule) {
    this.hookEvaluator = evaluator;
  }

  createWrappedTool(baseTool: AgentTool<any>, jobId: string): AgentTool<any> {
    return {
      name: baseTool.name,
      label: baseTool.label,
      description: baseTool.description,
      parameters: baseTool.parameters,
      execute: async (toolCallId: string, params: any) => {
        // 1. Ghi Ledger Intent (fail-closed)
        this.ledger.recordEntry(jobId, "tool_intent", {
          toolCallId,
          toolName: baseTool.name,
          params,
        });

        // 2. Hook Evaluator (Hard Gate)
        if (this.hookEvaluator) {
          const evalResult = this.hookEvaluator(baseTool.name, params);
          if (!evalResult.allowed) {
            this.ledger.recordEntry(jobId, "tool_blocked", {
              toolCallId,
              toolName: baseTool.name,
              params,
              ruleId: evalResult.ruleId || "RULE_BLOCK",
              reason: evalResult.reason || "Operation blocked by security hook",
            });

            return {
              content: [
                {
                  type: "text" as const,
                  text: `SECURITY_GATE_BLOCKED: Thao tác '${baseTool.name}' bị chặn bởi quy tắc bảo vệ (${evalResult.ruleId || "HARD_GATE"}). Lý do: ${evalResult.reason}`,
                },
              ],
              isError: true,
              details: {
                blocked: true,
                ruleId: evalResult.ruleId,
                reason: evalResult.reason,
              },
            };
          }
        }

        // 3. Thực thi tool
        try {
          const res = await baseTool.execute(toolCallId, params);

          // 4. Ghi Ledger Result
          this.ledger.recordEntry(jobId, "tool_result", {
            toolCallId,
            toolName: baseTool.name,
            result: res,
          });

          return res;
        } catch (err: any) {
          this.ledger.recordEntry(jobId, "tool_result", {
            toolCallId,
            toolName: baseTool.name,
            error: err.message,
          });
          throw err;
        }
      },
    };
  }

  getDomainTools(jobId: string): AgentTool<any>[] {
    const readTool: AgentTool<any> = {
      name: "read_tasks",
      label: "Read Tasks",
      description: "Đọc danh sách các tasks hiện tại",
      parameters: Type.Object({
        database_id: Type.Optional(Type.String()),
      }),
      execute: async () => {
        this.store.readCallCount++;
        return {
          content: [{ type: "text", text: JSON.stringify(this.store.tasks) }],
          details: { tasks: this.store.tasks },
        };
      },
    };

    const writeTool: AgentTool<any> = {
      name: "write_task",
      label: "Write Task",
      description: "Tạo mới hoặc cập nhật một task",
      parameters: Type.Object({
        title: Type.String(),
        priority: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        database_id: Type.Optional(Type.String()),
      }),
      execute: async (_toolCallId: string, params: any) => {
        this.store.writeCallCount++;
        const newTask = {
          id: `task-${this.store.tasks.length + 1}`,
          title: params.title,
          status: params.status || "Todo",
          priority: params.priority || "Normal",
          dbId: params.database_id || "db-tasks",
        };
        this.store.tasks.push(newTask);
        return {
          content: [{ type: "text", text: `Created task: ${JSON.stringify(newTask)}` }],
          details: { task: newTask },
        };
      },
    };

    const deleteDatabaseTool: AgentTool<any> = {
      name: "delete_database",
      label: "Delete Database",
      description: "Xoá vĩnh viễn toàn bộ một database và dữ liệu bên trong",
      parameters: Type.Object({
        database_id: Type.String({ description: "ID database cần xoá" }),
      }),
      execute: async (_toolCallId: string, params: any) => {
        this.store.deleteCallCount++;
        this.store.databases = this.store.databases.filter((d) => d.id !== params.database_id);
        return {
          content: [{ type: "text", text: `Database ${params.database_id} deleted successfully.` }],
        };
      },
    };

    const askTool = createAskUserTool(jobId, this.askManager);

    // Bọc các tool nghiệp vụ bằng wrapped tool
    return [
      this.createWrappedTool(readTool, jobId),
      this.createWrappedTool(writeTool, jobId),
      this.createWrappedTool(deleteDatabaseTool, jobId),
      askTool, // ask_user tự quản lý vòng đời và ledger decision riêng
    ];
  }

  createAgent(jobId: string, systemPrompt?: string, tools?: AgentTool<any>[], initialMessages?: AgentMessage[]) {
    const defaultPrompt =
      "You are a helpful task assistant. Use tools when needed. " +
      "If you lack critical parameters or need clarification, you MUST call ask_user with question and 0-4 structured options. " +
      "According to FR-AG-05, you must consolidate all missing info into ONE SINGLE ask_user question.";

    return new Agent({
      streamFn: customStreamFn,
      initialState: {
        model: createModel(LLM_MODEL_STRONG),
        systemPrompt: systemPrompt || defaultPrompt,
        tools: tools || this.getDomainTools(jobId),
        messages: initialMessages || [],
      },
    });
  }

  cleanup() {
    this.askManager.cleanup();
    this.ledger.close();
  }
}
