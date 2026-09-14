import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { Model, SimpleStreamOptions, AssistantMessageEventStream, Context } from "@earendil-works/pi-ai";
import { streamSimple as openAiStreamSimple } from "@earendil-works/pi-ai/api/openai-completions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });

export const LLM_BASE_URL = process.env.LLM_BASE_URL || "";
export const LLM_API_KEY = process.env.LLM_API_KEY || "";
export const LLM_MODEL_STRONG = process.env.LLM_MODEL_STRONG || "deepseek-v4-pro-ga-260813";

if (!LLM_BASE_URL || !LLM_API_KEY) {
  throw new Error("Missing LLM_BASE_URL or LLM_API_KEY in spikes/.env.local");
}

export function createModel(modelId = LLM_MODEL_STRONG): Model<"openai-completions"> {
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: "custom",
    baseUrl: LLM_BASE_URL,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1048576,
    maxTokens: 4096,
  };
}

export const customStreamFn = (
  model: Model<any>,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream => {
  return openAiStreamSimple(model as Model<"openai-completions">, context, {
    ...options,
    apiKey: LLM_API_KEY,
  });
};
