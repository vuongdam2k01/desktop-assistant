import autocannon from 'autocannon';
import { loadConfig } from '../src/config.js';
import { pathToFileURL } from 'node:url';

interface LoadTestMetrics {
  endpoint: string;
  requestsPerSecond: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  totalRequests: number;
  errorCount: number;
  errorRatePercent: number;
}

export async function runBenchmark(
  title: string,
  url: string,
  options: {
    connections?: number;
    duration?: number;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<LoadTestMetrics> {
  const connections = options.connections ?? 200;
  const duration = options.duration ?? 10; // default 10s for CLI smoke, 60s for full run

  process.stdout.write(`\nRunning benchmark: ${title}\n`);
  process.stdout.write(`  Target: ${options.method || 'GET'} ${url}\n`);
  process.stdout.write(`  Connections: ${connections}, Duration: ${duration}s\n`);

  const result = await autocannon({
    url,
    connections,
    duration,
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  });

  const totalReq = result.requests.total;
  const errors = result.errors + result.non2xx;
  const errorRate = totalReq > 0 ? (errors / totalReq) * 100 : 0;

  const metrics: LoadTestMetrics = {
    endpoint: url,
    requestsPerSecond: result.requests.average,
    latencyP50: result.latency.p50,
    latencyP95: result.latency.p95,
    latencyP99: result.latency.p99,
    totalRequests: totalReq,
    errorCount: errors,
    errorRatePercent: errorRate,
  };

  process.stdout.write(`  Requests/sec: ${metrics.requestsPerSecond.toFixed(2)}\n`);
  process.stdout.write(`  Latency p50:  ${metrics.latencyP50}ms\n`);
  process.stdout.write(`  Latency p95:  ${metrics.latencyP95}ms\n`);
  process.stdout.write(`  Latency p99:  ${metrics.latencyP99}ms\n`);
  process.stdout.write(`  Errors:       ${metrics.errorCount} (${metrics.errorRatePercent.toFixed(2)}%)\n`);

  return metrics;
}

export async function runAllLoadTests(): Promise<void> {
  const config = loadConfig();
  const baseUrl = `http://${config.host}:${config.port}`;
  const connections = parseInt(process.env.LOAD_TEST_CONNECTIONS || '200', 10);
  const duration = parseInt(process.env.LOAD_TEST_DURATION || '10', 10);

  process.stdout.write('====================================================\n');
  process.stdout.write('Desktop Assistant Backend — Load & Capacity Test\n');
  process.stdout.write(`Base URL: ${baseUrl}\n`);
  process.stdout.write(`Target connections: ${connections}, Duration: ${duration}s\n`);
  process.stdout.write('====================================================\n');

  // Benchmark 1: Public Health Endpoint
  await runBenchmark('Public Health Endpoint', `${baseUrl}/v1/health`, {
    connections,
    duration,
  });

  // Benchmark 2: Public Version Endpoint
  await runBenchmark('Public Version Endpoint', `${baseUrl}/v1/app/version`, {
    connections,
    duration,
  });

  // Benchmark 3: Authenticated Flow (if live Google ID token is supplied)
  const googleIdToken = process.env.GOOGLE_TEST_ID_TOKEN;
  if (googleIdToken) {
    process.stdout.write('\nOperator provided GOOGLE_TEST_ID_TOKEN. Running authenticated benchmark...\n');
    let accessToken: string | undefined;

    try {
      const signinRes = await fetch(`${baseUrl}/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: googleIdToken,
          deviceId: `load-test-device-${Date.now()}`,
        }),
      });

      if (signinRes.ok) {
        const tokens = (await signinRes.json()) as { accessToken: string };
        accessToken = tokens.accessToken;

        await runBenchmark(
          'Authenticated OAuth Authorize-URL',
          `${baseUrl}/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:8080/callback`,
          {
            connections,
            duration,
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      } else {
        process.stderr.write(`Sign-in failed with status ${signinRes.status}. Skipping authenticated benchmarks.\n`);
      }
    } finally {
      if (accessToken) {
        try {
          await fetch(`${baseUrl}/v1/account`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          process.stdout.write('Test account cleaned up via DELETE /v1/account.\n');
        } catch {
          // Cleanup best effort
        }
      }
    }
  } else {
    process.stdout.write(
      '\nNOTE: Authenticated benchmark skipped (no GOOGLE_TEST_ID_TOKEN provided).\n' +
        'To run authenticated sign-in and broker benchmarks, provide:\n' +
        '  GOOGLE_TEST_ID_TOKEN=<live-id-token> pnpm load:test\n'
    );
  }

  process.stdout.write('\nLoad test completed.\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runAllLoadTests().catch(err => {
    process.stderr.write(`Load test execution failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
