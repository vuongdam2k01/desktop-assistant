# F10 — Backend slice: Sign-In, allowlist, OAuth broker, health, version feed

Đọc trước: README.md §1, §3, §4, §5 (OQ-11, OQ-8). Worktree `feat/f10-backend-slice`. Phụ thuộc: F0 merged.
Sở hữu: `apps/backend` (trừ `src/replication` thuộc F22).

## Mục tiêu
Backend là peer service production-grade nhưng phạm vi hẹp: verify Google ID token → JWT access/refresh,
allowlist closed beta, device/session, OAuth broker tổng quát theo provider descriptor (không lưu token), rate
limit trước session guard, health kiểm DB, version check + static update feed, secret manager, backup, account
deletion (server side). Không chạy logic job.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` VII (backend không thực thi job, không dùng nội dung ngoài replication), VIII.
- `docs/spec/capabilities/backend/spec.md` — toàn bộ **trừ** 5 requirement thuộc F22 (encrypted at rest, key access
  confined, device registry, serves replication, update manifest per OS/arch thuộc F24): authentication Google →
  session; allowlist; brokers any provider; never executes job logic; every endpoint authenticated + TLS; version
  checks + static manifest; observable & resists abuse; account deletion removes records; secrets in manager + rotated;
  backup + restore proven; availability + load; auth/broker store 4 bảng; broker retains no credential; refresh token
  hash only; exchange bound to session + single-use state; outage blocks only sign-in/authorisation/version/replication;
  deleting account withdraws connector authorisations.
- `docs/spec/changes/req-020-backend-slice/` — `proposal.md`, `design.md`, `model.md`, `clarifications.md`,
  `contracts/client-session-api.md/.openapi.yaml/.sql`, `contracts/authorisation-broker-api.md/.openapi.yaml`,
  `contracts/authorisation-provider-descriptor.md/.schema.json`, `contracts/public-service-endpoints.md/.openapi.yaml`.
- `docs/spec/changes/req-016-signing-update/contracts/update-feed.*`, `req-023-macos-platform-baseline/contracts/update-feed.*`
  (feed per OS/arch — F10 serve tĩnh, F24 publish).
- PRD `docs/raw-idea/prd-mvp.md` §10.8 FR-BE-01..12, §11.5 NFR-BE, §12.2, §14.3.
- Spike: `spikes/SP-20-backend-slice/REPORT.md` (Q1 sign-in + allowlist, Q2 guard, Q3/Q6 broker + refresh thật,
  Q4 dump 4 bảng, Q5 loopback, Q7 secret scan, Q8 health + rate limit, Q9 200 kết nối, Q11 outage).
- `docs/spec/risks.md`: RISK-009, 010, 060, 062, 067.

## Phạm vi (in)
- Fastify + TS + PostgreSQL; composition root `src/app.ts` một dòng/plugin; migrations; docker-compose dev.
- Schema đúng 4 bảng: `account(google_sub, email, status)`, `device`, `session(refresh_token_hash, expiry, device)`,
  `invite_allowlist`; kiểm tra tự động dump schema không có bảng khác (test).
- `POST /v1/auth/google`: verify ID token (Google certs), allowlist gate (rỗng → refuse như uninvited; không lộ tồn
  tại account), tạo/ghép account + device (cùng device sign-in lại = 1 device), phát access ngắn + refresh dài;
  `POST /v1/auth/refresh` (hash so khớp, revoked/expired → refuse phân biệt lý do); `POST /v1/auth/logout` revoke
  device đó; invite withdrawn → không renew.
- Broker: provider descriptors (Notion, Google) load lúc start; thiếu secret → từ chối serve provider đó và log;
  `GET /v1/oauth/{provider}/authorize-url` phát state opaque gắn session, single-use; `POST /v1/oauth/{provider}/exchange`
  (state absent/unknown/used/other-session → refuse trước khi gọi provider; token trả về response, không ghi
  store/cache/log); `POST /v1/oauth/{provider}/refresh`; PKCE khi descriptor cho; body vs header auth theo descriptor;
  provider không cấu hình → refuse nêu tên.
- Rate limit per source class trước session guard; refusal nêu retry-after, phân biệt với auth fail.
- `GET /v1/health` (kiểm DB, unhealthy khi mất), `GET /v1/app/version`, static feed `/updates/{os}/{arch}/latest.yml`
  + installer + blockmap với HTTP Range (206).
- Admin tối thiểu allowlist (CLI hoặc endpoint bảo vệ).
- Account deletion endpoint: xoá 4 bảng records, gọi revoke từng provider (ghi kết quả; provider không có endpoint →
  trả danh sách user phải tự thu hồi); hook cho F22 xoá replication data.
- Secrets từ secret manager/env; logger redaction; script secret scan trong CI; runbook rotation.
- Backup daily + restore rehearsal script; load test script (k6/autocannon) 2× beta trên infra tương đương (ghi kết
  quả dev machine là evidence, không phải threshold).

## Ngoài phạm vi
Replication store, key custody, device registry serve (F22); ký/publish artefact (F24); UI.

## Tiêu chí hoàn thành
1. Mọi scenario backend spec thuộc F10 có test pass (unit + integration với Postgres docker).
2. Dump store sau chạy full flow: chỉ 4 bảng, không token/command/transcript.
3. Provider thứ hai thêm bằng descriptor: 0 dòng code broker đổi.
4. Secret scan CI sạch; log không chứa token/secret (test grep).
5. Dừng backend giữa job mô phỏng ở client test → job tiếp tục (kiểm chứng lại khi F7 merge).
6. Report nêu OQ-11 (infra/region) và OQ-8 chưa chốt; số đo load dev machine trích SP-20.
