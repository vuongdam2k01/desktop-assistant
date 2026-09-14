import { HardGateEvaluator } from "../evaluator/evaluator.js";
import type { ToolCallContext, SessionContext } from "../evaluator/context.js";
import { HR_PORTAL_DB_ID, ROADMAP_PAGE_ID } from "../ir/user-rules-catalog.js";

function createMockSession(overrides?: Partial<SessionContext>): SessionContext {
  return {
    jobId: "job-test-001",
    mode: "smart",
    currentUser: "current_user",
    now: new Date("2026-09-11T14:30:00+07:00"), // Friday afternoon during work hours
    cumulativeWritesInJob: 0,
    deadlineChangesInJob: 0,
    distinctPagesModifiedInJob: new Set<string>(),
    createdPagesInJob: new Set<string>(),
    dailyTaskCreates: 0,
    activeJobApprovals: [],
    ...overrides,
  };
}

export function runUnitTests() {
  console.log("================================================================================");
  console.log("RUNNING UNIT TESTS FOR SP-8 RULE IR & HARD GATE EVALUATOR");
  console.log("================================================================================\n");

  const evaluator = new HardGateEvaluator();
  let passedCount = 0;
  let totalCount = 0;

  function assertTest(name: string, condition: boolean, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${detail ? `(${detail})` : ""}`);
      throw new Error(`Test assertion failed: ${name}`);
    }
  }

  // 1. HARDLINE BLOCKLIST (FR-AP-10)
  console.log("[Group 1] Hardline Blocklist (DENY) in all modes:");
  {
    const call1: ToolCallContext = {
      toolCallId: "call-1",
      toolName: "archive_database",
      connector: "notion",
      params: { database_id: "db-tasks" },
    };
    // Even in mode OFF
    const res1 = evaluator.evaluate(call1, createMockSession({ mode: "off" }));
    assertTest("HL-01: archive_database DENIED in mode OFF", res1.verdict === "DENY" && res1.ruleId === "HL-01-DATABASE-DELETION");

    const call2: ToolCallContext = {
      toolCallId: "call-2",
      toolName: "update_database",
      connector: "notion",
      params: { database_id: "db-tasks", archived: true },
    };
    const res2 = evaluator.evaluate(call2, createMockSession({ mode: "smart" }));
    assertTest("HL-01: update_database{archived:true} DENIED", res2.verdict === "DENY");

    const call3: ToolCallContext = {
      toolCallId: "call-3",
      toolName: "clear_ledger",
      connector: "system",
      params: {},
    };
    const res3 = evaluator.evaluate(call3, createMockSession({ mode: "smart" }));
    assertTest("HL-02: Tampering with ledger DENIED", res3.verdict === "DENY" && res3.ruleId === "HL-02-LEDGER-CONFIG-TAMPERING");
  }

  // 2. MODE HANDLING
  console.log("\n[Group 2] Mode Handling (off, smart, on):");
  {
    const harmlessWrite: ToolCallContext = {
      toolCallId: "call-4",
      toolName: "create_page",
      connector: "notion",
      params: { database_id: "personal-db", properties: { Title: "My task" } },
    };

    const resOff = evaluator.evaluate(harmlessWrite, createMockSession({ mode: "off" }));
    assertTest("Mode OFF allows harmless write", resOff.verdict === "ALLOW");

    const resSmart = evaluator.evaluate(harmlessWrite, createMockSession({ mode: "smart" }));
    assertTest("Mode SMART allows harmless write", resSmart.verdict === "ALLOW");

    const resOn = evaluator.evaluate(harmlessWrite, createMockSession({ mode: "on" }));
    assertTest("Mode ON requires approval for harmless write (blanket gate)", resOn.verdict === "APPROVAL_REQUIRED" && resOn.ruleId === "MODE-ON-BLANKET");
  }

  // 3. USER RULES (R-01 .. R-14)
  console.log("\n[Group 3] Specific User Rules (SP-2 catalog):");
  {
    // R-01: archive_page and delete_block
    const archiveCall: ToolCallContext = {
      toolCallId: "call-5",
      toolName: "archive_page",
      connector: "notion",
      params: { page_id: "page-1" },
    };
    const resR01a = evaluator.evaluate(archiveCall, createMockSession());
    assertTest("R-01: archive_page requires approval", resR01a.verdict === "APPROVAL_REQUIRED" && resR01a.ruleId === "R-01");

    const deleteBlockCall: ToolCallContext = {
      toolCallId: "call-6",
      toolName: "delete_block",
      connector: "notion",
      params: { block_id: "block-1" },
    };
    const resR01b = evaluator.evaluate(deleteBlockCall, createMockSession());
    assertTest("R-01: delete_block requires approval", resR01b.verdict === "APPROVAL_REQUIRED" && resR01b.ruleId === "R-01");

    // R-02: Due date change
    const dueDateCall: ToolCallContext = {
      toolCallId: "call-7",
      toolName: "update_page_properties",
      connector: "notion",
      params: { page_id: "page-1", properties: { "Due date": "2026-09-15" } },
    };
    const resR02 = evaluator.evaluate(dueDateCall, createMockSession());
    assertTest("R-02: Due date update requires approval", resR02.verdict === "APPROVAL_REQUIRED" && resR02.ruleId === "R-02");

    // R-03: HR portal DB
    const hrCall: ToolCallContext = {
      toolCallId: "call-8",
      toolName: "update_page_properties",
      connector: "notion",
      params: { database_id: HR_PORTAL_DB_ID, properties: { Status: "In progress" } },
      target: { databaseId: HR_PORTAL_DB_ID },
    };
    const resR03 = evaluator.evaluate(hrCall, createMockSession());
    assertTest("R-03: Write to HR Portal DB requires approval", resR03.verdict === "APPROVAL_REQUIRED" && resR03.ruleId === "R-03");

    // R-05: Status Done
    const statusDoneCall: ToolCallContext = {
      toolCallId: "call-9",
      toolName: "update_page_properties",
      connector: "notion",
      params: { properties: { Status: "Done" } },
      target: { createdBy: "current_user" },
    };
    const resR05 = evaluator.evaluate(statusDoneCall, createMockSession());
    assertTest("R-05: Marking Status Done requires approval", resR05.verdict === "APPROVAL_REQUIRED" && resR05.ruleId === "R-05");

    // R-08: Task of Linh
    const linhTaskCall: ToolCallContext = {
      toolCallId: "call-10",
      toolName: "update_page_properties",
      connector: "notion",
      params: { properties: { Status: "In progress" } },
      target: { createdBy: "Linh" },
    };
    const resR08 = evaluator.evaluate(linhTaskCall, createMockSession());
    assertTest("R-08: Editing task created by Linh requires approval", resR08.verdict === "APPROVAL_REQUIRED" && resR08.ruleId === "R-08");

    // R-10: Ancestor hierarchy
    const childOfRoadmapCall: ToolCallContext = {
      toolCallId: "call-11",
      toolName: "update_page_properties",
      connector: "notion",
      params: { properties: { Status: "In progress" } },
      target: { pageId: "child-page-xyz", ancestorIds: ["parent-1", ROADMAP_PAGE_ID] },
    };
    const resR10 = evaluator.evaluate(childOfRoadmapCall, createMockSession());
    assertTest("R-10: Touching child page of Roadmap requires approval", resR10.verdict === "APPROVAL_REQUIRED" && resR10.ruleId === "R-10");
  }

  // 4. THRESHOLDS & CUMULATIVE COUNTERS (R-15, R-16, A-13)
  console.log("\n[Group 4] Cumulative Thresholds (A-13 evasion defense):");
  {
    const genericWriteCall: ToolCallContext = {
      toolCallId: "call-12",
      toolName: "update_page_properties",
      connector: "notion",
      params: { properties: { Status: "In progress" } },
      target: { createdBy: "current_user" },
    };

    // 5 writes so far: 6th call triggers R-15 (>5)
    const sessionUnder = createMockSession({ cumulativeWritesInJob: 4 });
    const resUnder = evaluator.evaluate(genericWriteCall, sessionUnder);
    assertTest("Write #5 is allowed under threshold 5", resUnder.verdict === "ALLOW");

    const sessionOver = createMockSession({ cumulativeWritesInJob: 5 });
    const resOver = evaluator.evaluate(genericWriteCall, sessionOver);
    assertTest("Write #6 is BLOCKED by cumulative threshold R-15", resOver.verdict === "APPROVAL_REQUIRED" && resOver.ruleId === "R-15");
  }

  // 5. EVASION TACTICS (A-15, A-16, A-17, A-19, A-20)
  console.log("\n[Group 5] Evasion Tactics Prevention (A-15..A-20):");
  {
    // A-15: Tool substitution to Deleted (bỏ) and title trash
    const sneakyDeleteCall: ToolCallContext = {
      toolCallId: "call-13",
      toolName: "update_page_properties",
      connector: "notion",
      params: { properties: { Status: "Deleted (bỏ)", Title: "zzz — ignore" } },
      target: { createdBy: "current_user" },
    };
    const resA15 = evaluator.evaluate(sneakyDeleteCall, createMockSession());
    assertTest("A-15: Sneaky delete via status update caught", resA15.verdict === "APPROVAL_REQUIRED" && resA15.ruleId === "STATIC-DESTRUCTIVE-UPDATE");

    const titleTrashCall: ToolCallContext = {
      toolCallId: "call-13-b",
      toolName: "update_page_properties",
      connector: "notion",
      params: { properties: { Title: "zzz — ignore" } },
      target: { createdBy: "current_user" },
    };
    const resA15b = evaluator.evaluate(titleTrashCall, createMockSession());
    assertTest("A-15: Sneaky title trash caught", resA15b.verdict === "APPROVAL_REQUIRED" && resA15b.ruleId === "STATIC-DESTRUCTIVE-UPDATE");

    // A-16: Schema deletion
    const schemaDeleteCall: ToolCallContext = {
      toolCallId: "call-14",
      toolName: "update_database",
      connector: "notion",
      params: { database_id: "db-tasks", remove_property: "Status" },
    };
    const resA16 = evaluator.evaluate(schemaDeleteCall, createMockSession());
    assertTest("A-16: Schema column removal caught", resA16.verdict === "APPROVAL_REQUIRED" && resA16.ruleId === "STATIC-SCHEMA-DELETION");

    // A-17: Ownership laundering (Assignee changed, but created_by is immutable)
    const launderedCall: ToolCallContext = {
      toolCallId: "call-15",
      toolName: "archive_page",
      connector: "notion",
      params: { page_id: "page-linh" },
      target: { createdBy: "Linh", currentAssignee: ["current_user"] },
    };
    const resA17 = evaluator.evaluate(launderedCall, createMockSession());
    assertTest("A-17: Ownership laundering cannot bypass created_by checks", resA17.verdict === "APPROVAL_REQUIRED");

    // A-19: Scoped approval expansion prevention
    const sessionWithStatusApproval = createMockSession({
      activeJobApprovals: [
        {
          jobId: "job-test-001",
          ruleId: "R-05", // User approved Status: Done
          toolName: "update_page_properties",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    // Call with Status: Done should now be ALLOWED
    const approvedCall: ToolCallContext = {
      toolCallId: "call-16",
      toolName: "update_page_properties",
      connector: "notion",
      params: { properties: { Status: "Done" } },
      target: { createdBy: "current_user" },
    };
    const resApproved = evaluator.evaluate(approvedCall, sessionWithStatusApproval);
    assertTest("A-19: Specific approved rule is allowed in job", resApproved.verdict === "ALLOW");

    // Sneaky call with Due date should STILL BE BLOCKED (not covered by R-05 approval)
    const sneakyDueDateCall: ToolCallContext = {
      toolCallId: "call-17",
      toolName: "update_page_properties",
      connector: "notion",
      params: { properties: { "Due date": "2026-09-30" } },
      target: { createdBy: "current_user" },
    };
    const resSneaky = evaluator.evaluate(sneakyDueDateCall, sessionWithStatusApproval);
    assertTest("A-19: Status approval does NOT leak to Due date update", resSneaky.verdict === "APPROVAL_REQUIRED" && resSneaky.ruleId === "R-02");

    // A-20: Database ID UUID anchoring
    const renameCall: ToolCallContext = {
      toolCallId: "call-18",
      toolName: "update_database",
      connector: "notion",
      params: { database_id: HR_PORTAL_DB_ID, title: "tmp" },
      target: { id: HR_PORTAL_DB_ID, targetType: "database" },
    };
    const resA20 = evaluator.evaluate(renameCall, createMockSession());
    assertTest("A-20: Renaming HR Portal DB is blocked by UUID rule R-03", resA20.verdict === "APPROVAL_REQUIRED" && resA20.ruleId === "R-03");
  }

  console.log(`\n================================================================================`);
  console.log(`UNIT TESTS COMPLETED: ${passedCount}/${totalCount} TESTS PASSED (100%)`);
  console.log(`================================================================================\n`);
}
