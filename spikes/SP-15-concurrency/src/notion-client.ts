import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { NotionPageSnapshot } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../spikes/.env.local');
const fixturesPath = path.resolve(__dirname, '../../../spikes/fixtures/notion.json');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

let notionFixtures: any = null;
if (fs.existsSync(fixturesPath)) {
  notionFixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
}

export function getNotionToken(workspace: 'A' | 'B' | 'C' = 'B'): string {
  const key = `NOTION_TOKEN_${workspace}`;
  const token = process.env[key];
  if (!token) {
    throw new Error(`Missing environment variable ${key} in .env.local`);
  }
  return token;
}

export function getDatabaseId(workspace: 'A' | 'B' | 'C' = 'B', role: 'tasks' | 'projects' = 'tasks'): string {
  if (!notionFixtures) {
    throw new Error('Notion fixtures not found at spikes/fixtures/notion.json');
  }
  const ws = notionFixtures.workspaces?.[workspace];
  if (!ws) {
    throw new Error(`Workspace ${workspace} not found in fixtures`);
  }
  const db = ws.databases?.find((d: any) => d.role === role);
  if (!db) {
    throw new Error(`Database with role '${role}' not found in workspace ${workspace}`);
  }
  return db.id;
}

export class NotionApiError extends Error {
  public status: number;
  public code: string;
  public retryAfter?: number;
  public responseBody: any;

  constructor(status: number, code: string, message: string, retryAfter?: number, body?: any) {
    super(`Notion API Error [${status}] ${code}: ${message}`);
    this.name = 'NotionApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.responseBody = body;
  }
}

export async function requestNotion(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  workspace: 'A' | 'B' | 'C' = 'B'
): Promise<{ data: any; status: number; durationMs: number; headers: Record<string, string> }> {
  const token = getNotionToken(workspace);
  const url = `https://api.notion.com/v1${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const start = performance.now();
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const durationMs = performance.now() - start;

  const resHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    resHeaders[k.toLowerCase()] = v;
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { rawText: text };
  }

  if (!res.ok) {
    const retryAfter = resHeaders['retry-after'] ? Number(resHeaders['retry-after']) : undefined;
    throw new NotionApiError(res.status, data.code || 'unknown_error', data.message || res.statusText, retryAfter, data);
  }

  return { data, status: res.status, durationMs, headers: resHeaders };
}

export async function getPage(pageId: string, workspace: 'A' | 'B' | 'C' = 'B'): Promise<NotionPageSnapshot> {
  const { data } = await requestNotion(`/pages/${pageId}`, 'GET', undefined, workspace);
  return {
    id: data.id,
    archived: data.archived,
    last_edited_time: data.last_edited_time,
    properties: data.properties,
  };
}

export async function updatePageProperties(
  pageId: string,
  properties: Record<string, any>,
  workspace: 'A' | 'B' | 'C' = 'B'
): Promise<NotionPageSnapshot> {
  const { data } = await requestNotion(`/pages/${pageId}`, 'PATCH', { properties }, workspace);
  return {
    id: data.id,
    archived: data.archived,
    last_edited_time: data.last_edited_time,
    properties: data.properties,
  };
}

export async function archivePage(
  pageId: string,
  archived: boolean = true,
  workspace: 'A' | 'B' | 'C' = 'B'
): Promise<NotionPageSnapshot> {
  const { data } = await requestNotion(`/pages/${pageId}`, 'PATCH', { archived }, workspace);
  return {
    id: data.id,
    archived: data.archived,
    last_edited_time: data.last_edited_time,
    properties: data.properties,
  };
}

export async function queryTasks(
  workspace: 'A' | 'B' | 'C' = 'B',
  pageSize: number = 10
): Promise<NotionPageSnapshot[]> {
  const dbId = getDatabaseId(workspace, 'tasks');
  const { data } = await requestNotion(`/databases/${dbId}/query`, 'POST', { page_size: pageSize }, workspace);
  return (data.results || []).map((p: any) => ({
    id: p.id,
    archived: p.archived,
    last_edited_time: p.last_edited_time,
    properties: p.properties,
  }));
}

/**
 * Filter out computed / read-only fields per SP-1 rules so Notion does not return HTTP 400.
 */
export function sanitizePropertiesForUpdate(rawProps: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, prop] of Object.entries(rawProps)) {
    if (!prop || typeof prop !== 'object') continue;
    const type = prop.type;

    // Filter computed / read-only fields
    if (['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by'].includes(type)) {
      continue;
    }

    switch (type) {
      case 'title': {
        const text = (prop.title || []).map((t: any) => t.plain_text).join('');
        sanitized[key] = { title: [{ text: { content: text } }] };
        break;
      }
      case 'rich_text': {
        const text = (prop.rich_text || []).map((t: any) => t.plain_text).join('');
        sanitized[key] = { rich_text: [{ text: { content: text } }] };
        break;
      }
      case 'number': {
        sanitized[key] = { number: prop.number ?? null };
        break;
      }
      case 'select': {
        sanitized[key] = { select: prop.select ? { name: prop.select.name } : null };
        break;
      }
      case 'status': {
        sanitized[key] = { status: prop.status ? { name: prop.status.name } : null };
        break;
      }
      case 'multi_select': {
        sanitized[key] = { multi_select: (prop.multi_select || []).map((m: any) => ({ name: m.name })) };
        break;
      }
      case 'date': {
        sanitized[key] = { date: prop.date ? { start: prop.date.start, end: prop.date.end } : null };
        break;
      }
      case 'people': {
        sanitized[key] = { people: (prop.people || []).map((p: any) => ({ id: p.id })) };
        break;
      }
      case 'checkbox': {
        sanitized[key] = { checkbox: Boolean(prop.checkbox) };
        break;
      }
      case 'relation': {
        sanitized[key] = { relation: (prop.relation || []).map((r: any) => ({ id: r.id })) };
        break;
      }
    }
  }

  return sanitized;
}
