# SPIKE SP-2 — Hội thoại đúc kết quy tắc phê duyệt

Thư mục: `spikes/SP-2-rule-elicitation/`  
Tham chiếu PRD: FR-AP-02, FR-AP-04, FR-AP-06, WF-5, US-4.1, R-2  
Corpus: `spikes/fixtures/sp2-approval-rules.md` (20 quy tắc R-01..R-20, đóng băng)  
Quyết định PO: `spikes/fixtures/README.md` mục 5 (đã chốt ngày 11/09/2026)

---

## 1. Mục đích Spike

Kiểm chứng khả năng của Elicitation Agent trong việc dẫn dắt hội thoại nhiều lượt với người dùng:
1. Thu thập ý định thô và làm rõ các điều kiện còn thiếu (đối tượng, thao tác, ngoại lệ, ngưỡng số lượng, thời gian).
2. Kiểm tra tính biên dịch được theo FR-AP-04: Báo rõ các yếu tố mơ hồ / ngoài khả năng kỹ thuật, chống lỗi âm thầm hạ cấp (silent downgrade).
3. Đúc kết thành `[BẢN DIỄN GIẢI QUY TẮC]` có cấu trúc để người dùng xác nhận.
4. Trích xuất danh mục mẫu quy tắc (`rule-patterns-for-ir.md`) làm đầu vào trực tiếp cho SP-8 thiết kế Rule IR.
5. So sánh năng lực giữa model mạnh (`LLM_MODEL_STRONG`) và model rẻ (`LLM_MODEL_CHEAP`) để định hình kiến trúc model routing (FR-AG-11).

---

## 2. Chuẩn bị môi trường

1. Đảm bảo Python 3.10+ (đã kiểm chứng trên Python 3.14).
2. Cấu hình file `spikes/.env.local` với các biến môi trường:
   ```bash
   LLM_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/coding/v3
   LLM_API_KEY=your-api-key
   LLM_MODEL_STRONG=deepseek-v4-pro-ga-260813
   LLM_MODEL_CHEAP=deepseek-v4-flash-ga-260731
   ```

---

## 3. Cách chạy thực nghiệm

### Chế độ thông thường (Tự động Resume / Skip)
Kiểm tra file kết quả đã có trong `evidence/transcripts_{strong,cheap}/{rule_id}.json`. Nếu đã tồn tại, tự động in `SKIP` và nạp số liệu đánh giá có sẵn mà không gọi lại API LLM:
```bash
python3 src/run_experiment.py
```

### Chế độ ép chạy lại toàn bộ (`--force`)
Xoá bỏ bộ nhớ đệm và chạy lại toàn bộ 40 phiên hội thoại cùng 40 lượt evaluator từ đầu:
```bash
python3 src/run_experiment.py --force
```

---

## 4. Cấu trúc thư mục

```
spikes/SP-2-rule-elicitation/
├── REPORT.md                         # Báo cáo kỹ thuật chi tiết theo chuẩn roadmap §3.4
├── README.md                         # Tài liệu hướng dẫn tái lập thực nghiệm
├── src/
│   ├── config.py                     # Quản lý đường dẫn và nạp .env.local
│   ├── corpus_parser.py              # Parser bóc tách 20 quy tắc từ sp2-approval-rules.md
│   ├── llm_client.py                 # Client OpenAI-compatible với retry exponential backoff
│   ├── prompts.py                    # Prompt elicitor v0 và prompt đóng vai user simulator
│   ├── dialog_runner.py              # Bộ điều phối hội thoại nhiều lượt giữa agent và simulator
│   ├── evaluator.py                  # Evaluator LLM độc lập chấm điểm theo Ground Truth
│   └── run_experiment.py             # Script chạy batch, skip cache, tính metrics và xuất artifacts
└── evidence/
    ├── transcripts_strong/           # 20 transcript JSON & MD của LLM_MODEL_STRONG
    ├── transcripts_cheap/            # 20 transcript JSON & MD của LLM_MODEL_CHEAP
    ├── metrics_summary.json          # Tổng hợp số đo định lượng Q1..Q4 của cả 2 model
    ├── rule-patterns-for-ir.md       # Danh mục mẫu quy tắc bàn giao cho SP-8 thiết kế IR
    └── elicitation_prompt_v0.md      # System prompt hoàn thiện của Elicitation Agent cho M2
```
