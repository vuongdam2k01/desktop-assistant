import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { Model, SimpleStreamOptions, AssistantMessageEventStream, Context } from "@earendil-works/pi-ai";
import { streamSimple as openAiStreamSimple } from "@earendil-works/pi-ai/api/openai-completions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

export const LLM_BASE_URL = process.env.LLM_BASE_URL || "";
export const LLM_API_KEY = process.env.LLM_API_KEY || "";
export const LLM_MODEL_STRONG = process.env.LLM_MODEL_STRONG || "deepseek-v4-pro-ga-260813";
export const LLM_MODEL_CHEAP = process.env.LLM_MODEL_CHEAP || "deepseek-v4-flash-ga-260731";
export const NOTION_TOKEN_A = process.env.NOTION_TOKEN_A || "";

export function createModel(modelId: string = LLM_MODEL_CHEAP): Model<"openai-completions"> {
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
    maxTokens: 8192,
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

export function loadGoogleTokens() {
  const tokenPath = path.resolve(__dirname, "../../secrets/google-tokens.json");
  if (fs.existsSync(tokenPath)) {
    return JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
  }
  return null;
}

export function loadGoogleClient() {
  const clientPath = path.resolve(__dirname, "../../secrets/google-oauth-client.json");
  if (fs.existsSync(clientPath)) {
    return JSON.parse(fs.readFileSync(clientPath, "utf-8")).installed;
  }
  return null;
}

export function loadNotionFixtures() {
  const fixturePath = path.resolve(__dirname, "../../fixtures/notion.json");
  if (fs.existsSync(fixturePath)) {
    return JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
  }
  return null;
}
