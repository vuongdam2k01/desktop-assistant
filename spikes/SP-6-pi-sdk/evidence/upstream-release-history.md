# Phân Tích Lịch Sử Phiên Bản & Độ Ổn Định API (@earendil-works) — Phục Vụ R-14

## 1. Dòng Thời Gian Phát Hành (05/2026 - 09/2026)

Dữ liệu trích xuất từ npm registry cho `@earendil-works/pi-agent-core` và `@earendil-works/pi-ai`:

| Mốc phiên bản | Ngày phát hành | Ghi chú / Thay đổi chính |
| :--- | :--- | :--- |
| `0.74.0` | 07/05/2026 | Chuyển đổi namespace từ `@mariozechner` sang `@earendil-works`. Thiết lập cấu trúc monorepo `pi`. |
| `0.75.0` | 17/05/2026 | Bổ sung session compaction và memory reducer. |
| `0.76.0` - `0.79.0` | 05/2026 - 06/2026 | Tinh chỉnh event stream, steering mode và follow-up queue. |
| `0.80.1` - `0.80.10`| 23/06/2026 - 16/07/2026 | Ổn định hóa tool batching execution (sequential / parallel). |
| `0.81.0` - `0.84.4`| 07/2026 - 08/2026 | Nâng cấp Telemetry OpenTelemetry integration (`@earendil-works/pi-telemetry`), mở rộng provider catalog trong `pi-ai`. |
| `0.85.0` | 04/09/2026 | Tái cấu trúc nhẹ `AgentOptions`, hoàn thiện `shouldStopAfterTurn` và `prepareNextTurnWithContext`. |
| `0.85.1` (Hiện tại) | 05/09/2026 | Bản ổn định mới nhất, sửa lỗi retry delay và type inference. |

---

## 2. Đánh Giá Nhịp Phát Hành (Release Cadence)

- **Tần suất phát hành:** Rất tích cực (Active Maintenance). Trung bình **2–3 minor releases/tháng**, kèm các bản patch sửa lỗi trong vòng 24–48 giờ.
- **Tính ổn định của Core Primitives:**
  - Bộ API cốt lõi dùng cho Desktop Assistant:
    * `Agent` class (`prompt()`, `continue()`, `state`, `subscribe()`)
    * `AgentTool` interface (`name`, `parameters`, `execute`)
    * `beforeToolCall` / `afterToolCall`
    * `streamSimple` trong `pi-ai`
  - Các primitives này đã **ổn định suốt từ v0.74.0 đến v0.85.1**, không có breaking change làm gãy mô hình wrap tool hay execution loop.
  - Các thay đổi chủ yếu diễn ra ở các tính năng nâng cao bên lề: compaction prompts, branch summarization, TUI themes, telemetry.

---

## 3. Chiến Lược Giảm Thiểu Rủi Ro R-14 Cho Dự Án

| Rủi ro (R-14) | Mức độ | Biện pháp kiểm soát & Giảm thiểu |
| :--- | :--- | :--- |
| **Breaking changes do nâng cấp tự động** | Trung bình | **Khóa cứng version (Pin exact):** Sử dụng `"@earendil-works/pi-agent-core": "0.85.1"` (tuyệt đối không dùng `^` hoặc `~`). Khóa chặt lockfile `package-lock.json`. |
| **Thay đổi API đột ngột của harness** | Thấp | **Lớp bọc Hook + Ledger nằm ở tầng ngoài:** Mọi tool đều được wrap qua `createWrappedTool` trước khi nạp vào agent (FR-AG-02). Ta chỉ tương tác với Pi qua contract `AgentTool.execute(id, params)`. Dù harness bên trong đổi cách gọi, tầng wrap không bị ảnh hưởng. |
| **Dự án upstream ngừng phát triển hoặc đổi giấy phép** | Rất thấp | **Bảo chứng bởi tác giả uy tín & Giấy phép MIT:** Dự án do Mario Zechner & Armin Ronacher đồng duy trì, cấp phép MIT hoàn toàn tự do. Trong kịch bản xấu nhất, ta hoàn toàn có thể fork và tự bảo trì mà không vi phạm pháp lý hay kỹ thuật. |
