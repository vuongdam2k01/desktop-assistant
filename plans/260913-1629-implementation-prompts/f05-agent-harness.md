# F5 — Agent harness & tool wrapping factory

Đọc trước: README.md §1, §3, §4, §5 (req-025 role key). Worktree `feat/f05-agent-harness`.
Phụ thuộc: F2, F4 merged (F6 song song; F5 dùng interface provider của F6 qua `packages/contracts`, tích hợp khi F6 merge).
Sở hữu: `packages/agent-harness`; điểm nối: tooling build check harness pin.

## Mục tiêu
Nhúng pi agents SDK đúng identity/version; **một** wrapping factory là đường duy nhất đưa tool vào agent: ledger
intent → gate → execute → ledger result; session cô lập; pause/resume dựa trên transcript durable; transcript lưu
account-owned; refusal là kết quả, không phải exception.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` I, II, III, V.
- `docs/spec/capabilities/agent/spec.md`: "Every worker tool is wrapped by the gate and the ledger obligation";
  "Tools reach the harness only through the wrapping factory"; "Each harness session holds its own state"; "A
  resumed run continues at its suspension point"; "harness pinned to one package identity"; "Connector tools return
  structured content and details arrays"; "Attached screenshots discarded when job ends".
- `docs/spec/capabilities/approval/spec.md`: "A held call suspends the job durably", "A denied call returns as a
  refusal", "Every verdict decided outside any model".
- `docs/spec/capabilities/ledger/spec.md`: writing precedes operation; one call = two records.
- `docs/spec/changes/req-007-pi-sdk-harness/` — `proposal.md`, `design.md`, `model.md`, `impact.md`, `clarifications.md`
  (no trusted-tool exception; transcript là state), `contracts/tool-wrapping.md/.schema.json`,
  `contracts/agent-session.md/.schema.json`, `contracts/provider-profile.md/.schema.json`.
- `docs/spec/changes/req-025-pi-agent-system/proposal.md`, `impact.md` — để role identifier là registry key (string)
  và session có chỗ cho lineage, tránh union đóng; **không** implement req-025.
- `docs/spec/changes/req-022-account-sync/` — transcript replicate (store descriptor).
- Spike: `spikes/SP-6-pi-sdk/REPORT.md` toàn bộ (Q1 no default tools, Q2 wrapper không phụ thuộc interception,
  Q3 pause/resume hai chế độ, Q4 ba session cô lập, Q5 provider không interactive sign-in, Q9 + §6 package identity,
  §4 namespace tương tự), `spikes/SP-8-rule-ir-hardgate/REPORT.md` Q2 (11 đường bypass), `spikes/SP-4-agent-loop/REPORT.md`
  Q5 (result shape).
- `docs/spec/risks.md`: RISK-014, 031, 032.

## Phạm vi (in)
- Dependency pi SDK đúng identity/version SP-6 §6; build check F0 (a) hoạt động với pin này.
- `createWrappedTool({origin: connectorId | 'internal', declaration, implementation})`: closure giữ implementation
  private; luồng: F1 `appendIntent` (fail → job fail, không fabricate) → F4 `evaluate` (allow → execute; hold →
  suspend; refuse → refusal result + ledger blocked record) → execute qua F8 coordinator khi có (F5 để interface) →
  F1 `appendResult`. Trả `{content:[{type:'text',text}], details}`.
- `createSession({role, tools: WrappedTool[], transcriptStore})`: từ chối tool không phải factory output; không
  đăng ký coding tool mặc định; session rỗng nếu không tool; role là string key.
- Session isolation: transcript, tool set, suspension riêng; không singleton process-wide (lý do cấm distribution
  thay thế).
- Suspend/resume: khi hold, ghi các turn đã xong vào transcript store (account-owned, F1 hoặc store riêng theo
  descriptor req-022) **trước** khi báo job waiting; resume từ memory hoặc rebuild từ transcript, không lặp tool đã
  xong; cancel sau suspend → decision tới không execute, không rebuild.
- Provider adapter interface: nhận `resolvedProfile` từ F6 (endpoint, credential handle, model) — F5 không giữ
  credential, chỉ gọi F3 trong main.
- Image lifecycle: giữ ảnh trong memory tới terminal state rồi giải phóng.
- Test: port 11 đường bypass SP-8 Q2 + Q2/Q3/Q4 SP-6 thành vitest; test "interception facility không cấu hình" vẫn
  refuse giống hệt; test alternative distribution → build fail.

## Ngoài phạm vi
System prompt worker/pet (F12/F13), routing (F6), coordinator (F8), UI.

## Tiêu chí hoàn thành
1. Mọi scenario agent spec thuộc F5 có test pass.
2. Đếm tool trong session bất kỳ: 100 % là wrapped; construct session với tool thô → throw.
3. 3 session song song với secret riêng → không rò chéo transcript/request.
4. Pause/resume hai chế độ: read trước không lặp, write approve chạy đúng 1 lần.
5. Ledger write fail → tool không chạy, job fail với lý do đó.
6. Report ghi rõ số đo trong Electron so với plain runtime (verification task của req-007).
