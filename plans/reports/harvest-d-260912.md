# Harvest nhóm D — 5 tài liệu (SP-17, SP-18, SP-19, SP-20, SP-21), 155 mục

Chế độ: ghi. Thư mục quét: `spikes/SP-17-provider-matrix`, `spikes/SP-18-pet-liveness`, `spikes/SP-19-connector-framework`, `spikes/SP-20-backend-slice`, `spikes/SP-21-ask-user-offline` (chỉ `*.md`, bỏ `node_modules`). Tách mục bằng `plugins/specdocs/scripts/extract-sections.mjs --json` (không chạy chế độ lùi). JSON tại `scratchpad/harvest-d/<SP>.json`.

## Harvest — 5 tài liệu, 155 mục

| Tài liệu nguồn | Change | Schema | Mục đã ánh xạ | Mục chưa ánh xạ |
| --- | --- | --- | --- | --- |
| spikes/SP-17-provider-matrix (16 mục) | req-016-llm-provider-matrix | design | 12 | 4 (README ×3: cấu trúc, môi trường, chạy lại; REPORT §1 heading chứa) |
| spikes/SP-18-pet-liveness (45 mục) | req-017-pet-liveness | design | 22 | 23 (README ×10; REPORT §1; architecture-decision §1; interaction-catalogue ×8 — trùng nội dung REPORT nhóm A–F; privacy-surface §1, "các rủi ro riêng tư cụ thể" (BỎ, trùng), "chi tiết 4 nguyên tắc") |
| spikes/SP-19-connector-framework (29 mục) | req-018-connector-framework | design | 24 | 5 (README ×3; REPORT §1; core-diff-report §1) |
| spikes/SP-20-backend-slice (40 mục) | req-019-backend-vertical-slice | design | 22 | 18 (README ×8; REPORT §1; broker-diff-report §1, A, B; load-test-report §1, kịch bản 1–3, "nhận định"; q5-notion-connect-flow §1) |
| spikes/SP-21-ask-user-offline (25 mục) | req-020-ask-user-offline-queue | design | 18 | 7 (README ×6; REPORT §1) |

Mục chưa ánh xạ đều là hướng dẫn tái lập/cấu trúc thư mục (README), heading chứa (§1 "Trả lời từng câu hỏi"), hoặc bản chi tiết trùng với mục REPORT đã trích. Không có mục thuộc 5 nhóm phân loại nào bị bỏ sót: mọi REPORT §0, Q-n, §2–§6 và các mục §2–§4 của evidence `.md` đều được trích trong proposal.

Phân loại theo bảng heading mặc định của SKILL: `0. Kết luận` → Why · `2. Tác động lên ADR / PRD` → What Changes · `3. Đầu vào cho tài liệu kỹ thuật` → Impact/Refs · `4. Rủi ro mới phát hiện` → risks-d.md · `5. Chưa trả lời được` → clarifications `## Open`. Các mục Q-n (trả lời từng câu) ánh xạ vào What Changes/Options theo nội dung.

Rủi ro: **+8 dòng** tại `scratchpad/harvest-d/risks-d.md` (KHÔNG ghi vào `docs/spec/risks.md` theo brief), kèm 3 dòng `- BỎ …`.
Câu hỏi mở: **+23** (req-016: 5 · req-017: 5 · req-018: 4 · req-019: 4 · req-020: 5), tất cả ở `clarifications.md#Open` vì cả 5 change là `design`.
Miền được gieo Purpose: không làm (controller đã gieo 10 miền; nhóm D không chạm `docs/spec/capabilities/`).

## Lý do chọn schema (tất cả `design`)

| Change | Điều kiện `lite` bị vi phạm |
| --- | --- |
| req-016-llm-provider-matrix | Hợp đồng mới (ma trận vai trò → model; ánh xạ lỗi provider → thẻ SYSTEM); cấu hình lưu trữ gán model theo vai; sửa lời văn ADR-007/FR-AG-11 |
| req-017-pet-liveness | Hợp đồng mới native → Pet Engine (`Bounds` + `ProcessName`, không Title); ràng buộc dữ liệu lưu trữ (cấm lưu Window Title); thuật toán riêng (hit-test alpha, quán tính, edge flip, caret evasion); ADR mới |
| req-018-connector-framework | Hợp đồng mới (Manifest Schema v0, `ConnectorAdapter`, mã lỗi connector); chạm dữ liệu ledger (`LedgerRecord.connectorId`, `PRE_SNAPSHOT`) |
| req-019-backend-vertical-slice | Hợp đồng mới (OpenAPI v0, `OAuthProviderConfig`); dữ liệu lưu trữ (DDL 4 bảng PostgreSQL) |
| req-020-ask-user-offline-queue | Hợp đồng mới (`ask_user` schema/kết quả); dữ liệu lưu trữ (bảng `decisions`, `offline_command_queue`); thực thể mới (trạng thái job `waiting_input`/`suspended`) |

## Miền (domains) mỗi change chạm

Mọi đường dẫn đều đã tồn tại (controller gieo Purpose) nên ghi dưới **Modified Capabilities** với ghi chú "ADDED requirements" — không có requirement hiện hữu nào bị đổi; không có New capability path.

| Change | Miền chạm (Modified, ADDED requirements) |
| --- | --- |
| req-016 | agent, uix, app, approval |
| req-017 | pet, platform, uix |
| req-018 | connector, agent, job, approval, ledger |
| req-019 | backend, connector, platform |
| req-020 | agent, job, ledger, uix, approval, platform |

Miền không change nào của nhóm D chạm: không có (cả 10 miền đều xuất hiện ít nhất một lần).

## Mã định danh xung đột

| Mã | Các nguồn | Khác nhau ở chỗ nào |
| --- | --- | --- |
| ADR-009 | `spikes/SP-18-pet-liveness/REPORT.md#2-tac-dong-len-adr-prd` vs `docs/raw-idea/prd-mvp.md` §14.2 | Spike đề xuất "Thêm mới ADR-009 — Kiến trúc Cửa sổ Pet Di động Đa màn hình"; PRD đã dùng ADR-009 cho "Monorepo, đóng gói, native (pnpm + Turborepo, electron-builder/updater, code signing, Rust napi-rs)". Cần cấp mã mới (ADR-010?) hoặc sửa ADR-001. Ghi ở proposal req-017 dòng cảnh báo đầu và Q-017-1. |
| R-17, R-19 | `spikes/SP-17-provider-matrix/REPORT.md` Q1 (dẫn từ SP-2) vs PRD v2.1 §16 | PRD không có R-17/R-19; spike dùng như mã rủi ro PRD. Không tra được nội dung đối chiếu. Q-016-5. |
| Mã lỗi vi phạm A.5 mục 2 | `spikes/SP-21-ask-user-offline/REPORT.md` Q2 vs cùng file §2 | Q2 ghi `HARNESS_A5_VIOLATION`, §2 ghi `MAX_ONE_PENDING_ASK_EXCEEDED` cho cùng một hành vi. Không phải mã ADR/SP/FR nhưng là xung đột hợp đồng trong một nguồn. Q-020-1. |
| Endpoint nhận lệnh | `spikes/SP-21-ask-user-offline/REPORT.md` Q8 (`POST /api/v1/commands/intake`) vs `spikes/SP-20-backend-slice/evidence/openapi-v0.yaml` (SP-20 §3) | SP-21 giả định backend có endpoint nhận lệnh người dùng; OpenAPI v0 của SP-20 không có endpoint này và theo Q4 SP-20 backend không lưu lệnh/nội dung công việc (NFR-BE-05). Xung đột phạm vi giữa hai spike cùng nhóm. Q-020-3. |

Ghi nhận thêm (không phải xung đột mã): SP-18 thực thi native bằng koffi 2.9.3 + C# helper DLL trong khi ADR-009 quy định Rust/napi-rs (Q-017-3); SP-17 dùng liên kết `file:///…/docs/prd-mvp.md#Lnnn` — file đã chuyển sang `docs/raw-idea/`, liên kết trong spike đã gãy (không sửa, chỉ báo).

## Kiểm tra

- `specdocs new change <tên> --schema design`: CLI chỉ hỗ trợ `--kind A|B|C`, không có `--kind harvest` → giữ kind mặc định `B` trong `.change.yaml`.
- `specdocs validate <tên>` cho cả 5 change: chỉ 1 ERROR "Change không có delta spec nào" (proposal-only, chấp nhận theo brief); không lỗi cấu trúc khác. `specdocs status` ghi proposal và clarifications = done.
- `spec-check.mjs evidence --json`: mọi mục bắt buộc (`^(2|3|4|5)\.`) của REPORT.md và evidence `.md` thuộc 5 spike nhóm D đã được trích; còn 16 mục README (cài đặt/chạy lại/cấu trúc) uncited — chủ ý, không thuộc nhóm nội dung nào.
- Nhãn bằng chứng: ĐÃ KIỂM CHỨNG chỉ gán cho khẳng định có evidence file/số đo trong REPORT; khuyến nghị kiến trúc, đặc tính UI chưa đo, chi phí tính từ bảng giá nhà cung cấp, phân tích so sánh (SQLite cùng file), ca 429 giả lập, ngoại suy production → CHƯA KIỂM CHỨNG.

## File đã tạo/sửa

- `docs/spec/changes/req-016-llm-provider-matrix/{.change.yaml,proposal.md,clarifications.md}`
- `docs/spec/changes/req-017-pet-liveness/{.change.yaml,proposal.md,clarifications.md}`
- `docs/spec/changes/req-018-connector-framework/{.change.yaml,proposal.md,clarifications.md}`
- `docs/spec/changes/req-019-backend-vertical-slice/{.change.yaml,proposal.md,clarifications.md}`
- `docs/spec/changes/req-020-ask-user-offline-queue/{.change.yaml,proposal.md,clarifications.md}`
- Scratch: `harvest-d/SP-*.json`, `harvest-d/risks-d.md`, `harvest-d/expand-cites.mjs`
- Không chạm `docs/spec/capabilities/`, `docs/spec/risks.md`, `docs/spec/roadmap.md`, `spikes/`, PRD, plugin.

Status: DONE_WITH_CONCERNS
Summary: Đã tạo 5 change `design` (req-016..020) với proposal.md và clarifications.md trích dẫn đầy đủ tới slug REPORT/evidence, 8 dòng rủi ro ở scratch, 23 câu hỏi mở; validate chỉ còn cảnh báo proposal-only.
Concerns/Blockers: (1) SP-18 đề xuất "ADR-009" trùng mã với ADR-009 hiện có của PRD — cần người quyết định cấp mã trước khi vào registry ADR; (2) SP-21 giả định endpoint backend nhận lệnh người dùng, mâu thuẫn với OpenAPI v0 của SP-20 và NFR-BE-05 — cần chốt phạm vi trước khi viết specs `job`/`backend`; (3) R-17/R-19 do SP-17 dẫn không tồn tại trong PRD v2.1.
