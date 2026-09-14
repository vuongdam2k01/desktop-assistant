import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const FIXTURES_FILE = path.resolve(__dirname, "../../fixtures/notion.json");
const FIXTURES = JSON.parse(fs.readFileSync(FIXTURES_FILE, "utf-8"));

export const NOTION_VERSION = "2022-06-28";

export function getNotionToken(workspaceKey: "A" | "B" | "C"): string {
  const token = process.env[`NOTION_TOKEN_${workspaceKey}`];
  if (!token) {
    throw new Error(`Missing NOTION_TOKEN_${workspaceKey} in .env.local`);
  }
  return token;
}

export function getWorkspaceConfig(workspaceKey: "A" | "B" | "C") {
  return FIXTURES.workspaces[workspaceKey];
}

export function getDatabaseId(workspaceKey: "A" | "B" | "C", role: "tasks" | "projects" = "tasks"): string {
  const ws = getWorkspaceConfig(workspaceKey);
  const db = ws.databases.find((d: any) => d.role === role);
  if (!db) {
    throw new Error(`Database with role '${role}' not found in workspace ${workspaceKey}`);
  }
  return db.id;
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, init);
      if (resp.status === 429) {
        const retryAfter = Number(resp.headers.get("Retry-After") || 1);
        await new Promise((resolve) => setTimeout(resolve, (retryAfter + 0.5) * 1000));
        continue;
      }
      return resp;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${retries} retries`);
}

export async function rawNotionCall(
  token: string,
  method: string,
  apiPath: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const url = `https://api.notion.com/v1${apiPath}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  const resp = await fetchWithRetry(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await resp.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: resp.status, data };
}

export async function queryDatabase(
  token: string,
  databaseId: string,
  filter?: any,
  sorts?: any[]
): Promise<any[]> {
  const body: any = { page_size: 100 };
  if (filter) body.filter = filter;
  if (sorts) body.sorts = sorts;

  const res = await rawNotionCall(token, "POST", `/databases/${databaseId}/query`, body);
  if (res.status >= 300) {
    throw new Error(`queryDatabase failed: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
  }
  return res.data.results || [];
}

export async function getPage(token: string, pageId: string): Promise<any> {
  const res = await rawNotionCall(token, "GET", `/pages/${pageId}`);
  if (res.status >= 300) {
    throw new Error(`getPage failed: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function createPage(
  token: string,
  databaseId: string,
  properties: any,
  children?: any[]
): Promise<any> {
  const body: any = {
    parent: { database_id: databaseId },
    properties,
  };
  if (children) body.children = children;

  const res = await rawNotionCall(token, "POST", "/pages", body);
  if (res.status >= 300) {
    throw new Error(`createPage failed: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function updatePageProperties(
  token: string,
  pageId: string,
  properties: any
): Promise<any> {
  const res = await rawNotionCall(token, "PATCH", `/pages/${pageId}`, { properties });
  if (res.status >= 300) {
    throw new Error(`updatePageProperties failed: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function archivePage(token: string, pageId: string, archived = true): Promise<any> {
  const res = await rawNotionCall(token, "PATCH", `/pages/${pageId}`, { archived });
  if (res.status >= 300) {
    throw new Error(`archivePage failed: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function listUsers(token: string): Promise<any[]> {
  const res = await rawNotionCall(token, "GET", "/users");
  if (res.status >= 300) {
    throw new Error(`listUsers failed: HTTP ${res.status} - ${JSON.stringify(res.data)}`);
  }
  return res.data.results || [];
}
