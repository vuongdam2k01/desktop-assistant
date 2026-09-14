import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  getNotionToken,
  getDatabaseId,
  queryDatabase,
  getPage,
  createPage,
  updatePageProperties,
  archivePage,
  listUsers,
} from "../notion-client.js";
import {
  extractPageTitle,
  extractPageStatus,
  extractPageDueDate,
  extractPagePriority,
  extractPageOrder,
  extractPageAssignee,
  extractPageTags,
  extractPageRelation,
} from "../notion-state.js";

export interface ToolExecutionContext {
  workspace: "A" | "B" | "C";
  recordWrite?: (toolName: string, params: any) => void;
  recordRead?: (toolName: string, params: any) => void;
}

function toolSuccess(data: any) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

export function createNotionTools(ctx: ToolExecutionContext): AgentTool[] {
  const ws = ctx.workspace;
  const token = getNotionToken(ws);

  // 1. notion_query_database
  const queryDbTool: AgentTool = {
    name: "notion_query_database",
    label: "Query Notion Database",
    description: "Query tasks or projects from the Notion workspace database. Returns a list of pages with their properties (id, title, status, due_date, priority, order, assignee, tags, project).",
    parameters: Type.Object({
      database_role: Type.Optional(Type.Union([Type.Literal("tasks"), Type.Literal("projects")], {
        description: "Role of the database: 'tasks' (default) or 'projects' (only in Workspace B)",
      })),
      status_filter: Type.Optional(Type.String({ description: "Filter by status name, e.g. 'Not started', 'In progress', 'Done'" })),
    }),
    execute: async (_toolCallId, params: any) => {
      ctx.recordRead?.("notion_query_database", params);
      const role = params.database_role || "tasks";
      const dbId = getDatabaseId(ws, role);
      
      let filter: any = undefined;
      if (params.status_filter) {
        filter = {
          property: "Status",
          select: { equals: params.status_filter },
        };
      }

      const results = await queryDatabase(token, dbId, filter);
      const formatted = results.map((p) => {
        if (role === "projects") {
          return {
            id: p.id,
            title: extractPageTitle(p),
            status: extractPageStatus(p),
          };
        }
        return {
          id: p.id,
          title: extractPageTitle(p),
          status: extractPageStatus(p),
          due_date: extractPageDueDate(p),
          priority: extractPagePriority(p),
          order: extractPageOrder(p),
          assignee: extractPageAssignee(p),
          tags: extractPageTags(p),
          project: extractPageRelation(p),
        };
      });

      return toolSuccess({
        database_role: role,
        count: formatted.length,
        pages: formatted,
      });
    },
  };

  // 2. notion_get_page
  const getPageTool: AgentTool = {
    name: "notion_get_page",
    label: "Get Notion Page",
    description: "Retrieve complete details and properties of a single page by its page_id.",
    parameters: Type.Object({
      page_id: Type.String({ description: "UUID of the page to retrieve" }),
    }),
    execute: async (_toolCallId, params: any) => {
      ctx.recordRead?.("notion_get_page", params);
      const page = await getPage(token, params.page_id);
      return toolSuccess({
        id: page.id,
        title: extractPageTitle(page),
        status: extractPageStatus(page),
        due_date: extractPageDueDate(page),
        priority: extractPagePriority(page),
        order: extractPageOrder(page),
        assignee: extractPageAssignee(page),
        tags: extractPageTags(page),
        project: extractPageRelation(page),
        archived: page.archived,
      });
    },
  };

  // 3. notion_create_page
  const createPageTool: AgentTool = {
    name: "notion_create_page",
    label: "Create Notion Page",
    description: "Create a new task or project in Notion with specified properties.",
    parameters: Type.Object({
      database_role: Type.Optional(Type.Union([Type.Literal("tasks"), Type.Literal("projects")], {
        description: "Role of the database: 'tasks' (default) or 'projects'",
      })),
      title: Type.String({ description: "Title / Name of the task or project" }),
      status: Type.Optional(Type.String({ description: "Status: 'Not started', 'In progress', or 'Done'" })),
      due_date: Type.Optional(Type.String({ description: "Due date in ISO format YYYY-MM-DD" })),
      priority: Type.Optional(Type.String({ description: "Priority: 'High', 'Medium', or 'Low' (for Workspace C)" })),
      order: Type.Optional(Type.Number({ description: "Order sequence number (for Workspace C; smaller = do first)" })),
      assignee: Type.Optional(Type.String({ description: "Assignee name: 'Linh', 'Trang', 'Hùng', 'Tuấn', 'user' (for Workspace B)" })),
      tags: Type.Optional(Type.Array(Type.String(), { description: "Tags: 'bug', 'feature', 'docs', 'meeting' (for Workspace B)" })),
      project_id: Type.Optional(Type.String({ description: "Project page ID to relate this task to (for Workspace B)" })),
    }),
    execute: async (_toolCallId, params: any) => {
      ctx.recordWrite?.("notion_create_page", params);
      const role = params.database_role || "tasks";
      const dbId = getDatabaseId(ws, role);

      const props: any = {
        Name: { title: [{ text: { content: params.title } }] },
      };

      if (params.status) {
        props.Status = { select: { name: params.status } };
      }
      if (params.due_date) {
        props["Due date"] = { date: { start: params.due_date } };
      }
      if (params.priority) {
        props.Priority = { select: { name: params.priority } };
      }
      if (params.order !== undefined) {
        props.Order = { number: params.order };
      }
      if (params.tags && params.tags.length > 0) {
        props.Tags = { multi_select: params.tags.map((t: string) => ({ name: t })) };
      }
      if (params.project_id) {
        props.Project = { relation: [{ id: params.project_id }] };
      }
      if (params.assignee) {
        props["Assignee Name"] = { rich_text: [{ text: { content: params.assignee } }] };
      }

      const created = await createPage(token, dbId, props);
      return toolSuccess({
        success: true,
        id: created.id,
        title: params.title,
        message: `Created page in ${role} successfully`,
      });
    },
  };

  // 4. notion_update_page_properties
  const updatePageTool: AgentTool = {
    name: "notion_update_page_properties",
    label: "Update Notion Page Properties",
    description: "Update properties of an existing page in Notion (title, status, due_date, priority, order, assignee, tags, project relation).",
    parameters: Type.Object({
      page_id: Type.String({ description: "UUID of the page to update" }),
      title: Type.Optional(Type.String({ description: "New title" })),
      status: Type.Optional(Type.String({ description: "New status: 'Not started', 'In progress', or 'Done'" })),
      due_date: Type.Optional(Type.String({ description: "New due date in ISO format YYYY-MM-DD" })),
      priority: Type.Optional(Type.String({ description: "New priority: 'High', 'Medium', or 'Low'" })),
      order: Type.Optional(Type.Number({ description: "New order number" })),
      assignee: Type.Optional(Type.String({ description: "New assignee name: 'Linh', 'Trang', 'Hùng', 'Tuấn', 'user'" })),
      tags: Type.Optional(Type.Array(Type.String(), { description: "New tags" })),
      project_id: Type.Optional(Type.String({ description: "New project relation ID" })),
    }),
    execute: async (_toolCallId, params: any) => {
      ctx.recordWrite?.("notion_update_page_properties", params);
      const props: any = {};

      if (params.title !== undefined) {
        props.Name = { title: [{ text: { content: params.title } }] };
      }
      if (params.status !== undefined) {
        props.Status = { select: { name: params.status } };
      }
      if (params.due_date !== undefined) {
        props["Due date"] = { date: { start: params.due_date } };
      }
      if (params.priority !== undefined) {
        props.Priority = { select: { name: params.priority } };
      }
      if (params.order !== undefined) {
        props.Order = { number: params.order };
      }
      if (params.tags !== undefined) {
        props.Tags = { multi_select: params.tags.map((t: string) => ({ name: t })) };
      }
      if (params.project_id !== undefined) {
        props.Project = { relation: [{ id: params.project_id }] };
      }
      if (params.assignee !== undefined) {
        props["Assignee Name"] = { rich_text: [{ text: { content: params.assignee } }] };
      }

      await updatePageProperties(token, params.page_id, props);
      return toolSuccess({
        success: true,
        page_id: params.page_id,
        updated_properties: Object.keys(props),
      });
    },
  };

  // 5. notion_archive_page
  const archivePageTool: AgentTool = {
    name: "notion_archive_page",
    label: "Archive Notion Page",
    description: "Archive (delete/soft-delete) a page in Notion.",
    parameters: Type.Object({
      page_id: Type.String({ description: "UUID of the page to archive" }),
    }),
    execute: async (_toolCallId, params: any) => {
      ctx.recordWrite?.("notion_archive_page", params);
      await archivePage(token, params.page_id, true);
      return toolSuccess({
        success: true,
        page_id: params.page_id,
        archived: true,
      });
    },
  };

  // 6. notion_list_users
  const listUsersTool: AgentTool = {
    name: "notion_list_users",
    label: "List Workspace Users",
    description: "List member users in the Notion workspace to look up IDs or names for assignment.",
    parameters: Type.Object({}),
    execute: async (_toolCallId, params: any) => {
      ctx.recordRead?.("notion_list_users", params);
      return toolSuccess([
        { id: "user-current", name: "user", email: "user@example.com", role: "You (account owner)" },
        { id: "user-linh", name: "Linh", email: "linh@vinmart-demo.example", role: "PM (Mobile app Vinmart)" },
        { id: "user-tuan", name: "Tuấn", email: "tuan.pham@company.example", role: "PM (HR portal nội bộ)" },
        { id: "user-hung", name: "Hùng", email: "hung@company.example", role: "Developer" },
        { id: "user-trang", name: "Trang", email: "trang@company.example", role: "Designer" },
      ]);
    },
  };

  return [queryDbTool, getPageTool, createPageTool, updatePageTool, archivePageTool, listUsersTool];
}
