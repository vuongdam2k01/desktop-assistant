# F22 — Account sync: replication, store descriptors, device registry, enrolment

Đọc trước: README.md §1, §3, §4, §5 (**req-022 blocked: 4 câu hỏi + chưa có spike**). Worktree `feat/f22-account-sync`.
Phụ thuộc: F1, F3, F10 merged (F21-C song song). Sở hữu: `packages/sync-client`, `apps/backend/src/replication`;
điểm nối: `ledger-store`, `credential-store` (đăng ký store descriptor).

## Bước 0 bắt buộc
Trước khi implement, chạy **spike sync** nhỏ (thư mục `spikes/SP-23-account-sync/` theo mẫu REPORT.md hiện có) đo:
enrolment từ sign-in alone trên device thứ hai, append-and-reconcile hai device offline, ordering theo device
sequence khi clock lệch, revocation latency, encrypted store throughput. Trình kết quả và xin quyết định 4 câu hỏi
`docs/spec/changes/req-022-account-sync/clarifications.md` trước khi viết mã sản phẩm. Nếu người dùng chấp nhận
UNVERIFIED, ghi rõ trong report.

## Mục tiêu
Dữ liệu thuộc tài khoản: jobs, ledger + snapshot, rules, config, connector authorisation (kể cả BYO client),
transcripts replicate mọi device; sign-in alone khôi phục; local store vẫn là bản làm việc; job chỉ chạy trên device
tạo; conflict theo rule store khai báo; device registry + revoke server-side; lease cho authorisation replicate;
backend giữ khoá service-managed với key custody tách biệt và audit.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` VII (toàn văn + rationale), III.
- `docs/spec/capabilities/sync/spec.md` — toàn bộ 12 requirement.
- `docs/spec/capabilities/backend/spec.md`: encrypted at rest; key access confined + audited; device registry; serves
  replication without executing; account deletion destroys replicated data + keys; backup encrypted.
- `docs/spec/capabilities/ledger/spec.md`: append-only across replicas; device id + sequence; superseded version
  record; retention across devices. `capabilities/connector/spec.md`: connecting connects for the account; lease
  expired state; disconnect reaches offline device. `capabilities/platform/spec.md`: unreadable credential replaced
  from account; replication material; erase on sign-out. `capabilities/agent/spec.md`: routing table replicates,
  credentials not. `capabilities/approval/spec.md`: counts span devices; decision on another device.
- `docs/spec/changes/req-022-account-sync/` — `proposal.md`, `design.md`, `model.md`, `clarifications.md` (Q-1..Q-5),
  `contracts/replication-protocol.md/.openapi.yaml/.sql`, `contracts/replicated-store-descriptor.md/.schema.json`,
  `contracts/device-registry.md/.openapi.yaml`, `specs/*/spec.md`.
- PRD changelog v2.2 (`docs/raw-idea/prd-mvp.md` §20).
- `docs/spec/risks.md`: RISK-009, 010, 062–070 (đọc kỹ 062, 063, 065, 066, 068).

## Phạm vi (in)
- Store descriptor registry: mỗi store replicate khai identity, version, conflict rule (`append-and-reconcile` cho ledger,
  transcripts, jobs; `last-writer-wins-preserve-superseded` cho rules/config/routing/connector auth), ordering basis
  (device_seq), retention; store không khai → refuse. F1/F3/F6/F4 đăng ký descriptor tại điểm nối.
- Client: handshake → pull (cursor resumable) → push (batch, idempotent) → device stream; enrolment từ sign-in (resumable,
  không hiện partial như complete; account rỗng → complete); background scheduler không cần user trigger; fail lặp →
  báo "out of step" không chặn công việc; local write luôn trước, replicate sau.
- Conflict: append-and-reconcile (record trùng → reconcile là một, không append hai; record "replace" → giữ cả hai);
  mutable LWW theo thứ tự backend nhận + append superseded version vào ledger (F1); rule mới dùng ngay.
- Replication material (per device) trong F3; lease refresh mỗi lần replicate thành công, hết hạn → connector
  "unavailable on this device"; revoke nhận được → dừng ngay.
- Job: chỉ device tạo thực thi; device khác xem state/ledger; approval/ask answer từ device khác → decision replicate →
  device giữ suspension resume; creating device offline → job hiện "interrupted", không device nào resume.
- Sign-out/revoke: erase account data + material (F3 erasure, F1 store), resumable; unreplicated work → xác nhận trước.
- Backend `src/replication`: encrypted store tách bảng auth; key custody service tách khỏi request handler, chỉ path
  replication gọi, least privilege, audit record mỗi access (không ghi audit → không access); device registry serve +
  revoke enforce; account deletion huỷ data + keys; backup chứa ciphertext; cross-account isolation.
- Retention/deletion replicate (xoá ledger trên device này → mọi device + backend; device offline khi expiry → xoá khi
  quay lại, không replicate ngược).
- Test: hai device giả lập (hai data dir) + backend docker: enrolment, offline dual append, clock skew ordering, revoke
  offline device, lease expiry, deletion propagation, cross-account refusal, audit record bắt buộc.

## Ngoài phạm vi
Sharing giữa account, server-side search, web client, cross-device locking, UI (F21-C dùng API).

## Tiêu chí hoàn thành
1. Spike SP-23 có REPORT và quyết định 4 câu hỏi được ghi lại (hoặc chấp nhận UNVERIFIED).
2. Mọi scenario sync spec + backend/ledger/connector/platform thuộc F22 có test pass.
3. Device thứ hai sign-in → jobs/ledger/rules/config/connector connected, không hỏi passphrase/file/device cũ.
4. Hai device offline append → hợp nhất đầy đủ, không mất, cùng thứ tự dù clock lệch.
5. Đường decrypt ngoài replication path bị từ chối và có audit (test); dump DB không đọc được nội dung.
6. Report ghi rõ RISK-062/063 là ranh giới vận hành đã chấp nhận.
