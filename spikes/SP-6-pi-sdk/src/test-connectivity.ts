import { createModel, customStreamFn, LLM_MODEL_STRONG } from "./client.js";

async function main() {
  console.log("Testing connectivity to LLM via pi-ai...");
  const model = createModel(LLM_MODEL_STRONG);
  const context = {
    systemPrompt: "You are a helpful assistant. Reply in exactly 5 words.",
    messages: [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: "Say hello to Desktop Assistant!" }],
        timestamp: Date.now(),
      },
    ],
  };

  const responseStream = customStreamFn(model, context);
  for await (const event of responseStream) {
    if (event.type === "text_delta") {
      process.stdout.write(event.delta);
    }
  }
  const result = await responseStream.result();
  console.log("\nFull result received:", result.stopReason, "tokens:", result.usage);
}

main().catch((err) => {
  console.error("Connectivity test failed:", err);
  process.exit(1);
});
