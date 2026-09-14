import { BackendError } from '../http/errors.js';

export interface ProviderHttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface ProviderHttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  data: unknown;
}

export interface ProviderHttpClient {
  request(req: ProviderHttpRequest): Promise<ProviderHttpResponse>;
}

export class FetchProviderHttpClient implements ProviderHttpClient {
  constructor(private readonly defaultTimeoutMs: number = 10000) {}

  async request(req: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const init: RequestInit = {
        method: req.method,
        signal: controller.signal,
      };
      if (req.headers) {
        init.headers = req.headers;
      }
      if (req.body) {
        init.body = req.body;
      }
      const res = await fetch(req.url, init);

      const contentType = res.headers.get('content-type') || '';
      let data: unknown;
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      } else {
        try {
          data = await res.text();
        } catch {
          data = null;
        }
      }

      const headers: Record<string, string | string[] | undefined> = {};
      res.headers.forEach((val, key) => {
        headers[key] = val;
      });

      return {
        status: res.status,
        headers,
        data,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BackendError({
          statusCode: 424,
          code: 'PROVIDER_UNREACHABLE',
          message: 'Provider request timed out',
        });
      }
      throw new BackendError({
        statusCode: 424,
        code: 'PROVIDER_UNREACHABLE',
        message: 'Provider connection failed',
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
