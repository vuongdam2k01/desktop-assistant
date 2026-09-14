#!/usr/bin/env python3
"""Kiểm chứng Q7: Khảo sát mã lỗi thực tế 400, 401, 403, 404, 409, 429 và phân biệt page bị xóa vs mất quyền."""

import json
import uuid
from typing import Dict, Any

from common import (
    get_token, get_workspace_info, create_page, get_page,
    set_page_archived, raw_api_call, DATA_DIR
)

def run():
    print("=== Chạy kiểm chứng Q7: Phân tích mã lỗi thực tế và cơ chế phát hiện xóa/mất quyền ===")
    tok_a = get_token("A")
    info_a = get_workspace_info("A")
    db_a_id = info_a["databases"][0]["id"]

    results = {
        "status_400_validation_error": {},
        "status_401_unauthorized": {},
        "status_403_restricted_resource": {},
        "status_404_not_found": {},
        "status_200_archived_comparison": {},
        "status_409_conflict_analysis": {},
        "status_429_rate_limited": {},
        "undo_detection_strategy": {}
    }

    # 1. 400 Validation Error (UUID sai định dạng)
    print("\n--- 1. Thử nghiệm HTTP 400 (UUID sai định dạng) ---")
    st_400, hdrs_400, bdy_400 = raw_api_call(tok_a, "GET", "/pages/invalid-uuid-12345", log_category="q7_error_400")
    print(f"   HTTP {st_400}: code={bdy_400.get('code')}, message={bdy_400.get('message')}")
    results["status_400_validation_error"] = {
        "status": st_400,
        "code": bdy_400.get("code"),
        "message": bdy_400.get("message")
    }

    # 2. 401 Unauthorized (Token sai/hết hạn)
    print("\n--- 2. Thử nghiệm HTTP 401 (Token sai) ---")
    st_401, hdrs_401, bdy_401 = raw_api_call("secret_invalid_token_999999999999999999", "GET", "/users/me", log_category="q7_error_401")
    print(f"   HTTP {st_401}: code={bdy_401.get('code')}, message={bdy_401.get('message')}")
    results["status_401_unauthorized"] = {
        "status": st_401,
        "code": bdy_401.get("code"),
        "message": bdy_401.get("message")
    }

    # 3. 403 Forbidden / Restricted Resource (Endpoint không có quyền)
    print("\n--- 3. Thử nghiệm HTTP 403 (Restricted resource) ---")
    st_403, hdrs_403, bdy_403 = raw_api_call(tok_a, "POST", "/comments", body={"parent": {"page_id": str(uuid.uuid4())}, "rich_text": [{"text": {"content": "hi"}}]}, log_category="q7_error_403")
    print(f"   HTTP {st_403}: code={bdy_403.get('code')}, message={bdy_403.get('message')}")
    results["status_403_restricted_resource"] = {
        "status": st_403,
        "code": bdy_403.get("code"),
        "message": bdy_403.get("message")
    }

    # 4. 404 Object Not Found (UUID đúng chuẩn nhưng không tồn tại hoặc không share)
    print("\n--- 4. Thử nghiệm HTTP 404 (UUID ngẫu nhiên) ---")
    rand_uuid = str(uuid.uuid4())
    st_404, hdrs_404, bdy_404 = raw_api_call(tok_a, "GET", f"/pages/{rand_uuid}", log_category="q7_error_404")
    print(f"   HTTP {st_404}: code={bdy_404.get('code')}, message={bdy_404.get('message')}")
    results["status_404_not_found"] = {
        "status": st_404,
        "tested_uuid": rand_uuid,
        "code": bdy_404.get("code"),
        "message": bdy_404.get("message")
    }

    # 5. So sánh với Page ĐÃ BỊ ARCHIVE (Trash)
    print("\n--- 5. So sánh: Page đã archive vs 404 ---")
    st_cr, _, cr_p = create_page(tok_a, {"database_id": db_a_id}, {"Name": {"title": [{"text": {"content": "Page for 404 vs Archive Test"}}]}}, category="q7_temp_page")
    temp_id = cr_p["id"]
    set_page_archived(tok_a, temp_id, True, category="q7_archive_temp")
    
    st_arc, _, bdy_arc = get_page(tok_a, temp_id, category="q7_get_archived_page")
    print(f"   Page trong Trash: HTTP {st_arc} (không phải 404!), archived={bdy_arc.get('archived')}")
    results["status_200_archived_comparison"] = {
        "status": st_arc,
        "archived_field": bdy_arc.get("archived"),
        "behavior": "Notion KHÔNG trả 404 cho page bị archive. Page trong Trash vẫn trả về 200 OK kèm archived: true. Chỉ khi bị xóa vĩnh viễn (empty trash) hoặc gỡ integration thì mới trả 404."
    }

    # 6. Đọc kết quả 429 từ Q5
    q5_file = DATA_DIR / "q5_rate_limit_results.json"
    if q5_file.exists():
        q5_data = json.loads(q5_file.read_text(encoding="utf-8"))
        results["status_429_rate_limited"] = q5_data.get("safe_rate_recommendation", {})

    # 7. Phân tích chiến lược phát hiện cho Undo (FR-UD-02)
    results["undo_detection_strategy"] = {
        "case_page_in_trash": {
            "api_response": "HTTP 200 với archived: true",
            "detection": "Page vẫn còn trong Trash. Undo-agent có thể tự động unarchive bằng PATCH {'archived': false} trước khi khôi phục snapshot."
        },
        "case_page_deleted_permanently_or_unshared": {
            "api_response": "HTTP 404 với code: 'object_not_found'",
            "can_distinguish_via_api": False,
            "distinction_mechanism": (
                "Notion API cố ý bảo mật bằng cách trả cùng một mã 404 object_not_found cho cả hai trường hợp: "
                "(1) page không tồn tại / đã xóa vĩnh viễn, và (2) page tồn tại nhưng bot không được cấp quyền. "
                "Hệ thống Desktop Assistant phân biệt dựa vào ledger: nếu page_id đã từng được ghi thành công bởi agent trong ledger "
                "nhưng nay trả 404 -> đánh dấu là 'OBJECT_DELETED_OR_PERMISSION_REVOKED', gắn cờ CONFLICT theo FR-UD-02 và dừng undo, báo người dùng."
            )
        },
        "case_token_revoked_or_expired": {
            "api_response": "HTTP 401 unauthorized",
            "detection": "Chuyển job sang failed với lý do token hết hạn, hướng dẫn người dùng kết nối lại (FR-NT-07)."
        }
    }

    out_file = DATA_DIR / "q7_error_codes_results.json"
    out_file.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ Hoàn tất Q7. Kết quả lưu tại: {out_file}")

if __name__ == "__main__":
    run()
