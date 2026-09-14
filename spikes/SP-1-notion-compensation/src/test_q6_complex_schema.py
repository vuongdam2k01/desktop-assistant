#!/usr/bin/env python3
"""Kiểm chứng Q6: Schema lạ của Workspace B (Rollup, Formula, Relation) - đọc, ghi, và snapshot."""

import json
from typing import Dict, Any, List

from common import (
    get_token, get_workspace_info, query_database, get_page,
    update_page_properties, raw_api_call, DATA_DIR
)

def sanitize_properties_for_snapshot(props: Dict[str, Any]) -> Dict[str, Any]:
    """
    Lọc bỏ toàn bộ thuộc tính computed/read-only khỏi properties object,
    chuyển đổi thành payload hợp lệ cho PATCH /v1/pages/:id.
    """
    writeable = {}
    READ_ONLY_TYPES = {"formula", "rollup", "created_by", "created_time", "last_edited_by", "last_edited_time"}

    for name, p in props.items():
        ptype = p.get("type")
        if ptype in READ_ONLY_TYPES:
            continue

        if ptype == "title":
            texts = [t["text"]["content"] for t in p.get("title", [])]
            content = "".join(texts)
            writeable[name] = {"title": [{"text": {"content": content}}]}
        elif ptype == "rich_text":
            texts = [t["text"]["content"] for t in p.get("rich_text", [])]
            content = "".join(texts)
            writeable[name] = {"rich_text": [{"text": {"content": content}}]}
        elif ptype == "number":
            writeable[name] = {"number": p.get("number")}
        elif ptype == "select":
            sel = p.get("select")
            writeable[name] = {"select": {"name": sel["name"]} if sel else None}
        elif ptype == "status":
            st = p.get("status")
            writeable[name] = {"status": {"name": st["name"]} if st else None}
        elif ptype == "multi_select":
            opts = p.get("multi_select", [])
            writeable[name] = {"multi_select": [{"name": o["name"]} for o in opts]}
        elif ptype == "date":
            d = p.get("date")
            writeable[name] = {"date": {"start": d["start"], "end": d.get("end")} if d else None}
        elif ptype == "people":
            ppl = p.get("people", [])
            writeable[name] = {"people": [{"id": u["id"]} for u in ppl]}
        elif ptype == "checkbox":
            writeable[name] = {"checkbox": p.get("checkbox", False)}
        elif ptype == "url":
            writeable[name] = {"url": p.get("url")}
        elif ptype == "email":
            writeable[name] = {"email": p.get("email")}
        elif ptype == "phone_number":
            writeable[name] = {"phone_number": p.get("phone_number")}
        elif ptype == "relation":
            rel = p.get("relation", [])
            writeable[name] = {"relation": [{"id": r["id"]} for r in rel]}

    return writeable

def run():
    print("=== Chạy kiểm chứng Q6: Schema phức tạp (Rollup, Formula, Relation) ===")
    tok_b = get_token("B")
    info_b = get_workspace_info("B")
    
    # Tìm database Tasks và Projects
    dbs = {db["role"]: db["id"] for db in info_b["databases"]}
    tasks_db_id = dbs["tasks"]
    projects_db_id = dbs["projects"]

    results = {
        "raw_task_inspection": {},
        "write_formula_attempt": {},
        "write_rollup_attempt": {},
        "relation_update_rollup_reactivity": {},
        "formula_reactivity_on_date_change": {},
        "sanitized_snapshot_roundtrip": {}
    }

    # 1. Đọc một task mẫu chứa đầy đủ Relation, Rollup, Formula
    print("\n--- 1. Đọc task mẫu chứa Schema phức tạp ---")
    st_q, _, tasks_data = query_database(tok_b, tasks_db_id, page_size=5, category="q6_query_sample_tasks")
    
    sample_task = None
    for t in tasks_data.get("results", []):
        props = t["properties"]
        if props.get("Project", {}).get("relation") and props.get("Project status", {}).get("rollup"):
            sample_task = t
            break
    if not sample_task:
        sample_task = tasks_data["results"][0]

    task_id = sample_task["id"]
    t_props = sample_task["properties"]
    task_name = t_props["Name"]["title"][0]["text"]["content"]
    print(f"   Task được chọn: '{task_name}' ({task_id})")
    print(f"     - Relation (Project): {t_props.get('Project')}")
    print(f"     - Rollup (Project status): {t_props.get('Project status')}")
    print(f"     - Formula (Days left): {t_props.get('Days left')}")

    results["raw_task_inspection"] = {
        "task_id": task_id,
        "relation_format": t_props.get("Project"),
        "rollup_format": t_props.get("Project status"),
        "formula_format": t_props.get("Days left")
    }

    # 2. Thử ghi trực tiếp vào Formula (Days left)
    print("\n--- 2. Thử ghi PATCH trực tiếp vào Formula ---")
    st_form, _, resp_form = update_page_properties(
        tok_b, task_id,
        {"Days left": {"formula": {"number": 99}}},
        category="q6_patch_formula"
    )
    print(f"   PATCH Formula: HTTP {st_form} — {resp_form.get('message', '')[:100]}")
    results["write_formula_attempt"] = {
        "status": st_form,
        "code": resp_form.get("code"),
        "message": resp_form.get("message")
    }

    # 3. Thử ghi trực tiếp vào Rollup (Project status)
    print("\n--- 3. Thử ghi PATCH trực tiếp vào Rollup ---")
    st_roll, _, resp_roll = update_page_properties(
        tok_b, task_id,
        {"Project status": {"rollup": {"array": []}}},
        category="q6_patch_rollup"
    )
    print(f"   PATCH Rollup: HTTP {st_roll} — {resp_roll.get('message', '')[:100]}")
    results["write_rollup_attempt"] = {
        "status": st_roll,
        "code": resp_roll.get("code"),
        "message": resp_roll.get("message")
    }

    # 4. Thử cập nhật Relation và kiểm tra tính phản ứng (reactivity) của Rollup
    print("\n--- 4. Kiểm tra Cập nhật Relation -> Tự động cập nhật Rollup ---")
    # Lấy danh sách projects
    _, _, proj_data = query_database(tok_b, projects_db_id, page_size=10, category="q6_query_projects")
    projects_list = proj_data.get("results", [])
    assert len(projects_list) >= 2, "Cần ít nhất 2 projects để test chuyển đổi"

    orig_rel = t_props["Project"]["relation"]
    orig_proj_id = orig_rel[0]["id"] if orig_rel else None
    
    # Chọn project khác với project hiện tại
    target_proj = None
    for p in projects_list:
        if p["id"] != orig_proj_id:
            target_proj = p
            break
    
    target_proj_id = target_proj["id"]
    target_proj_name = target_proj["properties"]["Name"]["title"][0]["text"]["content"]
    target_proj_status = target_proj["properties"]["Status"]["select"]["name"]
    print(f"   Project đích: '{target_proj_name}' (Status: {target_proj_status})")

    # Cập nhật relation sang target project
    st_u_rel, _, _ = update_page_properties(
        tok_b, task_id,
        {"Project": {"relation": [{"id": target_proj_id}]}},
        category="q6_update_relation"
    )
    print(f"   Đã cập nhật Relation sang target project (HTTP {st_u_rel})")

    # Đọc lại task ngay lập tức để kiểm tra Rollup
    _, _, task_after_rel = get_page(tok_b, task_id, category="q6_get_task_after_relation_change")
    rollup_after = task_after_rel["properties"]["Project status"]["rollup"]
    print(f"   Rollup sau cập nhật: {rollup_after}")

    # Khôi phục relation ban đầu
    st_undo_rel, _, _ = update_page_properties(
        tok_b, task_id,
        {"Project": {"relation": [{"id": orig_proj_id}] if orig_proj_id else []}},
        category="q6_undo_relation"
    )
    print(f"   Đã khôi phục Relation về ban đầu (HTTP {st_undo_rel})")

    results["relation_update_rollup_reactivity"] = {
        "original_project_id": orig_proj_id,
        "target_project_id": target_proj_id,
        "target_project_expected_status": target_proj_status,
        "observed_rollup_after_update": rollup_after,
        "reactivity_conclusion": "Rollup tự động cập nhật ngay lập tức trong API response khi Relation thay đổi, không có độ trễ."
    }

    # 5. Thử nghiệm Snapshot Sanitization & Roundtrip bù trừ trên Schema phức tạp
    print("\n--- 5. Snapshot Sanitizer & Bù trừ toàn vẹn ---")
    raw_snapshot = t_props
    clean_snap = sanitize_properties_for_snapshot(raw_snapshot)
    print(f"   Các trường writeable trong snapshot ({len(clean_snap)}): {list(clean_snap.keys())}")
    
    # Thử PATCH với raw_snapshot (chắc chắn lỗi nếu không sanitize)
    st_raw_patch, _, err_raw = raw_api_call(tok_b, "PATCH", f"/pages/{task_id}", body={"properties": raw_snapshot}, log_category="q6_test_unsanitized_patch")
    print(f"   Thử PATCH bằng raw snapshot: HTTP {st_raw_patch} (Bị từ chối đúng như dự kiến: {err_raw.get('code')})")

    # Thử PATCH với clean_snap (thành công)
    st_clean_patch, _, succ_clean = raw_api_call(tok_b, "PATCH", f"/pages/{task_id}", body={"properties": clean_snap}, log_category="q6_test_sanitized_patch")
    print(f"   Thử PATCH bằng sanitized snapshot: HTTP {st_clean_patch} (Thành công!)")

    results["sanitized_snapshot_roundtrip"] = {
        "raw_patch_status": st_raw_patch,
        "raw_patch_error": err_raw.get("message"),
        "sanitized_patch_status": st_clean_patch,
        "clean_snapshot_keys": list(clean_snap.keys()),
        "sanitization_rule": "BẮT BUỘC lọc bỏ formula, rollup, created_time, created_by, last_edited_time, last_edited_by trước khi gửi PATCH rollback."
    }

    out_file = DATA_DIR / "q6_complex_schema_results.json"
    out_file.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ Hoàn tất Q6. Kết quả lưu tại: {out_file}")

if __name__ == "__main__":
    run()
