# F13 — Pet-agent & persona

Đọc trước: README.md §1, §3, §4, §5 (**Q-OQ-3 persona chưa chốt**). Worktree `feat/f13-pet-agent-persona`.
Phụ thuộc: F5, F6, F2 merged. Sở hữu: `packages/pet-agent` (agent + persona spec assets + ack line set).

## Mục tiêu
Pet-agent là một agent ngang hàng chỉ có 5 tool (create_job, get_job_status, cancel_job, notify_user, ask_user),
không chạm connector, hỏi một câu gộp khi thiếu thông tin then chốt; mọi text pet hiển thị do pet-agent sinh
theo persona spec song ngữ; ngoại lệ duy nhất là ack line set cục bộ hiển thị < 200 ms.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` I (pet tạo job, không chỉ huy), External Content Is Data.
- `docs/spec/capabilities/agent/spec.md`: "Pet-agent hands work over and never touches connectors"; "A job is not
  created while key information is missing"; "Every model request resolves through the routing table" (pet text vs
  pet image theo input shape); "The pet-agent's own tools take the same path".
- `docs/spec/capabilities/pet/spec.md`: "All pet-visible text originates from the pet-agent" (ngoại lệ ack line set:
  chỉ xác nhận đã nhận, không nêu entity, không hứa kết quả; fallback language); "The pet acknowledges a handed-over
  command before any model answers" (200 ms, working state, no provider → không ack).
- `docs/spec/capabilities/uix/spec.md`: "Agent-generated text follows the conversation" language; ACK card trước khi
  job tồn tại.
- PRD `docs/raw-idea/prd-mvp.md` FR-AG-01, FR-AG-05, FR-PET-10, US-1.4, WF-2 bước 3, Phụ lục A.2 (ACK/RESULT do
  persona; APPROVAL dữ liệu cứng không qua LLM), §19 OQ-3.
- `docs/spec/changes/req-024-pet-pack-framework/` — `contracts/pet-pack-manifest.md/.schema.json` (persona
  specification schema: name, languages, talkativeness, acknowledgement lines, bounded description) — F13 dùng schema
  này cho persona mặc định; F23 làm pack framework.
- `docs/spec/changes/req-017-provider-matrix/` — `design.md` Acknowledgement presenter; `clarifications.md` phạm vi ack.
- Spike: `spikes/SP-17-provider-matrix/REPORT.md` Q2 (text median 1.958 ms, vision 6.655 ms → ack cục bộ),
  `spikes/SP-6-pi-sdk/REPORT.md` Q1.
- `docs/spec/risks.md`: RISK-007.

## Phạm vi (in)
- Persona spec mặc định theo schema pet-pack: **draft** tên, tính cách, giọng vi + en, talkativeness, ack line set vi/en
  — đánh dấu `[Đề xuất — chờ PO chốt OQ-3]` trong asset; đưa cho người dùng duyệt trong plan trước khi implement.
- Pet-agent session (F5) với đúng 5 tool internal qua factory; system prompt = persona + quy tắc: phân tích lệnh
  (text + ảnh), đủ thông tin then chốt (database đích, đối tượng) → `create_job`; thiếu → một `ask_user` gộp, không
  tạo job; sinh text ACK/RESULT/ERROR theo persona và ngôn ngữ hội thoại; **không** diễn đạt lại dữ liệu APPROVAL.
- `notify_user`: đẩy card RESULT/ERROR ≤200 ký tự vào F19 queue qua Job Manager event.
- Route model: text → pet text role, có ảnh → pet image role (F6); pet image trống → composer đã chặn (F19).
- Ack presenter: chọn dòng từ ack line set theo ngôn ngữ UI, fallback language; không gọi mạng; phát ngay khi gửi;
  không ack khi không role usable.
- Provider lỗi khi pet cần nói → sự kiện SYSTEM card (F6 classification), không text bịa.
- Conversation history record (lệnh, câu hỏi lại, phản hồi, job link) → store cho F21.

## Ngoài phạm vi
Worker loop (F12), card UI (F19), pet pack import/library (F23), persona thay thế.

## Tiêu chí hoàn thành
1. Mọi scenario agent/pet spec thuộc F13 có test pass.
2. Enumerate tool của pet session = đúng 5, bất kể số connector.
3. Lệnh mơ hồ (3 database, không default) → 1 ask gộp, không job; trả lời → tạo job không hỏi thêm.
4. Ack hiển thị < 200 ms (đo trong Electron, ghi số); provider chậm 8 s → ack vẫn đúng hạn, pet working.
5. Review ack line set: không dòng nào nêu entity/lệnh/kết quả (test lexical + review tay).
6. Report ghi rõ persona là draft chờ OQ-3, kèm điểm cần PO quyết.
