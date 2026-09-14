# SPIKE SP-1 — Năng lực bù trừ (compensating action) của Notion

Thư mục chứa toàn bộ mã nguồn thực nghiệm, bằng chứng (evidence) và báo cáo kỹ thuật cho **Spike SP-1** của dự án Desktop Assistant.

---

## 1. Mục đích
Xác minh thực tế trên Notion REST API (3 workspace thật: simple, complex, order):
- Độ toàn vẹn của snapshot trước ghi và khả năng bù trừ (undo) cho các thao tác ghi trong PRD FR-NT-03.
- Cơ chế xử lý schema phức tạp (Rollup, Formula, Relation) và thuộc tính `status` vs `select`.
- Ngưỡng rate limit thực tế và hành vi khi burst (FR-NT-06).
- Xây dựng ma trận bù trừ `compensation-matrix.md` làm đầu vào trực tiếp cho đặc tả Connector Manifest Schema (FR-CF-01).

---

## 2. Yêu cầu môi trường
- Python 3.10+ (đã kiểm chứng trên Python 3.14.4).
- File cấu hình `spikes/.env.local` chứa các biến môi trường:
  ```env
  NOTION_TOKEN_A=secret_...
  NOTION_TOKEN_B=secret_...
  NOTION_TOKEN_C=secret_...
  ```
- File `spikes/fixtures/notion.json` chứa thông tin ID của 3 workspace A, B, C.

---

## 3. Cách chạy lại toàn bộ từ đầu (Reproduce)

Để chạy toàn bộ test suite từ thư mục gốc của repo:

```bash
python3 spikes/SP-1-notion-compensation/src/run_all.py
```

Hoặc chạy độc lập từng phần kiểm chứng:
- **Q1 & Q2 (Snapshot & Roundtrip)**: `python3 spikes/SP-1-notion-compensation/src/test_q1_q2_roundtrip.py`
- **Q3 (Thao tác Irreversible)**: `python3 spikes/SP-1-notion-compensation/src/test_q3_irreversible.py`
- **Q4 (Thứ tự & Dò Schema)**: `python3 spikes/SP-1-notion-compensation/src/test_q4_ordering.py`
- **Q5 (Rate Limit & Burst)**: `python3 spikes/SP-1-notion-compensation/src/test_q5_rate_limit.py`
- **Q6 (Rollup, Formula, Relation)**: `python3 spikes/SP-1-notion-compensation/src/test_q6_complex_schema.py`
- **Q7 (Mã lỗi & Xóa vs Mất quyền)**: `python3 spikes/SP-1-notion-compensation/src/test_q7_error_codes.py`
- **Q8 (Property status vs select)**: `python3 spikes/SP-1-notion-compensation/src/test_q8_status_vs_select.py`

---

## 4. Cấu trúc thư mục

```
spikes/SP-1-notion-compensation/
├── REPORT.md                         # Báo cáo tổng kết đầy đủ (§0 đến §6)
├── README.md                         # Hướng dẫn chạy lại và cấu trúc
├── src/
│   ├── common.py                     # HTTP client gọi Notion REST thô và logger
│   ├── test_q1_q2_roundtrip.py       # Thử nghiệm snapshot và roundtrip bù trừ
│   ├── test_q3_irreversible.py       # Khảo sát các thao tác không thể hoàn nguyên
│   ├── test_q4_ordering.py           # Phân tích schema A vs C và thuật toán dò cột
│   ├── test_q5_rate_limit.py         # Đo burst, ngưỡng 429 và Retry-After
│   ├── test_q5_find_429.py           # Script phụ tải cao tìm trần rate limit
│   ├── test_q6_complex_schema.py     # Rollup, Formula, Relation trên Workspace B
│   ├── test_q7_error_codes.py        # Kiểm chứng 400, 401, 403, 404, 429
│   ├── test_q8_status_vs_select.py   # So sánh chi tiết kiểu status và select
│   └── run_all.py                    # Runner chạy tuần tự mọi test
└── evidence/
    ├── compensation-matrix.md        # ĐẦU RA BẮT BUỘC: Ma trận bù trừ cho FR-CF-01
    ├── data/                         # Kết quả tổng hợp có cấu trúc JSON
    └── raw_logs/                     # 100% request và response headers + body thô
```
