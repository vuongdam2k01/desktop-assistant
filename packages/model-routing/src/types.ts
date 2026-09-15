import type { ProviderProfile } from '@desktop-assistant/contracts/provider-profile';
import type { RoutingTable, Assignment } from '@desktop-assistant/contracts/role-routing';
import type { FailureNotice } from '@desktop-assistant/contracts/provider-failure';
import type { UsageRecord, UnitPrice } from '@desktop-assistant/contracts/usage-accounting';
import type { RoutingErrorCode } from './errors.js';

export const CORE_ROLES = [
  'pet-text',
  'pet-image',
  'worker',
  'rule-elicitation',
  'undo',
  'risk-judge',
] as const;

export type CoreRole = (typeof CORE_ROLES)[number];
export type RoleKey = string;

export type FailureCause = FailureNotice['cause'];
export type Remedy = FailureNotice['remedy'];

export type ModelCapability = 'text' | 'images' | 'reasoning' | 'tools';

export interface InputShape {
  carriesImages: boolean;
}

export interface CapabilityRequirement {
  role: RoleKey;
  required: ModelCapability[];
}

export interface SuitabilityVerdict {
  role: RoleKey;
  profileId: string;
  model: string;
  verdict: 'suitable' | 'unsuitable';
  evidence: string;
  summary: string;
}

export type AssignOutcome =
  | { ok: true }
  | { ok: false; error: RoutingErrorCode; detail: string }
  | { ok: false; error: 'UNMEASURED_NEEDS_ACKNOWLEDGEMENT'; measured: SuitabilityVerdict[] };

export interface ResolvedRoute {
  profileId: string;
  model: string;
  credentialKey: string;
  endpoint: ProviderProfile['endpoint'];
}

export type Resolution =
  | { ok: true; profileId: string; model: string; credentialKey: string; endpoint: ProviderProfile['endpoint'] }
  | { ok: false; error: RoutingErrorCode; role: RoleKey; detail: string };

export interface FailureObservation {
  transport: 'answered' | 'unreachable' | 'timed-out';
  httpStatus?: number | undefined;
  providerCode?: string | undefined;
  providerMessage?: string | undefined;
  completedEmpty?: boolean | undefined;
  profileId: string;
  role: RoleKey;
  model: string;
}

export interface JobRoutingSnapshot {
  jobId: string;
  role: RoleKey;
  profileId: string;
  model: string;
  createdAt: string;
}

export interface ImageRouteState {
  available: boolean;
  reason?: RoutingErrorCode | undefined;
}

export type RecordedCost = NonNullable<UsageRecord['cost']>;

export interface JobUsage {
  jobId: string;
  records: UsageRecord[];
  byRole: Array<{
    role: UsageRecord['role'];
    inputTokens: number;
    outputTokens: number;
    cost?: RecordedCost;
  }>;
  total: {
    inputTokens: number;
    outputTokens: number;
    cost?: RecordedCost;
    incompleteReason?: 'job-running' | 'usage-not-reported' | 'no-price-configured';
  };
}

export interface ModelRequestContext {
  systemPrompt?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string | Array<
      | { type: 'text'; text: string }
      | { type: 'image'; data: string; mimeType: string }
    >;
    timestamp?: number;
  }>;
}

export interface ModelRequestOptions {
  jobId: string;
  requestId: string;
  role: RoleKey;
  inputShape?: InputShape;
  context: ModelRequestContext;
  timeoutMs?: number;
}

export interface ModelRequestResult {
  text: string;
  usage?: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    totalTokens?: number | undefined;
  } | undefined;
  stopReason?: string | undefined;
  durationMs: number;
}
export type {
  ProviderProfile,
  RoutingTable,
  Assignment,
  FailureNotice,
  UsageRecord,
  UnitPrice,
};
