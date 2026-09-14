# SP-17 — Ma trận LLM Provider × Vai trò

Spike kiểm chứng và tổng hợp ma trận ánh xạ giữa LLM Provider và các vai trò của Desktop Assistant ([FR-AG-11](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L618), [ADR-007](file:///home/<user>/projects/desktop-assistant/docs/prd-mvp.md#L1076)): Pet-agent, Worker-agent, Bộ đúc kết quy tắc, Undo-agent, và Smart Mode Risk Judge (SP-10).

## Cấu trúc thư mục

```
spikes/SP-17-provider-matrix/
├── REPORT.md                  # Đầu ra chính thức của spike
├── README.md                  # Tài liệu hướng dẫn tái lập
├── package.json               # Cấu hình dependency
├── tsconfig.json              # TypeScript config
├── src/
│   ├── client.ts              # Khởi tạo model Pi SDK & helper kết nối
│   ├── benchmark-ack.ts       # Đo kiểm độ trễ Pet-agent ACK đối chiếu NFR-PF-03 (Q2)
│   ├── test-vision-behavior.ts# Đo kiểm và xác nhận lỗi từ chối ảnh trên DeepSeek (Q1)
│   ├── test-errors.ts         # Thực nghiệm bắt lỗi 401, 404, 429 & sinh thẻ SYSTEM (Q5)
│   ├── cost-calculator.ts     # Mô hình hoá và tính toán chi phí M-V1 (Q6)
│   └── run-all.ts             # Bộ chạy tổng hợp toàn bộ thí nghiệm
└── evidence/
    ├── ack-latency-bench.json # Dữ liệu đo độ trễ ACK (P50, P90, TTFT, Total)
    ├── vision-rejection-test.json # Log bắt lỗi HTTP 400 InvalidParameter trên DeepSeek
    ├── error-responses.json   # Log bắt lỗi xác thực và model không tồn tại
    ├── system-cards.json      # Payload thẻ SYSTEM chuẩn Phụ lục A.2
    └── monthly-cost-matrix.json # Ma trận chi phí hàng tháng theo cường độ sử dụng
```

## Yêu cầu môi trường

- Node.js `v24.21.0`
- File credential `spikes/.env.local` chứa:
  - `LLM_BASE_URL` (BytePlus Ark coding plan endpoint)
  - `LLM_API_KEY`
  - `LLM_MODEL_STRONG` (`deepseek-v4-pro-ga-260813`)
  - `LLM_MODEL_CHEAP` (`deepseek-v4-flash-ga-260731`)
  - `LLM_MODEL_VISION` (`seed-2-0-pro-260328`)

## Cách chạy lại từ đầu

1. **Cài đặt thư viện:**
   ```bash
   cd spikes/SP-17-provider-matrix
   npm install
   ```

2. **Chạy từng module kiểm chứng:**
   - Đo kiểm độ trễ Pet ACK (Q2):
     ```bash
     npm run bench:ack
     ```
   - Thử nghiệm bắt lỗi & Thẻ SYSTEM (Q5):
     ```bash
     npm run test:errors
     ```
   - Tính toán chi phí M-V1 (Q6):
     ```bash
     npm run calc:costs
     ```

3. **Chạy trọn bộ thí nghiệm:**
   ```bash
   npm run test:all
   ```
