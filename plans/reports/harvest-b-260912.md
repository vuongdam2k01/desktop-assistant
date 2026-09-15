# Harvest nhóm B — 5 tài liệu, 158 mục

Nguồn: `spikes/SP-6-pi-sdk`, `SP-7-pet-window-os`, `SP-8-rule-ir-hardgate`, `SP-9-undo-agent`, `SP-10-risk-judge`.
Trích mục bằng `plugins/specdocs/scripts/extract-sections.mjs --json` (không chạy chế độ lùi). Chỉ ghi vào
`docs/spec/changes/req-006..010/` (proposal.md + clarifications.md) và scratch `harvest-b/`. Không chạm
`capabilities/`, `risks.md`, `roadmap.md`, `spikes/`, PRD, plugin.

| Tài liệu nguồn | Change | Schema | Mục đã ánh xạ | Mục chưa ánh xạ |
| --- | --- | --- | --- | --- |
| spikes/SP-6-pi-sdk/REPORT.md | req-006-pi-sdk-embedding | design | 16 (toàn bộ REPORT.md) | 13 (README.md ×6 — hướng dẫn chạy lại; evidence/package-comparison.md ×4, evidence/upstream-release-history.md ×3 — chỉ dẫn làm bằng chứng phụ) |
| spikes/SP-7-pet-window-os/REPORT.md | req-007-pet-window-os | design | 16 (toàn bộ REPORT.md) | 11 (README.md ×11 — cấu trúc thư mục, bước chạy lại) |
| spikes/SP-8-rule-ir-hardgate/REPORT.md | req-008-rule-ir-hard-gate | design | 13 (toàn bộ REPORT.md) | 53 (README.md ×10; evidence/q1-ir-spec.md ×10, q2-bypass-analysis.md ×14, q4-injection-transcripts.md ×12, q5-evasion-transcripts.md ×8 — transcript/đặc tả chi tiết, dẫn làm bằng chứng phụ) |
| spikes/SP-9-undo-agent/REPORT.md | req-009-undo-agent | design | 13 (toàn bộ REPORT.md) | 4 (README.md ×4) |
| spikes/SP-10-risk-judge/REPORT.md | req-010-llm-risk-judge | design | 13 (toàn bộ REPORT.md) | 6 (README.md ×6) |

Phân loại heading theo bảng mặc định của SKILL.md: `0. Kết luận` → Why; `Q1..Qn` → Problem/What Changes;
`2. Tác động lên ADR/PRD` → What Changes (nhóm "ADR trôi", ID nguyên văn); `3. Đầu vào cho tài liệu kỹ thuật`
→ Impact; `4. Rủi ro mới phát hiện` → risks-b.md; `5. Chưa trả lời được` → clarifications/risks (SP-7) hoặc BỎ
(4 spike khai "không có"); `6. Phiên bản` → Impact (phụ thuộc/phiên bản đã chạy).

Quy tắc nhãn đã áp: kết quả có log/số đo/code trong REPORT.md → ĐÃ KIỂM CHỨNG; đề xuất, giải pháp chưa chạy,
số liệu từ tài liệu/lịch sử phát hành, khẳng định không kèm bằng chứng chạy (SP-6 Q8), macOS → CHƯA KIỂM CHỨNG.
Kiểm tự động: 148 trích dẫn `spikes/...#slug` trong 10 file + risks-b.md, 0 trích dẫn sai slug
(`harvest-b/check-cites.mjs`).

**Rủi ro:** +14 dòng trong `<scratch>/harvest-b/risks-b.md` (ID để trống, chờ controller gộp) · 5 dòng `BỎ`.
**Câu hỏi mở:** +23 trong `clarifications.md ## Open` (req-006: 4 · req-007: 4 · req-008: 5 · req-009: 5 · req-010: 5).
**Miền gieo Purpose:** không làm (controller đã gieo 10 miền; không sửa).
**Validate:** 5/5 change chỉ còn 1 ERROR giống nhau "Change không có delta spec nào" — proposal-only, chấp nhận
theo brief; `status` báo proposal + clarifications `done`, specs/model `ready`. `spec-check.mjs evidence` không
chạy (không thuộc phạm vi brief; script tồn tại hay không chưa kiểm).

## Lý do chọn schema (đều `design`)

| Change | Điều kiện `lite` bị vi phạm |
| --- | --- |
| req-006 | Hợp đồng mới (chuẩn bọc tool, contract `agent`↔`ledger`/`job`), thực thể Transcript, chạm dữ liệu lưu trữ (transcript cold-resume, ledger); chạm Nguyên tắc II → hiến pháp bắt buộc `design` |
| req-007 | Thuật toán riêng (hit-test theo alpha, fallback màn hình, corner flip), thành phần build mới (native module), dữ liệu lưu trữ (vị trí pet) |
| req-008 | Hợp đồng mới (Rule IR Spec v0), thực thể mới (Rule, HardlineRule, ApprovalToken, bộ đếm tích luỹ), thuật toán riêng (evaluator), chạm hard gate + ledger → Nguyên tắc II, V |
| req-009 | Thuật toán riêng (undo 4 pha, conflict hai lớp), dữ liệu lưu trữ (`undo_of`, snapshot), chạm Nguyên tắc III |
| req-010 | Thuật toán/prompt riêng, quyết định tự duyệt ghi ledger, chạm Nguyên tắc II, V |

## Miền (specdocs.domains) mỗi change chạm

| Change | New (requirement ADDED vào miền đã gieo Purpose) | Modified (hành vi hiện hữu) | Chạm gián tiếp qua contract |
| --- | --- | --- | --- |
| req-006 | `agent` | không (chưa có requirement nào tồn tại) | `ledger`, `platform`, `uix`, `pet` |
| req-007 | `pet`, `platform` | không | `uix`, `app` |
| req-008 | `approval` | không | `agent`, `ledger`, `connector`, `job` |
| req-009 | `ledger` (undo theo Purpose hiện tại) | không | `job`, `connector`, `agent`, `app`, `uix` |
| req-010 | `approval` | không | `agent`, `ledger`, `uix`, `job` |

Ghi chú: vì `capabilities/<domain>/spec.md` chỉ có `## Purpose`, harvest ghi capability dưới "New" với chú
thích "requirement ADDED"; mục Modified để trống. Cả 5 proposal đều ghi "CẦN spec-impact" vì chạm dữ liệu lưu trữ
(ledger/transcript/vị trí pet/quy tắc).

## Mã định danh xung đột (không tự sửa)

| Mã | Nguồn | Khác nhau ở chỗ nào |
| --- | --- | --- |
| ADR-001 / ADR-002 | spikes/SP-8-rule-ir-hardgate/REPORT.md#2-tac-dong-len-adr-prd vs PRD §14.2 | SP-8 gọi là "Hard Gate Architecture" (đặt hard gate ở tầng ứng dụng); PRD: ADR-001 = Electron, ADR-002 = Rive. PRD không có ADR nào cho hard gate |
| ADR-002 | spikes/SP-10-risk-judge/REPORT.md#2-tac-dong-len-adr-prd vs PRD §14.2 | SP-10 liệt kê "ADR-001/002/007 = Electron, TypeScript, Local SQLite Ledger, Direct Client-to-Provider"; PRD: ADR-002 = Rive, TypeScript thuộc ADR-003, SQLite không có số ADR (dòng "—") |
| ADR-005 | spikes/SP-9-undo-agent/REPORT.md#2-tac-dong-len-adr-prd vs PRD §14.2 | SP-9: "Cơ chế Undo dựa trên suy luận Ledger thay vì Git VCS rollback" và đề xuất bổ sung chỉ dẫn `property diff` vào đó; PRD: ADR-005 = Backend Node/Fastify/TypeScript/PostgreSQL. Undo-by-ledger trong PRD là QĐ-2/FR-UD-01, không phải ADR |
| ADR-009 | spikes/SP-7-pet-window-os/REPORT.md#tac-dong-len-adr vs PRD §14.2 | SP-7 gọi "(Native modules: napi-rs vs C++ vs WASM)"; PRD ADR-009 = monorepo + đóng gói + ký + native Rust/napi-rs. Cùng hướng, khác phạm vi tên gọi — mức thấp, ghi để đối chiếu |
| Tiền tố R-nn | spikes/SP-8-rule-ir-hardgate/REPORT.md (R-01..R-20 = quy tắc người dùng mẫu, kế thừa SP-2) vs PRD §16 (R-1..R-15 = rủi ro) và SP-6/SP-10 (dùng R-6, R-11, R-14, R-5 theo nghĩa PRD) | Cùng mã khác nội dung, ví dụ R-12: SP-8 = quy tắc `created_by.not_in [current_user, app_bot]`; PRD = rủi ro Gmail BYO OAuth. `specdocs.upstream.id_prefixes` có `R-` → RTM có thể bắt nhầm |
| Tiền tố S-nn | spikes/SP-9-undo-agent/REPORT.md (S-01, S-02, S-04, S-05, S-08 = kịch bản fixture) vs PRD §7 (S-M1, S-M5a… = scope) | Định dạng khác (`S-01` vs `S-M1`) nên không trùng nguyên văn; ghi vì `S-` nằm trong `id_prefixes` |

## Điểm cần controller lưu ý

- Cả 5 proposal mở đầu bằng cảnh báo chạm QĐ/ADR/PRD theo `rules.proposal` của config; mục PRD §20 cần sửa
  được liệt kê trong "ADR trôi" của từng What Changes: FR-AG-11/ADR-007 (SP-6), FR-AP-11/FR-AP-01/FR-AP-04
  (SP-8), "ADR-005" (SP-9), FR-AG-11/FR-AP-10/FR-AP-13 (SP-10); SP-7 không sửa PRD.
- req-008 và req-010 phụ thuộc nhau (tầng 1 là điều kiện tiền đề của tầng 2); chưa ghi `depends_on` trong
  `.change.yaml` vì brief không giao — đề nghị `roadmap` xử lý.
- Lệch phiên bản: config dự án ghi better-sqlite3 `^13`; SP-9 chạy `11.10.0` (ghi trong Impact của req-009).
- `--kind harvest` được engine chấp nhận (ghi vào `.change.yaml: kind: harvest`) dù help chỉ liệt kê A|B|C.

Status: DONE_WITH_CONCERNS
Summary: Đã tạo 5 change `design` (req-006..010) với proposal.md + clarifications.md, 148 trích dẫn kiểm sạch, 14 dòng rủi ro + 5 BỎ trong `harvest-b/risks-b.md`, 23 câu hỏi mở; validate chỉ còn cảnh báo proposal-only như dự kiến.
Concerns/Blockers: 3 mã ADR trong spike (ADR-001/002 ở SP-8, ADR-002 ở SP-10, ADR-005 ở SP-9) lệch PRD §14.2 và tiền tố `R-` va chạm giữa quy tắc mẫu SP-8 và rủi ro PRD — cần product owner chốt trước khi các đề xuất "ADR trôi" được ghi vào PRD §20; phụ thuộc req-008 → req-010 chưa ghi vào `.change.yaml`.
