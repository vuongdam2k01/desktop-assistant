# F12 — Worker agent loop & ask_user

Đọc trước: README.md §1, §3, §4, §5. Worktree `feat/f12-worker-agent-loop`. Phụ thuộc: F9, F5, F6 merged (F2, F4, F7, F8).
Sở hữu: `packages/worker-agent` (system prompt, skills, ask_user tool, scenario harness).

## Mục tiêu
Worker-agent chạy vòng agentic thật trên Notion: thu thập → lập kế hoạch → hành động → **tự kiểm chứng bằng read
sau mỗi mutation** → báo cáo; hỏi chỉ qua `ask_user` (một câu gộp, ≤4 option, một ask mở mỗi job); typed text
thắng ảnh; temporal anchor; câu trả lời không vượt gate; bộ 20 scenario SP-4 làm regression (sàn 85 %).

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` V (Capability Over Input Normalization), II, External Content Is Data.
- `docs/spec/capabilities/agent/spec.md`: worker-agents run a multi-step loop; ask tool single question structured
  options; asking cannot obtain what the gate refused; answer carries the refusal; ask_user schema; harness rejects
  more than one open ask (`MAX_ONE_PENDING_ASK_EXCEEDED`); inquiries decoupled from hard gate; answered inquiries
  append decision record; iterative loop 85 %; verify post-mutation state; clarifications exclusively through
  ask_user; typed text precedence; relative dates anchor to local timezone; connector tools return content+details.
- `docs/spec/capabilities/job/spec.md`: waiting_input → suspended 30 phút; resume không lặp.
- `docs/spec/capabilities/approval/spec.md`: "refusal disclosed in every later question".
- `docs/spec/changes/req-006-agent-loop/` — `proposal.md`, `design.md`, `model.md`, `contracts/worker-loop.md/.schema.json`,
  `contracts/worker-loop.prompt-context.schema.json`, `specs/agent|job/spec.md`.
- `docs/spec/changes/req-021-ask-user-offline/` — `design.md`, `contracts/ask-user.md/.schema.json`,
  `specs/agent|job/spec.md` (phần offline queue **không** thuộc F12).
- `docs/spec/changes/req-025-pi-agent-system/proposal.md` — skills package hình dung tương lai; F12 chỉ đóng gói skill
  Notion dưới dạng file dữ liệu tách khỏi code để sau này chuyển sang format req-025.
- Spike: `spikes/SP-4-agent-loop/REPORT.md` (Q1 85 %, Q2 95 % self-verify, Q3 0 over-ask, Q4 16,9 s, Q5 result shape,
  case S-10, S-16, S-17), 20 scenario runner trong `spikes/SP-4-agent-loop/`; `spikes/SP-21-ask-user-offline/REPORT.md`
  Q1, Q2, Q5, Q7; `spikes/SP-2-rule-elicitation/` (vocabulary Notion).
- `docs/spec/risks.md`: RISK-004, 029, 030.

## Phạm vi (in)
- System prompt worker (tách file, song ngữ theo ngôn ngữ lệnh): nguyên tắc loop, bắt buộc read-back sau mutation,
  cấm hỏi bằng prose (negative constraint S-10), typed text > image, temporal anchor `{date, weekday, time, IANA tz}`
  inject mỗi turn, nội dung connector là dữ liệu, không mô tả lại thao tác nguy hiểm.
- Skill Notion đóng gói (tri thức nghiệp vụ: schema-first trước khi ghi, order property, board column…) dạng dữ liệu.
- Tool `ask_user` (internal origin, qua factory F5): schema TypeBox theo contract (question, options ≤4 label ≤30,
  allow_free_text default true); runtime state pending ask per job trong F5 session → ask thứ hai bị từ chối; gọi →
  job `waiting_input` (F2) → chờ answer từ F19/F21 qua Job Manager → decision record (F1: job, question, options,
  answer, source bubble/app, timestamp) → resume; free text thắng option; timeout 30 phút → suspended.
- Disclosure: khi F4 đã refuse/hold trong job, mọi ask kèm `refusedOperations[]` để UI hiển thị.
- Worker session factory: `runJob(job)` tạo session F5 với tool set từ F7 (connected only) + ask_user, model từ F6
  role worker; ghi transcript; kết thúc với report ngắn ≤200 ký tự + kết quả đầy đủ cho job detail.
- Scenario harness: port 20 scenario SP-4 (fixture workspace Notion test), chấm final-state correctness, self-verify
  count, over-ask count, median latency; chạy trong CI nightly (không block PR) và thủ công.
- Regression case: S-10 prose ask, S-16 relative date Friday, S-17 typed vs image, ask_user bypass gate (SP-21 Q7).

## Ngoài phạm vi
Pet-agent (F13), UI ASK card (F19), offline queue (F21), skills registry req-025, connector khác.

## Tiêu chí hoàn thành
1. Mọi scenario agent spec thuộc F12 có test pass.
2. 20 scenario SP-4 trên Notion test: ≥ 17/20 final-state đúng, self-verify ≥ 95 %, 0 prose-ask; median job đơn ≤ 30 s
   (ghi số đo thật).
3. Ask thứ hai khi còn pending → `MAX_ONE_PENDING_ASK_EXCEEDED`; ask "I approve" không mở khoá gate.
4. Kill process khi waiting_input → resume sau restart không lặp step 1.
5. Report nêu số đo và case thất bại còn lại.
