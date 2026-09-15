import type { FailureNotice } from '@desktop-assistant/contracts/provider-failure';
import type { FailureObservation, FailureCause, Remedy } from './types.js';

export class FailureClassifier {
  private readonly now: () => string;

  constructor(now?: () => string) {
    this.now = now ?? (() => new Date().toISOString());
  }

  classify(observation: FailureObservation): FailureNotice {
    const { cause, remedy } = this.determineCauseAndRemedy(observation);
    const dedupeKey = `${observation.profileId}:${cause}`;

    let providerDetail: string | undefined = undefined;
    if (observation.providerMessage || observation.providerCode) {
      let raw = `${observation.providerCode ? observation.providerCode + ': ' : ''}${
        observation.providerMessage ?? ''
      }`.trim();
      // Redact potential bearer tokens or API keys from error detail
      raw = raw
        .replace(/sk-[a-zA-Z0-9_-]{10,}/g, 'sk-[REDACTED]')
        .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
        .replace(/AIza[0-9A-Za-z-_]{30,}/g, 'AIza[REDACTED]');
      // Length-bounded string to prevent massive error payloads from leaking into UI
      providerDetail = raw.slice(0, 500);
    } else if (observation.completedEmpty) {
      providerDetail = 'Model completed response stream with zero tokens, no content, and no error.';
    }

    return {
      cause,
      profileId: observation.profileId,
      roles: [observation.role as FailureNotice['roles'][number]],
      remedy,
      ...(providerDetail ? { providerDetail } : {}),
      observedAt: this.now(),
      dedupeKey,
    };
  }

  private determineCauseAndRemedy(observation: FailureObservation): {
    cause: FailureCause;
    remedy: Remedy;
  } {
    const status = observation.httpStatus;
    const msg = (observation.providerMessage ?? '').toLowerCase();
    const code = (observation.providerCode ?? '').toLowerCase();

    // 1. Network / Transport unreachable or timed-out
    if (observation.transport === 'unreachable' || observation.transport === 'timed-out') {
      return {
        cause: 'ENDPOINT_UNREACHABLE',
        remedy: { kind: 'network' },
      };
    }

    if (
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed')
    ) {
      return {
        cause: 'ENDPOINT_UNREACHABLE',
        remedy: { kind: 'network' },
      };
    }

    // 2. Configuration version ahead
    if (code.includes('version_ahead') || msg.includes('version ahead')) {
      return {
        cause: 'CONFIGURATION_AHEAD',
        remedy: { kind: 'product-update' },
      };
    }

    // 3. Credential Refused (401 / 403)
    if (
      status === 401 ||
      status === 403 ||
      code.includes('authenticationerror') ||
      code.includes('unauthorized') ||
      code.includes('invalid_api_key') ||
      msg.includes('api key') ||
      msg.includes('unauthorized') ||
      msg.includes('forbidden')
    ) {
      return {
        cause: 'CREDENTIAL_REFUSED',
        remedy: { kind: 'profile-credential', profileId: observation.profileId },
      };
    }

    // 4. Model Unavailable (404, unsupported model)
    if (
      status === 404 ||
      code.includes('unsupportedmodel') ||
      code.includes('model_not_found') ||
      code.includes('notfound') ||
      msg.includes('model does not exist') ||
      msg.includes('model not found') ||
      msg.includes('unsupported model') ||
      msg.includes('does not support the coding plan')
    ) {
      return {
        cause: 'MODEL_UNAVAILABLE',
        remedy: { kind: 'role-assignment', role: observation.role },
      };
    }

    // 5. Quota Exhausted (429, rate limit, credits)
    if (
      status === 429 ||
      code.includes('ratelimit') ||
      code.includes('insufficient_quota') ||
      msg.includes('rate limit') ||
      msg.includes('quota') ||
      msg.includes('insufficient balance') ||
      msg.includes('exceeded your current quota')
    ) {
      return {
        cause: 'QUOTA_EXHAUSTED',
        remedy: { kind: 'provider-account', profileId: observation.profileId },
      };
    }

    // 6. Response Unusable (empty stream or unparseable/unusable response floor)
    return {
      cause: 'RESPONSE_UNUSABLE',
      remedy: { kind: 'role-assignment', role: observation.role },
    };
  }
}
