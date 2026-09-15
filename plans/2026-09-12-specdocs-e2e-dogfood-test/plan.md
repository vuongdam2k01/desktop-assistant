# Kế hoạch Kiểm thử & Nghiệm thu Toàn diện Plugin `specdocs` (Dogfooding E2E)

**Mục tiêu**: Xây dựng một dự án thử nghiệm hoàn chỉnh tại `/home/<user>/projects/desktop-assistant-test` dựa trên chính chủ đề và yêu cầu thực tế của `desktop-assistant`, thực hiện kiểm thử toàn bộ chu trình W0–W10, các lệnh CLI, các script kiểm tra tiền định, các hook vòng đời (trên cả Antigravity và Claude Code), phát hiện và vá triệt để mọi lỗi/vấn đề phát sinh.

---

## Danh sách các Phase thực thi

| Phase | Tên giai đoạn | Mục tiêu chính | Trạng thái |
| --- | --- | --- | --- |
| **Phase 1** | Khởi tạo dự án & Cấu hình W0 | Dựng thư mục test, chạy `specdocs init`, biên soạn hiến pháp và cấu hình `config.yaml`, kiểm tra hook `state-inject` | **Đã hoàn thành** |
| **Phase 2** | Change Khởi tạo (`bootstrap-skeleton`) | Tạo change bootstrap (`skip_specs: true`), định nghĩa layout và standard-commands, nghiệm thu `sync` & `archive` | **Đã hoàn thành** |
| **Phase 3** | Năng lực cốt lõi (`sqlite-ledger`) | Đánh giá `assess`, phỏng vấn `clarify`, soạn delta spec, model, contract `ledger-spi`, checklist, nghiệm thu W2 ➔ W7 | **Đã hoàn thành** |
| **Phase 4** | Quan hệ phụ thuộc (`agent-loop`) | Năng lực phụ thuộc tiêu thụ contract của năng lực khác, chạy `specdocs:impact`, cập nhật roadmap và topo sort | **Đã hoàn thành** |
| **Phase 5** | Thay đổi phá vỡ (`job-runner v1.0.0`) | MODIFIED requirement, REMOVED requirement có Reason & Migration, contract MAJOR bump, kiểm tra gate phân tích ảnh hưởng | **Đã hoàn thành** |
| **Phase 6** | Kiểm thử biên & Script máy kiểm | Kiểm thử `spec-check` (`rtm`, `surfaces`, `xcut`, `evidence`, `consumers`, `order`), cố ý tạo chu trình và lỗi cú pháp để kiểm tra độ nhạy | **Đã hoàn thành** |
| **Phase 7** | Vá lỗi & Gia cố Plugin | Sửa chữa mọi bug/friction tìm được vào mã nguồn `plugins/specdocs/`, đồng bộ sang Antigravity installation | **Đã hoàn thành** |
| **Phase 8** | Tổng kết & Báo cáo hoàn thành | Lập báo cáo dogfooding toàn diện, nghiệm thu chất lượng và kết thúc goal | **Đã hoàn thành** |

---

## Tiêu chí chấp nhận (Acceptance Criteria)

1. Dự án test `/home/<user>/projects/desktop-assistant-test` được khởi tạo chuẩn xác, có cấu trúc `docs/spec/` hợp lệ.
2. Tất cả 11 lệnh của `specdocs` CLI hoạt động trơn tru.
3. Tất cả các script `spec-check.mjs` chạy không có ngoại lệ ngoài ý muốn.
4. Cả 3 hook hoạt động tốt trên môi trường Antigravity (qua `agy` CLI và các tool call) cũng như Claude Code.
5. Quy trình quản lý delta (ADDED, MODIFIED, REMOVED, RENAMED) được kiểm thử toàn bộ.
6. Mọi lỗi phát hiện trong quá trình test được vá trực tiếp vào `plugins/specdocs/` và kiểm tra lại qua linter + validate.
7. Đạt 100% test pass không còn cảnh báo hoặc lỗi tồn đọng.
