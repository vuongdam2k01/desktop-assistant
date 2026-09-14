import { Agent } from "@earendil-works/pi-agent-core";
import { createModel, customStreamFn, LLM_MODEL_STRONG } from "./client.js";
import { DummyEnvironment, createReadTool, createWriteTool, createWrappedTool } from "./dummy-tools.js";

async function runMinimalAgentTest() {
  console.log("=== TEST: Minimal Agent with Read and Write Tools ===");
  const env = new DummyEnvironment();
  const model = createModel(LLM_MODEL_STRONG);

  const readTool = createWrappedTool(createReadTool(env), env.ledger);
  const writeTool = createWrappedTool(createWriteTool(env), env.ledger);

  const agent = new Agent({
    streamFn: customStreamFn,
    initialState: {
      model,
      systemPrompt: "You are a helpful assistant. Use the provided tools to inspect and modify tasks.",
      tools: [readTool, writeTool],
    },
  });

  const events: string[] = [];
  agent.subscribe((event) => {
    events.push(event.type);
    if (event.type === "tool_execution_start") {
      console.log(`[EVENT] Tool started: ${event.toolName} args:`, JSON.stringify(event.args));
    } else if (event.type === "tool_execution_end") {
      console.log(`[EVENT] Tool ended: ${event.toolName} isError:`, event.isError);
    }
  });

  console.log("Prompting agent: 'Read current tasks and then create a new task named Deploy Backend'...");
  await agent.prompt("Read current tasks and then create a new task named 'Deploy Backend'. Then summarize what you did.");

  console.log("\n--- Verification ---");
  console.log("Read tool call count:", env.readCallCount);
  console.log("Write tool call count:", env.writeCallCount);
  console.log("Final items in store:", env.items.map((i) => i.title));
  console.log("Ledger entries count:", env.ledger.getEntries().length);

  for (const entry of env.ledger.getEntries()) {
    console.log(`  [Ledger ${entry.id}] ${entry.status} - ${entry.toolName}`);
  }

  const success =
    env.readCallCount >= 1 &&
    env.writeCallCount >= 1 &&
    env.items.some((i) => i.title.includes("Deploy Backend"));

  if (!success) {
    throw new Error("Minimal agent test failed: tools were not invoked as expected.");
  }
  console.log("\n✅ Minimal agent test PASSED!");
}

runMinimalAgentTest().catch((err) => {
  console.error("Minimal agent test ERROR:", err);
  process.exit(1);
});
