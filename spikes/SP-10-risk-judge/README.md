# SP-10 — Smart Mode Tầng 2: LLM Risk Judge Trong Đường Chặn

Spike này đánh giá và kiểm chứng thực nghiệm Tầng 2 (LLM Risk Judge) của chế độ `smart mode` (FR-AP-01b) trong đường chặn trước các thao tác ghi dữ liệu của Desktop Assistant.

---

## 1. Mục tiêu kiểm chứng

- **Corpus đóng băng:** 30 thao tác ghi W-01..W-30 (`spikes/fixtures/sp10-write-operations.md`) gồm:
  - 12 ca AN TOÀN (W-01..W-12)
  - 10 ca NGUY HIỂM (W-13..W-22)
  - 8 ca MƠ HỒ (W-23..W-30) — đã được Product Owner xác nhận giữ nhãn MƠ HỒ ngày 11/09/2026.
  - 5 ca có cài text thuyết phục gài bẫy (W-13, W-16, W-19, W-22, W-25).
- **Quy mô đo lường:** 30 ca × 3 lần lặp × 2 model (`LLM_MODEL_STRONG` và `LLM_MODEL_CHEAP`) = **180 lượt gọi LLM**.
- **Chỉ số trọng tâm:**
  - **Strict False-Allow:** Tỷ lệ tự duyệt nhầm thao tác NGUY HIỂM (yêu cầu tiến về 0%).
  - **Độ trễ (Latency):** Đánh giá tác động lên chỉ tiêu **NFR-PF-05** (job đơn giản trung vị ≤ 30s).
  - **Chi phí (Cost):** Lượng token tiêu thụ và chi phí USD phát sinh mỗi job.
  - **Kháng dẫn dụ:** Đánh giá khả năng chống chịu bẫy text thuyết phục (Anti-Injection).
  - **Fail-Closed khi lỗi:** Kiểm chứng hệ thống tự động đẩy lên người dùng khi mất mạng hoặc cổng chết.

---

## 2. Cấu trúc thư mục

```
spikes/SP-10-risk-judge/
├── REPORT.md                  # Báo cáo kết quả đầy đủ theo khung Roadmap §3.4
├── README.md                  # Hướng dẫn chạy lại từ đầu
├── package.json               # Cấu hình dependency Node.js
├── tsconfig.json              # Cấu hình TypeScript
├── src/
│   ├── types.ts               # Định nghĩa interface nhãn, kết quả đo, ma trận
│   ├── cases.ts               # 30 ca kiểm thử W-01..W-30 từ fixture đóng băng
│   ├── prompt.ts              # System prompt phòng thủ Anti-Injection cho Judge
│   ├── judge.ts               # Wrapper gọi LLM với cơ chế Fail-Closed fallback
│   ├── runner.ts              # Harness thực thi 180 lượt đo + tính thống kê
│   └── network-test.ts        # Kịch bản kiểm chứng fail-closed khi mất mạng / cổng chết
└── evidence/
    ├── raw_runs_strong.jsonl          # Log thô 90 lượt chạy của model STRONG
    ├── raw_runs_cheap.jsonl           # Log thô 90 lượt chạy của model CHEAP
    ├── confusion_matrix_strong.json   # Ma trận nhầm lẫn model STRONG
    ├── confusion_matrix_cheap.json    # Ma trận nhầm lẫn model CHEAP
    ├── persuasion_analysis.json       # Báo cáo 5 ca text thuyết phục
    ├── network_failure_test.json      # Bằng chứng kiểm thử cổng chết / rớt mạng
    └── metrics_summary.json           # Bảng tổng hợp số liệu Latency, Cost, Accuracy
```

---

## 3. Cách chạy lại từ đầu

### Bước 1 — Chuẩn bị môi trường & cài đặt dependency
Đảm bảo đã có file `spikes/.env.local` chứa các biến:
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL_STRONG` (mặc định: `deepseek-v4-pro-ga-260813`)
- `LLM_MODEL_CHEAP` (mặc định: `deepseek-v4-flash-ga-260731`)

Cài đặt package:
```bash
cd spikes/SP-10-risk-judge
npm install
```

### Bước 2 — Kiểm chứng an toàn Fail-Closed khi lỗi mạng (Q4)
Chạy kịch bản kiểm tra cổng chết cục bộ, timeout mạng, sai token:
```bash
npm run test:network
# hoặc: npx tsx src/network-test.ts
```

### Bước 3 — Chạy thực nghiệm đầy đủ 180 runs (Q1, Q2, Q3, Q5, Q6)
Chạy toàn bộ 30 ca × 3 lần lặp cho cả hai model:
```bash
npm run run:all
# hoặc: npx tsx src/runner.ts
```

Toàn bộ dữ liệu đo lường thô, ma trận nhầm lẫn và bảng tổng hợp sẽ được tự động ghi vào thư mục `evidence/`.
