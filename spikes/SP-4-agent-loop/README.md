# SP-4 — Đánh giá Vòng Hoạt Động Agent (Agent Loop)

## Mục đích
Spike SP-4 đánh giá vòng hoạt động hoàn chỉnh của Worker-Agent trên hạ tầng Pi Agents SDK (`@earendil-works/pi-agent-core@0.85.1`), thực thi 20 kịch bản công việc chuẩn trên Notion thật (S-01 đến S-20) theo nguyên tắc FR-AG-10 và giải quyết các câu hỏi Q1..Q5.

---

## Cấu trúc thư mục

```
spikes/SP-4-agent-loop/
├── REPORT.md                  # Báo cáo kết quả đầy đủ theo khung roadmap §3.4
├── README.md                  # Hướng dẫn chạy và tái lập
├── package.json               # Cấu hình dependency
├── tsconfig.json              # Cấu hình TypeScript ESM
├── src/
│   ├── client.ts              # Provider & model layer cho Pi SDK
│   ├── notion-client.ts       # Notion REST API client với retry và rate limiting
│   ├── notion-state.ts        # Bộ điều khiển dựng Seed và snapshot trạng thái
│   ├── scenarios-data.ts      # Định nghĩa 20 kịch bản và assertion ground truth
│   ├── runner.ts              # Test runner chính điều phối toàn bộ 20 kịch bản
│   ├── harness/
│   │   └── agent-harness.ts   # System prompt, skills, rules, và telemetry tracking
│   ├── tools/
│   │   ├── notion-tools.ts    # Bộ tool Notion (query, get, create, update, archive)
│   │   ├── google-tools.ts    # Bộ tool Gmail & Drive
│   │   └── ask-user-tool.ts   # Tool ask_user và simulated user responder
│   └── fixtures/
│       └── generate_images.py # Script sinh ảnh thị giác cho S-15, S-16, S-17
└── evidence/                  # 20 file transcript JSON và 20 file snapshot Notion
    ├── summary-results.json   # Thống kê tổng hợp số liệu đo lường
    ├── s15-zalo-checklist.png # Ảnh chat Zalo
    ├── s16-slack-hr.png       # Ảnh tin nhắn Slack
    ├── s17-zalo-demo.png       # Ảnh chat Zalo
    ├── S-01-transcript.json   # Transcript hội thoại và tool calls
    ├── S-01-notion-state.json # Trạng thái Notion sau khi chạy S-01
    └── ... (S-02 đến S-20)
```

---

## Hướng dẫn chạy lại từ đầu

### 1. Cài đặt phụ thuộc
```bash
cd spikes/SP-4-agent-loop
npm install
```

### 2. Sinh các ảnh thị giác cho kịch bản Vision (S-15, S-16, S-17)
```bash
python3 src/fixtures/generate_images.py
```

### 3. Kiểm tra kết nối và reset Seed Notion
```bash
npm run test:reset
```

### 4. Chạy toàn bộ 20 kịch bản
```bash
npm run run:all
```

### 5. Chạy một kịch bản đơn lẻ (tùy chọn)
```bash
npx tsx src/runner.ts --scenario=S-01
```

Sau khi hoàn tất, toàn bộ logs thô, số liệu tokens, độ trễ và snapshot trạng thái Notion sẽ được tự động ghi vào thư mục `evidence/`.
