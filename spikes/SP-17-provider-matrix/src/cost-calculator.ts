import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, "../evidence");
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

export const USD_TO_VND = 25400;

export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface Pricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface ProviderPlan {
  id: string;
  name: string;
  description: string;
  cheapPricing: Pricing;
  strongPricing: Pricing;
}

export const PROVIDER_PLANS: ProviderPlan[] = [
  {
    id: "ark-dual-optimal",
    name: "BytePlus Ark Coding Plan (Định tuyến phân vai tối ưu)",
    description: "Pet & Judge: DeepSeek V4 Flash | Worker, Rule & Undo: DeepSeek V4 Pro",
    cheapPricing: { inputPerMillion: 0.07, outputPerMillion: 0.28 }, // Flash
    strongPricing: { inputPerMillion: 0.27, outputPerMillion: 1.10 }, // Pro
  },
  {
    id: "ark-all-pro",
    name: "BytePlus Ark Coding Plan (Toàn bộ dùng Pro)",
    description: "Toàn bộ 4 vai trò + Judge đều dùng DeepSeek V4 Pro",
    cheapPricing: { inputPerMillion: 0.27, outputPerMillion: 1.10 },
    strongPricing: { inputPerMillion: 0.27, outputPerMillion: 1.10 },
  },
  {
    id: "openai-dual",
    name: "OpenAI BYO (GPT-4o-mini + GPT-4o)",
    description: "Pet & Judge: GPT-4o-mini | Worker, Rule & Undo: GPT-4o",
    cheapPricing: { inputPerMillion: 0.15, outputPerMillion: 0.60 },
    strongPricing: { inputPerMillion: 2.50, outputPerMillion: 10.00 },
  },
  {
    id: "openai-all-mini",
    name: "OpenAI BYO (Tiết kiệm - 100% GPT-4o-mini)",
    description: "Toàn bộ vai trò dùng GPT-4o-mini (Vision + Tool calling sẵn)",
    cheapPricing: { inputPerMillion: 0.15, outputPerMillion: 0.60 },
    strongPricing: { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  },
  {
    id: "anthropic-dual",
    name: "Anthropic BYO (Claude 3.5 Haiku + Sonnet)",
    description: "Pet & Judge: Claude 3.5 Haiku | Worker, Rule & Undo: Claude 3.5 Sonnet",
    cheapPricing: { inputPerMillion: 0.80, outputPerMillion: 4.00 },
    strongPricing: { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  },
];

// Dữ liệu token thực tế từ các spike
export const TOKEN_PROFILES = {
  // Pet ACK (đo thực tế tại SP-17)
  petAck: {
    inputTokens: 350,
    outputTokens: 25,
    totalTokens: 375,
  },
  // Worker-agent (đo thực tế tại SP-4 trên 20 kịch bản)
  workerSimple: {
    inputTokens: 14705,
    outputTokens: 3676,
    totalTokens: 18381,
  },
  workerMedium: {
    inputTokens: 19205,
    outputTokens: 4802,
    totalTokens: 24007,
  },
  workerComplex: {
    inputTokens: 26391,
    outputTokens: 6598,
    totalTokens: 32989,
  },
  workerAverage: {
    inputTokens: 18708,
    outputTokens: 4677,
    totalTokens: 23385,
  },
  // Risk Judge Tier 2 (đo thực tế tại SP-10): trung bình 1.5 call ghi/job
  riskJudgePerCall: {
    inputTokens: 1485,
    outputTokens: 353,
    totalTokens: 1838,
  },
  riskJudgePerJob: {
    inputTokens: 1485 * 1.5,
    outputTokens: 353 * 1.5,
    totalTokens: 1838 * 1.5,
  },
  // Undo-agent (đo thực tế tại SP-9): xác suất dùng ~20% số job
  undoPerInvocation: {
    inputTokens: 2000,
    outputTokens: 500,
    totalTokens: 2500,
  },
  // Bộ đúc kết quy tắc (đo thực tế tại SP-2): tính theo tháng (2 quy tắc mới/tháng)
  ruleElicitationMonthly: {
    inputTokens: 5200 * 2,
    outputTokens: 1300 * 2,
    totalTokens: 6500 * 2,
  },
};

function computeCost(tokens: TokenStats, pricing: Pricing): number {
  return (
    (tokens.inputTokens / 1_000_000) * pricing.inputPerMillion +
    (tokens.outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}

export interface MonthlyCostReport {
  intensityTier: string;
  jobsPerMonth: number;
  jobsPerWeek: number;
  plans: {
    planId: string;
    planName: string;
    monthlyTokenTotal: number;
    workerCostUsd: number;
    petAckCostUsd: number;
    judgeCostUsd: number;
    undoCostUsd: number;
    ruleCostUsd: number;
    totalCostUsd: number;
    totalCostVnd: number;
    costPerJobUsd: number;
    costPerJobVnd: number;
  }[];
}

export function calculateMonthlyCosts(): MonthlyCostReport[] {
  const intensityTiers = [
    { tier: "M-V1 Chuẩn (Baseline: ≥3 job/tuần)", jobsPerMonth: 15, jobsPerWeek: 3.5 },
    { tier: "Trung bình (Moderate: 1 job/ngày)", jobsPerMonth: 30, jobsPerWeek: 7 },
    { tier: "Cường độ cao (Power User: 2 jobs/ngày)", jobsPerMonth: 60, jobsPerWeek: 14 },
  ];

  return intensityTiers.map((intensity) => {
    const jobs = intensity.jobsPerMonth;
    const undoRuns = Math.round(jobs * 0.2); // 20% jobs được undo

    const planReports = PROVIDER_PLANS.map((plan) => {
      // 1. Worker cost (dùng STRONG pricing)
      const workerTokensTotal: TokenStats = {
        inputTokens: TOKEN_PROFILES.workerAverage.inputTokens * jobs,
        outputTokens: TOKEN_PROFILES.workerAverage.outputTokens * jobs,
        totalTokens: TOKEN_PROFILES.workerAverage.totalTokens * jobs,
      };
      const workerCostUsd = computeCost(workerTokensTotal, plan.strongPricing);

      // 2. Pet ACK cost (dùng CHEAP pricing)
      const petAckTokensTotal: TokenStats = {
        inputTokens: TOKEN_PROFILES.petAck.inputTokens * jobs,
        outputTokens: TOKEN_PROFILES.petAck.outputTokens * jobs,
        totalTokens: TOKEN_PROFILES.petAck.totalTokens * jobs,
      };
      const petAckCostUsd = computeCost(petAckTokensTotal, plan.cheapPricing);

      // 3. Risk Judge cost (dùng CHEAP pricing)
      const judgeTokensTotal: TokenStats = {
        inputTokens: TOKEN_PROFILES.riskJudgePerJob.inputTokens * jobs,
        outputTokens: TOKEN_PROFILES.riskJudgePerJob.outputTokens * jobs,
        totalTokens: TOKEN_PROFILES.riskJudgePerJob.totalTokens * jobs,
      };
      const judgeCostUsd = computeCost(judgeTokensTotal, plan.cheapPricing);

      // 4. Undo cost (dùng STRONG pricing)
      const undoTokensTotal: TokenStats = {
        inputTokens: TOKEN_PROFILES.undoPerInvocation.inputTokens * undoRuns,
        outputTokens: TOKEN_PROFILES.undoPerInvocation.outputTokens * undoRuns,
        totalTokens: TOKEN_PROFILES.undoPerInvocation.totalTokens * undoRuns,
      };
      const undoCostUsd = computeCost(undoTokensTotal, plan.strongPricing);

      // 5. Rule Elicitation cost (dùng STRONG pricing)
      const ruleCostUsd = computeCost(TOKEN_PROFILES.ruleElicitationMonthly, plan.strongPricing);

      const totalMonthlyTokens =
        workerTokensTotal.totalTokens +
        petAckTokensTotal.totalTokens +
        judgeTokensTotal.totalTokens +
        undoTokensTotal.totalTokens +
        TOKEN_PROFILES.ruleElicitationMonthly.totalTokens;

      const totalCostUsd = workerCostUsd + petAckCostUsd + judgeCostUsd + undoCostUsd + ruleCostUsd;
      const totalCostVnd = Math.round(totalCostUsd * USD_TO_VND);
      const costPerJobUsd = totalCostUsd / jobs;
      const costPerJobVnd = Math.round(costPerJobUsd * USD_TO_VND);

      return {
        planId: plan.id,
        planName: plan.name,
        monthlyTokenTotal: totalMonthlyTokens,
        workerCostUsd: Math.round(workerCostUsd * 10000) / 10000,
        petAckCostUsd: Math.round(petAckCostUsd * 10000) / 10000,
        judgeCostUsd: Math.round(judgeCostUsd * 10000) / 10000,
        undoCostUsd: Math.round(undoCostUsd * 10000) / 10000,
        ruleCostUsd: Math.round(ruleCostUsd * 10000) / 10000,
        totalCostUsd: Math.round(totalCostUsd * 1000) / 1000,
        totalCostVnd,
        costPerJobUsd: Math.round(costPerJobUsd * 10000) / 10000,
        costPerJobVnd,
      };
    });

    return {
      intensityTier: intensity.tier,
      jobsPerMonth: intensity.jobsPerMonth,
      jobsPerWeek: intensity.jobsPerWeek,
      plans: planReports,
    };
  });
}

export function runCostAnalysis() {
  console.log("================================================================================");
  console.log("SPIKE SP-17 / Q6: ƯỚC TÍNH CHI PHÍ LLM MỘT THÁNG Ở CƯỜNG ĐỘ M-V1");
  console.log("Dựa trên số token đo thật từ SP-4 (Agent Loop), SP-10 (Risk Judge), SP-2 (Rules), SP-9 (Undo)");
  console.log("================================================================================\n");

  const reports = calculateMonthlyCosts();

  reports.forEach((report) => {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`CƯỜNG ĐỘ: ${report.intensityTier} (~${report.jobsPerMonth} jobs/tháng)`);
    console.log(`--------------------------------------------------------------------------------`);
    console.table(
      report.plans.map((p) => ({
        "Gói Provider": p.planName.slice(0, 35),
        "Tổng Tokens": p.monthlyTokenTotal.toLocaleString(),
        "Tổng USD/tháng": `$${p.totalCostUsd.toFixed(3)}`,
        "Tổng VNĐ/tháng": `${p.totalCostVnd.toLocaleString()} đ`,
        "Cost/job (USD)": `$${p.costPerJobUsd.toFixed(4)}`,
        "Cost/job (VNĐ)": `${p.costPerJobVnd.toLocaleString()} đ`,
      }))
    );
  });

  const evidencePath = path.resolve(evidenceDir, "monthly-cost-matrix.json");
  fs.writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        calculatedAt: new Date().toISOString(),
        exchangeRateUsdToVnd: USD_TO_VND,
        tokenProfiles: TOKEN_PROFILES,
        providerPlans: PROVIDER_PLANS,
        reports,
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`\n✅ Đã lưu ma trận chi phí vào: ${evidencePath}\n`);

  return reports;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCostAnalysis();
}
