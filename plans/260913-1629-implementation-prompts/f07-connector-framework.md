# F7 — Connector framework: manifest, adapter, tool generator, connect flow

Đọc trước: README.md §1, §3, §4, §5. Worktree `feat/f07-connector-framework`. Phụ thuộc: F3, F5, F10 merged.
Sở hữu: `packages/connector-framework`; điểm nối: composition root main; connector registry (file một dòng/connector).

## Mục tiêu
"Connectors are data": manifest khai báo mọi hành vi đặc thù nền tảng, adapter đúng 4 operation, tool sinh từ
manifest của connector đang connected và bọc bởi F5; connect flow chuẩn qua broker backend; state hỏi platform;
disconnect revoke + erase. Thêm nền tảng thứ N = manifest + adapter + một dòng đăng ký.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` IV, VI, VIII.
- `docs/spec/capabilities/connector/spec.md` — phần framework: manifest định nghĩa connector; connecting is the same
  for every connector; only enabled scope requested + scope profiles; state visible & recoverable; tool set from
  connected only; gate & ledger uniform; disconnect revokes and erases; one job several connectors; MCP-compatible
  interfaces; BYO route first-class (khai báo trong manifest, runtime ở F11); connecting connects for the account;
  authorisation persisted only via credential store; loopback redirect; product client holds no secret; reached only
  through four adapter operations; failure only as declared error code; state established by asking platform;
  snapshot exclusions declared; manifest loaded whole or not at all; write tool declares resources (F8 dùng).
- `docs/spec/capabilities/approval/spec.md`: "declarations the gate reads come from the manifest".
- `docs/spec/changes/req-019-connector-framework/` — `proposal.md`, `design.md`, `model.md`, `evolution.md`,
  `contracts/connector-manifest.md/.schema.json` (1.0.0), `contracts/connector-adapter.md/.schema.json` (1.0.0).
- `docs/spec/changes/req-015-concurrency-coordinator/contracts/connector-manifest.*` (1.2.0 — version cao nhất,
  thêm coordination-declaration), `req-003-notion-compensation/contracts/connector-manifest.*` (1.1.0),
  `req-001-mvp-product-definition/contracts/connector-manifest.*` (0.1.0).
- `docs/spec/changes/req-020-backend-slice/contracts/authorisation-broker-api.md/.openapi.yaml` (client side của
  broker), `req-012-secure-storage/specs/connector/spec.md`, `req-022-account-sync/specs/connector/spec.md`
  (account-scoped, lease — F7 để hook; F22 implement).
- Spike: `spikes/SP-19-connector-framework/REPORT.md` (Q1 manifest validate, Q3 zero core change, Q4 exclusions,
  Q5 irreversible default, Q8 scope profiles, Q9 status 4 trạng thái, Q10 error codes, Q11 MCP; core-diff-report),
  `spikes/SP-20-backend-slice/REPORT.md` Q5 (loopback 3 thao tác), `spikes/SP-9-undo-agent/REPORT.md` §2.
- `docs/spec/risks.md`: RISK-058, 059.

## Phạm vi (in)
- Manifest loader: validate theo `connector-manifest@1.2.0`; whole-or-nothing; major cao hơn → từ chối nêu version
  app cần; write tool `is_reversible:true` thiếu formula → từ chối; snapshot structured thiếu exclusions → từ chối;
  profile cấp scope không tool dùng → từ chối; tool thiếu reconciliation → coi effect không read back.
- Adapter interface đúng 4 ops (`execute`, `snapshot`, `status`, `revoke`); mọi thất bại là `ConnectorError{code,
  retryable}` theo bộ code contract; không code → "unclassified adapter defect", không retry.
- Tool generator: từ manifest của connector **connected**, sinh tool implementation gọi adapter.execute qua dispatch
  hook (F8 cắm sau; khi chưa có, gọi trực tiếp nhưng qua một interface duy nhất), bọc bằng F5 factory với
  declaration (writes, irreversible, permission change, snapshot method, exclusions, resources, unrecallable effects);
  tool description MCP-shape với safety annotations.
- Connect flow (product client): gọi F10 `authorize-url` (state binding) → mở system browser → listener loopback
  (cổng động; không mở được → fail trước browser) → nhận code, discard state không khớp → F10 `exchange` → lưu qua
  F3 (token, refresh, expiry, scopes granted, profile, platform metadata) → connected; abandon/timeout → disconnected
  không partial; refusal → hiện lý do. Backend unreachable → fail "service unavailable", không fallback device-side.
- Status service: hỏi platform qua adapter.status → accepted / expired(renewable?) / insufficient / withdrawn /
  unreachable(last known) / unavailable-on-device (hook F22).
- Renew: refresh qua broker (F10) hoặc device-side theo manifest; lưu lại qua F3; ledger record "refresh happened"
  không mang token.
- Disconnect: revoke nếu manifest khai; erase prefix (F3) ; fail job đang dùng (F2); báo withdrawn vs removed-only.
- Scope comparison: granted < requested → "needs wider permission", tool thiếu scope không sinh; re-consent flow.
- Connector registry: `connectors/index.ts` một dòng/connector; F9/F11 thêm dòng.
- Test: manifest fixture giả (hai connector shape khác nhau) chứng minh core không branch theo tên; diff core khi
  thêm connector thứ 2 = 0.

## Ngoài phạm vi
Lock/queue (F8), Notion/Google adapter (F9/F11), BYO runtime & guide surface (F11/F21), UI connectors area (F21-A),
replication (F22).

## Tiêu chí hoàn thành
1. Mọi scenario connector spec thuộc F7 có test pass.
2. Manifest 9 tool đúng + 1 sai → connector không tool, báo tên tool; connector khác vẫn chạy.
3. Connect flow chạy thật với F10 (provider test/mock server chỉ ở test, không ở product) 3 thao tác, không hỏi
   token/client id/redirect.
4. Tool set chỉ chứa connector connected; disconnect → job mới không nhận tool.
5. Thêm connector fixture thứ hai: 0 dòng đổi ngoài manifest + adapter + 1 dòng registry (script kiểm diff).
