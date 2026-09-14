import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import type { Model, Context, SimpleStreamOptions, AssistantMessageEventStream } from "@earendil-works/pi-ai";
import { ConnectorRegistry } from "./connector-registry.js";
import { UniformLedger, type LedgerRecord } from "./ledger.js";
import { HardGateEvaluator } from "./evaluator/evaluator.js";
import { createHardGatedTool } from "./wrapped-tool.js";
import { ToolGenerator } from "../generator/tool-generator.js";
import type { SessionContext } from "./evaluator/context.js";

export interface JobExecutionResult {
  jobId: string;
  status: "completed" | "failed" | "blocked";
  response: string;
  toolCallsCount: number;
  ledgerRecords: LedgerRecord[];
  activeConnectors: string[];
  toolsProvided: string[];
  error?: string;
}

export class JobManager {
  readonly registry: ConnectorRegistry;
  readonly ledger: UniformLedger;
  readonly evaluator: HardGateEvaluator;

  constructor(
    registry: ConnectorRegistry,
    ledger: UniformLedger,
    evaluator: HardGateEvaluator
  ) {
    this.registry = registry;
    this.ledger = ledger;
    this.evaluator = evaluator;
  }

  /**
   * Generates and wraps all tools for CONNECTED connectors (FR-CF-06).
   * Connector-agnostic: iterates dynamically through the registry.
   */
  public assembleToolsForJob(session: SessionContext): {
    tools: AgentTool<any, any>[];
    activeConnectorIds: string[];
    toolNames: string[];
  } {
    const connected = this.registry.getConnectedConnectors();
    const assembledTools: AgentTool<any, any>[] = [];
    const activeConnectorIds: string[] = [];
    const toolNames: string[] = [];

    for (const conn of connected) {
      activeConnectorIds.push(conn.manifest.id);
      const generated = ToolGenerator.generateTools(conn.manifest, conn.adapter);
      for (const baseTool of generated) {
        toolNames.push(baseTool.name);
        const wrapped = createHardGatedTool(
          baseTool,
          this.ledger,
          this.evaluator,
          session,
          conn.adapter
        );
        assembledTools.push(wrapped);
      }
    }

    return {
      tools: assembledTools,
      activeConnectorIds,
      toolNames,
    };
  }

  /**
   * Runs a job with the specified prompt and approval mode
   */
  public async runJob(options: {
    jobId: string;
    prompt: string;
    mode: "on" | "smart" | "off";
    model: Model<any>;
    streamFn: (model: Model<any>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
    systemPrompt?: string;
  }): Promise<JobExecutionResult> {
    const { jobId, prompt, mode, model, streamFn, systemPrompt } = options;

    const session: SessionContext = {
      jobId,
      mode,
      now: new Date(),
      currentUser: "user@example.com",
      cumulativeWritesInJob: 0,
      deadlineChangesInJob: 0,
      distinctPagesModifiedInJob: new Set(),
      createdPagesInJob: new Set(),
      dailyTaskCreates: 0,
      activeJobApprovals: [],
    };

    const { tools, activeConnectorIds, toolNames } = this.assembleToolsForJob(session);

    let toolExecutionsCount = 0;
    const agent = new Agent({
      streamFn,
      initialState: {
        model,
        systemPrompt:
          systemPrompt ||
          "You are a helpful desktop assistant. You only have access to tools provided. If a requested action requires a tool you do not have, state clearly that you do not have the tool.",
        tools,
      },
    });

    agent.subscribe((event) => {
      if (event.type === "tool_execution_start") {
        toolExecutionsCount++;
      }
    });

    try {
      await agent.prompt(prompt);

      const messages = agent.state.messages;
      const lastMsg = messages[messages.length - 1];
      const responseText =
        lastMsg && lastMsg.role === "assistant"
          ? lastMsg.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join(" ")
          : "";

      const jobRecords = this.ledger.getRecords({ jobId });
      const hasBlocked = jobRecords.some((r) => r.type === "BLOCKED");

      return {
        jobId,
        status: hasBlocked ? "blocked" : "completed",
        response: responseText,
        toolCallsCount: toolExecutionsCount,
        ledgerRecords: jobRecords,
        activeConnectors: activeConnectorIds,
        toolsProvided: toolNames,
      };
    } catch (err: any) {
      return {
        jobId,
        status: "failed",
        response: "",
        toolCallsCount: toolExecutionsCount,
        ledgerRecords: this.ledger.getRecords({ jobId }),
        activeConnectors: activeConnectorIds,
        toolsProvided: toolNames,
        error: err.message,
      };
    }
  }
}
