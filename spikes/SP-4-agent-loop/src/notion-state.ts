import {
  getNotionToken,
  getDatabaseId,
  queryDatabase,
  archivePage,
  createPage,
  updatePageProperties,
} from "./notion-client.js";

export interface SeedTaskA {
  id_key: string;
  title: string;
  status: string;
  due_date: string;
  creator: string;
}

export interface SeedTaskB {
  id_key: string;
  title: string;
  status: string;
  due_date: string;
  assignee: string;
  tags: string[];
  project: string; // P1 | P2
  creator: string;
}

export interface SeedTaskC {
  id_key: string;
  order: number;
  title: string;
  priority: string;
  status: string;
  due_date: string;
  creator: string;
}

export const SEED_A_DATA: SeedTaskA[] = [
  { id_key: "A1", title: "Viết docs API HR portal", status: "In progress", due_date: "2026-09-15", creator: "user" },
  { id_key: "A2", title: "Review PR #212 của Hùng", status: "Not started", due_date: "2026-09-11", creator: "user" },
  { id_key: "A3", title: "Gửi report tuần cho Linh", status: "Not started", due_date: "2026-09-12", creator: "user" },
  { id_key: "A4", title: "Fix bug đăng nhập SSO", status: "In progress", due_date: "2026-09-18", creator: "Tuấn" },
  { id_key: "A5", title: "Họp retro sprint 14", status: "Not started", due_date: "2026-09-16", creator: "Linh" },
  { id_key: "A6", title: "Chuẩn bị demo Vinmart", status: "Not started", due_date: "2026-09-22", creator: "user" },
];

export const SEED_B_PROJECTS = [
  { key: "P1", name: "Mobile app Vinmart" },
  { key: "P2", name: "HR portal nội bộ" },
];

export const SEED_B_DATA: SeedTaskB[] = [
  { id_key: "B1", title: "Design review màn checkout", status: "In progress", due_date: "2026-09-14", assignee: "Trang", tags: ["feature"], project: "P1", creator: "Linh" },
  { id_key: "B2", title: "Weekly report Vinmart", status: "Not started", due_date: "2026-09-12", assignee: "user", tags: ["docs"], project: "P1", creator: "user" },
  { id_key: "B3", title: "Monthly report HR", status: "Not started", due_date: "2026-09-30", assignee: "user", tags: ["docs"], project: "P2", creator: "user" },
  { id_key: "B4", title: "Fix crash khi upload avatar", status: "Not started", due_date: "2026-09-17", assignee: "Hùng", tags: ["bug"], project: "P2", creator: "Tuấn" },
  { id_key: "B5", title: "Viết test cho module payroll", status: "Not started", due_date: "2026-09-21", assignee: "user", tags: ["feature"], project: "P2", creator: "user" },
  { id_key: "B6", title: "Sync với khách về contract", status: "Done", due_date: "2026-09-08", assignee: "user", tags: ["meeting"], project: "P1", creator: "user" },
  { id_key: "B7", title: "Setup CI cho repo mobile", status: "In progress", due_date: "2026-09-16", assignee: "user", tags: ["feature"], project: "P1", creator: "user" },
];

export const SEED_C_DATA: SeedTaskC[] = [
  { id_key: "C1", order: 1, title: "Fix crash màn thanh toán", priority: "High", status: "In progress", due_date: "2026-09-12", creator: "user" },
  { id_key: "C2", order: 2, title: "Viết docs onboarding", priority: "Medium", status: "Not started", due_date: "2026-09-18", creator: "user" },
  { id_key: "C3", order: 3, title: "Review PR #212 của Hùng", priority: "Medium", status: "Not started", due_date: "2026-09-11", creator: "user" },
  { id_key: "C4", order: 4, title: "Refactor module auth", priority: "Low", status: "Not started", due_date: "2026-09-25", creator: "user" },
  { id_key: "C5", order: 5, title: "Trả lời feedback QA round 2", priority: "High", status: "Not started", due_date: "2026-09-15", creator: "Linh" },
  { id_key: "C6", order: 6, title: "Update thư viện lên RN 0.80", priority: "Low", status: "Not started", due_date: "2026-10-02", creator: "user" },
];

export function extractPageTitle(page: any): string {
  const titleProp = page.properties?.Name?.title || [];
  return titleProp.map((t: any) => t.plain_text).join("").trim();
}

export function extractPageStatus(page: any): string {
  return page.properties?.Status?.select?.name || page.properties?.["Task Status"]?.status?.name || "";
}

export function extractPageDueDate(page: any): string {
  return page.properties?.["Due date"]?.date?.start || "";
}

export function extractPagePriority(page: any): string {
  return page.properties?.Priority?.select?.name || "";
}

export function extractPageOrder(page: any): number | null {
  return page.properties?.Order?.number ?? null;
}

export function extractPageAssignee(page: any): string {
  const textName = page.properties?.["Assignee Name"]?.rich_text?.[0]?.plain_text;
  if (textName) return textName;
  const people = page.properties?.Assignee?.people || [];
  if (people.length > 0) return people[0].name || "user";
  return "";
}

export function extractPageTags(page: any): string[] {
  return (page.properties?.Tags?.multi_select || []).map((t: any) => t.name);
}

export function extractPageRelation(page: any): string[] {
  return (page.properties?.Project?.relation || []).map((r: any) => r.id);
}

/**
 * Reset Workspace A về đúng 6 task Seed A
 */
export async function resetWorkspaceA(): Promise<void> {
  const token = getNotionToken("A");
  const dbId = getDatabaseId("A", "tasks");
  const existingPages = await queryDatabase(token, dbId);

  // Archive mọi trang hiện tại để đảm bảo sạch sẽ 100%
  for (const p of existingPages) {
    await archivePage(token, p.id, true);
  }

  // Tạo lại đúng 6 task seed
  for (const item of SEED_A_DATA) {
    const props: any = {
      Name: { title: [{ text: { content: item.title } }] },
      Status: { select: { name: item.status } },
      "Due date": { date: { start: item.due_date } },
      Creator: { rich_text: [{ text: { content: item.creator } }] },
    };
    await createPage(token, dbId, props);
  }
}

/**
 * Reset Workspace B về đúng Projects P1/P2 và 7 task Seed B
 */
export async function resetWorkspaceB(): Promise<{ projectIds: Record<string, string> }> {
  const token = getNotionToken("B");
  const projDbId = getDatabaseId("B", "projects");
  const tasksDbId = getDatabaseId("B", "tasks");

  // 1. Projects: archive các project cũ và tạo P1, P2
  const existingProjs = await queryDatabase(token, projDbId);
  for (const p of existingProjs) {
    await archivePage(token, p.id, true);
  }

  const projectIds: Record<string, string> = {};
  for (const proj of SEED_B_PROJECTS) {
    const res = await createPage(token, projDbId, {
      Name: { title: [{ text: { content: proj.name } }] },
      Status: { select: { name: "Đang chạy" } },
    });
    projectIds[proj.key] = res.id;
  }

  // 2. Tasks: archive toàn bộ task cũ và tạo 7 task Seed B
  const existingTasks = await queryDatabase(token, tasksDbId);
  for (const p of existingTasks) {
    await archivePage(token, p.id, true);
  }

  for (const item of SEED_B_DATA) {
    const projId = projectIds[item.project];
    const props: any = {
      Name: { title: [{ text: { content: item.title } }] },
      Status: { select: { name: item.status } },
      "Due date": { date: { start: item.due_date } },
      Tags: { multi_select: item.tags.map((t) => ({ name: t })) },
      Project: { relation: projId ? [{ id: projId }] : [] },
      "Assignee Name": { rich_text: [{ text: { content: item.assignee } }] },
      Creator: { rich_text: [{ text: { content: item.creator } }] },
    };
    await createPage(token, tasksDbId, props);
  }

  return { projectIds };
}

/**
 * Reset Workspace C về đúng 6 task Seed C
 */
export async function resetWorkspaceC(): Promise<void> {
  const token = getNotionToken("C");
  const dbId = getDatabaseId("C", "tasks");
  const existingPages = await queryDatabase(token, dbId);

  // Archive mọi trang hiện tại
  for (const p of existingPages) {
    await archivePage(token, p.id, true);
  }

  // Tạo lại đúng 6 task seed
  for (const item of SEED_C_DATA) {
    const props: any = {
      Name: { title: [{ text: { content: item.title } }] },
      Order: { number: item.order },
      Priority: { select: { name: item.priority } },
      Status: { select: { name: item.status } },
      "Due date": { date: { start: item.due_date } },
      Creator: { rich_text: [{ text: { content: item.creator } }] },
    };
    await createPage(token, dbId, props);
  }
}

/**
 * Lấy snapshot toàn bộ trang trong workspace
 */
export async function snapshotWorkspace(workspaceKey: "A" | "B" | "C"): Promise<any> {
  const token = getNotionToken(workspaceKey);
  const tasksDbId = getDatabaseId(workspaceKey, "tasks");
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
  }));

  let parsedProjects: any[] = [];
  if (workspaceKey === "B") {
    const projDbId = getDatabaseId("B", "projects");
    const projs = await queryDatabase(token, projDbId);
    parsedProjects = projs.map((p) => ({
      id: p.id,
      title: extractPageTitle(p),
      archived: p.archived,
    }));
  }

  return {
    workspace: workspaceKey,
    timestamp: new Date().toISOString(),
    tasks: parsedTasks,
    projects: parsedProjects,
  };
}
