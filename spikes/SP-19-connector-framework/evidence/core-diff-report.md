# BÁO CÁO ĐO LƯỜNG SỬA ĐỔI LÕI KHI THÊM CONNECTOR THỨ HAI (CORE DIFF REPORT)

> **Mục đích:** Kiểm chứng mệnh đề trung tâm của PRD §10.10:  
> *"Connector là dữ liệu + adapter, không phải code đặc thù rải trong lõi. Thêm nền tảng thứ N = viết một manifest + một adapter, không sửa Job Manager, hooks, ledger hay UI."*

---

## 1. Tóm tắt kết quả đo lường

| Thành phần lõi (Core Component) | File nguồn | Số dòng sửa trong Logic Lõi | Rẽ nhánh cứng theo Connector? | Kết luận |
| :--- | :--- | :---: | :---: | :---: |
| **Job Manager** | `src/core/job-manager.ts` | **0 dòng** | KHÔNG | ✅ Đạt |
| **Connector Registry** | `src/core/connector-registry.ts` | **0 dòng** | KHÔNG | ✅ Đạt |
| **Evaluator (Rule IR Hard Gate)** | `src/core/evaluator/evaluator.ts` | **0 dòng** | KHÔNG | ✅ Đạt |
| **Uniform Ledger** | `src/core/ledger.ts` | **0 dòng** | KHÔNG | ✅ Đạt |
| **Wrap Layer (createHardGatedTool)** | `src/core/wrapped-tool.ts` | **0 dòng** | KHÔNG | ✅ Đạt |
| **Tool Generator** | `src/generator/tool-generator.ts` | **0 dòng** | KHÔNG | ✅ Đạt |
| **TỔNG CỘNG LÕI** | — | **0 DÒNG** | **0** | **MỆNH ĐỀ §10.10 ĐÚNG 100%** |

---

## 2. Những gì THỰC SỰ phải viết khi thêm Gmail

Để tích hợp connector Gmail, kỹ sư chỉ phải thêm đúng **2 file độc lập**:

1. **Manifest dữ liệu:** `evidence/gmail.manifest.json` (57 dòng JSON)  
   - Khai báo metadata (id, name, icon).  
   - Khai báo OAuth endpoints, capabilities, và scope profiles (BYO vs Central).  
   - Khai báo 2 tool đọc (`gmail_search_emails`, `gmail_get_email_details`) kèm schema tham số.  
   - Không có tool ghi, không có snapshot/compensation (khớp FR-GM-01).

2. **Adapter nền tảng:** `src/adapters/gmail-adapter.ts` (194 dòng TypeScript)  
   - Hiện thực hóa `ConnectorAdapter` interface.  
   - Chỉ chứa logic gọi Google OAuth refresh token, revoke token, và Gmail REST API v1.  
   - Không chứa bất kỳ dòng code nào của Job Manager, Evaluator, hay Ledger.

3. **Cấu hình kích hoạt (Bootstrap / Dependency Injection):**  
   - 1 dòng đăng ký tại nơi khởi tạo app:  
     `registry.register(gmailManifest, gmailAdapter);`

---

## 3. Phân tích chi tiết từng module lõi

### 3.1. Job Manager (`src/core/job-manager.ts`) — 0 dòng sửa
- **Cơ chế:** `job-manager` gọi `registry.getConnectedConnectors()` để lấy danh sách các connector đang kết nối.
- Với mỗi connector, gọi `ToolGenerator.generateTools(manifest, adapter)` và bọc qua wrap layer.
- Khi Gmail được thêm vào registry, Job Manager tự động phát hiện và sinh bộ tool cho Gmail mà không cần thêm một dòng code hay câu lệnh `if (connector === 'gmail')` nào.

### 3.2. Evaluator / Rule IR (`src/core/evaluator/evaluator.ts`) — 0 dòng sửa
- **Cơ chế:** Evaluator đánh giá thuần túy dựa trên `ToolCallContext`.
- `ToolCallContext` mang các thuộc tính tổng quát: `connector`, `toolName`, `params`, `target`, `isIrreversible`, `changesPermission`.
- Evaluator không hardcode tên tool của Gmail hay Notion. Mọi quy tắc phê duyệt được cấu hình qua Rule IR hoặc cờ an toàn trong manifest (FR-AP-05).

### 3.3. Uniform Ledger (`src/core/ledger.ts`) — 0 dòng sửa
- **Cơ chế:** Ledger ghi nhận sự kiện dưới dạng `LedgerRecord` với trường `connectorId` tổng quát (FR-CF-10).
- Notion có `preSnapshot` và `compensatingAction`; Gmail là read-only nên hai trường này là `undefined`/`null`. Ledger tiếp nhận cả hai mà không cần rẽ nhánh.

### 3.4. Wrap Layer (`src/core/wrapped-tool.ts`) — 0 dòng sửa
- **Cơ chế:** Wrap layer đọc trực tiếp hợp đồng từ `baseTool.manifestMeta`.
- Nếu `meta.category === "write"` và `meta.snapshot.enabled === true` -> tự động gọi `adapter.fetchSnapshot()`.
- Vì Gmail khai báo `category: "read"`, wrap layer tự động bỏ qua bước snapshot và bù trừ, chuyển thẳng sang thực thi và ghi log INTENT/RESULT. Không có bất kỳ logic đặc thù nào cho Gmail.

---

## 4. Kết luận cho Q3

- **Số dòng logic lõi phải sửa: ĐÚNG 0 DÒNG.**
- **Số dòng cấu hình nạp:** 1 dòng (`registry.register(gmailManifest, gmailAdapter)`).
- **Phán quyết Mệnh đề PRD §10.10:** **HOÀN TOÀN ĐÚNG TRÊN THỰC CHỨNG.**
