# Bản vá thượng nguồn (nháp) — gom từ harvest 20 REPORT spike M0

Ngày: 2026-09-12 · Nguồn: `plans/reports/harvest-{a,b,c,d}-260912.md`, `docs/spec/changes/req-001..020/proposal.md`.
Mục đích: một bản để product owner duyệt **một lần** trước khi ghi vào PRD §20 (Nhật ký thay đổi) và registry ADR. Chưa sửa gì trong PRD.

## A. Quyết định chỉ product owner làm được

| # | Việc | Vì sao cần bạn | Đề xuất của AI (chọn hoặc sửa) |
| --- | --- | --- | --- |
| A1 | Cấp mã cho hai đề xuất ADR mới đang "mượn" số cũ: SP-18 gọi "ADR-009 — Kiến trúc cửa sổ pet đa màn hình" (PRD ADR-009 = monorepo/đóng gói/native); SP-15 và SP-9 gọi "ADR-005 — Undo bù trừ & Ledger" (PRD ADR-005 = Backend Fastify/PostgreSQL) | Số ADR là định danh trong PRD FROZEN | ADR-010 = "Undo bù trừ từ ledger" (gộp bổ sung của SP-9 `property diff` và SP-15 object lock); ADR-011 = "Cửa sổ pet đa màn hình" (SP-18) |
| A2 | Quyết định về **native module**: SP-18 dùng koffi + C# helper thay vì Rust/napi-rs của ADR-009; SP-7 muốn nâng native từ "lối thoát" thành thành phần bắt buộc từ M1 | Đổi phạm vi ADR-009 | Giữ ADR-009 (Rust/napi-rs là đường chính thức); koffi/C# chỉ là bằng chứng khả thi, phải port sang napi-rs trong change `req-017`/`req-007` |
| A3 | Chốt phạm vi backend nhận lệnh: SP-21 giả định `POST /api/v1/commands/intake` trên backend; SP-20 OpenAPI v0 không có và NFR-BE-05 nói backend không thấy nội dung công việc | Mâu thuẫn giữa hai spike về ranh giới dữ liệu | Không có endpoint nhận lệnh trên backend; hàng chờ ngoại tuyến nằm hoàn toàn phía client (`req-020` viết lại theo hướng này) |
| A4 | Mua chứng chỉ ký thương mại (Cloud Signing: Azure Trusted Signing hoặc SSL.com eSigner), tư cách công ty hay cá nhân | Chỉ bạn mua được; hạn ≥ 2 tuần trước Closed Beta; OV cá nhân gây cảnh báo SmartScreen | Tư cách công ty nếu có pháp nhân; xem `spikes/SP-16-signing-update/evidence/procurement-checklist.md` |
| A5 | Tách tiền tố ID va chạm với PRD: corpus SP-2/SP-8 dùng `R-01..R-20` cho quy tắc mẫu (PRD `R-1..R-15` là rủi ro); SP-4 dùng `S-01..S-20` cho kịch bản (PRD `S-M1..` là phạm vi); SP-12 dùng `R-SQL-nn` | RTM đọc `id_prefixes` sẽ bắt nhầm | Đổi trong tài liệu spike thành `RULE-nn`, `SCN-nn`, `RSK-SQL-nn`; hoặc chấp nhận và thu hẹp `must_pattern` (đã làm: RTM chỉ tính hàng bảng FR/NFR/US) |
| A6 | Hai lỗi trích dẫn trong spike cần bạn xác nhận cách sửa: SP-2 viết "ADR-001/002/004 củng cố Hard Gate" (ADR-001/002 là Electron/Rive); SP-4 gán E9 cho ca "ảnh mâu thuẫn lệnh gõ" (PRD E9 là ASK option vs gõ tự do) | Sửa tài liệu bằng chứng đã đóng | Sửa số trong REPORT bằng một commit "docs(spike): đính chính trích dẫn", không đổi kết luận |

## B. Bổ sung ADR/PRD do spike đề xuất (AI đã đối chiếu, chờ duyệt gộp)

| ADR / FR | Bổ sung | Nguồn | Bằng chứng |
| --- | --- | --- | --- |
| ADR-004 | Pin cứng `@earendil-works/pi-agent-core@0.85.1`, `@earendil-works/pi-ai@0.85.1` | SP-6 §2 | ĐÃ KIỂM CHỨNG |
| ADR-007 / FR-AG-11 | Sửa lời văn: bỏ "subscription qua /login OAuth", thay bằng cấu hình provider qua API key/custom provider; ma trận vai trò → model là cấu hình client | SP-17 §2 | ĐÃ KIỂM CHỨNG (ma trận), lời văn là đề xuất |
| ADR-009 | Bắt buộc `asarUnpack: ["**/*.node"]`; CI/CD ký bằng Cloud Signing Service (không USB token) theo CA/B Forum 06/2023 | SP-12 §2, SP-16 §2 | ĐÃ KIỂM CHỨNG |
| §14.2 hàng "Local store" | Nâng pin `better-sqlite3` lên `^13.0.3` (Node-API, prebuild cho Electron 44) | SP-12 §2 | ĐÃ KIỂM CHỨNG |
| FR-LG-01 / FR-LG-02 / §12.1 | Làm rõ mô hình 2 bản ghi `tool_intent` + `tool_result`; trigger chặn UPDATE/DELETE | SP-12 §2 | ĐÃ KIỂM CHỨNG |
| FR-NT-06 | Tốc độ mục tiêu 2.5 req/s (thay 3), backoff ưu tiên header `Retry-After`; phân loại mã lỗi Notion | SP-1 §2 | ĐÃ KIỂM CHỨNG (429 có Retry-After); 3 req/s là số nhà cung cấp |
| FR-NT-03 / FR-CF-01 | Ma trận bù trừ Notion (tạo/sửa/di chuyển/archive; comment là irreversible) | SP-1 §3 | ĐÃ KIỂM CHỨNG |
| FR-UD-02 | Conflict detection bắt buộc so `property diff` với `snapshot_after`, không chỉ `last_edited_time` (Notion làm tròn tới phút) | SP-9 §2 | ĐÃ KIỂM CHỨNG |
| FR-AP-* / A.5 | Mã lỗi vi phạm "một ASK chờ" thống nhất một tên (`MAX_ONE_PENDING_ASK_EXCEEDED` hay `HARNESS_A5_VIOLATION`) | SP-21 Q2 vs §2 | cần chọn một |
| NFR-PF-03 / A.2 | Kiến trúc ACK tức thì từ template cục bộ ≤ 50 ms, LLM chạy nền | SP-17 §2 | CHƯA KIỂM CHỨNG (đề xuất) |
| FR-BE-09 / FR-APP-06 | Manifest `latest.yml` tĩnh; `autoInstallOnAppQuit = false`; card xác nhận khi còn job | SP-16 §2 | ĐÃ KIỂM CHỨNG (pipeline), hành vi card là đề xuất |
| R-17, R-19 | Được SP-17 dẫn nhưng không tồn tại trong PRD v2.1 | SP-17 Q1 | cần xoá trích dẫn hoặc thêm rủi ro |

## C. Đã xử lý ở tầng công cụ (không cần bạn)

- `docs/spec/risks.md`: 57 rủi ro (RSK-001..057) + 15 mục đã xem xét và bỏ.
- 79 câu hỏi mở nằm trong `clarifications.md` của từng change; hook mở phiên liệt kê chúng.
- `must_pattern` của RTM chỉ tính hàng bảng FR/NFR ưu tiên M và US; `evidence_files` chỉ bắt buộc trích REPORT.md.

## Câu hỏi chưa giải quyết

- A1–A6 ở trên.
- Khi nào bật CI macOS (Q-BOOT-1) và `appId`/`productName` chính thức (Q-BOOT-2) — từ change `bootstrap-skeleton`.
