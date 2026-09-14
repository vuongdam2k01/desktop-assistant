import type { ConnectorAdapter } from "./adapter-interface.js";
import type {
  ConnectorAuthCredentials,
  ConnectorStatusResult,
} from "../types/manifest-types.js";

export class NotionAdapter implements ConnectorAdapter {
  readonly connectorId = "notion";
  private token: string = "";

  constructor(credentials?: ConnectorAuthCredentials) {
    if (credentials?.accessToken) {
      this.token = credentials.accessToken;
    }
  }

  async initialize(credentials: ConnectorAuthCredentials): Promise<void> {
    this.token = credentials.accessToken || "";
  }

  async checkStatus(): Promise<ConnectorStatusResult> {
    const checkedAt = new Date().toISOString();
    if (!this.token) {
      return { status: "disconnected", error: "Missing Notion token", checkedAt };
    }

    try {
      const res = await fetch("https://api.notion.com/v1/users/me", {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (res.status === 200) {
        return { status: "connected", checkedAt };
      } else if (res.status === 401) {
        return { status: "token_expired", canRefresh: false, error: "HTTP 401 Unauthorized", checkedAt };
      } else if (res.status === 403) {
        return { status: "permission_error", error: "HTTP 403 Forbidden", checkedAt };
      } else {
        return { status: "error", error: `HTTP ${res.status}: ${res.statusText}`, checkedAt };
      }
    } catch (err: any) {
      return { status: "error", error: err.message, checkedAt };
    }
  }

  async revoke(): Promise<boolean> {
    // Notion API does not expose an OAuth token revoke endpoint.
    // Local clearing is performed.
    this.token = "";
    return true;
  }

  async fetchSnapshot(operationId: string, targetId: string): Promise<any> {
    const res = await fetch(`https://api.notion.com/v1/pages/${targetId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": "2022-06-28",
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Notion snapshot for page ${targetId}: HTTP ${res.status}`);
    }
    const page = await res.json();
    return {
      id: page.id,
      archived: page.archived,
      properties: page.properties,
      last_edited_time: page.last_edited_time,
    };
  }

  async execute(operationId: string, params: any, signal?: AbortSignal): Promise<any> {
    if (!this.token) {
      throw new Error("CONNECTOR_ERROR: Notion adapter is not initialized with a token");
    }

    const headers = {
      Authorization: `Bearer ${this.token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };

    switch (operationId) {
      case "query_database": {
        const body: any = {};
        if (params.status_filter) {
          body.filter = {
            property: "Status",
            status: { equals: params.status_filter },
          };
        }
        const res = await fetch(`https://api.notion.com/v1/databases/${params.database_id}/query`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Notion query_database failed (${res.status}): ${errText}`);
        }
        const data = await res.json();
        return {
          count: data.results?.length || 0,
          results: (data.results || []).slice(0, 10).map((p: any) => ({
            id: p.id,
            title: p.properties?.Name?.title?.[0]?.plain_text || p.properties?.title?.title?.[0]?.plain_text || "Untitled",
            archived: p.archived,
          })),
        };
      }

      case "get_page": {
        const res = await fetch(`https://api.notion.com/v1/pages/${params.page_id}`, {
          headers,
          signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Notion get_page failed (${res.status}): ${errText}`);
        }
        return await res.json();
      }

      case "create_page": {
        const body: any = {
          parent: { database_id: params.database_id },
          properties: {},
        };

        // Name property
        body.properties.Name = {
          title: [{ text: { content: params.title || "New Task" } }],
        };

        // Merge extra properties if provided
        if (params.properties) {
          for (const [key, val] of Object.entries(params.properties)) {
            if (key === "Status" && typeof val === "string") {
              body.properties.Status = { status: { name: val } };
            } else if (key === "Due date" && typeof val === "string") {
              body.properties["Due date"] = { date: { start: val } };
            }
          }
        }

        const res = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Notion create_page failed (${res.status}): ${errText}`);
        }
        const created = await res.json();
        return {
          id: created.id,
          url: created.url,
          title: params.title,
          status: "created",
        };
      }

      case "update_page_properties": {
        const body: any = { properties: {} };
        if (params.archived !== undefined) {
          body.archived = params.archived;
        }
        if (params.properties) {
          for (const [key, val] of Object.entries(params.properties)) {
            if (key === "Name" && typeof val === "string") {
              body.properties.Name = { title: [{ text: { content: val } }] };
            } else if (key === "Status" && typeof val === "string") {
              body.properties.Status = { status: { name: val } };
            } else if (typeof val === "object" && val !== null) {
              body.properties[key] = val;
            }
          }
        }

        const res = await fetch(`https://api.notion.com/v1/pages/${params.page_id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body),
          signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Notion update_page_properties failed (${res.status}): ${errText}`);
        }
        const updated = await res.json();
        return {
          id: updated.id,
          archived: updated.archived,
          status: "updated",
        };
      }

      case "archive_page": {
        const res = await fetch(`https://api.notion.com/v1/pages/${params.page_id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ archived: true }),
          signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Notion archive_page failed (${res.status}): ${errText}`);
        }
        return { id: params.page_id, archived: true };
      }

      case "create_comment": {
        const res = await fetch("https://api.notion.com/v1/comments", {
          method: "POST",
          headers,
          body: JSON.stringify({
            parent: { page_id: params.page_id },
            rich_text: [{ text: { content: params.comment_text } }],
          }),
          signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Notion create_comment failed (${res.status}): ${errText}`);
        }
        const comment = await res.json();
        return { id: comment.id, status: "comment_created", irreversible: true };
      }

      case "delete_block": {
        const res = await fetch(`https://api.notion.com/v1/blocks/${params.block_id}`, {
          method: "DELETE",
          headers,
          signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Notion delete_block failed (${res.status}): ${errText}`);
        }
        return { id: params.block_id, deleted: true, irreversible: true };
      }

      default:
        throw new Error(`NotionAdapter: unsupported operation '${operationId}'`);
    }
  }
}
