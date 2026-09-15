import type {
  ConnectorStatusProvider,
  ConnectorTokenRenewer,
  Job,
  PreFlightOptions,
} from './types.js';
import { PreFlightError } from './errors.js';

export const DEFAULT_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes per SP-19 / req-019

/**
 * Validates and proactively renews connector authorisations before a job starts
 * per capabilities/job/spec.md (Requirement: A job establishes its connectors' authorisation before it starts).
 */
export class PreFlightChecker {
  readonly #tokenRefreshMarginMs: number;
  readonly #statusProvider?: ConnectorStatusProvider | undefined;
  readonly #tokenRenewer?: ConnectorTokenRenewer | undefined;

  constructor(
    statusProvider?: ConnectorStatusProvider,
    tokenRenewer?: ConnectorTokenRenewer,
    options?: PreFlightOptions
  ) {
    this.#statusProvider = statusProvider;
    this.#tokenRenewer = tokenRenewer;
    this.#tokenRefreshMarginMs =
      options?.tokenRefreshMarginMs ?? DEFAULT_TOKEN_REFRESH_MARGIN_MS;
  }

  get tokenRefreshMarginMs(): number {
    return this.#tokenRefreshMarginMs;
  }

  /**
   * Establishes that every connector the job may use holds a currently accepted authorisation.
   * Proactively renews any authorisation whose validity is below the configured margin.
   * Throws PreFlightError if a required connector cannot be used or renewed without user interaction.
   */
  async establishAuthorisation(job: Job): Promise<void> {
    const connectors = job.requiredConnectors;
    if (!connectors || connectors.length === 0) {
      return;
    }

    if (!this.#statusProvider) {
      throw new PreFlightError(
        job.id,
        connectors[0] || 'unknown',
        'No connector status provider configured. Pre-flight check failed (fail-closed).',
        true
      );
    }

    for (const connector of connectors) {
      const status = await this.#statusProvider.checkStatus(connector);

      // 1. If connector is not connected or revoked
      if (!status.connected) {
        throw new PreFlightError(
          job.id,
          connector,
          `Connector "${connector}" is not connected or authorisation has been withdrawn.`,
          true
        );
      }

      // 2. If token expiration is known, check whether it is within the margin
      if (status.tokenExpiresAt) {
        const expiresAtMs = Date.parse(status.tokenExpiresAt);
        if (!isNaN(expiresAtMs)) {
          const remainingMs = expiresAtMs - Date.now();

          // If remaining validity is below the margin, proactive renewal is required
          if (remainingMs < this.#tokenRefreshMarginMs) {
            if (!status.canRenewWithoutUser || !this.#tokenRenewer) {
              throw new PreFlightError(
                job.id,
                connector,
                `Authorisation for connector "${connector}" expires soon (${Math.round(remainingMs / 1000)}s) and cannot be renewed without user interaction.`,
                true
              );
            }

            const renewed = await this.#tokenRenewer.renewToken(connector);
            if (!renewed) {
              throw new PreFlightError(
                job.id,
                connector,
                `Proactive token renewal for connector "${connector}" failed. Reconnection required.`,
                true
              );
            }
          }
        }
      }
    }
  }
}
