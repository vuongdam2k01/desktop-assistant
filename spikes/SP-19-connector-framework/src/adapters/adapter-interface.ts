import type {
  ConnectorAuthCredentials,
  ConnectorStatusResult,
} from "../types/manifest-types.js";

/**
 * Common Connector Adapter interface (PRD §10.10)
 * Platform-specific HTTP/SDK logic is isolated strictly within adapters.
 * Adapters DO NOT contain Job Manager, Hooks, Evaluator, or Ledger code.
 */
export interface ConnectorAdapter {
  readonly connectorId: string;

  /**
   * Initialize or update adapter credentials
   */
  initialize(credentials: ConnectorAuthCredentials): Promise<void>;

  /**
   * Health check / token validity check (FR-CF-05)
   */
  checkStatus(): Promise<ConnectorStatusResult>;

  /**
   * Revoke credentials with provider if endpoint available (FR-CF-08)
   */
  revoke(): Promise<boolean>;

  /**
   * Execute an operation defined in manifest
   */
  execute(
    operationId: string,
    params: any,
    signal?: AbortSignal
  ): Promise<any>;

  /**
   * Pre-write snapshot retrieval (FR-NT-04, FR-CF-01)
   */
  fetchSnapshot?(
    operationId: string,
    targetId: string,
    signal?: AbortSignal
  ): Promise<any>;
}
