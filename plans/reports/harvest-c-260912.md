# Harvest nhóm C — 5 tài liệu (SP-11, SP-12, SP-13, SP-15, SP-16)

Ngày: 2026-09-12 · Agent: harvest-c · Chế độ: ghi · Lệnh tạo: `specdocs new change <tên> --schema design --kind harvest` (flag `--kind harvest` được CLI chấp nhận và ghi vào `.change.yaml`).

## Harvest — 5 tài liệu, 155 mục (REPORT 69 · README 37 · evidence .md 29 · đã trừ heading container)

| Tài liệu nguồn | Change | Schema | Mục đã ánh xạ | Mục chưa ánh xạ |
| --- | --- | --- | --- | --- |
| spikes/SP-11-secure-storage/REPORT.md (+README) | req-011-secure-storage | design | 14/15 REPORT (Kết luận, Q1–Q6, §2 + 2 mục con, §3, §4, §5, §6) | 1 (container "1. Trả lời từng câu hỏi") + README 5 mục (hướng dẫn tái lập — liệt kê trong Refs, không sinh yêu cầu) |
| spikes/SP-12-sqlite-ledger/REPORT.md (+README) | req-012-sqlite-ledger | design | 12/15 REPORT (Kết luận, Q1 gồm Q1a–e, Q2–Q6, §2–§6) | 3 (container §1; 2 mục con môi trường của §6) + README 10 mục (tái lập) |
| spikes/SP-13-byo-oauth-google/REPORT.md (+README, evidence/byo-setup-guide-draft.md) | req-013-byo-oauth-google | design | 13/14 REPORT; guide-draft 8/21 (các phần §2–§5, troubleshooting 2–4 + trỏ cả file) | 1 (container §1) + guide-draft 13 mục con (bước 1–8, §1, §6 — nội dung hướng dẫn, trỏ qua file) + README 8 mục (tái lập / tóm tắt trùng REPORT) |
| spikes/SP-15-concurrency/REPORT.md (+README) | req-014-job-concurrency-rate-limit | design | 12/13 REPORT (Kết luận, Q1–Q6, §2–§6) | 1 (container §1) + README 5 mục (tái lập) |
| spikes/SP-16-signing-update/REPORT.md (+README, evidence/procurement-checklist.md) | req-015-signing-auto-update | design | 13/14 REPORT; procurement-checklist 5/8 (§1–§5) | 1 (container §1) + checklist 3 (tiêu đề, Trường hợp A/B — nằm trong §3 đã trích) + README 9 mục (tái lập) |

Mỗi change có `proposal.md` (khung design đầy đủ: Why · Problem · Cost of inaction · Options · Recommendation · What Changes · Capabilities · Impact · Refs · Constitution check · Assumptions) và `clarifications.md` với mục `## Open`. `specdocs status` báo proposal/clarifications `done`, specs/model `ready`.

**Rủi ro**: +16 dòng bảng và 3 dòng `BỎ` trong `<scratch>/harvest-c/risks-c.md` (không chạm `docs/spec/risks.md`) · **Câu hỏi mở**: +21 (req-011: 3 · req-012: 3 · req-013: 5 · req-014: 5 · req-015: 5), tất cả trong `clarifications.md ## Open` (schema design, không dùng `## Open questions`).
**Miền được gieo Purpose**: không làm — controller đã gieo 10 miền; không sửa `docs/spec/capabilities/`.

## Kiểm tra

- `specdocs validate <change>` ×5: mỗi change đúng 1 ERROR `Change không có delta spec nào; nếu không đổi hành vi, đặt skip_specs: true` — là trạng thái proposal-only, chấp nhận theo brief; không có lỗi cấu trúc khác.
- Kiểm chéo trích dẫn: 116 tham chiếu `spikes/...#slug` trong 10 file của nhóm C — 116/116 khớp slug do `extract-sections.mjs` sinh.
- `spec-check.mjs evidence`: 0 finding bắt buộc (medium) còn lại cho SP-11/12/13/15/16 sau khi bổ sung trích dẫn §2–§5 của README/evidence vào Refs (dưới nhãn "không ánh xạ" hoặc "hồ sơ mua sắm"); còn 51 finding `info` (mục không bắt buộc: bước chạy lại, mục con) — không xử lý. Toàn repo còn 833 finding thuộc các spike ngoài nhóm.

## Lý do chọn schema (tất cả `design`)

| Change | Điều kiện `lite` bị vi phạm |
| --- | --- |
| req-011-secure-storage | Thực thể mới (`secure_credentials`, taxonomy khoá); chạm dữ liệu lưu trữ; hợp đồng mới cho `connector`/`agent`/`backend` tiêu thụ |
| req-012-sqlite-ledger | Chạm ledger & dữ liệu lưu trữ (schema, trigger, migration); thuật toán riêng (đối soát sau crash); chạm Nguyên tắc II/V → hiến pháp bắt buộc `design` |
| req-013-byo-oauth-google | Hợp đồng connector Google mới (OAuth loopback/PKCE); chạm dữ liệu lưu trữ (token, client JSON); điểm biến thiên `reserved` (BYO → client trung tâm) |
| req-014-job-concurrency-rate-limit | Thực thể/thành phần mới (Connector Gateway, ObjectLockManager, FairRateQueue); thuật toán riêng (DRR, property-diff); chạm Nguyên tắc II/III, INV-G-02 |
| req-015-signing-auto-update | Hợp đồng mới `platform`↔`backend` (manifest FR-BE-09); hành vi thoát/khởi động lại app phụ thuộc job; CI/ký số |

## Miền (domains) mỗi change chạm

Mọi miền đích hiện chỉ có `## Purpose`, chưa có requirement → không có gì để MODIFIED; tất cả ghi là **New (ADDED requirement vào miền đã gieo)**. Miền tiêu thụ ghi trong mục Modified của proposal để `specdocs:impact` biết consumer.

| Change | New (chủ sở hữu) | Miền tiêu thụ (trỏ contract, chưa đổi hành vi) |
| --- | --- | --- |
| req-011 | `platform` | `connector`, `agent`, `backend`, `uix`, `app` |
| req-012 | `ledger`, `platform` | `uix`, `job`, `connector` |
| req-013 | `connector` | `app`, `platform`, `backend`, `agent`/`job` |
| req-014 | `job`, `connector` | `ledger`, `approval`, `agent` |
| req-015 | `platform`, `backend` | `app`, `uix`, `job` |

## ADR trôi / PRD cần §20 (ghi nguyên văn trong What Changes)

| Change | Mã | Nội dung nguồn đề xuất |
| --- | --- | --- |
| req-011 | NFR-SEC-01 | Đổi câu chữ: bỏ hàm ý dùng trực tiếp Credential Manager; "secure storage API của nền tảng (Electron safeStorage/DPAPI, Keychain) + ciphertext trong SQLite/app-data" |
| req-011 | ADR-007, FR-CF-11 | Xác nhận giữ nguyên (không đổi) |
| req-012 | Hàng "Local store (client)" §14.2 (không mã) | Nâng pin `better-sqlite3` lên `^13.x` |
| req-012 | ADR-009 | Bổ sung bắt buộc `asarUnpack: ["**/*.node"]` |
| req-012 | PRD §12.1, FR-LG-01, FR-LG-02 | Làm rõ 2 bản ghi `tool_intent`/`tool_result` mỗi tool call |
| req-013 | — | Không sửa ADR; xác nhận §13.6, R-12, FR-CF-11 |
| req-014 | PRD §14.1 | Thêm khối Connector Gateway & Resource Coordinator |
| req-014 | FR-AG-04 | Trần 3–4 job/connector account, job vượt → `pending` |
| req-014 | FR-NT-06 | Đặc tả DRR/Fair Queueing + Token Bucket 3 req/s |
| req-014 | "ADR-005" | Bất biến khoá đối tượng trước snapshot / giải phóng sau commit — **mã xung đột, xem bảng dưới** |
| req-015 | ADR-009 | Bổ sung: CI/CD bắt buộc Cloud Signing Service, không USB token |
| req-015 | FR-BE-09 | Manifest `latest.yml` tĩnh + `.exe`/`.blockmap`, không ký PKI manifest |
| req-015 | FR-APP-06 | `autoInstallOnAppQuit = false`; dialog/card xác nhận khi còn job |

## Mã định danh xung đột (không tự sửa)

| Mã | Các nguồn | Khác nhau ở chỗ nào |
| --- | --- | --- |
| **ADR-005** | `spikes/SP-15-concurrency/REPORT.md#2-tac-dong-len-adr-prd`, `…#q2-…` ↔ `docs/raw-idea/prd-mvp.md` §14.2 | SP-15 gọi ADR-005 là "Cơ chế Undo bù trừ & Ledger" và đề xuất bổ sung bất biến khoá; PRD ADR-005 = Backend Node.js + Fastify + TypeScript + PostgreSQL. Nội dung bất biến đã có trong hiến pháp INV-G-02; cần người quyết định chốt mã neo (Q-014-01). |
| "ADR Local store" | `spikes/SP-12-sqlite-ledger/REPORT.md#2-tac-dong-len-adr-prd` ↔ PRD §14.2 | Không tồn tại mã ADR nào tên này; PRD chỉ có hàng "Local store (client) — SQLite (better-sqlite3)" với cột ADR = "—". Đề xuất nâng pin `^13.x` không có chỗ neo có mã (Q-012-03). |
| R-SQL-01..05 | `spikes/SP-12-sqlite-ledger/REPORT.md#4-rui-ro-moi-phat-hien` ↔ `config.yaml specdocs.upstream.id_prefixes` (`R-`) | Mã rủi ro cục bộ của spike dùng tiền tố `R-` trùng namespace PRD (R-1..R-15) nhưng khác số — không trùng nội dung; risks-c.md giữ nguyên văn để controller quyết định đổi/bỏ tiền tố khi gộp. |
| NFR-PF-03 (lệch diễn giải, không lệch mã) | `spikes/SP-15-concurrency/REPORT.md#q3-…`, `#q4-…` ↔ PRD §11 | SP-15 áp "ack ≤ 2 s" cho thời gian chờ hàng đợi request của job; PRD định nghĩa NFR-PF-03 là phản hồi xác nhận của pet-agent, "không tính thời gian chạy job". Proposal giữ câu nguồn kèm chú thích. |
| Pin `better-sqlite3` (giữa hai spike nhóm C) | `spikes/SP-12-sqlite-ledger/REPORT.md#6-…` (`^13.0.3`) ↔ `spikes/SP-15-concurrency/REPORT.md#6-…` (`^11.8.1`) | SP-15 chạy Linux/Node với v11 — không mâu thuẫn kết luận nhưng số liệu khoá/ledger của SP-15 chưa chạy trên v13; ghi trong Impact của req-014. |

## Ghi chú nhãn bằng chứng

- Giữ ĐÃ KIỂM CHỨNG cho mọi khẳng định có log/thực nghiệm trong REPORT; gắn CHƯA KIỂM CHỨNG khi nguồn tự khai "theo đặc tả", "giá công bố", "tham chiếu", hoặc suy luận không chạy thử: SP-11 đổi máy/restore; SP-13 mã lỗi 7 ngày, giới hạn export 10 MB/5 TB, Internal user type; SP-15 rủi ro deadlock/starvation, `timeoutMs`, quantum; SP-16 toàn bộ giá/lead time/SmartScreen/hành vi trên máy ngoài; macOS ở SP-11/SP-16 ghi "CHƯA KIỂM CHỨNG — macOS hoãn".
- SP-13 Q5 yêu cầu screenshot nhưng bằng chứng là SVG minh hoạ — giữ nhãn nguồn, ghi Q-013-03.

## Handoff

- Change nháp đã tạo → `/specdocs:roadmap` xếp thứ tự (gợi ý phụ thuộc: req-012 ← req-011; req-014 ← req-012; req-013 ← req-011; req-015 độc lập nhưng có mốc mua sắm), rồi `/specdocs:assess` từng cái.
- Câu hỏi mở → `/specdocs:clarify` trên từng change; hai câu cần product owner sớm nhất: Q-015-01 (tư cách mua cert, chặn lịch M1) và Q-014-01 (mã ADR cho bất biến khoá).
- Rủi ro → controller gộp `harvest-c/risks-c.md` vào `docs/spec/risks.md` (cấp ID).

Status: DONE_WITH_CONCERNS
Summary: Đã tạo 5 change `design` (req-011..015) với proposal + clarifications truy vết 116/116 trích dẫn về đúng slug nguồn, 16 dòng rủi ro + 3 BỎ trong scratch, 21 câu hỏi mở; validate chỉ còn lỗi "chưa có delta spec" đúng như dự kiến cho proposal-only.
Concerns/Blockers: (1) Xung đột mã ADR-005 (SP-15 vs PRD) và "ADR Local store" không có mã — cần người quyết định chốt trước khi viết specs Refs. (2) Nhiều số liệu SP-16 và một phần SP-13 là tài liệu nhà cung cấp → toàn bộ mục mua sắm/lịch M1 đang ở CHƯA KIỂM CHỨNG. (3) `validate` coi "không có delta spec" là ERROR (không phải cảnh báo) — nếu controller muốn `validate --all` xanh ở giai đoạn proposal-only, cần quyết định ở tầng plugin, không phải ở change.
