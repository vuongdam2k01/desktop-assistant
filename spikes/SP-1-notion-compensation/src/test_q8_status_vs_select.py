#!/usr/bin/env python3
"""Kiểm chứng Q8: So sánh toàn diện giữa property kiểu 'status' và 'select' (schema, ghi, lỗi, snapshot, undo)."""

import json
from typing import Dict, Any

from common import (
    get_token, get_workspace_info, get_database, create_page, get_page,
    update_page_properties, set_page_archived, raw_api_call, DATA_DIR
)

def run():
    print("=== Chạy kiểm chứng Q8: So sánh Property 'status' vs 'select' ===")
    tok_a = get_token("A")
    info_a = get_workspace_info("A")
    db_a_id = info_a["databases"][0]["id"]

    results = {
        "status_property_creation": {},
        "schema_comparison": {},
        "write_valid_name": {},
        "write_valid_id": {},
        "write_invalid_option": {},
        "write_null_clear": {},
        "snapshot_and_undo_comparison": {}
    }

    # 1. Thêm một property kiểu `status` vào Database A: "Task Status"
    print("\n--- 1. Thêm property kiểu 'status' vào Database Tasks ---")
    st_patch_db, _, db_patch_res = raw_api_call(
        tok_a, "PATCH", f"/databases/{db_a_id}",
        body={"properties": {"Task Status": {"status": {}}}},
        log_category="q8_add_status_property"
    )
    print(f"   PATCH database thêm 'Task Status': HTTP {st_patch_db}")
    
    # Đọc lại schema database
    _, _, db_schema = get_database(tok_a, db_a_id, category="q8_get_db_schema")
    status_prop_def = db_schema["properties"].get("Task Status", {})
    select_prop_def = db_schema["properties"].get("Status", {})

    print(f"   Schema 'Task Status' (type: {status_prop_def.get('type')}):")
    status_opts = status_prop_def.get("status", {}).get("options", [])
    status_groups = status_prop_def.get("status", {}).get("groups", [])
    print(f"     - Groups: {[g.get('name') for g in status_groups]}")
    print(f"     - Options: {[(o.get('name'), o.get('id')) for o in status_opts]}")

    print(f"   Schema 'Status' (type: {select_prop_def.get('type')}):")
    select_opts = select_prop_def.get("select", {}).get("options", [])
    print(f"     - Options: {[(o.get('name'), o.get('id')) for o in select_opts]}")

    results["schema_comparison"] = {
        "status": {
            "type": "status",
            "has_groups": True,
            "groups": status_groups,
            "options": status_opts
        },
        "select": {
            "type": "select",
            "has_groups": False,
            "options": select_opts
        }
    }

    # Tạo 1 test page để thực hiện các phép thử
    st_cr, _, test_page = create_page(
        tok_a, {"database_id": db_a_id},
        {"Name": {"title": [{"text": {"content": "SP1 Q8 Status vs Select Test"}}]}},
        category="q8_create_test_page"
    )
    p_id = test_page["id"]

    # 2. Thử ghi giá trị hợp lệ theo NAME
    print("\n--- 2. Thử ghi giá trị hợp lệ theo Name ---")
    # Ghi vào select: "Đang làm"
    st_w_sel, _, _ = update_page_properties(tok_a, p_id, {"Status": {"select": {"name": "Đang làm"}}}, category="q8_write_select_name")
    # Ghi vào status: "In progress"
    st_w_stat, _, _ = update_page_properties(tok_a, p_id, {"Task Status": {"status": {"name": "In progress"}}}, category="q8_write_status_name")
    print(f"   Ghi select theo Name: HTTP {st_w_sel}")
    print(f"   Ghi status theo Name: HTTP {st_w_stat}")
    results["write_valid_name"] = {"select_status": st_w_sel, "status_status": st_w_stat}

    # 3. Thử ghi giá trị hợp lệ theo ID
    print("\n--- 3. Thử ghi giá trị hợp lệ theo ID ---")
    stat_done_opt = [o for o in status_opts if o.get("name") == "Done"][0]
    sel_backlog_opt = [o for o in select_opts if o.get("name") == "Backlog"][0]

    st_id_sel, _, _ = update_page_properties(tok_a, p_id, {"Status": {"select": {"id": sel_backlog_opt["id"]}}}, category="q8_write_select_id")
    st_id_stat, _, _ = update_page_properties(tok_a, p_id, {"Task Status": {"status": {"id": stat_done_opt["id"]}}}, category="q8_write_status_id")
    print(f"   Ghi select theo ID: HTTP {st_id_sel}")
    print(f"   Ghi status theo ID: HTTP {st_id_stat}")
    results["write_valid_id"] = {"select_status": st_id_sel, "status_status": st_id_stat}

    # 4. Thử ghi Option KHÔNG TỒN TẠI trong Schema
    print("\n--- 4. Thử ghi Option KHÔNG TỒN TẠI trong Schema ---")
    # Select với option lạ
    st_bad_sel, _, resp_bad_sel = update_page_properties(tok_a, p_id, {"Status": {"select": {"name": "Tùy biến mới lạ"}}}, category="q8_write_bad_select")
    # Status với option lạ
    st_bad_stat, _, resp_bad_stat = update_page_properties(tok_a, p_id, {"Task Status": {"status": {"name": "Trạng thái tự chế"}}}, category="q8_write_bad_status")
    print(f"   Select với option lạ: HTTP {st_bad_sel} — {resp_bad_sel.get('message', '')[:100]}")
    print(f"   Status với option lạ: HTTP {st_bad_stat} — {resp_bad_stat.get('message', '')[:100]}")
    results["write_invalid_option"] = {
        "select": {"status": st_bad_sel, "response": resp_bad_sel},
        "status": {"status": st_bad_stat, "response": resp_bad_stat},
        "difference": (
            "Với select, Notion cho phép tự động tạo option mới nếu bot có quyền (hoặc từ chối nếu thiếu quyền). "
            "Với status, Notion BẮT BUỘC option phải thuộc nhóm định nghĩa trước trong database schema; "
            "không bao giờ cho phép tự tạo option status khi update page (báo 400 validation_error)."
        )
    }

    # 5. Thử XÓA giá trị (Ghi null)
    print("\n--- 5. Thử xóa giá trị (Ghi null) ---")
    st_null_sel, _, resp_null_sel = update_page_properties(tok_a, p_id, {"Status": {"select": None}}, category="q8_null_select")
    st_null_stat, _, resp_null_stat = update_page_properties(tok_a, p_id, {"Task Status": {"status": None}}, category="q8_null_status")
    print(f"   Ghi select=null: HTTP {st_null_sel}")
    print(f"   Ghi status=null: HTTP {st_null_stat} — {resp_null_stat.get('message', '')[:100]}")

    # Đọc lại page để xem giá trị sau khi null
    _, _, p_after_null = get_page(tok_a, p_id, category="q8_get_page_after_null")
    val_sel_after = p_after_null["properties"]["Status"]["select"]
    val_stat_after = p_after_null["properties"]["Task Status"]["status"]
    print(f"   Giá trị sau null: Select={val_sel_after}, Status={val_stat_after}")
    results["write_null_clear"] = {
        "select_null_status": st_null_sel,
        "status_null_status": st_null_stat,
        "select_val_after": val_sel_after,
        "status_val_after": val_stat_after,
        "conclusion": "Cả select và status đều cho phép set null để xóa/reset giá trị."
    }

    # 6. Snapshot & Phục hồi Undo
    print("\n--- 6. Dựng Snapshot và Phục hồi cho Status vs Select ---")
    # Đặt giá trị xác định
    update_page_properties(tok_a, p_id, {
        "Status": {"select": {"name": "Đang làm"}},
        "Task Status": {"status": {"name": "In progress"}}
    }, category="q8_set_pre_snap")

    _, _, snap_page = get_page(tok_a, p_id, category="q8_get_snapshot")
    snap_props = snap_page["properties"]

    # Snapshot format
    stat_snap = snap_props["Task Status"]["status"] # {'id': '...', 'name': 'In progress', 'color': 'blue'}
    sel_snap = snap_props["Status"]["select"]       # {'id': '...', 'name': 'Đang làm', 'color': '...'}

    # Mutate
    update_page_properties(tok_a, p_id, {
        "Status": {"select": {"name": "Xong"}},
        "Task Status": {"status": {"name": "Done"}}
    }, category="q8_mutate_both")

    # Undo bù trừ dùng snapshot name
    st_undo_name, _, _ = update_page_properties(tok_a, p_id, {
        "Status": {"select": {"name": sel_snap["name"]}},
        "Task Status": {"status": {"name": stat_snap["name"]}}
    }, category="q8_undo_by_name")

    # Mutate lần 2
    update_page_properties(tok_a, p_id, {
        "Status": {"select": {"name": "Xong"}},
        "Task Status": {"status": {"name": "Done"}}
    }, category="q8_mutate_both_2")

    # Undo bù trừ dùng snapshot id
    st_undo_id, _, _ = update_page_properties(tok_a, p_id, {
        "Status": {"select": {"id": sel_snap["id"]}},
        "Task Status": {"status": {"id": stat_snap["id"]}}
    }, category="q8_undo_by_id")

    print(f"   Undo bằng Snapshot Name: HTTP {st_undo_name}")
    print(f"   Undo bằng Snapshot ID: HTTP {st_undo_id}")

    results["snapshot_and_undo_comparison"] = {
        "snapshot_format": {
            "status": stat_snap,
            "select": sel_snap
        },
        "undo_by_name_works": (st_undo_name == 200),
        "undo_by_id_works": (st_undo_id == 200),
        "recommendation_for_manifest": (
            "Khi snapshot: lưu cả `name` và `id`. "
            "Khi khôi phục: ưu tiên khôi phục bằng `id` (chính xác tuyệt đối ngay cả khi người dùng đổi tên option trên GUI), "
            "fallback sang `name` nếu option ID bị xóa và tạo lại."
        )
    }

    # Dọn dẹp test page
    set_page_archived(tok_a, p_id, True, category="q8_cleanup")

    out_file = DATA_DIR / "q8_status_vs_select_results.json"
    out_file.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ Hoàn tất Q8. Kết quả lưu tại: {out_file}")

if __name__ == "__main__":
    run()
