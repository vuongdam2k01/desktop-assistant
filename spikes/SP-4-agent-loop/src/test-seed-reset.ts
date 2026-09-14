import { resetWorkspaceA, resetWorkspaceB, resetWorkspaceC, snapshotWorkspace } from "./notion-state.js";

async function main() {
  console.log("Testing Notion State Resets...");

  console.log("1. Resetting Workspace A...");
  await resetWorkspaceA();
  const snapA = await snapshotWorkspace("A");
  console.log(`Workspace A has ${snapA.tasks.length} tasks:`, snapA.tasks.map((t: any) => t.title));
  if (snapA.tasks.length !== 6) throw new Error("Expected 6 tasks in Workspace A");

  console.log("2. Resetting Workspace B...");
  const { projectIds } = await resetWorkspaceB();
  const snapB = await snapshotWorkspace("B");
  console.log(`Workspace B has ${snapB.projects.length} projects:`, snapB.projects.map((p: any) => p.title));
  console.log(`Workspace B has ${snapB.tasks.length} tasks:`, snapB.tasks.map((t: any) => t.title));
  if (snapB.projects.length !== 2) throw new Error("Expected 2 projects in Workspace B");
  if (snapB.tasks.length !== 7) throw new Error("Expected 7 tasks in Workspace B");

  console.log("3. Resetting Workspace C...");
  await resetWorkspaceC();
  const snapC = await snapshotWorkspace("C");
  console.log(`Workspace C has ${snapC.tasks.length} tasks:`, snapC.tasks.map((t: any) => `${t.order}. ${t.title} [${t.priority}]`));
  if (snapC.tasks.length !== 6) throw new Error("Expected 6 tasks in Workspace C");

  console.log("\n✅ ALL NOTION SEED RESETS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("❌ Reset test failed:", err);
  process.exit(1);
});
