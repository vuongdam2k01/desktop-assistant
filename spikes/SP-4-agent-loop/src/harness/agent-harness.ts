import { Agent } from "@earendil-works/pi-agent-core";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createModel, customStreamFn, LLM_MODEL_STRONG, LLM_MODEL_VISION } from "../client.js";
import { createNotionTools, type ToolExecutionContext } from "../tools/notion-tools.js";
import { createGoogleTools } from "../tools/google-tools.js";
import { createAskUserTool, type AskUserHandler, type AskUserRecord } from "../tools/ask-user-tool.js";

export interface HarnessOptions {
  workspace: "A" | "B" | "C";
  isVision?: boolean;
  onAskUser: AskUserHandler;
}

export interface HarnessExecutionStats {
  turns: number;
  toolCallsCount: number;
  writeCallsCount: number;
  readCallsCount: number;
  hasSelfVerified: boolean;
  askUserRecords: AskUserRecord[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalTokens: number;
  durationMs: number;
}

export function buildSystemPrompt(workspace: "A" | "B" | "C"): string {
  return `Bạn là Desktop Assistant (Worker-Agent) thông minh, tận tuỵ và chính xác, hỗ trợ người dùng quản lý công việc trên Notion và các công cụ làm việc.

MỐC THỜI GIAN CHUẨN:
- Thời điểm hiện tại: Thứ Sáu, ngày 11/09/2026, lúc 14:30 (Giờ Việt Nam, Asia/Ho_Chi_Minh).
- Quy đổi thời gian tương đối:
  + Hôm qua: 2026-09-10
  + Hôm nay: 2026-09-11
  + Tuần này (còn lại): 11/09/2026 - 13/09/2026
  + Thứ 2 tuần sau: 2026-09-14
  + Thứ 3 tuần sau: 2026-09-15
  + Thứ 4 tuần sau: 2026-09-16
  + Thứ 5 / Thứ 5 tuần sau: 2026-09-17
  + Thứ 6 tuần sau: 2026-09-18
  + Cuối tháng: 2026-09-30

BỐI CẢNH NHÂN SỰ & DỰ ÁN:
- Người dùng (bạn đang phục vụ, gọi là 'user' hoặc 'tao/tôi'): Phụ trách kỹ thuật cho 2 dự án.
- Dự án:
  + "Mobile app Vinmart" (PM Linh, khách hàng ngoài) -> Dự án P1 ở Workspace B.
  + "HR portal nội bộ" (PM anh Tuấn) -> Dự án P2 ở Workspace B.
- Đồng nghiệp:
  + Linh (PM Vinmart)
  + Tuấn (PM HR portal, anh Tuấn)
  + Hùng (Developer)
  + Trang (Designer)

WORKSPACE HIỆN TẠI: Workspace ${workspace}
- ${workspace === "A" ? "DB duy nhất là 'tasks' (gồm Name, Status ['Not started', 'In progress', 'Done'], Due date). Workspace A KHÔNG có database 'projects'." : ""}
- ${workspace === "B" ? "Gồm DB 'projects' (Name, Status) và DB 'tasks' (Name, Status, Due date, Assignee, Tags ['bug', 'feature', 'docs', 'meeting'], Project relation)." : ""}
- ${workspace === "C" ? "DB duy nhất là 'tasks' (gồm Name, Order [số nhỏ = làm trước], Priority ['High', 'Medium', 'Low'], Status, Due date). Workspace C KHÔNG có database 'projects'." : ""}

NGUYÊN TẮC HOẠT ĐỘNG (FR-AG-10 & FR-AG-05):
1. VÒNG LẶP ĐẦY ĐỦ: Thu thập ngữ cảnh (query DB / search mail / drive) -> Lập kế hoạch -> Thực hiện -> TỰ KIỂM CHỨNG -> Báo cáo kết quả.
2. TỰ KIỂM CHỨNG (BẮT BUỘC): Sau khi tạo, cập nhật, sắp xếp hoặc archive bất kỳ task nào, bạn PHẢI gọi tool đọc lại ('notion_query_database' hoặc 'notion_get_page') để kiểm chứng trạng thái trên database đã khớp 100% với mong muốn trước khi đưa ra câu trả lời cuối cùng.
3. HỎI LẠI QUA 'ask_user' (FR-AG-05):
   - Bạn PHẢI gọi tool 'ask_user' trước khi hành động trong các trường hợp mơ hồ then chốt sau:
     + Lệnh yêu cầu "cân bằng lại các task" hoặc "cân đối lại việc" mà chưa nêu tiêu chí cụ thể (hỏi tiêu chí sắp xếp kèm options, hoặc hỏi task nào cần chuyển).
     + Lệnh yêu cầu "dồn bớt việc sang tuần sau" mà chưa rõ dời task nào và dời sang ngày nào.
     + Lệnh yêu cầu "dời hết sang thứ 6" mà chưa rõ phạm vi task (tuần này hay tất cả) và thứ 6 nào.
     + Lệnh sửa/xoá mà có từ 2 task trở lên cùng khớp mô tả (ví dụ: 2 task tạo hôm qua, 2 task chứa từ 'report').
     + Lệnh tạo task cho "dự án mới" mà chưa có tên dự án hoặc ngày cụ thể.
   - Khi hỏi, gom các điểm còn thiếu vào ĐÚNG MỘT câu hỏi gộp rõ ràng kèm danh sách gợi ý options.
   - TUYỆT ĐỐI KHÔNG hỏi thừa khi lệnh đã nêu rõ tiêu chí (ví dụ: 'reorder by deadline', 'xong cái review PR của Hùng', 'thêm task... dl thứ 5'). Hỏi thừa khi đã đủ thông tin là vi phạm FR-AG-05.
4. XỬ LÝ TRÙNG LẶP: Khi được yêu cầu thêm task từ tài liệu/ảnh ("cái nào có rồi thì thôi"), hãy truy vấn database kiểm tra xem task đã tồn tại chưa để tránh tạo trùng.
5. SẮP XẾP ORDER (Workspace C):
   - Số Order nhỏ = làm trước.
   - Sắp theo deadline (earliest first): Task có Due date sớm hơn bắt buộc phải có Order nhỏ hơn task có Due date muộn hơn (ví dụ: 09-11 < 09-12 < 09-15 < 09-18 < 09-25 < 10-02). Cập nhật lại Order của các task để đảm bảo đúng thứ tự deadline.`;
}

export function createHarnessAgent(options: HarnessOptions) {
  const modelId = options.isVision ? LLM_MODEL_VISION : LLM_MODEL_STRONG;
  const model = createModel(modelId, options.isVision);

  const stats: HarnessExecutionStats = {
    turns: 0,
    toolCallsCount: 0,
    writeCallsCount: 0,
    readCallsCount: 0,
    hasSelfVerified: false,
    askUserRecords: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalReasoningTokens: 0,
    totalTokens: 0,
    durationMs: 0,
  };

  let hadWriteCall = false;

  const toolCtx: ToolExecutionContext = {
    workspace: options.workspace,
    recordWrite: (toolName, _params) => {
      stats.writeCallsCount++;
      stats.toolCallsCount++;
      hadWriteCall = true;
    },
    recordRead: (toolName, _params) => {
      stats.readCallsCount++;
      stats.toolCallsCount++;
      if (hadWriteCall && (toolName === "notion_query_database" || toolName === "notion_get_page")) {
        stats.hasSelfVerified = true;
      }
    },
  };

  const notionTools = createNotionTools(toolCtx);
  const googleTools = createGoogleTools((toolName, params) => {
    toolCtx.recordRead?.(toolName, params);
  });
  const askUserTool = createAskUserTool(options.onAskUser, stats.askUserRecords);

  const allTools: AgentTool[] = [...notionTools, ...googleTools, askUserTool];

  const agent = new Agent({
    streamFn: customStreamFn,
    initialState: {
      model,
      systemPrompt: buildSystemPrompt(options.workspace),
      tools: allTools,
    },
  });

  return { agent, stats };
}
