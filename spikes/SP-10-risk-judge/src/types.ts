export type GroundTruthLabel = "AN TOÀN" | "NGUY HIỂM" | "MƠ HỒ";
export type JudgeDecision = "AUTO_APPROVE" | "AUTO_REJECT" | "ESCALATE_USER";
export type RiskLevel = "LOW" | "HIGH" | "UNCERTAIN";

export interface TestCase {
  id: string;
  toolCall: string;
  targetDescription: string;
  groundTruth: GroundTruthLabel;
  reason: string;
  irreversible: string;
  staticPattern: string;
  hasPersuasiveText: boolean;
  persuasiveTextSnippet?: string;
  contextNote?: string;
}

export interface JudgeEvaluation {
  decision: JudgeDecision;
  risk_level: RiskLevel;
  reasoning: string;
  is_fallback?: boolean;
}

export interface RunRecord {
  caseId: string;
  model: string;
  repeatIndex: number;
  groundTruth: GroundTruthLabel;
  decision: JudgeDecision;
  riskLevel: RiskLevel;
  reasoning: string;
  isFallback: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  hasPersuasiveText: boolean;
  isExactMatch: boolean;
  isSafe: boolean;
  isStrictFalseAllow: boolean;
  isBroadFalseAllow: boolean;
}

export interface MatrixRow {
  AUTO_APPROVE: number;
  AUTO_REJECT: number;
  ESCALATE_USER: number;
  total: number;
}

export interface ConfusionMatrix {
  "AN TOÀN": MatrixRow;
  "NGUY HIỂM": MatrixRow;
  "MƠ HỒ": MatrixRow;
  totalRuns: number;
  exactMatches: number;
  exactAccuracy: number;
  safeDecisions: number;
  safeAccuracy: number;
  strictFalseAllowCount: number;
  strictFalseAllowRate: number;
  broadFalseAllowCount: number;
  broadFalseAllowRate: number;
}

export interface LatencyStats {
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  p90Ms: number;
}

export interface TokenStats {
  meanPromptTokens: number;
  meanCompletionTokens: number;
  meanReasoningTokens: number;
  meanTotalTokens: number;
}

export interface ModelSummary {
  modelName: string;
  totalRuns: number;
  latency: LatencyStats;
  tokens: TokenStats;
  estimatedCostPerCallUsd: number;
  estimatedCostSimpleJobUsd: number;
  estimatedCostComplexJobUsd: number;
  confusionMatrix: ConfusionMatrix;
  consistencyRate: number; // % of testcases with 100% agreement across 3 repeats
  persuasionStats: {
    totalPersuasiveRuns: number;
    persuasiveFooledCount: number; // decision == AUTO_APPROVE
    persuasionResistanceRate: number; // 1 - fooled
    details: Record<string, { groundTruth: GroundTruthLabel; decisions: JudgeDecision[]; fooled: boolean }>;
  };
}
