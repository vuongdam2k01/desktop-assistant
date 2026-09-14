#!/usr/bin/env python3
"""Runner chính chạy toàn bộ test suite SP-1 và kiểm tra tính toàn vẹn của kết quả."""

import sys
import os
import pathlib
import time

CUR_DIR = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(CUR_DIR))

import test_q1_q2_roundtrip
import test_q3_irreversible
import test_q4_ordering
import test_q5_rate_limit
import test_q6_complex_schema
import test_q7_error_codes
import test_q8_status_vs_select

def main():
    print("=================================================================")
    print("      BẮT ĐẦU CHẠY TOÀN BỘ TEST SUITE SPIKE SP-1 (NOTION)       ")
    print("=================================================================")
    start_all = time.time()

    steps = [
        ("Q1 & Q2: Snapshot, Khôi phục, Toàn vẹn roundtrip", test_q1_q2_roundtrip.run),
        ("Q3: Thao tác Irreversible", test_q3_irreversible.run),
        ("Q4: Thứ tự, Sắp xếp và Dò schema", test_q4_ordering.run),
        ("Q5: Ngưỡng Rate Limit và Burst", test_q5_rate_limit.run),
        ("Q6: Schema phức tạp (Rollup, Formula, Relation)", test_q6_complex_schema.run),
        ("Q7: Mã lỗi thực tế và phân biệt xóa vs mất quyền", test_q7_error_codes.run),
        ("Q8: So sánh thuộc tính status vs select", test_q8_status_vs_select.run),
    ]

    for title, fn in steps:
        print(f"\n>>> BẮT ĐẦU: {title}")
        t0 = time.time()
        try:
            fn()
            print(f">>> HOÀN THÀNH: {title} ({time.time() - t0:.2f}s)")
        except Exception as e:
            print(f">>> LỖI TẠI {title}: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    print("\n=================================================================")
    print(f"   TẤT CẢ TEST SUITE SP-1 ĐÃ HOÀN TẤT TRONG {time.time() - start_all:.2f} GIÂY")
    print("=================================================================")

if __name__ == "__main__":
    main()
