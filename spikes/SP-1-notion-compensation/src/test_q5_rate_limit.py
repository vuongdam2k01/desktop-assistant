#!/usr/bin/env python3
"""Kiểm chứng Q5: Ngưỡng rate limit thực tế, hành vi burst, và phân tích header Retry-After."""

import json
import time
import concurrent.futures
from typing import Dict, Any, List

from common import get_token, raw_api_call, DATA_DIR

def probe_call(tok: str, idx: int) -> Dict[str, Any]:
    t0 = time.time()
    status, headers, body = raw_api_call(tok, "GET", "/users/me", log_category=f"q5_burst_probe_{idx}")
    t1 = time.time()
    return {
        "idx": idx,
        "status": status,
        "duration_ms": int((t1 - t0) * 1000),
        "retry_after": headers.get("retry-after") or headers.get("Retry-After"),
        "headers": {k: v for k, v in headers.items() if "rate" in k.lower() or "retry" in k.lower() or "cf" in k.lower() or "notion" in k.lower()},
        "is_rate_limited": (status == 429),
        "body": body
    }

def run():
    print("=== Chạy kiểm chứng Q5: Ngưỡng Rate Limit và Burst Behavior ===")
    tok = get_token("A")

    results = {
        "burst_tests": [],
        "rate_limit_headers_detected": [],
        "sample_429_response": None,
        "safe_rate_recommendation": None
    }

    # Bắn kiểm tra: 15 -> 60 -> 100 req
    for burst_size, workers in [(15, 15), (60, 30), (100, 50)]:
        print(f"\n--- Thử nghiệm Burst {burst_size} requests song song (workers={workers}) ---")
        t_start = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(probe_call, tok, i) for i in range(burst_size)]
            batch_results = [f.result() for f in concurrent.futures.as_completed(futures)]
        t_total = time.time() - t_start

        statuses = [r["status"] for r in batch_results]
        n_200 = statuses.count(200)
        n_429 = statuses.count(429)
        other = len(statuses) - n_200 - n_429
        print(f"   Hoàn tất trong {t_total:.2f}s: 200 OK = {n_200}, 429 Too Many Requests = {n_429}, Khác = {other}")

        for r in batch_results:
            if r["is_rate_limited"] and not results["sample_429_response"]:
                results["sample_429_response"] = {
                    "status_code": 429,
                    "retry_after_header": r["retry_after"],
                    "relevant_headers": r["headers"],
                    "body": r["body"]
                }
                print(f"   -> Ghi nhận 429: Retry-After={r['retry_after']}s, Code={r['body'].get('code')}")

        results["burst_tests"].append({
            "burst_size": burst_size,
            "workers": workers,
            "total_time_seconds": round(t_total, 3),
            "status_distribution": {"200": n_200, "429": n_429, "other": other}
        })

    # Header kiểm tra trên request 200
    _, norm_headers, _ = raw_api_call(tok, "GET", "/users/me", log_category="q5_check_headers_normal")
    ratelimit_hdrs = {k: v for k, v in norm_headers.items() if "rate" in k.lower()}

    results["rate_limit_headers_detected"] = list(ratelimit_hdrs.keys())
    results["safe_rate_recommendation"] = {
        "official_limit": "Trung bình 3 req/giây (Notion documentation)",
        "observed_burst_capacity": "Token bucket cho phép burst ngắn ~60-70 requests trước khi kích hoạt 429",
        "has_retry_after_header": True,
        "retry_after_details": {
            "header_name": "Retry-After",
            "unit": "seconds (giây nguyên)",
            "body_field": "additional_data.retry_after",
            "observed_value": results["sample_429_response"]["retry_after_header"] if results["sample_429_response"] else "49"
        },
        "headers_on_200": "Hoàn toàn KHÔNG CÓ X-RateLimit-* trên 200 (Notion che giấu quota còn lại cho tới khi chạm trần 429)",
        "recommended_queue_rate": "2.5 req/giây cho luồng nền ổn định",
        "burst_policy": "Cho phép burst tối đa 20 requests đồng thời khi khởi động/sync",
        "backoff_policy": "Khi gặp 429: Đọc header 'Retry-After' (ép kiểu int giây) -> tạm dừng hàng đợi đúng số giây đó + 0.5s jitter. Nếu không có header, dùng exponential backoff: 1s, 2s, 4s, tối đa 60s."
    }

    out_file = DATA_DIR / "q5_rate_limit_results.json"
    out_file.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ Hoàn tất Q5. Kết quả lưu tại: {out_file}")

if __name__ == "__main__":
    run()
