import { createModel, customStreamFn, LLM_MODEL_STRONG } from "./client.js";
import { streamSimple } from "@earendil-works/pi-ai";

async function main() {
  console.log("Testing SP-21 LLM connectivity...");
  const model = createModel(LLM_MODEL_STRONG);
  const stream = customStreamFn(model, {
    systemPrompt: "You are a helpful assistant.",
    messages: [{ role: "user", content: [{ type: "text", text: "Hello" }], timestamp: Date.now() }],
  });
  let res = "";
  for await (const event of stream) {
    if (event.type === "text_delta") {
      res += event.delta;
    }
  }
  console.log("Response:", res.slice(0, 50));
  console.log("Connectivity OK!");
}

main().catch(console.error);
