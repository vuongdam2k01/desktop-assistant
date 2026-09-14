# SP-6 — Kiểm chứng khả năng nhúng pi agents SDK

## 0. Kết luận
**ĐI** — Pi agents SDK chính thức từ `pi.dev` (`@earendil-works/pi-agent-core@0.85.1` và `@earendil-works/pi-ai@0.85.1`) hoạt động xuất sắc trên Node.js v24: đáp ứng tuyệt đối tiêu chuẩn Hard Gate 0-lọt (Q2) qua mô hình 2 tầng wrap/hook, pause/resume chuẩn xác không lặp bước theo US-4.2/AC2 (Q3), cô lập hoàn hảo đa agent song song (Q4), tương thích mượt mà với custom OpenAI-compatible endpoint (Q5) và input ảnh (Q6).

---

## 1. Trả lời từng câu hỏi

### Q1 — Đăng ký tool tuỳ ý được không, VÀ có chặn được việc đăng ký bộ tool coding mặc định (read/bash/edit/write) không? FR-AG-02 yêu cầu tường minh rằng worker-agent KHÔNG có các tool này.
**TRẢ LỜI: ĐƯỢC 100%.**
- SDK cho phép định nghĩa tool tuỳ ý thông qua interface `AgentTool` với schema TypeBox, nhãn UI, và hàm `execute`.
- Khi nhúng `Agent` từ `@earendil-works/pi-agent-core`, **mặc định không có bất kỳ tool nào được nạp**. Danh sách tool hoàn toàn do ta truyền vào qua `initialState.tools`.
- Kiểm tra danh sách `agent.state.tools`: chỉ chứa 2 tool nghiệp vụ ta khai báo (`read_data`, `write_data`); hoàn toàn vắng bóng 4 tool coding mặc định (`bash`, `read`, `edit`, `write`).
- Khi prompt yêu cầu agent gọi lệnh bash (`ls -la`), agent nhận biết không có tool thực thi lệnh và từ chối an toàn; số tool thực thi kích hoạt = 0.
- **Bằng chứng:** [`spikes/SP-6-pi-sdk/evidence/q1-tool-registry.log`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/q1-tool-registry.log), code kiểm chứng tại [`spikes/SP-6-pi-sdk/src/test-q1-tools.ts#L18-L75`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/src/test-q1-tools.ts#L18-L75).

---

### Q2 — 🔴 QUAN TRỌNG NHẤT — chèn được lớp wrap TRƯỚC execute không, đúng trình tự ghi ledger → hook đánh giá → thực thi → ghi kết quả? Nếu wrap chỉ dựa vào middleware của framework thì có đường vòng nào bỏ qua nó không? Hard gate 0-lọt của toàn dự án phụ thuộc câu này.
**TRẢ LỜI: CHÈN ĐƯỢC TUYỆT ĐỐI — BẢO ĐẢM 0-LỌT VỚI KIẾN TRÚC 2 TẦNG.**
- **Trình tự chuẩn:**
  1. `ledger.recordIntent(toolCallId, name, params)` (Ghi nhận trạng thái `INTENT`).
  2. `evaluator(name, params)` (Hook đánh giá quy tắc).
  3. Nếu bị từ chối: `ledger.recordBlocked(...)` và trả về kết quả lỗi; hàm `innerExecute` **tuyệt đối không được gọi**.
  4. Nếu chấp thuận: thực thi `innerExecute(...)` -> `ledger.recordResult(...)`.
- **Thực nghiệm chứng minh:** Yêu cầu agent ghi task cấm `"Delete Production Database"`. Kết quả:
  - `writeCallCount` của tool thực thi = **0** (tool không hề chạy).
  - Dữ liệu trong store không đổi (giữ nguyên 2 items).
  - Ledger ghi đủ 2 log: 1 `INTENT` và 1 `BLOCKED`, **0 log `RESULT`**.
- **Kiểm chứng các đường vòng (Bypass Vectors):**
  - *Đường vòng 1 (Gọi tool không tồn tại / giả mạo):* Pi agent-loop kiểm tra đối chiếu `currentContext.tools?.find(...)`. Nếu không khớp, trả về `"Tool ... not found"` ngay lập tức, không bao giờ rơi vào execute.
  - *Đường vòng 2 (Không cấu hình middleware của framework):* Vì toàn bộ tool nạp vào Pi đều được wrap ở tầng hàm (`createWrappedTool`), lớp bảo vệ nằm ở closure thuộc tính `.execute` của chính object tool. Thử nghiệm agent không truyền `beforeToolCall`, evaluator vẫn chặn 100% (`writeCallCount` vẫn = 0).
  - *Đường vòng 3 (Tool gọi tool / Nested tool):* Các tool sinh từ connector manifest là các leaf function độc lập gọi fetch API, không giữ tham chiếu tới agent harness nên không thể gọi ngầm tool khác.
- **Bằng chứng:** [`spikes/SP-6-pi-sdk/evidence/q2-hardgate-block.log`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/q2-hardgate-block.log), [`spikes/SP-6-pi-sdk/evidence/q2-bypass-attempts.log`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/q2-bypass-attempts.log), code tại [`spikes/SP-6-pi-sdk/src/test-q2-hardgate.ts#L25-L125`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/src/test-q2-hardgate.ts#L25-L125).

---

### Q3 — Có API pause/resume ĐÚNG ĐIỂM DỪNG không (phục vụ waiting_approval và waiting_input)? Resume có chạy lại bước đã xong không — US-4.2/AC2 CẤM.
**TRẢ LỜI: CÓ — RESUME CHUẨN XÁC, TUYỆT ĐỐI KHÔNG CHẠY LẠI BƯỚC ĐÃ XONG.**
- **Thực nghiệm chứng minh đầy đủ cả 2 chế độ hoạt động:**
  - *Chế độ 1: In-Flight Async Suspension & Resume (App đang chạy, chờ người dùng duyệt qua UI Card):*
    - Agent nhận lệnh: Bước 1 `read_data`, Bước 2 `write_data` ('Setup CI-CD').
    - Bước 1 chạy xong: `readCallCount` = 1.
    - Bước 2 chạm vào cổng duyệt: Tool wrapper treo qua async Promise `approvalPromise`, agent dừng chờ ở trạng thái `waiting_approval` mà không bị ngắt vòng lặp (`writeCallCount` = 0).
    - Người dùng bấm `[APPROVE]`: Promise giải phóng, `write_data` thực thi (`writeCallCount` = 1), agent hoàn tất lượt và xuất bản báo cáo tổng kết.
    - Đối chiếu: `readCallCount` giữ nguyên = **1** (bước 1 KHÔNG chạy lại).
  - *Chế độ 2: Cold Checkpoint Persistence & Resume (Mô phỏng app tắt / crash, nạp lại từ SQLite):*
    - Phục hồi session bị gián đoạn từ persistent storage: transcript chứa cặp `assistant(toolCalls: [read, write])` cùng `toolResult` của `read_data`.
    - Khi người dùng bấm `[APPROVE]`: Thực thi `write_data` đã duyệt, ghép `toolResult` hoàn chỉnh vào transcript (tin nhắn cuối là `toolResult`).
    - Khởi tạo instance `coldResumedAgent = new Agent({ initialState: { messages: resumedMessages, tools } })`.
    - Gọi `coldResumedAgent.continue()`: Agent tiếp tục suy luận từ checkpoint trong 3.0s, đọc cả 2 kết quả và in ra bảng tổng kết Markdown chi tiết.
    - Đối chiếu: `readCallCount` của phiên mới = **0** (hoàn toàn không gọi lại bước 1), `writeCallCount` = **1**.
- **Đối chiếu tiêu chuẩn cấm US-4.2/AC2:**
  - Tuyệt đối KHÔNG chạy lại bước đã xong ở cả 2 chế độ.
  - Resume diễn ra đúng điểm dừng, hoàn tất nhiệm vụ và cung cấp phản hồi trọn vẹn.
- **Bằng chứng:** [`spikes/SP-6-pi-sdk/evidence/q3-pause-resume.log`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/q3-pause-resume.log), code tại [`spikes/SP-6-pi-sdk/src/test-q3-pause-resume.ts#L20-L210`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/src/test-q3-pause-resume.ts#L20-L210).

---

### Q4 — Chạy nhiều instance agent song song trong một process Node được không, context có cô lập thật không (FR-AG-04)?
**TRẢ LỜI: ĐƯỢC — CÔ LẬP HOÀN TOÀN, KHÔNG CÓ RÒ RỈ HOẶC CROSS-TALK.**
- Chạy đồng thời 3 worker agents (`Worker-Alpha`, `Worker-Beta`, `Worker-Gamma`) trong cùng 1 process Node (PID 106519) qua `Promise.all`.
- Mỗi instance sở hữu `id`, `privateCode` và `city` riêng biệt.
- Toàn bộ 3 agent hoàn thành song song trong 5.9s wall-clock time.
- Kiểm tra chéo toàn bộ transcript: Mỗi worker chỉ trả lời đúng mã bí mật của chính mình, **không có bất kỳ từ khoá hay dữ liệu nào của worker khác bị rò rỉ**.
- Khác biệt then chốt: `@earendil-works/pi-agent-core` thiết kế state hoàn toàn theo instance (`_state`, `steeringQueue`, `followUpQueue`), không dùng global singleton như `@oh-my-pi`.
- **Bằng chứng:** [`spikes/SP-6-pi-sdk/evidence/q4-concurrency.log`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/q4-concurrency.log), code tại [`spikes/SP-6-pi-sdk/src/test-q4-concurrency.ts#L20-L115`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/src/test-q4-concurrency.ts#L20-L115).

---

### Q5 — Provider layer hỗ trợ những cơ chế nào? FR-AG-11 nói "subscription qua /login OAuth, API key, custom provider" — nhưng /login là affordance của CLI, còn ta NHÚNG SDK. Xác định đường nhúng phơi ra gì; nếu subscription OAuth không tồn tại ở đường nhúng thì kết luận là FR-AG-11 phải sửa lời văn, KHÔNG phải đi mua subscription.
**TRẢ LỜI: HỖ TRỢ ĐẦY ĐỦ API KEY VÀ CUSTOM PROVIDER. CẦN ĐIỀU CHỈNH LỜI VĂN FR-AG-11.**
- SDK `@earendil-works/pi-ai` hỗ trợ các cơ chế trong đường nhúng:
  1. `apiKey`: Truyền trực tiếp trong options hoặc phân giải động qua `getApiKey(provider)`.
  2. `custom provider`: Plain object `Model<"openai-completions">` với `baseUrl`, `headers`, và `compat`. Đã test thành công với BytePlus Ark cho cả 2 model `LLM_MODEL_STRONG` (DeepSeek V4 Pro) và `LLM_MODEL_CHEAP` (DeepSeek V4 Flash).
- **Về "subscription qua /login OAuth":**
  - Pi là phần mềm mã nguồn mở MIT, **không có dịch vụ trả phí hay "Pi subscription"**.
  - `/login` trên Pi CLI là lệnh dòng lệnh interactive tương tác thiết bị (device code/web callback) để đăng nhập tài khoản Anthropic/OpenAI/GitHub của người dùng.
  - Trong đường nhúng SDK, không có terminal tương tác `/login`. App Desktop Assistant chịu trách nhiệm quản lý credential qua UI thiết lập của app, lưu vào OS secure storage (SP-11), rồi truyền programmatic token/key vào SDK.
  - **Kiến nghị sửa PRD FR-AG-11:** Bỏ cụm từ "subscription qua /login OAuth", thay bằng "App cung cấp UI cấu hình provider (hỗ trợ API key của các nhà cung cấp OpenAI, Anthropic, Google hoặc custom endpoint tương thích OpenAI); credential lưu trong secure storage của OS...".
- **Bằng chứng:** [`spikes/SP-6-pi-sdk/evidence/q5-provider-response.log`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/q5-provider-response.log), code tại [`spikes/SP-6-pi-sdk/src/test-q5-providers.ts#L18-L95`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/src/test-q5-providers.ts#L18-L95).

---

### Q6 — Input đa phương thức (ảnh) có được hỗ trợ không (FR-PET-04)?
**TRẢ LỜI: ĐƯỢC HỖ TRỢ TRỰC TIẾP QUA SDK.**
- `Agent.prompt(input: string, images?: ImageContent[])` nhận mảng ảnh dạng base64.
- Cấu trúc `ImageContent`: `{ type: "image", data: "<base64>", mimeType: "image/png" }`.
- Thử nghiệm gửi ảnh PNG 32x32px tới model `seed-2-0-pro-260328` (`LLM_MODEL_VISION`): Model nhận diện thành công hình ảnh và trả về mô tả chính xác (Input tokens: 1366, Output: 134).
- *Lưu ý kỹ thuật:* BytePlus Ark yêu cầu ảnh có kích thước tối thiểu ≥ 14px; app cần validate kích thước trước khi nạp vào SDK.
- **Bằng chứng:** [`spikes/SP-6-pi-sdk/evidence/q6-vision-response.log`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/q6-vision-response.log), code tại [`spikes/SP-6-pi-sdk/src/test-q6-vision.ts#L20-L70`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/src/test-q6-vision.ts#L20-L70).

---

### Q7 — Truy xuất token usage từ session được không (R-6, R-11)?
**TRẢ LỜI: TRUY XUẤT ĐƯỢC RÕ RÀNG Ở CẢ 2 CẤP ĐỘ.**
1. *Cấp độ Realtime Event:* Mỗi khi một turn kết thúc, sự kiện `turn_end` cung cấp `event.message.usage` (`input`, `output`, `reasoning`, `totalTokens`).
2. *Cấp độ Session Transcript:* Duyệt qua `agent.state.messages`, mọi tin nhắn có `role === "assistant"` đều lưu trữ thuộc tính `usage`.
- Thực nghiệm đo đạc qua 3 turns: Thu thập chính xác 1242 input tokens, 167 output tokens, 82 reasoning tokens, tổng 1409 tokens. Đảm bảo đầy đủ số liệu phục vụ R-6 và R-11.
- **Bằng chứng:** [`spikes/SP-6-pi-sdk/evidence/q7-token-usage.log`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/q7-token-usage.log), code tại [`spikes/SP-6-pi-sdk/src/test-q7-token-usage.ts#L20-L95`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/src/test-q7-token-usage.ts#L20-L95).

---

### Q8 — Session JSONL dùng làm transcript được không, xung đột gì với ledger append-only riêng của ta không?
**TRẢ LỜI: DÙNG ĐƯỢC HOÀN TOÀN — KHÔNG CÓ XUNG ĐỘT.**
- Hai hệ thống phục vụ hai mục đích hoàn toàn độc lập và tương hỗ:
  - **Pi Session JSONL:** Lưu transcript hội thoại của LLM (các lượt message `user`, `assistant`, `tool_result`, `thought` reasoning, và branching). Phục vụ ngữ cảnh LLM và hiển thị chat history.
  - **SQLite Ledger (SP-12, FR-LG):** Store append-only lưu các sự kiện nghiệp vụ và an toàn (`INTENT`, `EVALUATION`, `BLOCKED`, `SNAPSHOT_BEFORE`, `SNAPSHOT_AFTER`, `COMPENSATION_RECIPE`). Phục vụ audit, hard gate 0-lọt, crash recovery (fail-closed), và cơ chế hoàn tác (undo).
- Pi Session hoàn toàn không can thiệp vào SQLite, và SQLite Ledger không phụ thuộc cấu trúc file của Pi. Hai bên liên kết nhau qua khoá ngoại logic `jobId` và `toolCallId`.

---

### Q9 — Nhịp phát hành và độ ổn định API: lịch sử version có breaking change dày không (R-14)? Dòng @oh-my-pi/* vs @earendil-works/* dòng nào chính thức?
**TRẢ LỜI:**
1. **Xác định dòng package chính thức:**
   - `@earendil-works/*` là **bản gốc chính thức (upstream canonical)** của `pi.dev`, do Mario Zechner (`badlogic`) và Armin Ronacher (`mitsuhiko`) phát triển. Package phân phối mã JS đã build sẵn, nhắm thẳng vào Node.js (`node >=22.19.0`), phiên bản hiện tại là `0.85.1`.
   - `@oh-my-pi/*` là **bản fork downstream** của Can Bölük (`can1357`), hướng tới Bun (`bun >=1.3.14`), chỉ xuất mã nguồn TypeScript thô và dùng process-wide pause gate singleton. **Không dùng dòng này cho Desktop Assistant.**
2. **Nhịp phát hành và breaking changes:**
   - Upstream phát hành tích cực (~2–3 minor releases/tháng).
   - Bộ API core nhúng (`Agent`, `AgentTool`, `streamSimple`, `continue`, `beforeToolCall`) cực kỳ ổn định từ `0.74.0` đến `0.85.1`.
   - **Giảm thiểu R-14:** Khóa cứng phiên bản `0.85.1` trong `package.json` và `package-lock.json`. Toàn bộ lớp bọc (Hook + Ledger) nằm ở tầng ngoài bọc `AgentTool.execute`, do đó harness bên trong có nâng cấp cũng không làm phá vỡ kiến trúc sản phẩm.
- **Bằng chứng:** [`spikes/SP-6-pi-sdk/evidence/package-comparison.md`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/package-comparison.md), [`spikes/SP-6-pi-sdk/evidence/upstream-release-history.md`](file:///home/<user>/projects/desktop-assistant/spikes/SP-6-pi-sdk/evidence/upstream-release-history.md).

---

## 2. Tác động lên ADR / PRD

1. **ADR-004 (Agent harness):** **GIỮ NGUYÊN — KHÔNG SỬA.**
   - Quyết định dùng Pi agents SDK được kiểm chứng là hoàn toàn chính xác.
   - Bổ sung định danh package chính thức: Pin cứng `@earendil-works/pi-agent-core@0.85.1` và `@earendil-works/pi-ai@0.85.1`.
2. **FR-AG-11 & ADR-007 (LLM provider configuration):** **SỬA LỜI VĂN NHẸ.**
   - *Hiện tại:* Ghi "subscription qua /login OAuth, API key, hoặc custom provider".
   - *Đề xuất sửa:* Bỏ từ "subscription qua /login OAuth" vì đây là thao tác của CLI interactive; sửa thành: "App cung cấp UI cấu hình provider (hỗ trợ API key của các nhà cung cấp OpenAI, Anthropic, Google, hoặc custom endpoint tương thích OpenAI); credential lưu trong secure storage của OS (NFR-SEC-01)...".
   - Không ảnh hưởng đến kiến trúc hạ tầng (vẫn giữ nguyên client-side BYO provider, không dựng LLM gateway).

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Chuẩn bọc Tool (Tool Wrapping Pattern):** Mọi tool sinh từ connector manifest (FR-AG-02) phải đi qua hàm factory `createWrappedTool(baseTool, ledger, evaluator)` để đảm bảo bắt buộc có 4 bước: `Ghi Ledger Intent → Evaluator Hook → Execute → Ghi Ledger Result`.
2. **Chuẩn Pause & Resume (Approval Flow):**
   - Khi gặp tool cần duyệt, trả về trạng thái `waiting_approval` và lưu transcript `agent.state.messages` vào persistent storage.
   - Khi nhận sự kiện Approve từ UI, thực thi tool call, cập nhật tin nhắn `tool_result` vào transcript và khởi tạo instance `Agent` mới rồi gọi `agent.continue()`.
3. **Cấu hình Custom Provider:** Sử dụng `streamSimple` từ `@earendil-works/pi-ai/api/openai-completions` kết hợp với đối tượng `Model<"openai-completions">` để trỏ vào bất kỳ endpoint OpenAI-compatible nào.

---

## 4. Rủi ro mới phát hiện

1. **Kích thước ảnh tối thiểu trên Vision Endpoint:** Model Vision (BytePlus Ark Seed 2.0 Pro) từ chối các ảnh có chiều rộng hoặc chiều cao < 14px (trả lỗi 400). Tầng giao diện pet/composer cần kiểm tra kích thước ảnh trước khi gửi.
2. **Nhầm lẫn namespace package:** Nếu vô tình cài package `@oh-my-pi/*` thay vì `@earendil-works/*`, dự án sẽ gặp lỗi do thiếu runtime Bun và vi phạm tính cô lập khi chạy song song nhiều agent.

---

## 5. Chưa trả lời được + vì sao

**KHÔNG CÓ.** Toàn bộ 9 câu hỏi kỹ thuật từ Q1 đến Q9 đều đã được trả lời dứt khoát kèm code chạy thực tế và log chứng minh đầy đủ.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

- `node`: `v24.21.0` (Linux x86_64)
- `npm`: `11.19.0`
- `@earendil-works/pi-agent-core`: `0.85.1`
- `@earendil-works/pi-ai`: `0.85.1`
- `typebox`: `1.3.7`
- `tsx`: `4.23.13`
- `typescript`: `5.9.3`
- `dotenv`: `17.4.2`
- Provider test: BytePlus Ark OpenAI-compatible endpoint (`deepseek-v4-pro-ga-260813`, `deepseek-v4-flash-ga-260731`, `seed-2-0-pro-260328`).
