import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, "../evidence");

export interface ScenarioDefinition {
  id: string;
  workspace: "A" | "B" | "C";
  instruction: string;
  complexity: "đơn" | "vừa" | "phức";
  shouldAsk: boolean;
  userAnswer?: string;
  imagePath?: string;
  evaluate: (snapshot: any, askRecords: any[]) => { success: boolean; reasons: string[] };
}

export const SCENARIOS: ScenarioDefinition[] = [
  // ────────────────────────────────────────── S-01
  {
    id: "S-01",
    workspace: "A",
    instruction: "thêm task fix login vinmart vào notion, dl thứ 5",
    complexity: "đơn",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 7) reasons.push(`Expected 7 tasks, found ${tasks.length}`);
      const newTask = tasks.find((t: any) => {
        const title = t.title.toLowerCase();
        return title.includes("fix login") && title.includes("vinmart");
      });
      if (!newTask) reasons.push("New task 'fix login vinmart' not found");
      else {
        if (newTask.due_date !== "2026-09-17") reasons.push(`Expected due date 2026-09-17, got ${newTask.due_date}`);
        if (newTask.status !== "Not started") reasons.push(`Expected status 'Not started', got '${newTask.status}'`);
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-02
  {
    id: "S-02",
    workspace: "C",
    instruction: "xong cái review PR của Hùng rồi nhé",
    complexity: "đơn",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 6) reasons.push(`Expected 6 tasks, found ${tasks.length}`);
      const c3 = tasks.find((t: any) => t.title.includes("Review PR #212"));
      if (!c3) reasons.push("Task C3 not found");
      else {
        if (c3.status !== "Done") reasons.push(`Expected C3 status 'Done', got '${c3.status}'`);
        if (c3.order !== 3) reasons.push(`Expected C3 order 3, got ${c3.order}`);
        if (c3.due_date !== "2026-09-11") reasons.push(`Expected C3 due date 2026-09-11, got ${c3.due_date}`);
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-03
  {
    id: "S-03",
    workspace: "A",
    instruction: "push the SSO login bug to next week, monday is fine",
    complexity: "đơn",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 6) reasons.push(`Expected 6 tasks, found ${tasks.length}`);
      const a4 = tasks.find((t: any) => t.title.includes("Fix bug đăng nhập SSO"));
      if (!a4) reasons.push("Task A4 not found");
      else {
        if (a4.due_date !== "2026-09-14") reasons.push(`Expected A4 due date 2026-09-14, got ${a4.due_date}`);
        if (a4.status !== "In progress") reasons.push(`Expected A4 status 'In progress', got '${a4.status}'`);
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-04
  {
    id: "S-04",
    workspace: "C",
    instruction: "thêm task 'viết migration script cho bảng users', prio high, dl thứ 4, xếp trước task viết docs",
    complexity: "vừa",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 7) reasons.push(`Expected 7 tasks, found ${tasks.length}`);
      const newTask = tasks.find((t: any) => {
        const title = t.title.toLowerCase();
        return title.includes("migration script") && title.includes("users");
      });
      if (!newTask) reasons.push("New migration script task not found");
      else {
        if (newTask.priority !== "High") reasons.push(`Expected priority 'High', got '${newTask.priority}'`);
        if (newTask.due_date !== "2026-09-16") reasons.push(`Expected due date 2026-09-16, got ${newTask.due_date}`);
        const c1 = tasks.find((t: any) => t.title.includes("Fix crash màn thanh toán"));
        const c2 = tasks.find((t: any) => t.title.includes("Viết docs onboarding"));
        if (c1 && c2) {
          if (!(c1.order < newTask.order && newTask.order < c2.order)) {
            reasons.push(`Expected order C1 (${c1.order}) < new (${newTask.order}) < C2 (${c2.order})`);
          }
        }
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-05
  {
    id: "S-05",
    workspace: "B",
    instruction: "tạo task 'họp align scope phase 2 với Linh' bên project vinmart, giao cho Linh, tag meeting, thứ 3 tuần sau",
    complexity: "vừa",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 8) reasons.push(`Expected 8 tasks, found ${tasks.length}`);
      const newTask = tasks.find((t: any) => t.title.toLowerCase().includes("align scope phase 2"));
      if (!newTask) reasons.push("New task 'align scope phase 2' not found");
      else {
        if (newTask.due_date !== "2026-09-15") reasons.push(`Expected due date 2026-09-15, got ${newTask.due_date}`);
        if (!newTask.assignee.toLowerCase().includes("linh")) reasons.push(`Expected assignee Linh, got '${newTask.assignee}'`);
        if (!newTask.tags.includes("meeting")) reasons.push(`Expected tags to contain 'meeting', got ${JSON.stringify(newTask.tags)}`);
        const p1 = snap.projects.find((p: any) => p.title.includes("Mobile app Vinmart"));
        if (p1 && (!newTask.project_relation || !newTask.project_relation.includes(p1.id))) {
          reasons.push("Task not linked to Project Vinmart (P1)");
        }
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-06
  {
    id: "S-06",
    workspace: "C",
    instruction: "Hãy thêm cho tao task làm slide pitch cho Vinmart, dl thứ 3, cân bằng lại các công việc khác",
    complexity: "phức",
    shouldAsk: true,
    userAnswer: "(A) theo deadline, không đổi Priority hay deadline của ai",
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 7) reasons.push(`Expected 7 tasks, found ${tasks.length}`);
      const newTask = tasks.find((t: any) => {
        const title = t.title.toLowerCase();
        return title.includes("slide pitch") && title.includes("vinmart");
      });
      if (!newTask) reasons.push("New task 'slide pitch' not found");
      else {
        if (newTask.due_date !== "2026-09-15") reasons.push(`Expected due date 2026-09-15, got ${newTask.due_date}`);
        // Sorted by order
        const sorted = [...tasks].sort((a, b) => a.order - b.order);
        // Expected order sequence: C3 (09-11) < C1 (09-12) < {new, C5} (09-15) < C2 (09-18) < C4 (09-25) < C6 (10-02)
        const orderC3 = tasks.find((t: any) => t.title.includes("Review PR #212"))?.order;
        const orderC1 = tasks.find((t: any) => t.title.includes("Fix crash màn thanh toán"))?.order;
        const orderC2 = tasks.find((t: any) => t.title.includes("Viết docs onboarding"))?.order;
        const orderC4 = tasks.find((t: any) => t.title.includes("Refactor module auth"))?.order;
        const orderC6 = tasks.find((t: any) => t.title.includes("Update thư viện"))?.order;
        if (orderC3 !== undefined && orderC1 !== undefined && orderC2 !== undefined) {
          if (!(orderC3 < orderC1 && orderC1 < newTask.order && newTask.order < orderC2 && orderC2 < orderC4 && orderC4 < orderC6)) {
            reasons.push(`Order sequence not sorted by deadline: C3=${orderC3}, C1=${orderC1}, new=${newTask.order}, C2=${orderC2}`);
          }
        }
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-07
  {
    id: "S-07",
    workspace: "A",
    instruction: "tuần này ngập quá, dồn bớt việc sang tuần sau đi",
    complexity: "vừa",
    shouldAsk: true,
    userAnswer: "cái nào chưa bắt đầu thì dời, đang làm thì giữ; ngày nào tuần sau cũng đc",
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 6) reasons.push(`Expected 6 tasks, found ${tasks.length}`);
      const a2 = tasks.find((t: any) => t.title.includes("Review PR #212"));
      const a3 = tasks.find((t: any) => t.title.includes("Gửi report tuần cho Linh"));
      const a1 = tasks.find((t: any) => t.title.includes("Viết docs API HR portal"));
      if (a1 && a1.due_date !== "2026-09-15") reasons.push(`A1 (in progress) was modified: ${a1.due_date}`);
      if (a2 && (a2.due_date < "2026-09-14" || a2.due_date > "2026-09-18")) {
        reasons.push(`A2 due date not in next week: ${a2.due_date}`);
      }
      if (a3 && (a3.due_date < "2026-09-14" || a3.due_date > "2026-09-18")) {
        reasons.push(`A3 due date not in next week: ${a3.due_date}`);
      }
      if (a2 && a3 && a2.due_date > a3.due_date) {
        reasons.push(`Relative order reversed: A2 (${a2.due_date}) > A3 (${a3.due_date})`);
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-08
  {
    id: "S-08",
    workspace: "C",
    instruction: "reorder everything by deadline pls, earliest first",
    complexity: "vừa",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 6) reasons.push(`Expected 6 tasks, found ${tasks.length}`);
      const sorted = [...tasks].sort((a, b) => a.order - b.order);
      // Expected sequence: C3 (09-11) -> C1 (09-12) -> C5 (09-15) -> C2 (09-18) -> C4 (09-25) -> C6 (10-02)
      const titles = sorted.map((t) => t.title);
      if (!titles[0]?.includes("Review PR #212")) reasons.push(`Expected #1 to be Review PR (09-11), got '${titles[0]}'`);
      if (!titles[1]?.includes("Fix crash màn thanh toán")) reasons.push(`Expected #2 to be Fix crash (09-12), got '${titles[1]}'`);
      if (!titles[2]?.includes("Trả lời feedback QA")) reasons.push(`Expected #3 to be Trả lời feedback (09-15), got '${titles[2]}'`);
      if (!titles[3]?.includes("Viết docs onboarding")) reasons.push(`Expected #4 to be Viết docs (09-18), got '${titles[3]}'`);
      if (!titles[4]?.includes("Refactor module auth")) reasons.push(`Expected #5 to be Refactor auth (09-25), got '${titles[4]}'`);
      if (!titles[5]?.includes("Update thư viện")) reasons.push(`Expected #6 to be Update thư viện (10-02), got '${titles[5]}'`);
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-09
  {
    id: "S-09",
    workspace: "C",
    instruction: "cái trả lời feedback QA khẩn lắm, đẩy lên đầu đi, còn lại lùi hết xuống",
    complexity: "vừa",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 6) reasons.push(`Expected 6 tasks, found ${tasks.length}`);
      const sorted = [...tasks].sort((a, b) => a.order - b.order);
      if (!sorted[0]?.title.includes("Trả lời feedback QA")) {
        reasons.push(`Expected top task to be 'Trả lời feedback QA', got '${sorted[0]?.title}'`);
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-10
  {
    id: "S-10",
    workspace: "B",
    instruction: "cân đối lại việc giữa tao với Linh đi, tao đang ngập, Linh đang rảnh",
    complexity: "vừa",
    shouldAsk: true,
    userAnswer: "Weekly report Vinmart với Setup CI",
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 7) reasons.push(`Expected 7 tasks, found ${tasks.length}`);
      const b2 = tasks.find((t: any) => t.title.includes("Weekly report Vinmart"));
      const b7 = tasks.find((t: any) => t.title.includes("Setup CI cho repo mobile"));
      const b3 = tasks.find((t: any) => t.title.includes("Monthly report HR"));
      const b5 = tasks.find((t: any) => t.title.includes("Viết test cho module payroll"));
      if (b2 && !b2.assignee.toLowerCase().includes("linh")) reasons.push(`Expected B2 assignee Linh, got '${b2.assignee}'`);
      if (b7 && !b7.assignee.toLowerCase().includes("linh")) reasons.push(`Expected B7 assignee Linh, got '${b7.assignee}'`);
      if (b3 && b3.assignee.toLowerCase().includes("linh")) reasons.push(`B3 should remain user, got '${b3.assignee}'`);
      if (b5 && b5.assignee.toLowerCase().includes("linh")) reasons.push(`B5 should remain user, got '${b5.assignee}'`);
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-11
  {
    id: "S-11",
    workspace: "A",
    instruction: "xoá cái task hôm qua tạo đi, ko cần nữa",
    complexity: "đơn",
    shouldAsk: true,
    userAnswer: "cái report",
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 5) reasons.push(`Expected 5 active tasks, found ${tasks.length}`);
      const a3 = tasks.find((t: any) => t.title.includes("Gửi report tuần cho Linh"));
      if (a3) reasons.push("Task A3 ('Gửi report tuần cho Linh') was not archived");
      const a2 = tasks.find((t: any) => t.title.includes("Review PR #212"));
      if (!a2) reasons.push("Task A2 was archived by mistake");
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-12
  {
    id: "S-12",
    workspace: "B",
    instruction: "đổi dl task report sang cuối tháng",
    complexity: "đơn",
    shouldAsk: true,
    userAnswer: "weekly",
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      const b2 = tasks.find((t: any) => t.title.includes("Weekly report Vinmart"));
      const b3 = tasks.find((t: any) => t.title.includes("Monthly report HR"));
      if (b2 && b2.due_date !== "2026-09-30") reasons.push(`Expected B2 due date 2026-09-30, got ${b2.due_date}`);
      if (b3 && b3.due_date !== "2026-09-30") reasons.push(`Expected B3 due date 2026-09-30, got ${b3.due_date}`);
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-13
  {
    id: "S-13",
    workspace: "B",
    instruction: "create a kickoff task for the new project, sometime next week",
    complexity: "vừa",
    shouldAsk: true,
    userAnswer: "project mới là Chatbot CS cho Vinmart, tạo luôn đi; thứ 3",
    evaluate: (snap) => {
      const reasons: string[] = [];
      const projs = snap.projects;
      const tasks = snap.tasks;
      const newProj = projs.find((p: any) => p.title.toLowerCase().includes("chatbot cs"));
      if (!newProj) reasons.push("New project 'Chatbot CS' not created");
      const newTask = tasks.find((t: any) => t.title.toLowerCase().includes("kickoff"));
      if (!newTask) reasons.push("New kickoff task not found");
      else {
        if (newTask.due_date !== "2026-09-15") reasons.push(`Expected due date 2026-09-15, got ${newTask.due_date}`);
        if (newProj && (!newTask.project_relation || !newTask.project_relation.includes(newProj.id))) {
          reasons.push("Kickoff task not linked to new Chatbot CS project");
        }
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-14
  {
    id: "S-14",
    workspace: "C",
    instruction: "dời hết sang thứ 6 nhé",
    complexity: "vừa",
    shouldAsk: true,
    userAnswer: "mấy cái deadline tuần này thôi, sang thứ 6 tuần sau",
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      const c1 = tasks.find((t: any) => t.title.includes("Fix crash màn thanh toán"));
      const c3 = tasks.find((t: any) => t.title.includes("Review PR #212"));
      if (c1 && c1.due_date !== "2026-09-18") reasons.push(`Expected C1 due date 2026-09-18, got ${c1.due_date}`);
      if (c3 && c3.due_date !== "2026-09-18") reasons.push(`Expected C3 due date 2026-09-18, got ${c3.due_date}`);
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-15
  {
    id: "S-15",
    workspace: "A",
    instruction: "tạo task từ cái này",
    complexity: "đơn",
    shouldAsk: false,
    imagePath: path.resolve(EVIDENCE_DIR, "s15-zalo-checklist.png"),
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 7) reasons.push(`Expected 7 tasks, found ${tasks.length}`);
      const newTask = tasks.find((t: any) => {
        const title = t.title.toLowerCase();
        return title.includes("checklist") && title.includes("uat");
      });
      if (!newTask) reasons.push("New task containing 'checklist' and 'UAT' not found");
      else {
        if (!["2026-09-15", "2026-09-16"].includes(newTask.due_date)) {
          reasons.push(`Expected due date 2026-09-15 or 2026-09-16, got ${newTask.due_date}`);
        }
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-16
  {
    id: "S-16",
    workspace: "B",
    instruction: "add mấy cái này vào notion, cái nào có rồi thì thôi",
    complexity: "vừa",
    shouldAsk: false,
    imagePath: path.resolve(EVIDENCE_DIR, "s16-slack-hr.png"),
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 8) reasons.push(`Expected exactly 8 tasks (only 1 new), found ${tasks.length}`);
      const newTask = tasks.find((t: any) => {
        const title = t.title.toLowerCase();
        return title.includes("onboarding doc") || title.includes("hr onboarding") || title.includes("onboarding");
      });
      if (!newTask) reasons.push("New onboarding task not found");
      else {
        if (!["2026-09-17", "2026-09-18"].includes(newTask.due_date)) {
          reasons.push(`Expected due date 2026-09-17 or 2026-09-18, got ${newTask.due_date}`);
        }
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-17
  {
    id: "S-17",
    workspace: "C",
    instruction: "tạo task chuẩn bị demo cho khách, dl thứ 5",
    complexity: "đơn",
    shouldAsk: false,
    imagePath: path.resolve(EVIDENCE_DIR, "s17-zalo-demo.png"),
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 7) reasons.push(`Expected 7 tasks, found ${tasks.length}`);
      const newTask = tasks.find((t: any) => {
        const title = t.title.toLowerCase();
        return title.includes("demo") && !title.includes("chuẩn bị demo vinmart");
      });
      if (!newTask) reasons.push("New demo task not found");
      else {
        if (newTask.due_date !== "2026-09-17") reasons.push(`Expected due date 2026-09-17 (text instruction), got ${newTask.due_date}`);
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-18
  {
    id: "S-18",
    workspace: "B",
    instruction: "check mail anh Tuấn về cái contract, tạo task cho mấy việc của tao trong đó",
    complexity: "phức",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 9) reasons.push(`Expected 9 tasks (2 new), found ${tasks.length}`);
      const task1 = tasks.find((t: any) => {
        const title = t.title.toLowerCase();
        return title.includes("estimate") && title.includes("phase 2");
      });
      const task2 = tasks.find((t: any) => {
        const title = t.title.toLowerCase();
        return title.includes("sla") || title.includes("legal");
      });
      if (!task1) reasons.push("Task 1 'estimate phase 2' not found");
      else {
        if (!["2026-09-15", "2026-09-16"].includes(task1.due_date)) {
          reasons.push(`Task 1 expected due date 2026-09-15 or 2026-09-16, got ${task1.due_date}`);
        }
      }
      if (!task2) reasons.push("Task 2 'review SLA' not found");
      else {
        if (task2.due_date !== "2026-09-19") {
          reasons.push(`Task 2 expected due date 2026-09-19, got ${task2.due_date}`);
        }
      }
      const hungTask = tasks.find((t: any) => t.title.toLowerCase().includes("staging"));
      if (hungTask) reasons.push("Erroneously created task for Hùng (staging)!");
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-19
  {
    id: "S-19",
    workspace: "A",
    instruction: "the checkout spec on drive (v3) — make me one review task per section, due next wed",
    complexity: "phức",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 10) reasons.push(`Expected 10 tasks (4 new), found ${tasks.length}`);
      const sections = ["overview", "cart", "payment", "order confirmation"];
      for (const sec of sections) {
        const found = tasks.find((t: any) => {
          const title = t.title.toLowerCase();
          return title.includes("review") && title.includes(sec);
        });
        if (!found) reasons.push(`Review task for section '${sec}' not found`);
        else if (found.due_date !== "2026-09-16") {
          reasons.push(`Section '${sec}' expected due date 2026-09-16, got ${found.due_date}`);
        }
      }
      return { success: reasons.length === 0, reasons };
    },
  },

  // ────────────────────────────────────────── S-20
  {
    id: "S-20",
    workspace: "A",
    instruction: "khách vinmart mail báo dời demo, check rồi update lại task chuẩn bị demo giúp",
    complexity: "vừa",
    shouldAsk: false,
    evaluate: (snap) => {
      const reasons: string[] = [];
      const tasks = snap.tasks;
      if (tasks.length !== 6) reasons.push(`Expected 6 tasks, found ${tasks.length}`);
      const a6 = tasks.find((t: any) => t.title.includes("Chuẩn bị demo Vinmart"));
      if (!a6) reasons.push("Task A6 'Chuẩn bị demo Vinmart' not found");
      else {
        if (!["2026-09-23", "2026-09-24"].includes(a6.due_date)) {
          reasons.push(`Expected due date 2026-09-23 or 2026-09-24, got ${a6.due_date}`);
        }
      }
      return { success: reasons.length === 0, reasons };
    },
  },
];
