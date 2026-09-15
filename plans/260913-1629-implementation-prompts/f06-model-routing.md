# F6 — Model provider profiles & role routing

Đọc trước: README.md §1, §3, §4, §5. Worktree `feat/f06-model-routing`. Phụ thuộc: F3 merged (F1 cho usage record).
Sở hữu: `packages/model-routing`; điểm nối: `renderer-app` settings chỉ qua IPC contract (UI thật ở F21-B).

## Mục tiêu
Người dùng tự mang provider (API key hoặc custom endpoint tương thích protocol harness hỗ trợ); bảng routing
6 role → model là cấu hình account-owned; kiểm tra capability tại lúc gán; phân loại mọi lỗi provider thành
cause + remedy; ghi usage mỗi request; response rỗng là failure.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` VII; PRD ADR-007 (`docs/raw-idea/prd-mvp.md` §14.2, FR-AG-11).
- `docs/spec/capabilities/agent/spec.md`: "Model provider and role routing are configured on the client"; "Every
  model request resolves through the routing table" (6 role đóng: pet text, pet image, worker, rule elicitation,
  undo, risk judge); "A role is assigned only to a model that declares the capabilities"; "An assignment that
  departs from a measured result says what it departs from"; "A model response carrying neither content nor an
  error is a failure"; "Every provider failure is classified"; "Every model request records what it consumed";
  "The routing table follows the account and names what this device cannot serve"; risk-judge default cheap;
  rule-elicitation pinned strong.
- `docs/spec/capabilities/uix/spec.md`: provider failure SYSTEM card (payload F6 cung cấp; render ở F19).
- `docs/spec/capabilities/app/spec.md`: usage & cost trong job detail (F6 cung cấp query).
- `docs/spec/changes/req-017-provider-matrix/` — `proposal.md`, `design.md` (Routing registry, Suitability record,
  Request dispatcher, Failure classifier, Usage accounting), `model.md`, `impact.md`, `clarifications.md`,
  `contracts/role-routing.md/.schema.json`, `contracts/provider-failure.md/.schema.json`,
  `contracts/usage-accounting.md/.schema.json`, `contracts/usage-accounting.unit-price.schema.json`.
- `docs/spec/changes/req-007-pi-sdk-harness/contracts/provider-profile.md/.schema.json`;
  `req-001-mvp-product-definition/contracts/provider-configuration.*` (lịch sử 0.1.0).
- `docs/spec/changes/req-025-pi-agent-system/proposal.md` — thiết kế role key là string trong registry, catalogue
  6 role là dữ liệu khởi tạo, để mở rộng không breaking.
- Spike: `spikes/SP-17-provider-matrix/REPORT.md` (Q1 capability, Q2 latency, Q3 routing, Q5 lỗi → system card,
  Q6 token, §4 empty stream), `spikes/SP-17-provider-matrix/evidence/system-cards.json`, `spikes/SP-6-pi-sdk/REPORT.md`
  Q5, `spikes/SP-10-risk-judge/REPORT.md` §0, `spikes/SP-2-rule-elicitation/REPORT.md` §0.
- `docs/spec/risks.md`: RISK-006, 011, 024, 054, 055.

## Phạm vi (in)
- Profile store (account-owned, replicate qua F22 sau): tên, provider kind, endpoint, danh sách model với
  capability declared (text, image input, tool calling), unit price tuỳ chọn; credential handle → F3 (không
  replicate). Không có interactive sign-in; UI contract nêu rõ điều đó.
- Routing table: đúng một assignment mỗi role; `resolve(role, inputShape) → {profile, model, credentialHandle}`;
  role thiếu → lỗi có tên role; assignment đổi giữa job → job giữ cũ (snapshot khi job start).
- Validation khi gán: capability declared; suitability record ship sẵn (đọc-only) đánh dấu model đo unsuitable cho
  elicitation/undo → không offer trong profile ship sẵn, model chưa đo → statement, chấp nhận khi confirm.
- Defaults khi lưu profile đầu: 6 role từ model của profile; 1 model không image → pet image trống + statement.
- Dispatcher: gọi provider qua adapter của F5/pi provider layer; empty response (no content, no tool call, no error)
  → failure "unusable response"; classify 6 cause (credential refused, model unavailable, quota exhausted, endpoint
  unreachable, unusable response, profile from newer build) + remedy → event cho F19 SYSTEM card (update thay vì
  thêm khi cùng profile+cause; withdraw khi sửa).
- Usage record mỗi request (job, role, profile, model, tokens in/out hoặc "not reported", duration, cost nếu có
  price, currency) → F1 store; query tổng per job per role.
- Device không có credential cho profile → role "unusable on this device", không retarget.

## Ngoài phạm vi
UI settings (F21-B), SYSTEM card render (F19), risk judge/elicitation logic (F15/F14), replication (F22).

## Tiêu chí hoàn thành
1. Mọi scenario agent spec thuộc F6 có test pass.
2. Gán model text-only cho pet image → từ chối nêu capability; sửa profile bỏ image → role báo unsatisfiable.
3. Ba lỗi provider thật (sai key, model không tồn tại, quota) chạy qua endpoint test → đúng cause + remedy; empty
   stream → failure không phải completed turn.
4. Usage: job dùng 3 role → 3 record; không price → không cost; provider không báo token → "not reported" không
   phải 0.
5. Role key là string registry; thêm role thứ 7 chỉ là dữ liệu + contract bump, không đổi type union.
