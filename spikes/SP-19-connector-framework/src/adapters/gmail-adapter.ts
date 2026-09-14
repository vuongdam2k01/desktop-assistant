import type { ConnectorAdapter } from "./adapter-interface.js";
import type {
  ConnectorAuthCredentials,
  ConnectorStatusResult,
} from "../types/manifest-types.js";

export class GmailAdapter implements ConnectorAdapter {
  readonly connectorId = "gmail";
  private accessToken: string = "";
  private refreshToken?: string;
  private clientId?: string;
  private clientSecret?: string;
  private isRevoked: boolean = false;

  constructor(credentials?: ConnectorAuthCredentials) {
    if (credentials) {
      this.accessToken = credentials.accessToken || "";
      this.refreshToken = credentials.refreshToken;
      this.clientId = credentials.clientId;
      this.clientSecret = credentials.clientSecret;
    }
  }

  async initialize(credentials: ConnectorAuthCredentials): Promise<void> {
    this.accessToken = credentials.accessToken || "";
    this.refreshToken = credentials.refreshToken;
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.isRevoked = false;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      return false;
    }

    try {
      const params = new URLSearchParams();
      params.append("client_id", this.clientId);
      params.append("client_secret", this.clientSecret);
      params.append("refresh_token", this.refreshToken);
      params.append("grant_type", "refresh_token");

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "invalid_grant") {
          this.isRevoked = true;
        }
        return false;
      }

      const data = await res.json();
      this.accessToken = data.access_token;
      return true;
    } catch {
      return false;
    }
  }

  async checkStatus(): Promise<ConnectorStatusResult> {
    const checkedAt = new Date().toISOString();

    if (this.isRevoked) {
      return { status: "revoked", canRefresh: false, error: "Token was revoked", checkedAt };
    }

    if (!this.accessToken && !this.refreshToken) {
      return { status: "disconnected", error: "No credentials provided", checkedAt };
    }

    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (res.status === 200) {
        return { status: "connected", checkedAt };
      }

      if (res.status === 401) {
        // Token expired; test refresh
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return { status: "connected", canRefresh: true, checkedAt };
        }
        if (this.isRevoked) {
          return { status: "revoked", canRefresh: false, error: "Token was revoked", checkedAt };
        }
        return {
          status: "token_expired",
          canRefresh: Boolean(this.refreshToken),
          error: "HTTP 401 UNAUTHENTICATED: Token expired",
          checkedAt,
        };
      }

      if (res.status === 403) {
        return {
          status: "permission_error",
          error: "HTTP 403 Forbidden: Insufficient OAuth scopes",
          checkedAt,
        };
      }

      return { status: "error", error: `HTTP ${res.status}: ${res.statusText}`, checkedAt };
    } catch (err: any) {
      return { status: "error", error: err.message, checkedAt };
    }
  }

  async revoke(): Promise<boolean> {
    const tokenToRevoke = this.accessToken || this.refreshToken;
    if (tokenToRevoke) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch {
        // Ignore network errors during best-effort remote revoke
      }
    }
    this.accessToken = "";
    this.refreshToken = undefined;
    this.isRevoked = true;
    return true;
  }

  async execute(operationId: string, params: any, signal?: AbortSignal): Promise<any> {
    if (this.isRevoked) {
      throw new Error("CONNECTOR_REVOKED: Gmail connector token has been revoked.");
    }
    if (!this.accessToken) {
      // Try refresh
      const refreshed = await this.refreshAccessToken();
      if (!refreshed || !this.accessToken) {
        throw new Error("CONNECTOR_DISCONNECTED: Gmail connector is not connected or token expired.");
      }
    }

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };

    switch (operationId) {
      case "search_emails": {
        const query = encodeURIComponent(params.query || "");
        const maxResults = params.max_results || 5;
        let res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
          { headers, signal }
        );

        if (res.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            headers.Authorization = `Bearer ${this.accessToken}`;
            res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
              { headers, signal }
            );
          }
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gmail search_emails failed (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const messages = data.messages || [];

        // Enrich first few messages with snippet/subject
        const enriched: any[] = [];
        for (const msg of messages.slice(0, 3)) {
          try {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers, signal }
            );
            if (detailRes.ok) {
              const detail = await detailRes.json();
              const headersList = detail.payload?.headers || [];
              const subject = headersList.find((h: any) => h.name.toLowerCase() === "subject")?.value || "(No Subject)";
              const from = headersList.find((h: any) => h.name.toLowerCase() === "from")?.value || "Unknown";
              const date = headersList.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
              enriched.push({
                id: msg.id,
                threadId: msg.threadId,
                subject,
                from,
                date,
                snippet: detail.snippet || "",
              });
            } else {
              enriched.push(msg);
            }
          } catch {
            enriched.push(msg);
          }
        }

        return {
          query: params.query,
          count: messages.length,
          messages: enriched,
        };
      }

      case "get_email_details": {
        let res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${params.message_id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers, signal }
        );

        if (res.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            headers.Authorization = `Bearer ${this.accessToken}`;
            res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${params.message_id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers, signal }
            );
          }
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gmail get_email_details failed (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const headersList = data.payload?.headers || [];
        const subject = headersList.find((h: any) => h.name.toLowerCase() === "subject")?.value || "(No Subject)";
        const from = headersList.find((h: any) => h.name.toLowerCase() === "from")?.value || "Unknown";
        const date = headersList.find((h: any) => h.name.toLowerCase() === "date")?.value || "";

        return {
          id: data.id,
          threadId: data.threadId,
          subject,
          from,
          date,
          snippet: data.snippet,
        };
      }

      default:
        throw new Error(`GmailAdapter: unsupported operation '${operationId}'`);
    }
  }
}
