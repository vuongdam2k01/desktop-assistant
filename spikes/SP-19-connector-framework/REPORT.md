# SP-19 — CONNECTOR FRAMEWORK: MANIFEST SINH TOOL, HOOK VÀ LEDGER ĐỒNG NHẤT

## 0. Kết luận
**ĐI** — Mệnh đề trung tâm PRD §10.10 được thực chứng tuyệt đối: thêm connector thứ hai (Gmail chỉ đọc) đòi hỏi **đúng 0 dòng sửa đổi logic lõi** (Job Manager, Evaluator, Ledger, Wrap Layer, Tool Generator đều giữ nguyên 100%), mọi tool sinh động từ manifest đăng ký vào Pi harness thực thi mượt mà với LLM thật, hook phê duyệt và ledger áp dụng đồng nhất cho cả hai nền tảng.

---

## 1. Trả lời từng câu hỏi

### Q1 — Thiết kế được manifest schema đủ diễn đạt HAI connector khác hình dạng không?
**Trả lời:** **CÓ, ĐẠT 100%**.  
Manifest schema v0 (`evidence/manifest-schema.json`, `evidence/manifest-types.ts`) biểu diễn hoàn chỉnh hai connector với hình thái hoàn toàn trái ngược:
1. **Notion Connector** (`evidence/notion.manifest.json`):
   - Phức tạp, hỗ trợ cả Đọc & Ghi (7 tools).
   - Khai báo đầy đủ cấu hình OAuth, capabilities (`pages_read`, `pages_write`).
   - Với mỗi tool ghi: khai báo chi tiết phương pháp snapshot trước-ghi (`target_id_param: "page_id"`), danh sách 6 trường read-only bắt buộc lọc bỏ (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by` theo SP-1), công thức bù trừ tĩnh (`restore_properties`, `archive_page`, `unarchive_page`), hoặc cờ `irreversible: true` (đối với `create_comment` và `delete_block` theo SP-1 dòng 23-24).
2. **Gmail Connector** (`evidence/gmail.manifest.json`):
   - Đơn giản, CHỈ ĐỌC (2 tools: `search_emails`, `get_email_details` theo FR-GM-01).
   - Không có bất kỳ tool ghi nào, không có snapshot hay công thức bù trừ.
   - Hỗ trợ phân hóa `scope_profiles` theo kênh phát hành (BYO OAuth dùng `gmail.readonly`, Kênh đại trà dùng `gmail.metadata`).

*Bằng chứng:*
- `evidence/manifest-schema.json`
- `evidence/manifest-types.ts`
- `evidence/notion.manifest.json`
- `evidence/gmail.manifest.json`
- `evidence/q1-manifest-schema-validation.log`

---

### Q2 — 🔴 TRUNG TÂM: Sinh tool động từ manifest rồi đăng ký vào harness pi có chạy không? Agent gọi được tool sinh ra mà không cần code đặc thù cho từng connector?
**Trả lời:** **CÓ, CHẠY HOÀN HẢO VỚI LLM VÀ API THẬT**.  
Lớp `ToolGenerator.generateTools()` tự động chuyển đổi các định nghĩa `ToolDefinition` trong manifest thành danh sách `AgentTool` tương thích trực tiếp với `@earendil-works/pi-agent-core`, chuyển đổi schema tham số sang TypeBox TSchema động.

Thực nghiệm thực tế với model LLM (`deepseek-v4-flash-ga-260731`) và database Notion thật (`3d8c0043-56ec-81cf-a480-e9e679285df6`):
- Agent tiếp nhận prompt: `"Hãy truy vấn danh sách task trong database có id '3d8c0043-56ec-81cf-a480-e9e679285df6'. Trả về số lượng task tìm thấy."`
- Agent tự động phân tích định nghĩa schema của `notion_query_database`, kích hoạt sự kiện `tool_execution_start`, tự động điền đúng `database_id`.
- Thao tác thực thi thành công qua Adapter generic, đọc được 6 task từ Notion workspace `spike-a` và trả về bảng markdown định dạng chuẩn cho người dùng.
- Không có bất kỳ dòng code đặc thù nào của Notion tồn tại trong Pi harness hay Agent runtime.

*Bằng chứng:*
- `src/tests/test-q2-tool-generation.ts`
- `evidence/q2-tool-generation.log` (ghi nhận: gọi `notion_query_database`, success=true, 6 tasks trả về).

---

### Q3 — 🔴 Viết manifest cho connector THỨ HAI (Gmail chỉ đọc) rồi đo: phải sửa bao nhiêu dòng trong Job Manager, evaluator, lớp ledger và lớp wrap?
**Trả lời:** **ĐÚNG 0 DÒNG SỬA ĐỔI TRONG LOGIC LÕI — MỆNH ĐỀ §10.10 ĐÚNG TUYỆT ĐỐI**.

Số liệu đo lường thực tế kiểm chứng qua mã nguồn và AST:
- **Job Manager** (`src/core/job-manager.ts`): **0 dòng**.
- **Connector Registry** (`src/core/connector-registry.ts`): **0 dòng**.
- **Evaluator** (`src/core/evaluator/evaluator.ts`): **0 dòng**.
- **Uniform Ledger** (`src/core/ledger.ts`): **0 dòng**.
- **Wrap Layer** (`src/core/wrapped-tool.ts`): **0 dòng**.
- **Tool Generator** (`src/generator/tool-generator.ts`): **0 dòng**.

Tất cả các thành phần lõi hoạt động 100% dựa trên hợp đồng trừu tượng `ConnectorManifest` và `ConnectorAdapter`. Khi thêm Gmail:
1. Kỹ sư chỉ viết đúng **2 file độc lập**:
   - `evidence/gmail.manifest.json` (57 dòng JSON).
   - `src/adapters/gmail-adapter.ts` (194 dòng TypeScript đóng kín logic gọi Google API).
2. Tại tầng composition root / bootstrap của ứng dụng, chỉ thêm **1 dòng cấu hình**:  
   `registry.register(gmailManifest, gmailAdapter);`

*Bằng chứng:*
- `evidence/core-diff-report.md` (Báo cáo đo lường chi tiết từng file)
- `src/tests/test-q3-core-diff.ts`
- `evidence/q3-core-diff.log`

---

### Q4 — FR-CF-07: Hook và ledger áp dụng đồng nhất trên cả hai connector không?
**Trả lời:** **CÓ, ÁP DỤNG ĐỒNG NHẤT 100% MÀ KHÔNG RẼ NHÁNH**.  
Lớp wrap (`createHardGatedTool`) và `UniformLedger` xử lý đồng thời cả hai hình dạng:
- **Notion** (Thao tác ghi `update_page_properties`): Tự động lấy snapshot trước-ghi qua adapter, lọc bỏ các trường computed theo danh sách `sanitization` trong manifest, tính toán `compensatingAction` tương ứng, và lưu vào ledger dưới dạng bản ghi `PRE_SNAPSHOT`.
- **Gmail** (Thao tác đọc `search_emails`): Nhận biết `category: "read"` từ manifest, bỏ qua hoàn toàn snapshot, chỉ ghi nhận sự kiện `INTENT` và `RESULT`.
- Cả hai dòng dữ liệu được lưu trữ trong cùng một cấu trúc `LedgerRecord` chuẩn hóa có trường `connectorId`. Không tồn tại bất kỳ câu lệnh `if (connector === 'notion')` hay `if (connector === 'gmail')` nào trong code lõi.

*Bằng chứng:*
- `src/tests/test-q4-uniform-ledger.ts`
- `evidence/q4-uniform-ledger.log` (xác thực record #5 mang `PRE_SNAPSHOT` của Notion update với 6 trường computed đã được sanitize; record #10 của Gmail chỉ có `INTENT` và `RESULT`).

---

### Q5 — FR-AP-05: Thao tác gắn cờ `irreversible` trong manifest có TỰ ĐỘNG thuộc diện phê duyệt không?
**Trả lời:** **CÓ, TỰ ĐỘNG 100% MÀ KHÔNG CẦN KHAI THÊM NƠI KHÁC**.  
Thử nghiệm với tool gắn cờ `irreversible: true` (`notion_create_comment` và tool thử nghiệm `service_purge_permanent_logs`):
- Khi chạy ở Approval Mode `smart` hoặc `on` mà trong catalog **hoàn toàn không có quy tắc người dùng nào nhắc đến tool này**:
  - `HardGateEvaluator` đọc `callContext.isIrreversible === true`.
  - Tự động kích hoạt cơ chế hard gate với rule `FR-AP-05-IRREVERSIBLE`, trả về verdict `APPROVAL_REQUIRED`.
  - Tool bị chặn thực thi ngay tại wrap layer (`executionAttempted = false`), ghi nhận trạng thái `WAITING_APPROVAL` vào ledger.
- Khi người dùng cấp token phê duyệt hợp lệ (`activeJobApprovals`), thao tác được phép thực thi bình thường (`executionAttempted = true`).
- Kết quả này giải quyết dứt điểm câu hỏi mở OQ-2 trong PRD.

*Bằng chứng:*
- `src/tests/test-q5-irreversible-gate.ts`
- `evidence/q5-irreversible-gate.log`

---

### Q6 — FR-CF-06: Connector CHƯA kết nối có bị loại khỏi tool set không?
**Trả lời:** **CÓ, LOẠI BỎ TRIỆT ĐỂ — AGENT HOÀN TOÀN KHÔNG BIẾT ĐẾN NÓ**.  
- Khởi tạo registry với Notion `connected` và Gmail `disconnected`.
- `JobManager.assembleToolsForJob()` lọc nghiêm ngặt qua `registry.getConnectedConnectors()`. Bộ tool được cấp cho Pi Agent chỉ có 7 tool của Notion, hoàn toàn không có bất kỳ tool nào của Gmail.
- Khi người dùng ra lệnh: `"Hãy kiểm tra hộp thư Gmail của tôi xem có email nào từ noreply@agentkit.best không"`, Agent nhận thức rõ ràng trong prompt system và tool list rằng nó không có công cụ Gmail, từ chối thực thi một cách an toàn mà không kích hoạt bất kỳ tool nào (`toolCallsCount = 0`).
- Khi chuyển trạng thái Gmail sang `connected`, bộ tool lập tức tự động cập nhật lên 9 tool mà không cần khởi động lại app.

*Bằng chứng:*
- `src/tests/test-q6-disconnected-filtering.ts`
- `evidence/q6-disconnected-filtering.log`

---

### Q7 — FR-CF-10: Một job dùng NHIỀU connector (đọc Gmail rồi ghi Notion) chạy được không?
**Trả lời:** **CÓ, THỰC THI END-TO-END THÀNH CÔNG VỚI API THẬT**.  
Kịch bản kiểm chứng:
- Prompt: `"Tìm kiếm email có từ khóa 'Verification' trong Gmail. Dựa vào thông tin email tìm được, hãy tạo 1 task mới trên Notion database..."`
- Pi Agent đã gọi tuần tự 4 tool calls trong cùng 1 Job (`job-q7-cross-connector-flow`):
  1. `gmail_search_emails` (connector: `gmail`): Tìm thấy email "Your AgentKit Verification Code" từ `noreply@agentkit.best`.
  2. `gmail_get_email_details` (connector: `gmail`): Đọc chi tiết tiêu đề, nội dung snippet, mã xác thực.
  3. `notion_create_page` (connector: `notion`): Tạo task mới trên Notion workspace database thật với tiêu đề `[Gmail Import] Your AgentKit Verification Code`.
- Uniform Ledger ghi nhận 10 bản ghi liên tục, từng bản ghi gắn nhãn chính xác `connectorId: "gmail"` hoặc `connectorId: "notion"`.
- Test tự động dọn dẹp (archive) task thử nghiệm trên Notion để bảo toàn dữ liệu fixtures.

*Bằng chứng:*
- `src/tests/test-q7-multi-connector-job.ts`
- `evidence/q7-multi-connector-job.log`

---

### Q8 — FR-CF-04: Manifest hỗ trợ scope profile theo kênh phát hành không?
**Trả lời:** **CÓ, HOÀN TOÀN ĐÁP ỨNG**.  
Manifest `gmail.manifest.json` định nghĩa `scope_profiles`:
- Profile `byo`: Trả về `["https://www.googleapis.com/auth/gmail.readonly"]` (phục vụ kênh người dùng tự nạp GCP credentials theo FR-CF-11, không vướng kiểm duyệt CASA).
- Profile `central_mass_distribution`: Trả về `["https://www.googleapis.com/auth/gmail.metadata"]` (phục vụ phát hành đại trà cho người dùng phổ thông, giới hạn ở mức metadata để tránh CASA AL2).
- Chuyển kênh phát hành hoàn toàn là việc cấu hình profile key trong môi trường hoặc settings; không sửa đổi cấu trúc manifest, không sửa adapter.

*Bằng chứng:*
- `src/tests/test-q8-scope-profiles.ts`
- `evidence/q8-scope-profiles.log`

---

### Q9 — FR-CF-05: Trạng thái connector phát hiện và phân biệt được không?
**Trả lời:** **CÓ, PHÂN BIỆT RÕ RÀNG CẢ 4 TRẠNG THÁI**:
1. `connected`: Probe API endpoint trả về HTTP 200 OK.
2. `token_expired`: Probe trả về HTTP 401 UNAUTHENTICATED. Adapter tự động kiểm tra xem có refresh token không để báo `canRefresh: true/false` cho UI hiển thị nút Reconnect.
3. `permission_error`: Probe trả về HTTP 403 Forbidden do thiếu OAuth scope, phân biệt rõ với lỗi hết hạn token.
4. `revoked`: Adapter phát hiện token bị người dùng/provider thu hồi (`invalid_grant`), khoá hoàn toàn trạng thái thực thi.

*Bằng chứng:*
- `src/tests/test-q9-status-detection.ts`
- `evidence/q9-status-detection.log`

---

### Q10 — FR-CF-08: Ngắt kết nối có gọi revoke endpoint và xoá token không? Job đang chạy có fail sạch theo FR-AG-07 không?
**Trả lời:** **CÓ, ĐẠT 100%**.  
- Khi người dùng bấm ngắt kết nối: `adapter.revoke()` gọi revoke endpoint của nhà cung cấp (`https://oauth2.googleapis.com/revoke`), xoá sạch access token và refresh token khỏi bộ nhớ.
- Khi một job đang chạy (in-flight) cố gọi tool sau khi connector đã bị thu hồi:
  - Adapter lập tức ném ngoại lệ chuẩn `CONNECTOR_REVOKED`.
  - Wrap layer bắt được ngoại lệ, không nuốt lỗi, ghi nhận trạng thái `BLOCKED` kèm nguyên nhân vào ledger.
  - Job kết thúc ở trạng thái `failed` sạch sẽ theo chuẩn FR-AG-07, không treo tiến trình, không gây crash ứng dụng.

*Bằng chứng:*
- `src/tests/test-q10-disconnect-revoke.ts`
- `evidence/q10-disconnect-revoke.log`

---

### Q11 — FR-CF-09: Giao diện tool có tương thích chuẩn MCP không?
**Trả lời:** **TƯƠNG THÍCH GẦN NHƯ TUYỆT ĐỐI (KHOẢNG CÁCH = 0)**.  
Đánh giá đối chiếu kỹ thuật giữa `ToolDefinition` của framework và đặc tả `Tool` của Model Context Protocol (MCP 2024-11-05):
- `name`, `description`: Trùng khớp 1:1.
- `parameters`: Trùng khớp 1:1 với `inputSchema` của MCP (cùng định dạng JSON Schema Draft-07).
- Request / Response: Cùng trả về mảng `content: [{ type: "text", text: ... }]`.
- Các siêu dữ liệu an toàn mở rộng (`snapshot`, `compensation`, `irreversible`): Được đóng gói tự nhiên vào trường `annotations` tiêu chuẩn của MCP.
- Thử nghiệm nhập tool bên ngoài từ MCP server (`github_create_issue`) vào Connector framework thành công ngay lập tức qua hàm chuyển đổi `mcpToolToManifestTool`. Giai đoạn sau hỗ trợ bên thứ ba chỉ cần viết thêm `MCPClientAdapter` (kết nối stdio/SSE) mà KHÔNG CẦN sửa kiến trúc lõi.

*Bằng chứng:*
- `src/generator/mcp-compat.ts`
- `src/tests/test-q11-mcp-compat.ts`
- `evidence/q11-mcp-compat.log`

---

## 2. Tác động lên ADR / PRD

1. **Mệnh đề PRD §10.10 & Milestone S-M5**: **ĐÃ XÁC NHẬN THỰC CHỨNG**. Thiết kế manifest-driven là đúng đắn và khả thi 100%. Không cần sửa đổi kiến trúc lõi hay ADR.
2. **Xác nhận câu hỏi mở OQ-2 (PRD mục 13.1) & FR-AP-05**:  
   Chính thức xác nhận: Thao tác gắn cờ `irreversible: true` trong manifest **mặc định thuộc diện phê duyệt** ở mode `smart/on` mà không cần người dùng phải tự định nghĩa rule thủ công.
3. **Xác nhận FR-CF-04**: Scope profile trong manifest là cơ chế hữu hiệu và tinh gọn để kiểm soát mức CASA (AL1 vs AL2) khi mở rộng từ kênh BYO sang kênh đại trà.

---

## 3. Đầu vào cho tài liệu kỹ thuật

1. **Đặc tả Manifest Schema v0**:
   - `evidence/manifest-schema.json` và `evidence/manifest-types.ts` được chọn làm đặc tả chính thức cho Milestone M1.
2. **Quy tắc lọc Snapshot trước-ghi (Sanitization Contract)**:
   - Các connector dạng Document/Database (như Notion) bắt buộc khai báo `sanitization` trong tool ghi để loại trừ 6 trường computed: `formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`.
3. **Chuẩn hóa Adapter Interface**:
   - Giao diện `ConnectorAdapter` tối giản: `execute`, `fetchSnapshot`, `checkStatus`, `revoke`.
4. **Chuẩn hóa mã lỗi hệ thống**:
   - Các mã lỗi connector chuẩn hoá: `CONNECTOR_REVOKED`, `CONNECTOR_DISCONNECTED`, `CONNECTOR_EXPIRED` để Job Manager xử lý fail-clean (FR-AG-07).

---

## 4. Rủi ro mới phát hiện

1. **Notion API không hỗ trợ endpoint Revoke công khai**:  
   Khác với Google OAuth (có endpoint `/revoke`), Notion không cung cấp REST endpoint để client huỷ token. Việc ngắt kết nối Notion chỉ xoá token ở client (local-first). Cần công bố rõ trong tài liệu kỹ thuật và hướng dẫn người dùng cách gỡ tích hợp từ trang Settings của Notion nếu muốn thu hồi triệt để từ phía server Notion.
2. **Độ trễ khi Token hết hạn giữa Job (Token Refresh Overhead)**:  
   Nếu token hết hạn ngay giữa một chuỗi tool call, việc gọi token refresh tốn thêm ~300ms. Khuyến nghị ở M1: Job Manager nên kiểm tra hạn dùng của token trước khi khởi động job và chủ động refresh nếu còn dưới 5 phút.

---

## 5. Chưa trả lời được + vì sao
*Không có*. Toàn bộ 11 câu hỏi đều được trả lời dứt khoát với dữ liệu thực chứng 100% từ mã nguồn chạy thực tế và API thật của Notion và Google.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài

| Package / Công cụ | Phiên bản | Vai trò |
| :--- | :--- | :--- |
| `Node.js` | `v24.21.0` | Runtime môi trường thực thi |
| `npm` | `11.19.0` | Package manager |
| `@earendil-works/pi-agent-core` | `0.85.1` | Harness runtime của Pi Agent |
| `@earendil-works/pi-ai` | `0.85.1` | LLM streaming & tool call engine |
| `typebox` | `1.3.7` | Thư viện sinh JSON Schema / TSchema cho tool parameters |
| `dotenv` | `17.4.2` | Nạp biến môi trường từ `spikes/.env.local` |
| `tsx` | `4.23.13` | TypeScript ESM runner |
| `typescript` | `5.9.3` | Trình biên dịch và kiểm tra kiểu tĩnh |
