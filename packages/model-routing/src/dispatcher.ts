import type { CredentialStore } from '@desktop-assistant/credential-store';
import type { UsageRecord } from '@desktop-assistant/contracts/usage-accounting';
import { RoutingRegistry } from './routing-registry.js';
import { FailureClassifier } from './failure-classifier.js';
import { FailureRegistry } from './failure-registry.js';
import { UsageAccounting } from './usage-accounting.js';
import {
  type ModelRequestOptions,
  type ModelRequestResult,
  type InputShape,
  type FailureObservation,
  type ResolvedRoute,
} from './types.js';
import { RoutingError, ProviderFailureError, UsageAccountingError } from './errors.js';

export interface ProviderExecutionInput {
  route: ResolvedRoute;
  apiKey: string;
  context: ModelRequestOptions['context'];
  timeoutMs?: number | undefined;
}

export interface ProviderExecutionOutput {
  text: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }> | undefined;
  usage?: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    totalTokens?: number | undefined;
  } | undefined;
  stopReason?: string | undefined;
  httpStatus?: number | undefined;
}

export type ProviderRunner = (
  input: ProviderExecutionInput
) => Promise<ProviderExecutionOutput>;

export interface ModelRequestDispatcherOptions {
  routingRegistry: RoutingRegistry;
  failureClassifier: FailureClassifier;
  failureRegistry: FailureRegistry;
  usageAccounting: UsageAccounting;
  credentialStore?: CredentialStore | undefined;
  runner?: ProviderRunner | undefined;
  now?: (() => string) | undefined;
}

export class ModelRequestDispatcher {
  private readonly routingRegistry: RoutingRegistry;
  private readonly failureClassifier: FailureClassifier;
  private readonly failureRegistry: FailureRegistry;
  private readonly usageAccounting: UsageAccounting;
  private readonly credentialStore?: CredentialStore | undefined;
  private readonly runner: ProviderRunner;
  private readonly now: () => string;

  constructor(options: ModelRequestDispatcherOptions) {
    this.routingRegistry = options.routingRegistry;
    this.failureClassifier = options.failureClassifier;
    this.failureRegistry = options.failureRegistry;
    this.usageAccounting = options.usageAccounting;
    this.credentialStore = options.credentialStore;
    this.runner = options.runner ?? defaultProviderRunner;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async dispatch(options: ModelRequestOptions): Promise<ModelRequestResult> {
    const startTime = Date.now();
    const carriesImages = this.detectCarriesImages(options);
    const shape: InputShape = { carriesImages };

    // 1. Resolve route through the routing table (honoring job snapshots)
    const resolution = await this.routingRegistry.resolve(
      options.role,
      shape,
      options.jobId
    );

    if (!resolution.ok) {
      throw new RoutingError({
        code: resolution.error,
        role: resolution.role,
        detail: resolution.detail,
      });
    }

    const { profileId, model, credentialKey, endpoint } = resolution;
    const route: ResolvedRoute = { profileId, model, credentialKey, endpoint };

    // 2. Resolve secret from CredentialStore (F3) - Fail closed if store absent
    if (!this.credentialStore) {
      throw new RoutingError({
        code: 'PROFILE_CREDENTIAL_ABSENT',
        role: options.role,
        profileId,
        model,
        detail: `CredentialStore is required to resolve credentials on this device`,
      });
    }

    let apiKey: string;
    try {
      apiKey = await this.credentialStore.get(credentialKey);
    } catch (err: unknown) {
      throw new RoutingError({
        code: 'PROFILE_CREDENTIAL_ABSENT',
        role: options.role,
        profileId,
        model,
        detail: `Failed to retrieve credential '${credentialKey}' on this device: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    if (!apiKey) {
      throw new RoutingError({
        code: 'PROFILE_CREDENTIAL_ABSENT',
        role: options.role,
        profileId,
        model,
        detail: `Credential '${credentialKey}' is empty on this device`,
      });
    }

    // 3. Execute provider request
    let executionOutput: ProviderExecutionOutput;
    let failureObservation: FailureObservation;

    try {
      executionOutput = await this.runner({
        route,
        apiKey,
        context: options.context,
        timeoutMs: options.timeoutMs,
      });
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      failureObservation = this.extractFailureObservation(
        err,
        profileId,
        options.role,
        model
      );

      // Record zero or missing usage on fatal error
      try {
        await this.usageAccounting.record({
          jobId: options.jobId,
          requestId: options.requestId,
          role: options.role as UsageRecord['role'],
          profileId,
          model,
          reported: false,
          durationMs,
          recordedAt: this.now(),
        });
      } catch (recErr) {
        if (!(recErr instanceof UsageAccountingError && recErr.code === 'RECORD_DUPLICATE')) {
          throw recErr;
        }
      }

      const notice = this.failureClassifier.classify(failureObservation);
      await this.failureRegistry.raise(notice);
      throw new ProviderFailureError(notice);
    }

    const durationMs = Date.now() - startTime;

    // 4. Check for Empty Response failure (SP-17 §4: Silent Vision Drop)
    const hasContent =
      executionOutput.text.trim().length > 0 ||
      (executionOutput.toolCalls !== undefined && executionOutput.toolCalls.length > 0);
    const isCompletedEmpty = !hasContent;

    if (isCompletedEmpty) {
      const emptyObservation: FailureObservation = {
        transport: 'answered',
        httpStatus: executionOutput.httpStatus ?? 200,
        completedEmpty: true,
        profileId,
        role: options.role,
        model,
      };

      const notice = this.failureClassifier.classify(emptyObservation);
      await this.failureRegistry.raise(notice);

      // Record usage as not reported or 0 tokens with failure
      try {
        await this.usageAccounting.record({
          jobId: options.jobId,
          requestId: options.requestId,
          role: options.role as UsageRecord['role'],
          profileId,
          model,
          reported: false,
          durationMs,
          recordedAt: this.now(),
        });
      } catch (recErr) {
        if (!(recErr instanceof UsageAccountingError && recErr.code === 'RECORD_DUPLICATE')) {
          throw recErr;
        }
      }

      throw new ProviderFailureError(notice);
    }

    // 5. On successful response, record usage and withdraw any standing notices on this profile
    const unitPrice = await this.usageAccounting.getPrice(profileId, model);
    const inpTokens = executionOutput.usage?.inputTokens;
    const outTokens = executionOutput.usage?.outputTokens;
    const hasReportedTokens = inpTokens !== undefined && outTokens !== undefined;

    const cost = hasReportedTokens
      ? this.usageAccounting.calculateCost(inpTokens, outTokens, unitPrice)
      : undefined;

    await this.usageAccounting.record({
      jobId: options.jobId,
      requestId: options.requestId,
      role: options.role as UsageRecord['role'],
      profileId,
      model,
      reported: hasReportedTokens,
      ...(inpTokens !== undefined ? { inputTokens: inpTokens } : {}),
      ...(outTokens !== undefined ? { outputTokens: outTokens } : {}),
      durationMs,
      ...(cost ? { cost } : {}),
      recordedAt: this.now(),
    });

    // Auto-withdraw standing notices for this profile
    await this.failureRegistry.withdrawForProfile(profileId);

    return {
      text: executionOutput.text,
      usage: executionOutput.usage,
      stopReason: executionOutput.stopReason,
      durationMs,
    };
  }

  private detectCarriesImages(options: ModelRequestOptions): boolean {
    if (options.inputShape?.carriesImages) {
      return true;
    }
    for (const msg of options.context.messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'image') {
            return true;
          }
        }
      }
    }
    return false;
  }

  private extractFailureObservation(
    err: unknown,
    profileId: string,
    role: string,
    model: string
  ): FailureObservation {
    const errorObj = err as Record<string, unknown> | undefined;
    const message = (errorObj?.message ?? errorObj?.errorMessage ?? String(err)) as string;
    const status = (errorObj?.status ?? errorObj?.statusCode) as number | undefined;
    const code = (errorObj?.code ?? errorObj?.errorCode) as string | undefined;

    let transport: 'answered' | 'unreachable' | 'timed-out' = 'answered';
    const lower = message.toLowerCase();
    if (
      lower.includes('timed out') ||
      lower.includes('timeout') ||
      lower.includes('etimedout')
    ) {
      transport = 'timed-out';
    } else if (
      lower.includes('econnrefused') ||
      lower.includes('enotfound') ||
      lower.includes('fetch failed')
    ) {
      transport = 'unreachable';
    }

    return {
      transport,
      httpStatus: status,
      providerCode: code,
      providerMessage: message,
      profileId,
      role,
      model,
    };
  }
}

/**
 * Default provider runner supporting OpenAI, Anthropic, and Google generative dialects.
 */
async function defaultProviderRunner(
  input: ProviderExecutionInput
): Promise<ProviderExecutionOutput> {
  const { route, apiKey, context, timeoutMs } = input;
  const address = route.endpoint.address.replace(/\/$/, '');
  const dialect = route.endpoint.dialect;

  const controller = new AbortController();
  const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    if (dialect === 'anthropic-messages') {
      const url = `${address}/v1/messages`;
      const anthropicMessages = context.messages.map((m) => {
        if (typeof m.content === 'string') {
          return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
        }
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content.map((part) => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text };
            }
            return {
              type: 'image',
              source: { type: 'base64', media_type: part.mimeType, data: part.data },
            };
          }),
        };
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(route.endpoint.headers as Record<string, string> | undefined),
        'x-api-key': apiKey,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: route.model,
          max_tokens: 4096,
          messages: anthropicMessages,
          ...(context.systemPrompt ? { system: context.systemPrompt } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        let parsedErr: { error?: { message?: string; type?: string } } | undefined = undefined;
        try {
          parsedErr = JSON.parse(errText);
        } catch {
          // Raw text
        }
        const err = new Error(
          parsedErr?.error?.message || errText || `HTTP ${res.status}: ${res.statusText}`
        ) as Error & { status?: number | undefined; code?: string | undefined };
        err.status = res.status;
        if (parsedErr?.error?.type !== undefined) {
          err.code = parsedErr.error.type;
        }
        throw err;
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string;
      };

      const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text).join('') ?? '';
      return {
        text,
        usage: data.usage
          ? {
              ...(data.usage.input_tokens !== undefined ? { inputTokens: data.usage.input_tokens } : {}),
              ...(data.usage.output_tokens !== undefined ? { outputTokens: data.usage.output_tokens } : {}),
              totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
            }
          : undefined,
        stopReason: data.stop_reason,
        httpStatus: res.status,
      };
    }

    if (dialect === 'google-generative') {
      const url = `${address}/v1beta/models/${route.model}:generateContent?key=${apiKey}`;
      const contents = context.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: typeof m.content === 'string'
          ? [{ text: m.content }]
          : m.content.map((p) => (p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mimeType, data: p.data } })),
      }));

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(route.endpoint.headers as Record<string, string> | undefined),
        },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(errText || `HTTP ${res.status}: ${res.statusText}`) as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      };

      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      return {
        text,
        usage: data.usageMetadata
          ? {
              ...(data.usageMetadata.promptTokenCount !== undefined
                ? { inputTokens: data.usageMetadata.promptTokenCount }
                : {}),
              ...(data.usageMetadata.candidatesTokenCount !== undefined
                ? { outputTokens: data.usageMetadata.candidatesTokenCount }
                : {}),
              ...(data.usageMetadata.totalTokenCount !== undefined
                ? { totalTokens: data.usageMetadata.totalTokenCount }
                : {}),
            }
          : undefined,
        stopReason: data.candidates?.[0]?.finishReason,
        httpStatus: res.status,
      };
    }

    // Default: openai-completions
    const url = `${address}/chat/completions`;
    const formattedMessages = context.messages.map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }
      return {
        role: m.role,
        content: m.content.map((part) => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          }
          return {
            type: 'image_url',
            image_url: { url: `data:${part.mimeType};base64,${part.data}` },
          };
        }),
      };
    });

    if (context.systemPrompt) {
      formattedMessages.unshift({ role: 'system', content: context.systemPrompt });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(route.endpoint.headers as Record<string, string> | undefined),
      // Security (C1): Authorization is always set last to prevent custom headers override
      Authorization: `Bearer ${apiKey}`,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: route.model,
        messages: formattedMessages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr: { error?: { message?: string; code?: string } } | undefined = undefined;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        // Raw text
      }
      const err = new Error(
        parsedErr?.error?.message || errText || `HTTP ${res.status}: ${res.statusText}`
      ) as Error & { status?: number | undefined; code?: string | undefined };
      err.status = res.status;
      if (parsedErr?.error?.code !== undefined) {
        err.code = parsedErr.error.code;
      }
      throw err;
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const choice = data.choices?.[0];
    const text = choice?.message?.content ?? '';
    const toolCalls = choice?.message?.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    const usage = data.usage
      ? {
          ...(data.usage.prompt_tokens !== undefined
            ? { inputTokens: data.usage.prompt_tokens }
            : {}),
          ...(data.usage.completion_tokens !== undefined
            ? { outputTokens: data.usage.completion_tokens }
            : {}),
          ...(data.usage.total_tokens !== undefined
            ? { totalTokens: data.usage.total_tokens }
            : {}),
        }
      : undefined;

    return {
      text,
      ...(toolCalls ? { toolCalls } : {}),
      ...(usage ? { usage } : {}),
      stopReason: choice?.finish_reason,
      httpStatus: res.status,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
