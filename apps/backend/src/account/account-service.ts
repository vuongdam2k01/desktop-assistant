import type pg from 'pg';
import { BackendError } from '../http/errors.js';
import type { ProviderHttpClient } from '../oauth/provider-http-client.js';
import type { ProviderRegistry } from '../oauth/provider-registry.js';
import type { AccountDataLifecycle } from './account-data-lifecycle.js';

export interface ProviderWithdrawalResult {
  providerId: string;
  outcome: 'withdrawn' | 'failed' | 'no-revocation-endpoint';
}

export interface DeleteAccountResult {
  accountDeleted: true;
  devicesRemoved: number;
  sessionsRevoked: number;
  providerWithdrawals: ProviderWithdrawalResult[];
}

export class AccountService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly providerRegistry: ProviderRegistry,
    private readonly httpClient: ProviderHttpClient,
    private readonly lifecycle: AccountDataLifecycle,
    private readonly logger?: {
      info: (obj: Record<string, unknown>, msg?: string) => void;
      warn: (obj: Record<string, unknown>, msg?: string) => void;
      error: (obj: Record<string, unknown>, msg?: string) => void;
    }
  ) {}

  async deleteAccount(accountId: string): Promise<DeleteAccountResult> {
    const withdrawals: ProviderWithdrawalResult[] = [];

    // Step 1: Visit and attempt revocation for each provider authorization
    await this.lifecycle.visitProviderAuthorisations(accountId, async item => {
      let descriptor;
      try {
        descriptor = this.providerRegistry.getProvider(item.providerId);
      } catch {
        descriptor = undefined;
      }

      if (!descriptor || !descriptor.revokeEndpoint) {
        withdrawals.push({
          providerId: item.providerId,
          outcome: 'no-revocation-endpoint',
        });
        this.logger?.info(
          {
            event: 'provider_revocation',
            providerId: item.providerId,
            outcome: 'no-revocation-endpoint',
          },
          'Provider has no revocation endpoint'
        );
        return;
      }

      try {
        const { clientId, clientSecret } = await this.providerRegistry.resolveCredentials(descriptor);

        const bodyParams = new URLSearchParams();
        bodyParams.set('token', item.revocationToken);
        bodyParams.set('token_type_hint', 'access_token');

        const headers: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        };

        if (descriptor.tokenAuthMethod === 'credentials-in-header') {
          const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          headers['Authorization'] = `Basic ${creds}`;
        } else {
          bodyParams.set('client_id', clientId);
          bodyParams.set('client_secret', clientSecret);
        }

        const res = await this.httpClient.request({
          url: descriptor.revokeEndpoint,
          method: 'POST',
          headers,
          body: bodyParams.toString(),
        });

        const outcome = res.status >= 200 && res.status < 300 ? 'withdrawn' : 'failed';
        withdrawals.push({
          providerId: item.providerId,
          outcome,
        });

        this.logger?.info(
          {
            event: 'provider_revocation',
            providerId: item.providerId,
            outcome,
            statusCode: res.status,
          },
          'Provider authorization revocation response'
        );
      } catch (err) {
        withdrawals.push({
          providerId: item.providerId,
          outcome: 'failed',
        });
        this.logger?.warn(
          {
            event: 'provider_revocation',
            providerId: item.providerId,
            outcome: 'failed',
            err: err instanceof Error ? err.message : String(err),
          },
          'Provider authorization revocation failed'
        );
      }
    });

    // Step 2: Destroy replicated account in F22.
    // If this fails, fail-closed with 503 so F10 session remains intact for retry.
    try {
      await this.lifecycle.destroyReplicatedAccount(accountId);
    } catch (err) {
      this.logger?.error(
        {
          event: 'replicated_account_destroy_failed',
          accountId,
          err: err instanceof Error ? err.message : String(err),
        },
        'Failed to destroy replicated account data'
      );
      throw new BackendError({
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Failed to destroy replicated account data; account deletion retained for retry',
      });
    }

    // Step 3: Transactional deletion of F10 relations
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const devRes = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM device WHERE account_id = $1',
        [accountId]
      );
      const devicesRemoved = parseInt(devRes.rows[0]?.count || '0', 10);

      const sessRes = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM session WHERE account_id = $1',
        [accountId]
      );
      const sessionsRevoked = parseInt(sessRes.rows[0]?.count || '0', 10);

      // Delete the activated invitation
      await client.query('DELETE FROM invitation WHERE activated_account_id = $1', [accountId]);

      // Delete the account (cascades to device and session tables)
      await client.query('DELETE FROM account WHERE id = $1', [accountId]);

      await client.query('COMMIT');

      return {
        accountDeleted: true,
        devicesRemoved: isNaN(devicesRemoved) ? 0 : devicesRemoved,
        sessionsRevoked: isNaN(sessionsRevoked) ? 0 : sessionsRevoked,
        providerWithdrawals: withdrawals,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
