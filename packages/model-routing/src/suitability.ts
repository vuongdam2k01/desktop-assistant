import type { SuitabilityVerdict, RoleKey } from './types.js';

const RAW_SUITABILITY_RECORDS = [
  // Rule Elicitation
  {
    role: 'rule-elicitation',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash',
    verdict: 'unsuitable',
    evidence: 'spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan',
    summary:
      'Cheap model exhibited 25% silent downgrade on uncompilable rules (RISK-024). Agrees with invalid rules rather than refusing.',
  },
  {
    role: 'rule-elicitation',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash-ga-260731',
    verdict: 'unsuitable',
    evidence: 'spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan',
    summary:
      'Cheap model exhibited 25% silent downgrade on uncompilable rules (RISK-024). Agrees with invalid rules rather than refusing.',
  },
  {
    role: 'rule-elicitation',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro',
    verdict: 'suitable',
    evidence: 'spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan',
    summary: 'Strong model converged with 100% accuracy and 0.0% silent downgrade across all rule elicitation cases.',
  },
  {
    role: 'rule-elicitation',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro-ga-260813',
    verdict: 'suitable',
    evidence: 'spikes/SP-2-rule-elicitation/REPORT.md#0-ket-luan',
    summary: 'Strong model converged with 100% accuracy and 0.0% silent downgrade across all rule elicitation cases.',
  },

  // Undo Agent
  {
    role: 'undo',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash',
    verdict: 'unsuitable',
    evidence: 'spikes/SP-9-undo-agent/REPORT.md#0-ket-luan',
    summary: 'High risk of incorrect compensating action ordering and missed conflict detection on multi-step jobs.',
  },
  {
    role: 'undo',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash-ga-260731',
    verdict: 'unsuitable',
    evidence: 'spikes/SP-9-undo-agent/REPORT.md#0-ket-luan',
    summary: 'High risk of incorrect compensating action ordering and missed conflict detection on multi-step jobs.',
  },
  {
    role: 'undo',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro',
    verdict: 'suitable',
    evidence: 'spikes/SP-9-undo-agent/REPORT.md#0-ket-luan',
    summary: 'Generated correct reverse compensating sequence in 100% of sample jobs with zero false-negative conflicts.',
  },
  {
    role: 'undo',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro-ga-260813',
    verdict: 'suitable',
    evidence: 'spikes/SP-9-undo-agent/REPORT.md#0-ket-luan',
    summary: 'Generated correct reverse compensating sequence in 100% of sample jobs with zero false-negative conflicts.',
  },

  // Risk Judge (Cheap is optimal and default)
  {
    role: 'risk-judge',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash',
    verdict: 'suitable',
    evidence: 'spikes/SP-10-risk-judge/REPORT.md#0-ket-luan',
    summary: 'Achieved 0.0% strict false-allow on dangerous operations with median latency 3,154 ms at $0.000203/call.',
  },
  {
    role: 'risk-judge',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash-ga-260731',
    verdict: 'suitable',
    evidence: 'spikes/SP-10-risk-judge/REPORT.md#0-ket-luan',
    summary: 'Achieved 0.0% strict false-allow on dangerous operations with median latency 3,154 ms at $0.000203/call.',
  },
  {
    role: 'risk-judge',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro',
    verdict: 'suitable',
    evidence: 'spikes/SP-10-risk-judge/REPORT.md#0-ket-luan',
    summary: '0.0% strict false-allow on dangerous operations, available as explicit user override for maximum reasoning.',
  },
  {
    role: 'risk-judge',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro-ga-260813',
    verdict: 'suitable',
    evidence: 'spikes/SP-10-risk-judge/REPORT.md#0-ket-luan',
    summary: '0.0% strict false-allow on dangerous operations, available as explicit user override for maximum reasoning.',
  },

  // Pet Image (Vision required)
  {
    role: 'pet-image',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash',
    verdict: 'unsuitable',
    evidence: 'spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q1',
    summary: '100% protocol error rejection on images (HTTP 400 InvalidParameter), silent empty stream.',
  },
  {
    role: 'pet-image',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro',
    verdict: 'unsuitable',
    evidence: 'spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q1',
    summary: '100% protocol error rejection on images (HTTP 400 InvalidParameter), silent empty stream.',
  },
  {
    role: 'pet-image',
    profileId: 'shipped:byteplus-ark',
    model: 'seed-2-0-pro',
    verdict: 'suitable',
    evidence: 'spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q1',
    summary: '100% accuracy extracting tasks and metadata from attached screenshots.',
  },
  {
    role: 'pet-image',
    profileId: 'shipped:byteplus-ark',
    model: 'seed-2-0-pro-260328',
    verdict: 'suitable',
    evidence: 'spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q1',
    summary: '100% accuracy extracting tasks and metadata from attached screenshots.',
  },

  // Pet Text
  {
    role: 'pet-text',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash',
    verdict: 'suitable',
    evidence: 'spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q2',
    summary: 'Fastest text latency (P50 TTFT 1,916 ms) satisfying the ≤2s acknowledgement target.',
  },
  {
    role: 'pet-text',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-flash-ga-260731',
    verdict: 'suitable',
    evidence: 'spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi Q2',
    summary: 'Fastest text latency (P50 TTFT 1,916 ms) satisfying the ≤2s acknowledgement target.',
  },

  // Worker
  {
    role: 'worker',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro',
    verdict: 'suitable',
    evidence: 'spikes/SP-4-agent-loop/REPORT.md',
    summary: '85% final state correctness and 95% self-verification across multi-step agentic workflows.',
  },
  {
    role: 'worker',
    profileId: 'shipped:byteplus-ark',
    model: 'deepseek-v4-pro-ga-260813',
    verdict: 'suitable',
    evidence: 'spikes/SP-4-agent-loop/REPORT.md',
    summary: '85% final state correctness and 95% self-verification across multi-step agentic workflows.',
  },
] as const satisfies readonly SuitabilityVerdict[];

export const SHIPPED_SUITABILITY_RECORDS: readonly SuitabilityVerdict[] =
  Object.freeze(RAW_SUITABILITY_RECORDS.map((r) => Object.freeze({ ...r })));

/**
 * Returns a suitability verdict if one was measured for the specified model in the role.
 */
export function findSuitabilityVerdict(
  role: RoleKey,
  profileId: string,
  model: string
): SuitabilityVerdict | null {
  const match = SHIPPED_SUITABILITY_RECORDS.find(
    (record) =>
      record.role === role &&
      record.profileId === profileId &&
      record.model.toLowerCase() === model.toLowerCase()
  );
  return match ?? null;
}

/**
 * Returns all measured verdicts for a role.
 */
export function getMeasuredVerdictsForRole(role: RoleKey): SuitabilityVerdict[] {
  return SHIPPED_SUITABILITY_RECORDS.filter((r) => r.role === role);
}

/**
 * Checks whether a model is explicitly measured as unsuitable for a role.
 */
export function isModelMeasuredUnsuitable(
  role: RoleKey,
  profileId: string,
  model: string
): boolean {
  const verdict = findSuitabilityVerdict(role, profileId, model);
  return verdict !== null && verdict.verdict === 'unsuitable';
}
