import type { ConnectorManifest, ConnectorHealthStatus } from "../types/manifest-types.js";
import type { ConnectorAdapter } from "../adapters/adapter-interface.js";

export interface RegisteredConnector {
  manifest: ConnectorManifest;
  adapter: ConnectorAdapter;
  status: ConnectorHealthStatus;
}

export class ConnectorRegistry {
  private connectors: Map<string, RegisteredConnector> = new Map();

  register(manifest: ConnectorManifest, adapter: ConnectorAdapter, initialStatus: ConnectorHealthStatus = "connected"): void {
    if (manifest.id !== adapter.connectorId) {
      throw new Error(`Registry error: Manifest id '${manifest.id}' does not match adapter '${adapter.connectorId}'`);
    }
    this.connectors.set(manifest.id, {
      manifest,
      adapter,
      status: initialStatus,
    });
  }

  unregister(connectorId: string): boolean {
    return this.connectors.delete(connectorId);
  }

  setStatus(connectorId: string, status: ConnectorHealthStatus): void {
    const conn = this.connectors.get(connectorId);
    if (conn) {
      conn.status = status;
    }
  }

  getStatus(connectorId: string): ConnectorHealthStatus {
    return this.connectors.get(connectorId)?.status || "disconnected";
  }

  getConnector(connectorId: string): RegisteredConnector | undefined {
    return this.connectors.get(connectorId);
  }

  getAllConnectors(): RegisteredConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * FR-CF-06: Returns only connected connectors.
   * Disconnected connectors are excluded so the agent cannot "know" about them.
   */
  getConnectedConnectors(): RegisteredConnector[] {
    return Array.from(this.connectors.values()).filter(
      (c) => c.status === "connected"
    );
  }
}
