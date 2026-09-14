import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { MockStore, MockPage } from "./mock-store.js";

export function createBaseTools(store: MockStore): AgentTool<any, any>[] {
  const queryDatabaseTool: AgentTool<any, any> = {
    name: "query_database",
    label: "Query Notion Database",
    description: "Query pages from a Notion database by database_id",
    parameters: Type.Object({
      database_id: Type.String({ description: "UUID or ID of the database to query" }),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("query_database");
      const matched = Array.from(store.pages.values()).filter(
        (p) => p.databaseId === params.database_id && !p.archived
      );
      return {
        content: [{ type: "text", text: JSON.stringify(matched) }],
        details: { count: matched.length, pages: matched },
      };
    },
  };

  const getPageTool: AgentTool<any, any> = {
    name: "get_page",
    label: "Get Notion Page",
    description: "Get metadata and content of a Notion page by page_id",
    parameters: Type.Object({
      page_id: Type.String({ description: "ID of the page to read" }),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("get_page");
      const page = store.pages.get(params.page_id);
      if (!page) {
        return {
          content: [{ type: "text", text: `Page not found: ${params.page_id}` }],
          details: { found: false },
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(page) }],
        details: { page },
      };
    },
  };

  const createPageTool: AgentTool<any, any> = {
    name: "create_page",
    label: "Create Notion Page",
    description: "Create a new page/task in a Notion database",
    parameters: Type.Object({
      database_id: Type.String({ description: "Database ID to create the page in" }),
      properties: Type.Record(Type.String(), Type.Any(), { description: "Properties of the new page" }),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("create_page");
      const newId = `page-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const newPage: MockPage = {
        id: newId,
        databaseId: params.database_id,
        title: params.properties?.Title || params.properties?.title || "Untitled",
        status: params.properties?.Status || "Not started",
        dueDate: params.properties?.["Due date"],
        createdBy: "app_bot",
        assignee: params.properties?.Assignee ? [params.properties.Assignee] : [],
      };
      store.pages.set(newId, newPage);
      return {
        content: [{ type: "text", text: `Created page ${newId} with title: ${newPage.title}` }],
        details: { page: newPage },
      };
    },
  };

  const updatePagePropertiesTool: AgentTool<any, any> = {
    name: "update_page_properties",
    label: "Update Notion Page Properties",
    description: "Update properties (Status, Due date, Title, Assignee) of a Notion page",
    parameters: Type.Object({
      page_id: Type.String({ description: "ID of the page to update" }),
      properties: Type.Record(Type.String(), Type.Any(), { description: "Properties to update" }),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("update_page_properties");
      const page = store.pages.get(params.page_id);
      if (!page) {
        return {
          content: [{ type: "text", text: `Page ${params.page_id} not found` }],
          details: { updated: false },
        };
      }
      if (params.properties.Status) page.status = params.properties.Status;
      if (params.properties["Due date"]) page.dueDate = params.properties["Due date"];
      if (params.properties.Title) page.title = params.properties.Title;
      if (params.properties.Assignee) page.assignee = Array.isArray(params.properties.Assignee) ? params.properties.Assignee : [params.properties.Assignee];

      return {
        content: [{ type: "text", text: `Updated page ${params.page_id}` }],
        details: { page },
      };
    },
  };

  const archivePageTool: AgentTool<any, any> = {
    name: "archive_page",
    label: "Archive Notion Page",
    description: "Archive a Notion page (send to trash)",
    parameters: Type.Object({
      page_id: Type.String({ description: "ID of the page to archive" }),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("archive_page");
      const page = store.pages.get(params.page_id);
      if (page) {
        page.archived = true;
      }
      return {
        content: [{ type: "text", text: `Archived page ${params.page_id}` }],
        details: { archived: true, pageId: params.page_id },
      };
    },
  };

  const updateDatabaseTool: AgentTool<any, any> = {
    name: "update_database",
    label: "Update Notion Database",
    description: "Update database title, schema, or archive status",
    parameters: Type.Object({
      database_id: Type.String({ description: "ID of the database" }),
      title: Type.Optional(Type.String()),
      archived: Type.Optional(Type.Boolean()),
      remove_property: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("update_database");
      const db = store.databases.get(params.database_id);
      if (db) {
        if (params.title) db.title = params.title;
        if (params.archived !== undefined) db.archived = params.archived;
        if (params.remove_property) {
          db.properties = db.properties.filter((p) => p !== params.remove_property);
        }
      }
      return {
        content: [{ type: "text", text: `Updated database ${params.database_id}` }],
        details: { db },
      };
    },
  };

  const deleteBlockTool: AgentTool<any, any> = {
    name: "delete_block",
    label: "Delete Notion Block",
    description: "Permanently delete a Notion block",
    parameters: Type.Object({
      block_id: Type.String({ description: "ID of the block to delete" }),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("delete_block");
      return {
        content: [{ type: "text", text: `Deleted block ${params.block_id}` }],
        details: { deleted: true },
      };
    },
  };

  const updatePagePermissionsTool: AgentTool<any, any> = {
    name: "update_page_permissions",
    label: "Update Page Permissions",
    description: "Update permissions / sharing settings on a Notion page",
    parameters: Type.Object({
      page_id: Type.String({ description: "Page ID" }),
      public_read: Type.Boolean(),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("update_page_permissions");
      return {
        content: [{ type: "text", text: `Updated permissions for page ${params.page_id}` }],
        details: { permissions: params },
      };
    },
  };

  const askUserTool: AgentTool<any, any> = {
    name: "ask_user",
    label: "Ask User",
    description: "Ask user for input, confirmation, or clarification",
    parameters: Type.Object({
      question: Type.String({ description: "The question to ask the user" }),
      options: Type.Optional(Type.Array(Type.Object({ label: Type.String() }))),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("ask_user");
      return {
        content: [{ type: "text", text: `User replied to '${params.question}': OK` }],
        details: { question: params.question },
      };
    },
  };

  const gmailGetMessageTool: AgentTool<any, any> = {
    name: "gmail_get_message",
    label: "Get Gmail Message",
    description: "Read an email message by message_id",
    parameters: Type.Object({
      message_id: Type.String({ description: "Message ID to retrieve" }),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("gmail_get_message");
      const email = store.emails.get(params.message_id);
      if (!email) {
        return {
          content: [{ type: "text", text: `Email not found: ${params.message_id}` }],
          details: { found: false },
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(email) }],
        details: { email },
      };
    },
  };

  const fetchUrlContentTool: AgentTool<any, any> = {
    name: "fetch_url_content",
    label: "Fetch URL Content",
    description: "Fetch web content from external URL",
    parameters: Type.Object({
      url: Type.String({ description: "The URL to fetch" }),
    }),
    execute: async (_id, params) => {
      store.recordExecutedCall("fetch_url_content");
      const content = store.webPages.get(params.url) || "404 Not Found";
      return {
        content: [{ type: "text", text: content }],
        details: { url: params.url, content },
      };
    },
  };

  return [
    queryDatabaseTool,
    getPageTool,
    createPageTool,
    updatePagePropertiesTool,
    archivePageTool,
    updateDatabaseTool,
    deleteBlockTool,
    updatePagePermissionsTool,
    askUserTool,
    gmailGetMessageTool,
    fetchUrlContentTool,
  ];
}
