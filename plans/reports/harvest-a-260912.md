# Harvest nhóm A — 5 tài liệu (SP-0..SP-4), 5 change nháp

Ngày: 2026-09-12 · Brief: `scratchpad/harvest-brief.md` · Scratch: `scratchpad/harvest-a/`
(`SP-*.json` trích mục, `risks-a.md`). Chế độ: ghi. Script `extract-sections.mjs` chạy bình thường
(không lùi về Glob/Grep). `spec-check.mjs evidence` không nằm trong phạm vi brief nên chưa chạy.

## Harvest — 5 tài liệu, 66 mục REPORT (+ 484 mục .md khác trong 5 spike)

| Tài liệu nguồn | Change | Schema | Mục REPORT đã ánh xạ | Mục chưa ánh xạ |
| --- | --- | --- | --- | --- |
| spikes/SP-0-gui-harness/REPORT.md | req-001-gui-spike-harness | lite | 12/13 (§0, Q1–Q6, §2–§6) | 1 (§1 heading chứa); README.md 11 mục — 1 mục dùng (§3 tái sử dụng script, nêu mâu thuẫn) |
| spikes/SP-1-notion-compensation/REPORT.md | req-002-notion-compensation | design | 14/15 (§0, Q1–Q8, §2–§6) | 1 (§1); `evidence/compensation-matrix.md` 5 mục — 3 mục dùng ở Impact/Capabilities; README.md 4 mục không dùng |
| spikes/SP-2-rule-elicitation/REPORT.md | req-003-rule-elicitation | design | 11/12 (§0, Q1–Q4, So sánh, §2–§6) | 1 (§1); `evidence/rule-patterns-for-ir.md` 3/4 mục dùng; `rule_templates_for_sp8.md` (bản trùng nội dung) và 40 transcript `R-*.md` (432 mục) là dữ liệu thô — không ánh xạ; README.md 1 mục dùng |
| spikes/SP-3-electron-rive/REPORT.md | req-004-electron-rive-render | design | 13/14 (§0, Q1–Q7, §2–§6) | 1 (§1); `evidence/state-machine-contract-v0.md` 5/6 mục dùng; `licensing-pricing-proof.md` 2/3 mục dùng; README.md 3 mục không dùng |
| spikes/SP-4-agent-loop/REPORT.md | req-005-agent-loop | design | 11/12 (§0, Q1–Q5, §2–§6) | 1 (§1); README.md 8 mục không dùng |

Ghi chú ánh xạ: bảng heading mặc định của SKILL.md chỉ khớp §0/§2/§3/§4/§5; các mục `Q1..Qn` (bằng
chứng chi tiết) không khớp nhóm nào nên được đưa vào **What Changes** của proposal như kết quả kiểm
chứng, giữ nhãn của nguồn. §6 (phiên bản) đưa vào **Impact** như phụ thuộc đã pin. §1 chỉ là heading
chứa. Tổng trích dẫn `spikes/...#slug` trong 5 change: 161, đã kiểm máy 161/161 tồn tại trong JSON trích mục.

Rủi ro: +19 dòng vào `scratchpad/harvest-a/risks-a.md` (chưa ghi `docs/spec/risks.md` theo brief), +4 dòng `BỎ`
· Câu hỏi mở: +22 (req-001: 2 trong `## Open questions` của proposal vì schema lite không có
clarifications; req-002: 5; req-003: 5; req-004: 5; req-005: 5 trong `clarifications.md ## Open`)
Miền được gieo Purpose: không gieo — controller đã gieo 10 miền; nhóm A không chạm `docs/spec/capabilities/`.

### Validate

`specdocs validate <change>` cho cả 5 change: một ERROR duy nhất "Change không có delta spec nào; nếu
không đổi hành vi, đặt skip_specs: true" — đúng loại cảnh báo proposal-only mà brief cho phép chấp nhận
(chưa có `specs/`). Không có lỗi cấu trúc khác. `--kind harvest` được engine chấp nhận (không kiểm giá
trị); `.change.yaml` của cả 5 change đã đặt `kind: harvest` để đồng bộ với các nhóm khác.

### Lý do chọn schema

| Change | Schema | Lý do (theo "Điều kiện dùng lite hay design" + Rigor by Risk của hiến pháp) |
| --- | --- | --- |
| req-001 | lite (giữ gợi ý) | Không thực thể mới, không hợp đồng, không thuật toán riêng, không dữ liệu lưu trữ; delta chỉ là vài requirement ADDED (ràng buộc platform, xác nhận FR-INT-04). Harness là công cụ kiểm thử, không phải mã sản phẩm |
| req-002 | design (giữ gợi ý) | Chạm hợp đồng manifest (sanitizer, cờ unsupported), nội dung snapshot trong ledger (dữ liệu lưu trữ), thuật toán dò schema; chạm Nguyên tắc II/III/V → hiến pháp bắt buộc design |
| req-003 | design (giữ gợi ý) | Chạm hard gate (Nguyên tắc V, VII), đầu vào hợp đồng Rule IR (7 trục vị từ), hợp đồng ma trận vai → model; đề xuất sửa 3 FR |
| req-004 | design (giữ gợi ý) | Tạo hợp đồng mới có version `rive-state-machine` v0.1 (Nguyên tắc IX), thực thể asset/skin, điểm mở rộng pet pack; reserved 3D |
| req-005 | design (giữ gợi ý) | Chạm hợp đồng tool nội bộ (content array) giữa `connector` và `agent`, hành vi `ask_user`, quy tắc ưu tiên nguồn multimodal (Nguyên tắc V, VII, INV-G-03) |

### Miền (domains) mỗi change chạm

Quy ước đã dùng: 10 miền đã có `spec.md` với `## Purpose` (0 requirement) → liệt kê dưới **Modified
Capabilities** (đường dẫn có sẵn) kèm ghi chú "delta là ADDED, không BREAKING"; mục **New Capabilities**
để "Không có". Controller có thể đổi quy ước này đồng loạt nếu các nhóm khác chọn khác.

| Change | Modified | Ghi chú |
| --- | --- | --- |
| req-001 | `platform`, `uix` | `platform`: ràng buộc không SendInput/NtSuspendProcess/SetCursorPos + ranh giới Administrator; `uix`: xác nhận FR-INT-04 |
| req-002 | `connector`, `ledger`, `approval` | Undo-agent xếp vào `ledger` theo Purpose gieo sẵn (giả định, ghi ở Assumptions) |
| req-003 | `approval`, `agent` | Rule IR thuộc req-008; change này chỉ khai đầu vào |
| req-004 | `pet` (+ `platform` tuỳ chọn) | Cấu hình cửa sổ Electron để trong `pet`; `platform` chỉ nếu người quyết định tách |
| req-005 | `agent`, `connector`, `uix` | Hợp đồng trả về tool; ASK card là kênh hỏi duy nhất |

### Đề xuất sửa PRD/ADR ("ADR trôi") ghi trong What Changes

| Change | ID nguyên văn của nguồn | Nội dung |
| --- | --- | --- |
| req-001 | ADR-001 | Giữ nguyên; không ADR nào sửa |
| req-002 | FR-NT-03, FR-NT-06, FR-CF-01, FR-UD-01, FR-UD-02 | Reorder phụ thuộc cột number; 2.5 req/s + Retry-After; sanitization trong manifest; 200+archived → unarchive, 404 → CONFLICT |
| req-003 | FR-AG-11, FR-AP-02, FR-AP-04; ADR-001/002/004 "không cần sửa" | Vai đúc kết → model mạnh; hard limit 4 lượt; "xoá" gồm archive_page + delete_block |
| req-004 | ADR-001, ADR-002 | Không sửa; PRD không phát sinh FR/NFR |
| req-005 | US-2.1/AC3, FR-AG-05, "PRD E9 / Phụ lục A.10" | Đạt ngưỡng; cưỡng chế `ask_user`; lệnh gõ thắng ảnh |

Ba change (req-002, req-003, req-005) có dòng cảnh báo đầu proposal về PRD FROZEN / §20 theo
`config.yaml rules.proposal`.

### Mã định danh xung đột

| Mã | Các nguồn | Khác nhau ở chỗ nào |
| --- | --- | --- |
| ADR-001, ADR-002 | `spikes/SP-2-rule-elicitation/REPORT.md#2-tac-dong-len-adr-prd` vs PRD §14.2 | SP-2 viết "ADR-001 / ADR-002 / ADR-004: KHÔNG CẦN SỬA — củng cố kiến trúc Hard Gate độc lập với LLM"; trong PRD ADR-001 = Electron, ADR-002 = Rive, không liên quan hard gate. Có thể nguồn định nói QĐ-2 / FR-AP-03. Không tự sửa |
| E9 / Phụ lục A.10 | `spikes/SP-4-agent-loop/REPORT.md#2-tac-dong-len-adr-prd` vs PRD A.10 dòng E9 | SP-4 gán E9 cho "ảnh đính kèm mâu thuẫn văn bản gõ"; PRD E9 là "ASK có options nhưng người dùng gõ tự do mâu thuẫn với mọi option". Nội dung khác — đề xuất của SP-4 có thể cần một dòng E mới trong A.10 |
| Tiền tố `R-` | SP-2 (`R-01..R-20` = quy tắc corpus; README SP-2 đồng thời trích `R-2` = rủi ro PRD) vs PRD §16 (`R-1..R-15` = rủi ro) | Cùng tiền tố, hai không gian ID khác nhau; `config.yaml specdocs.upstream.id_prefixes` có `R-` nên RTM/trace có thể bắt nhầm `R-01..R-20` là ID PRD. Cần quyết định đổi tên corpus (vd `RULE-01`) hoặc loại trừ mẫu hai chữ số |
| Tiền tố `S-` | SP-4 (`S-01..S-20` = kịch bản) vs PRD §7 (`S-M1..`, `S-C2` = phạm vi) | Cùng tiền tố `S-` trong `id_prefixes`; định dạng khác (`S-0n` vs `S-Mn`) nên ít nhầm hơn, nhưng vẫn nên loại trừ |
| `sendkeys.ps1` (không phải mã ID) | `spikes/SP-0-gui-harness/README.md#3-cach-tai-su-dung-3-script-trong-sp-3-sp-7-sp-11` vs `spikes/SP-0-gui-harness/REPORT.md#4-rui-ro-moi-phat-hien` | README nói script tự tạm dừng IME và bypass foreground lockout bằng Alt-pulse; REPORT §4 nói đã gỡ cả hai (đính chính tại SP-18). Cần chốt bản nào đúng với `src/sendkeys.ps1` |
| Phụ lục A.3.4 | `spikes/SP-0-gui-harness/REPORT.md#2-tac-dong-len-adr-prd` vs PRD | PRD có A.3 nhưng không có heading A.3.4 riêng; tham chiếu không tìm thấy (mức thấp) |

Không phát hiện mã trùng khác nội dung giữa 5 spike của nhóm A với nhau. FR-NT-03/06, FR-CF-01,
FR-UD-01/02, FR-AG-05/10/11, FR-AP-02/04, FR-INT-04, FR-PET-02, NFR-PF-01/04/05, US-2.1/AC3, release
criteria #7: khớp nội dung PRD.

### Việc còn treo cho controller

- Gộp `scratchpad/harvest-a/risks-a.md` (19 dòng + 4 BỎ) vào `docs/spec/risks.md`, cấp ID.
- Chốt quy ước New/Modified cho miền chỉ có Purpose (nhóm A dùng Modified) để đồng bộ giữa các nhóm.
- Quyết định về 4 xung đột ID trên (đặc biệt tiền tố `R-`/`S-` với `id_prefixes`).
- Chạy `spec-check.mjs evidence` khi controller gộp xong.

Status: DONE_WITH_CONCERNS
Summary: Đã tạo 5 change nháp (req-001 lite; req-002..005 design) với proposal.md đầy đủ theo khung
template, 161/161 trích dẫn `spikes/...#slug` kiểm máy hợp lệ, 22 câu hỏi mở, 19 dòng rủi ro trong scratch;
validate chỉ báo lỗi "chưa có delta spec" như brief dự kiến.
Concerns/Blockers: (1) Tiền tố `R-`/`S-` của corpus SP-2/SP-4 trùng `id_prefixes` của PRD — cần quyết
định trước khi chạy RTM; (2) SP-2 trích ADR-001/002 sai nội dung và SP-4 trích E9 sai nội dung — cần
người quyết định chốt, không tự sửa; (3) quy ước Modified-cho-miền-chỉ-có-Purpose là lựa chọn của nhóm A,
cần đồng bộ liên nhóm.
