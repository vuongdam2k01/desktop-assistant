import {
  getNotionToken,
  getDatabaseId,
  queryDatabase,
  archivePage,
  createPage,
} from './notion-client.js';

export interface SeedTaskA {
  title: string;
  status: string;
  due_date: string;
  creator: string;
}

export interface SeedTaskB {
  title: string;
  status: string;
  due_date: string;
  assignee: string;
  tags: string[];
  project: string;
  creator: string;
}

export interface SeedTaskC {
  order: number;
  title: string;
  priority: string;
  status: string;
  due_date: string;
  creator: string;
}

export const SEED_A_DATA: SeedTaskA[] = [
  { title: 'Viết docs API HR portal', status: 'In progress', due_date: '2026-09-15', creator: 'user' },
  { title: 'Review PR #212 của Hùng', status: 'Not started', due_date: '2026-09-11', creator: 'user' },
  { title: 'Gửi report tuần cho Linh', status: 'Not started', due_date: '2026-09-12', creator: 'user' },
  { title: 'Fix bug đăng nhập SSO', status: 'In progress', due_date: '2026-09-18', creator: 'Tuấn' },
  { title: 'Họp retro sprint 14', status: 'Not started', due_date: '2026-09-16', creator: 'Linh' },
  { title: 'Chuẩn bị demo Vinmart', status: 'Not started', due_date: '2026-09-22', creator: 'user' },
];

export const SEED_B_PROJECTS = [
  { key: 'P1', name: 'Mobile app Vinmart' },
  { key: 'P2', name: 'HR portal nội bộ' },
];

export const SEED_B_DATA: SeedTaskB[] = [
  { title: 'Design review màn checkout', status: 'In progress', due_date: '2026-09-14', assignee: 'Trang', tags: ['feature'], project: 'P1', creator: 'Linh' },
  { title: 'Weekly report Vinmart', status: 'Not started', due_date: '2026-09-12', assignee: 'user', tags: ['docs'], project: 'P1', creator: 'user' },
  { title: 'Monthly report HR', status: 'Not started', due_date: '2026-09-30', assignee: 'user', tags: ['docs'], project: 'P2', creator: 'user' },
  { title: 'Fix crash khi upload avatar', status: 'Not started', due_date: '2026-09-17', assignee: 'Hùng', tags: ['bug'], project: 'P2', creator: 'Tuấn' },
  { title: 'Viết test cho module payroll', status: 'Not started', due_date: '2026-09-21', assignee: 'user', tags: ['feature'], project: 'P2', creator: 'user' },
  { title: 'Sync với khách về contract', status: 'Done', due_date: '2026-09-08', assignee: 'user', tags: ['meeting'], project: 'P1', creator: 'user' },
  { title: 'Setup CI cho repo mobile', status: 'In progress', due_date: '2026-09-16', assignee: 'user', tags: ['feature'], project: 'P1', creator: 'user' },
];

export const SEED_C_DATA: SeedTaskC[] = [
  { order: 1, title: 'Fix crash màn thanh toán', priority: 'High', status: 'In progress', due_date: '2026-09-12', creator: 'user' },
  { order: 2, title: 'Viết docs onboarding', priority: 'Medium', status: 'Not started', due_date: '2026-09-18', creator: 'user' },
  { order: 3, title: 'Review PR #212 của Hùng', priority: 'Medium', status: 'Not started', due_date: '2026-09-11', creator: 'user' },
  { order: 4, title: 'Refactor module auth', priority: 'Low', status: 'Not started', due_date: '2026-09-25', creator: 'user' },
  { order: 5, title: 'Trả lời feedback QA round 2', priority: 'High', status: 'Not started', due_date: '2026-09-15', creator: 'Linh' },
  { order: 6, title: 'Update thư viện lên RN 0.80', priority: 'Low', status: 'Not started', due_date: '2026-10-02', creator: 'user' },
];

export function extractPageTitle(page: any): string {
  const titleProp = page.properties?.Name?.title || [];
  return titleProp.map((t: any) => t.plain_text).join('').trim();
}

export function extractPageStatus(page: any): string {
  return page.properties?.Status?.select?.name || page.properties?.['Task Status']?.status?.name || '';
}

export function extractPageDueDate(page: any): string {
  return page.properties?.['Due date']?.date?.start || '';
}

export function extractPagePriority(page: any): string {
  return page.properties?.Priority?.select?.name || '';
}

export function extractPageOrder(page: any): number | null {
  return page.properties?.Order?.number ?? null;
}

export function extractPageAssignee(page: any): string {
  const textName = page.properties?.['Assignee Name']?.rich_text?.[0]?.plain_text;
  if (textName) return textName;
  const people = page.properties?.Assignee?.people || [];
  if (people.length > 0) return people[0].name || 'user';
  return '';
}

export function extractPageTags(page: any): string[] {
  return (page.properties?.Tags?.multi_select || []).map((t: any) => t.name);
}

export function extractPageRelation(page: any): string[] {
  return (page.properties?.Project?.relation || []).map((r: any) => r.id);
}

export async function resetWorkspaceA(): Promise<void> {
  const token = getNotionToken('A');
  const dbId = getDatabaseId('A', 'tasks');
  const existingPages = await queryDatabase(token, dbId);

  for (const p of existingPages) {
    await archivePage(token, p.id, true);
  }

  for (const item of SEED_A_DATA) {
    const props: any = {
      Name: { title: [{ text: { content: item.title } }] },
      Status: { select: { name: item.status } },
      'Due date': { date: { start: item.due_date } },
      Creator: { rich_text: [{ text: { content: item.creator } }] },
    };
    await createPage(token, dbId, props);
  }
}

export async function resetWorkspaceB(): Promise<{ projectIds: Record<string, string> }> {
  const token = getNotionToken('B');
  const projDbId = getDatabaseId('B', 'projects');
  const tasksDbId = getDatabaseId('B', 'tasks');

  const existingProjs = await queryDatabase(token, projDbId);
  for (const p of existingProjs) {
    await archivePage(token, p.id, true);
  }

  const projectIds: Record<string, string> = {};
  for (const proj of SEED_B_PROJECTS) {
    const res = await createPage(token, projDbId, {
      Name: { title: [{ text: { content: proj.name } }] },
      Status: { select: { name: 'Đang chạy' } },
    });
    projectIds[proj.key] = res.id;
  }

  const existingTasks = await queryDatabase(token, tasksDbId);
  for (const p of existingTasks) {
    await archivePage(token, p.id, true);
  }

  for (const item of SEED_B_DATA) {
    const projId = projectIds[item.project];
    const props: any = {
      Name: { title: [{ text: { content: item.title } }] },
      Status: { select: { name: item.status } },
      'Due date': { date: { start: item.due_date } },
      Tags: { multi_select: item.tags.map((t) => ({ name: t })) },
      Project: { relation: projId ? [{ id: projId }] : [] },
      'Assignee Name': { rich_text: [{ text: { content: item.assignee } }] },
      Creator: { rich_text: [{ text: { content: item.creator } }] },
    };
    await createPage(token, tasksDbId, props);
  }

  return { projectIds };
}

export async function resetWorkspaceC(): Promise<void> {
  const token = getNotionToken('C');
  const dbId = getDatabaseId('C', 'tasks');
  const existingPages = await queryDatabase(token, dbId);

  for (const p of existingPages) {
    await archivePage(token, p.id, true);
  }

  for (const item of SEED_C_DATA) {
    const props: any = {
      Name: { title: [{ text: { content: item.title } }] },
      Order: { number: item.order },
      Priority: { select: { name: item.priority } },
      Status: { select: { name: item.status } },
      'Due date': { date: { start: item.due_date } },
      Creator: { rich_text: [{ text: { content: item.creator } }] },
    };
    await createPage(token, dbId, props);
  }
}

export async function snapshotWorkspace(workspaceKey: 'A' | 'B' | 'C'): Promise<any> {
  const token = getNotionToken(workspaceKey);
  const tasksDbId = getDatabaseId(workspaceKey, 'tasks');
  const tasks = await queryDatabase(token, tasksDbId);

  const parsedTasks = tasks.map((p) => ({
    id: p.id,
    title: extractPageTitle(p),
    status: extractPageStatus(p),
    due_date: extractPageDueDate(p),
    priority: extractPagePriority(p),
    order: extractPageOrder(p),
    assignee: extractPageAssignee(p),
    tags: extractPageTags(p),
    project_relation: extractPageRelation(p),
    archived: p.archived,
    last_edited_time: p.last_edited_time,
  }));

  return {
    workspace: workspaceKey,
    timestamp: new Date().toISOString(),
    tasks: parsedTasks,
  };
}
