# F11 — Google connectors qua BYO OAuth client (Gmail chỉ đọc, Drive chỉ đọc)

Đọc trước: README.md §1, §3, §4, §5 (BYO ship từ bản đầu). Worktree `feat/f11-google-byo-oauth`.
Phụ thuộc: F7, F8, F3, F21-A merged. Sở hữu: `connectors/google`; điểm nối: connector registry; component BYO steps
trong `renderer-app` connectors area.

## Mục tiêu
Gmail và Drive chỉ đọc, kết nối bằng OAuth client **của người dùng** (đường email duy nhất khi CASA hoãn):
loopback port động, exchange trên device không qua broker, guide từng bước trong app, so scope mỗi consent,
expired giữ client + reconnect một bấm, client là dữ liệu account.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` VII, VIII (BYO là luồng chính thức trong app).
- `docs/spec/capabilities/connector/spec.md` — Gmail read-only; message content only when needed + disclosure; Drive
  read-only; read-only connectors honour user rules; BYO route first-class; Google authorises with user-created
  client; device chooses loopback port; supplied client checked before browser; consent granting less does not
  present as connected; account not admitted reported as client restriction; refused renewal is expired not lost;
  reconnect never asks file again; client belongs to account; Drive file read by declared route; file exceeding
  ceiling refused; never-exercised capability absent.
- `docs/spec/capabilities/app/spec.md` — "bring-your-own setup runs as ordered steps"; "setup states what it will
  cost before the first step". `docs/spec/capabilities/uix/spec.md` — connector stopped working → SYSTEM card.
- `docs/spec/changes/req-014-byo-oauth-google/` — `proposal.md`, `design.md`, `model.md`, `clarifications.md`,
  `contracts/byo-authorisation-client.md/.schema.json`, `contracts/byo-setup-guide.md/.schema.json`,
  `contracts/drive-content-projection.md/.schema.json`, `specs/connector|app|uix/spec.md`.
- PRD `docs/raw-idea/prd-mvp.md` §10.11 FR-GM/FR-DR, §13.2, §13.3, §13.6, §13.7 (CASA), FR-CF-11.
- Spike: `spikes/SP-13-byo-oauth-google/REPORT.md` (Q1 loopback + đọc thật, Q2 port động RFC 8252, Q3 renewal 7 ngày,
  Q5 consent từng scope + access denied, Q6 export/download 30 MB, Q7 guide), `evidence/byo-setup-guide-draft.md`,
  `evidence/q1_loopback_run.log`, `evidence/q2_dynamic_ports.log`, `evidence/ui_scope_consent.svg`.
- `docs/spec/risks.md`: RISK-012, 013.

## Phạm vi (in)
- Manifest `connectors/google/manifest.json` (1.2.0): hai capability groups mail-read, drive-read; scope profiles
  (BYO: `gmail.readonly` + `drive.readonly`; mass-market profile `drive.file` khai sẵn nhưng không kích hoạt); BYO route
  availability + guide descriptor + lifetime caveat; tools chỉ đọc (list/search messages, get message, list labels;
  find files, get metadata, read content) — **không** tool write; không tool cho capability chưa exercise.
- Adapter: Gmail API, Drive API; Drive content projection theo route per type (Docs/Sheets/Slides export → text
  form; stored → download); ceiling 20 MB download (product decision, ghi UNVERIFIED cho export ceiling); unsupported
  type → báo tên; size unknown → dừng tại ceiling.
- BYO runtime: nạp credential JSON → validate desktop-kind + client_id/secret có mặt (sai → báo bước guide) → lưu qua
  F3 theo prefix connector, xoá file gốc khỏi retention → Connect: acquire port loopback động → mở system browser
  dưới client user → nhận code → exchange **trên device** với provider token endpoint → lưu token/scopes granted; so
  granted vs requested → thiếu → "needs wider permission", tool thiếu không sinh, offer re-consent; account không
  trong test users → giải thích + bước guide; ghi account thực sự được cấp.
- Renewal refused → expired kèm instant + reason provider, giữ client; reconnect = consent only; client mất → guide
  từ bước file; abandon → giữ expired.
- Disclosure Limited Use khi connect Gmail; không background index (chỉ fetch trong job).
- Guide surface: component React trong connectors area render `byo-setup-guide` descriptor: preamble (số bước, warning
  screen, re-consent 7 ngày), 6 bước console + 2 bước app, mở link system browser, xác nhận từng bước, resume vị trí
  sau khi đóng cửa sổ, lỗi file hiện tại bước đó.
- Không request nào mang client_id/secret của user tới backend (test).

## Ngoài phạm vi
Ghi Gmail/Drive, central client + CASA, attachment nặng, replication client (F22 chỉ cần class descriptor từ F3).

## Tiêu chí hoàn thành
1. Mọi scenario Google/BYO trong connector/app/uix spec có test pass.
2. Integration thật với Google Cloud project test (credential env CI): connect, đọc mail, export sheet, download
   file, consent thiếu scope, port bị chiếm → port khác.
3. Backend tắt → BYO connect vẫn hoàn tất.
4. Diff core = 0 ngoài `connectors/google` + registry + component guide.
5. Report nêu UNVERIFIED (refusal chính xác sau 7 ngày, export ceiling, managed org) và quyết định ship BYO từ đầu.
