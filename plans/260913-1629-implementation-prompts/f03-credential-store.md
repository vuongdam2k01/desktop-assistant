# F3 — Secure credential store

Đọc trước: README.md §1, §3, §4. Worktree `feat/f03-credential-store`. Phụ thuộc: F0 merged.
Sở hữu: `packages/credential-store`; điểm nối: composition root main.

## Mục tiêu
Kho credential trên thiết bị cho token connector, credential provider model, BYO OAuth client, replication
material: mã hoá qua facility secure-storage của OS, lưu ciphertext trong file riêng của app, key namespaced,
enumerate theo prefix, xử lý unreadable, erasure atomic resumable, giá trị giải mã không rời main process.

## Tài liệu bắt buộc đọc
- `docs/spec/constitution.md` VII.
- `docs/spec/capabilities/platform/spec.md` — "Credentials are held in operating-system secure storage" (không dùng
  credential vault giới hạn kích thước hoặc hiện trong danh sách của user), "Every stored credential is addressed
  by a namespaced key", "A credential that cannot be decrypted is never returned", "readable only by the OS user
  that stored them", "A decrypted credential never leaves the process", "Erasing leaves nothing readable behind",
  "An update preserves the signing identity" (RISK-077/078).
- `docs/spec/capabilities/connector/spec.md` — "authorisation is persisted only through the device's credential
  store" (4 nhóm credential, BYO client ~400 byte).
- `docs/spec/capabilities/agent/spec.md` — provider credential trong secure storage, không replicate.
- `docs/spec/changes/req-012-secure-storage/` — `proposal.md`, `design.md` (Credential Store, Cipher Gateway, Class
  Registry, Key Parser, Erasure Runner, Restoration Coordinator), `model.md`, `clarifications.md`,
  `contracts/secure-storage.md`, `contracts/secure-storage.sql`, `contracts/credential-class-descriptor.md/.schema.json`.
- `docs/spec/changes/req-022-account-sync/` — credential connector replicate, provider credential không replicate;
  restore từ account khi unreadable.
- Spike: `spikes/SP-11-secure-storage/REPORT.md` (Windows: 1 MB capacity, per-user binding, tamper test, erasure)
  và `spikes/SP-11-secure-storage/macos/REPORT.md` (Keychain ACL, ad-hoc signing prompt — RISK-084, tên app khoá).
- `docs/spec/risks.md`: RISK-042, 043, 077, 078, 079, 084.

## Phạm vi (in)
- File SQLite riêng (không phải ledger) `credentials.db`: key, ciphertext, last_updated, class, metadata; mở
  **không** fullfsync.
- Cipher Gateway: thành phần duy nhất gọi Electron `safeStorage` (DPAPI/Keychain); không có fallback plaintext;
  secure storage không sẵn → báo lỗi và từ chối lưu.
- Key Parser: `<domain>:<category>:<identity>[:<field>]`; từ chối key không đủ domain/identity; `listByPrefix`,
  `eraseByPrefix`.
- Class Registry: descriptor đăng ký khi khởi động (connector token, provider credential, BYO client,
  replication material), khai route phục hồi (replication / account sign-in / user reconnect).
- Read API cho main process trả giá trị; IPC cho renderer chỉ trả `{present, lastUpdated}`.
- Unreadable: mark entry, báo lỗi, không trả giá trị thay thế; Restoration Coordinator gọi route của class (nối
  F22 sau; ở F3 chỉ để hook).
- Erasure Runner: ghi "erasure pending", overwrite rồi delete, hoàn tất trước khi xoá store file, resume khi khởi
  động nếu bị ngắt; API `eraseAccount`, `eraseConnector(prefix)`, `eraseAll` (uninstall hook).
- Đảm bảo nội dung không vào log/crash report (redaction test).

## Ngoài phạm vi
OAuth flow (F7/F11), replication (F22), UI (F21), provider profile logic (F6).

## Tiêu chí hoàn thành
1. Mọi scenario platform spec về credential có test pass trên Windows và macOS (CI) và Linux (safeStorage fallback
   thử nghiệm: phải báo lỗi rõ, không plaintext).
2. Entry > 2,5 KB lưu và đọc nguyên; không xuất hiện trong Credential Manager/Keychain list của user.
3. Tamper/truncate ciphertext → lỗi unreadable, không giá trị; copy data dir sang user/máy khác → không đọc được.
4. Erasure bị ngắt giả lập → khởi động sau hoàn tất trước khi dùng store.
5. Renderer không nhận giá trị credential qua bất kỳ IPC nào (test).
6. Report kèm câu hỏi mở (macOS prompt khi ký ad-hoc trong dev; last_used).
