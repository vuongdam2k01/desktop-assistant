# SPIKE SP-6 — Kiểm Chứng Khả Năng Nhúng Pi Agents SDK

Thư mục này chứa toàn bộ mã nguồn kiểm chứng thực tế và bằng chứng (logs) cho **SPIKE SP-6 (Đường găng số 1 trên Linux)** của dự án Desktop Assistant.

---

## 1. Cấu Trúc Thư Mục

```
spikes/SP-6-pi-sdk/
├── REPORT.md                  # Đầu ra chính — Báo cáo kết luận theo khung mục 3.4
├── README.md                  # File này: hướng dẫn chạy lại từ đầu
├── package.json               # Cấu hình dependency (@earendil-works/pi-agent-core, @earendil-works/pi-ai)
├── tsconfig.json              # Cấu hình TypeScript
├── src/
│   ├── client.ts              # Model & streamFn factory kết nối BytePlus Ark
│   ├── dummy-tools.ts         # 2 tool giả lập (read_data, write_data) & wrapped gate factory
│   ├── mock-ledger.ts         # In-memory ledger ghi intent, blocked, result
│   ├── test-connectivity.ts   # Kiểm tra kết nối LLM provider
│   ├── test-minimal-agent.ts  # Agent tối giản chạy THẬT với 2 tool
│   ├── test-q1-tools.ts       # Q1: Đăng ký tool tuỳ biến, chặn coding tools
│   ├── test-q2-hardgate.ts    # Q2: Hard gate wrap trước execute (0-lọt), bypass test
│   ├── test-q3-pause-resume.ts# Q3: Pause / Resume checkpoint (US-4.2/AC2)
│   ├── test-q4-concurrency.ts # Q4: Chạy nhiều instance song song trong 1 process Node
│   ├── test-q5-providers.ts   # Q5: Provider layer, custom endpoints, phân tích FR-AG-11
│   ├── test-q6-vision.ts      # Q6: Multimodal image input (FR-PET-04)
│   ├── test-q7-token-usage.ts # Q7: Truy xuất token usage từ session (R-6, R-11)
│   └── run-all.ts             # Test runner chạy toàn bộ 7 bài test
└── evidence/
    ├── q1-tool-registry.log
    ├── q2-hardgate-block.log
    ├── q2-bypass-attempts.log
    ├── q3-pause-resume.log
    ├── q4-concurrency.log
    ├── q5-provider-response.log
    ├── q6-vision-response.log
    ├── q7-token-usage.log
    ├── package-comparison.md
    └── upstream-release-history.md
```

---

## 2. Yêu Cầu Môi Trường

- Node.js `>= 22.19.0` (đã kiểm chứng trên `v24.21.0`)
- npm `>= 11.0.0` (đã kiểm chứng trên `11.19.0`)
- File `spikes/.env.local` chứa các cấu hình LLM hợp lệ:
  - `LLM_BASE_URL`
  - `LLM_API_KEY`
  - `LLM_MODEL_STRONG`
  - `LLM_MODEL_CHEAP`
  - `LLM_MODEL_VISION`

---

## 3. Cách Chạy Lại Toàn Bộ Kiểm Chứng Từ Đầu

### Cài đặt dependencies:
```bash
cd spikes/SP-6-pi-sdk
npm install
```

### Chạy toàn bộ test suite tự động:
```bash
npm run test:all
# Hoặc: npx tsx src/run-all.ts
```

### Hoặc chạy từng bài test riêng biệt:
```bash
npm run test:q1    # Kiểm tra đăng ký tool & chặn tool coding
npm run test:q2    # Kiểm tra hard gate wrap trước execute (0-lọt) & bypass vectors
npm run test:q3    # Kiểm tra pause & resume checkpoint không lặp bước (US-4.2/AC2)
npm run test:q4    # Kiểm tra cô lập nhiều agent chạy song song
npm run test:q5    # Kiểm tra provider layer & đo đạc latency model STRONG/CHEAP
npm run test:q6    # Kiểm tra nhận diện hình ảnh với vision model
npm run test:q7    # Kiểm tra trích xuất token usage từ session
```
