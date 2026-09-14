import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env.local');
const fixturesPath = path.resolve(__dirname, '../../fixtures/notion.json');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

let notionFixtures: any = null;
if (fs.existsSync(fixturesPath)) {
  notionFixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
}

export function getNotionToken(workspace: 'A' | 'B' | 'C'): string {
  const key = `NOTION_TOKEN_${workspace}`;
  const token = process.env[key];
  if (!token) {
    throw new Error(`Missing environment variable ${key} in .env.local`);
  }
  return token;
}

export function getDatabaseId(workspace: 'A' | 'B' | 'C', role: 'tasks' | 'projects' = 'tasks'): string {
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

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(`Notion API Error [${status}] ${code}: ${message}`);
    this.name = 'NotionApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

async function requestNotion(token: string, method: string, endpoint: string, body?: any): Promise<any> {
  const url = `https://api.notion.com/v1${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody: any = await response.json().catch(() => ({}));
    const retryAfter = response.headers.get('Retry-After') ? Number(response.headers.get('Retry-After')) : undefined;
    throw new NotionApiError(
      response.status,
      errorBody.code || 'unknown_error',
      errorBody.message || response.statusText,
      retryAfter
    );
  }

  return response.json();
}

/**
 * Sanitize raw Notion page properties to editable/writeable property dictionary (SP-1).
 * Excludes formula, rollup, created_time, created_by, last_edited_time, last_edited_by.
 */
export function sanitizePropertiesForUpdate(rawProps: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, prop] of Object.entries(rawProps)) {
    if (!prop || typeof prop !== 'object') continue;
    const type = prop.type;

    // Filter out computed / read-only fields per SP-1 rules
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
        if (prop.status?.name) {
          sanitized[key] = { status: { name: prop.status.name } };
        }
        break;
      }
      case 'multi_select': {
        sanitized[key] = {
          multi_select: (prop.multi_select || []).map((m: any) => ({ name: m.name })),
        };
        break;
      }
      case 'date': {
        sanitized[key] = {
          date: prop.date ? { start: prop.date.start, end: prop.date.end } : null,
        };
        break;
      }
      case 'people': {
        sanitized[key] = {
          people: (prop.people || []).map((p: any) => ({ id: p.id })),
        };
        break;
      }
      case 'checkbox': {
        sanitized[key] = { checkbox: Boolean(prop.checkbox) };
        break;
      }
      case 'relation': {
        sanitized[key] = {
          relation: (prop.relation || []).map((r: any) => ({ id: r.id })),
        };
        break;
      }
      default:
        // Ignore other unsupported or complex types
        break;
    }
  }

  return sanitized;
}

export async function getPage(token: string, pageId: string): Promise<any> {
  return requestNotion(token, 'GET', `/pages/${pageId}`);
}

export async function queryDatabase(token: string, databaseId: string, filter?: any): Promise<any[]> {
  const body: any = {};
  if (filter) body.filter = filter;

  let results: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    if (startCursor) body.start_cursor = startCursor;
    const resp = await requestNotion(token, 'POST', `/databases/${databaseId}/query`, body);
    results = results.concat(resp.results || []);
    hasMore = Boolean(resp.has_more);
    startCursor = resp.next_cursor || undefined;
  }

  return results;
}

export async function createPage(token: string, databaseId: string, properties: any): Promise<any> {
  return requestNotion(token, 'POST', '/pages', {
    parent: { database_id: databaseId },
    properties,
  });
}

export async function updatePageProperties(token: string, pageId: string, properties: any): Promise<any> {
  return requestNotion(token, 'PATCH', `/pages/${pageId}`, {
    properties,
  });
}

export async function archivePage(token: string, pageId: string, archived: boolean = true): Promise<any> {
  return requestNotion(token, 'PATCH', `/pages/${pageId}`, {
    archived,
  });
}

export async function createComment(token: string, pageId: string, text: string): Promise<any> {
  return requestNotion(token, 'POST', '/comments', {
    parent: { page_id: pageId },
    rich_text: [{ text: { content: text } }],
  });
}
