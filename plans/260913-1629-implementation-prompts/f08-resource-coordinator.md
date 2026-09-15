# F8 — Resource coordinator: khoá đối tượng, hàng đợi công bằng, admission

Đọc trước: README.md §1, §3, §4, §5. Worktree `feat/f08-resource-coordinator`. Phụ thuộc: F7 merged (F2 cho admission).
Sở hữu: `packages/resource-coordinator`; điểm nối: dispatch hook trong `connector-framework`.

## Mục tiêu
Một coordinator mỗi process, mọi platform call đi qua: lease exclusive theo key chuẩn, lấy toàn bộ set một lần
theo thứ tự canonical, timeout 15 s → error code resource-held; exclusive span từ đọc before-state tới result
durable; approval chờ người thì release rồi re-acquire + re-check; dispatcher fair round-robin per job + token
bucket per authorisation; admission cap per connector account.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` III, IV.
- `docs/spec/capabilities/connector/spec.md` — 6 requirement coordinator: every platform call passes through one
  coordinator; resource named by normalised key `<connector>:<type>:<identifier>`; write tool declares resources or
  manifest refused; requests under one authorisation dispatched fairly; a call obtains every resource at once in
  fixed order; call refused rather than made after wait limit.
- `docs/spec/capabilities/ledger/spec.md` — "before state captured under exclusive access", "call whose recorded
  before state no longer matches does not execute".
- `docs/spec/capabilities/job/spec.md` — parallel limit per connector account, resource-held transient retry.
- `docs/spec/changes/req-015-concurrency-coordinator/` — `proposal.md`, `design.md` (Lease table, Wait list, Key
  deriver, Dispatcher, Admission pool), `model.md`, `impact.md`, `clarifications.md` (Q-1 approval ngoài span,
  Q-2 key không qualify authorisation, Q-3/Q-4 cap dùng `queued`, Q-5 weights), `contracts/resource-coordinator.md/.schema.json`,
  `contracts/coordination-declaration.md/.schema.json`, `contracts/connector-manifest.*` (1.2.0).
- Spike: `spikes/SP-15-concurrency/REPORT.md` (Q1 LWW platform, Q2 dirty snapshot, Q3 4.251 → 252 ms, Q4 3/5/8 job,
  §3 item 1 lock manager 15 s, §4 deadlock), `spikes/SP-15-concurrency/evidence/q2-dirty-snapshot.json`.
- `docs/spec/risks.md`: RISK-049, 050.

## Phạm vi (in)
- `Coordinator` singleton trong main process; F7 dispatch hook là **đường duy nhất** tới `adapter.execute`/`snapshot`
  (F7 gỡ đường gọi trực tiếp khi F8 merge; test chứng minh không còn route khác).
- Key deriver: đọc `coordination-declaration` của tool (argument paths + type + normalisation rule) → keys; read
  tool không khai; write tool khai sai path → manifest refused (đưa check vào loader F7 qua hook validate).
- Lease table: exclusive, reentrant trong job; `acquireAll(keys sorted)` all-or-none; không acquire thêm sau khi bắt
  đầu (refuse nêu lý do); wait ≤ 15 s (config) → `RESOURCE_HELD{holderJobId}`; ghi vào outcome là coordinator
  refusal, không phải platform failure.
- Exclusive span API cho F5 wrapper: `beginWrite(keys)` → đọc snapshot → intent record → verdict; nếu hold → `release`
  ; khi approve → `reacquire` + so before-state với intent record (F1) → khác → refuse ghi lý do; allow → execute →
  result durable → `release`. Crash khi giữ lease → khởi động không còn lease (in-memory).
- Dispatcher per authorisation: per-job queues round-robin có weight/floor (default từ SP-15 khuyến nghị, cấu hình,
  ghi UNVERIFIED), token bucket theo rate manifest khai; 429 với Retry-After → toàn queue authorisation chờ; không
  Retry-After → backoff tăng tới ceiling; authorisation khác không ảnh hưởng.
- Admission pool: cap per connector account (default 4, reserved 1 cho job người dùng), F2 hỏi trước khi
  `running`; waiting giải phóng.
- Coordinator unavailable/shutting down → call không tới platform, job fail lý do đó, không fallback.
- Test: tái hiện Q2 dirty snapshot (không lock → sai; có lock → đúng), deadlock hai job hai connector, fairness
  bulk 15 request vs interactive 1 request, reentrancy, timeout naming holder.

## Ngoài phạm vi
Cross-device locking (F22), UI.

## Tiêu chí hoàn thành
1. Mọi scenario coordinator trong connector/ledger/job spec có test pass.
2. Không tồn tại import `adapter.execute` ngoài coordinator (lint rule + test).
3. Dirty-snapshot regression: undo job 2 không xoá công việc job 1.
4. Fairness: interactive request dispatch trong bounded số dispatch dù bulk backlog; bulk vẫn hoàn thành.
5. Report ghi số đo fairness/timeout và nêu defaults UNVERIFIED (Q-4, Q-5).
