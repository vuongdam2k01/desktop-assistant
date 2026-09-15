import type { Verdict, MatchedRuleInfo, Decision } from '../types.js';

const VERDICT_STRICTNESS: Record<Verdict, number> = {
  refuse: 3,
  hold: 2,
  allow: 1,
};

/**
 * Resolves multiple matched rule decisions using the normative strictest-wins algorithm.
 * refuse > hold > allow.
 * Sorts matched rules by strictness (strictest first).
 */
export function resolveStrictestVerdict(
  matchedRules: readonly MatchedRuleInfo[],
  fallbackVerdict: Verdict = 'allow',
  fallbackReason = 'No matching stopping rules found.'
): Decision {
  if (matchedRules.length === 0) {
    return {
      verdict: fallbackVerdict,
      matched: [],
      reason: fallbackReason,
    };
  }

  // Sort matched rules by strictness descending
  const sorted = [...matchedRules].sort(
    (a, b) => VERDICT_STRICTNESS[b.verdict] - VERDICT_STRICTNESS[a.verdict]
  );

  const top = sorted[0];
  const strictestVerdict = top ? top.verdict : fallbackVerdict;

  // Has any unappealable hardline refusal
  const hasHardlineRefusal = sorted.some(
    (r) => r.origin === 'hardline' && r.verdict === 'refuse'
  );

  // Compose explanatory reason from strictest matching rules
  const reasons = sorted
    .filter((r) => r.verdict === strictestVerdict)
    .map((r) => `[${r.origin.toUpperCase()}] ${r.name} (${r.ruleId})`);

  const reason =
    strictestVerdict === 'allow'
      ? 'All matching rules permit this operation.'
      : `${strictestVerdict === 'refuse' ? 'Refused' : 'Held for approval'} by: ${reasons.join('; ')}`;

  return {
    verdict: strictestVerdict,
    matched: sorted,
    reason,
    ...(hasHardlineRefusal ? { unappealable: true } : {}),
  };
}
