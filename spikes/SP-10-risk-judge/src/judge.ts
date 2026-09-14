import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { TestCase, JudgeDecision, RiskLevel } from "./types.js";
import { RISK_JUDGE_SYSTEM_PROMPT, buildRiskJudgeUserPrompt } from "./prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

export const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/coding/v3";
export const LLM_API_KEY = process.env.LLM_API_KEY || "";
export const LLM_MODEL_STRONG = process.env.LLM_MODEL_STRONG || "deepseek-v4-pro-ga-260813";
export const LLM_MODEL_CHEAP = process.env.LLM_MODEL_CHEAP || "deepseek-v4-flash-ga-260731";

export interface JudgeOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  temperature?: number;
}

export interface JudgeResult {
  decision: JudgeDecision;
  riskLevel: RiskLevel;
  reasoning: string;
  isFallback: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  rawResponseText?: string;
  errorDetail?: string;
}

export async function evaluateRisk(
  tc: TestCase,
  modelId: string,
  options: JudgeOptions = {}
): Promise<JudgeResult> {
  const baseUrl = options.baseUrl ?? LLM_BASE_URL;
  const apiKey = options.apiKey ?? LLM_API_KEY;
  const timeoutMs = options.timeoutMs ?? 20000;
  const temperature = options.temperature ?? 0.0;

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const userPrompt = buildRiskJudgeUserPrompt(tc);
    const body = {
      model: modelId,
      messages: [
        { role: "system", content: RISK_JUDGE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature,
      response_format: { type: "json_object" }
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutHandle);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const rawContent = choice?.message?.content || "";
    const usage = data.usage || {};

    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const reasoningTokens =
      usage.completion_tokens_details?.reasoning_tokens ||
      (choice?.message?.reasoning_content ? Math.round(choice.message.reasoning_content.length / 4) : 0);
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    // Parse JSON
    let parsed: any;
    try {
      const cleanJson = rawContent
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch (parseErr: any) {
      throw new Error(`JSON parse error from model response: ${parseErr.message} — raw: ${rawContent.slice(0, 150)}`);
    }

    let decision: JudgeDecision;
    const decStr = String(parsed.decision || "").toUpperCase().trim();
    if (decStr === "AUTO_APPROVE" || decStr === "APPROVE" || decStr === "LOW_RISK") {
      decision = "AUTO_APPROVE";
    } else if (decStr === "AUTO_REJECT" || decStr === "REJECT" || decStr === "HIGH_RISK" || decStr === "DENY") {
      decision = "AUTO_REJECT";
    } else if (decStr === "ESCALATE_USER" || decStr === "ESCALATE" || decStr === "ASK_USER" || decStr === "UNCERTAIN") {
      decision = "ESCALATE_USER";
    } else {
      throw new Error(`Invalid decision field value: "${decStr}"`);
    }

    let riskLevel: RiskLevel;
    const rlStr = String(parsed.risk_level || "").toUpperCase().trim();
    if (rlStr === "LOW") riskLevel = "LOW";
    else if (rlStr === "HIGH") riskLevel = "HIGH";
    else riskLevel = "UNCERTAIN";

    const reasoning = parsed.reasoning || parsed.explanation || "Không có giải thích chi tiết";

    return {
      decision,
      riskLevel,
      reasoning,
      isFallback: false,
      latencyMs,
      promptTokens,
      completionTokens,
      reasoningTokens,
      totalTokens,
      rawResponseText: rawContent
    };
  } catch (error: any) {
    clearTimeout(timeoutHandle);
    const latencyMs = Math.round(performance.now() - startTime);

    // 🔴 CRITICAL FAIL-CLOSED BEHAVIOR (FR-AP-01b / FR-AP-13):
    // If the judge call fails for ANY reason, fallback to ESCALATE_USER!
    return {
      decision: "ESCALATE_USER",
      riskLevel: "UNCERTAIN",
      reasoning: `FAIL-CLOSED FALLBACK: Lời gọi risk judge thất bại (${error.message}). Đẩy lên người dùng duyệt an toàn.`,
      isFallback: true,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      errorDetail: error.message
    };
  }
}
