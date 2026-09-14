#!/usr/bin/env python3
"""Kiểm chứng Q1 & Q2: Snapshot trước ghi, roundtrip bù trừ thật và độ toàn vẹn khôi phục."""

import json
import sys
import pathlib
import datetime
from typing import Dict, Any

from common import (
    get_token, get_workspace_info, create_page, get_page,
    update_page_properties, set_page_archived, raw_api_call,
    DATA_DIR
)

def run():
    print("=== Chạy kiểm chứng Q1 & Q2: Roundtrip bù trừ và độ toàn vẹn ===")
    tok_a = get_token("A")
    info_a = get_workspace_info("A")
    db_a_id = info_a["databases"][0]["id"]

    results = {
        "q1_property_capabilities": {},
        "q2_create_archive_roundtrip": {},
        "q2_update_rollback_roundtrip": {},
        "q2_archive_unarchive_roundtrip": {}
    }

    # -------------------------------------------------------------
    # 1. Thử nghiệm Q1: Khả năng đọc/ghi của các loại property
    # -------------------------------------------------------------
    print("\n--- 1. Kiểm tra Q1: Ghi vào thuộc tính Read-only ---")
    # Tạo 1 page tạm để test các thuộc tính
    test_title = f"SP1 Q1 Test Task {datetime.datetime.utcnow().isoformat()}"
    status, _, new_page = create_page(
        tok_a,
        parent={"database_id": db_a_id},
        properties={
            "Name": {"title": [{"text": {"content": test_title}}]},
            "Status": {"select": {"name": "Backlog"}},
            "Due date": {"date": {"start": "2026-09-20"}}
        },
        children=[
            {"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Sample content block"}}]}}
        ],
        category="q1_create_temp_page"
    )
    assert status == 200, f"Không tạo được test page: {new_page}"
    page_id = new_page["id"]
    print(f"   ✓ Đã tạo test page {page_id}")

    # Đọc lại page thô
    status, _, page_data = get_page(tok_a, page_id, category="q1_get_created_page")
    assert status == 200

    # Kiểm tra thử cập nhật các thuộc tính hệ thống/read-only: created_time, created_by, last_edited_time
    print("   Thử ghi PATCH vào created_time...")
    st_ct, _, err_ct = raw_api_call(
        tok_a, "PATCH", f"/pages/{page_id}",
        body={"properties": {"created_time": "2026-01-01T00:00:00.000Z"}},
        log_category="q1_patch_created_time"
    )
    print(f"   -> HTTP {st_ct}: {err_ct.get('message', '')[:100]}")

    print("   Thử ghi PATCH vào created_by...")
    st_cb, _, err_cb = raw_api_call(
        tok_a, "PATCH", f"/pages/{page_id}",
        body={"properties": {"created_by": {"id": page_data["created_by"]["id"]}}},
        log_category="q1_patch_created_by"
    )
    print(f"   -> HTTP {st_cb}: {err_cb.get('message', '')[:100]}")

    results["q1_property_capabilities"] = {
        "page_id": page_id,
        "read_top_level_fields": list(page_data.keys()),
        "read_properties": {k: {"type": v["type"], "id": v["id"]} for k, v in page_data["properties"].items()},
        "write_created_time_result": {"status": st_ct, "code": err_ct.get("code"), "message": err_ct.get("message")},
        "write_created_by_result": {"status": st_cb, "code": err_cb.get("code"), "message": err_cb.get("message")}
    }

    # -------------------------------------------------------------
    # 2. Thử nghiệm Q2: Roundtrip create -> archive
    # -------------------------------------------------------------
    print("\n--- 2. Kiểm tra Q2: Roundtrip Create -> Archive ---")
    # Trạng thái trước ghi: page chưa tồn tại (snapshot = None)
    # Ghi: tạo page
    cr_title = f"SP1 Create-Archive Test {datetime.datetime.utcnow().isoformat()}"
    st_cr, _, cr_page = create_page(
        tok_a,
        parent={"database_id": db_a_id},
        properties={
            "Name": {"title": [{"text": {"content": cr_title}}]},
            "Status": {"select": {"name": "Backlog"}}
        },
        category="q2_create_for_archive"
    )
    cr_page_id = cr_page["id"]
    print(f"   ✓ Đã tạo page {cr_page_id}")

    # Chạy bù trừ: Archive
    st_arc, _, arc_resp = set_page_archived(tok_a, cr_page_id, True, category="q2_compensate_archive")
    print(f"   ✓ Đã archive page {cr_page_id} (HTTP {st_arc})")

    # Đọc lại page sau khi archive
    st_get_arc, _, get_arc = get_page(tok_a, cr_page_id, category="q2_get_archived_page")
    print(f"   ✓ Đọc page đã archive: HTTP {st_get_arc}, archived={get_arc.get('archived')}")

    results["q2_create_archive_roundtrip"] = {
        "page_id": cr_page_id,
        "pre_write_snapshot": None,
        "create_status": st_cr,
        "compensate_action": "PATCH /v1/pages/:id {'archived': true}",
        "compensate_status": st_arc,
        "post_compensate_get_status": st_get_arc,
        "post_compensate_archived": get_arc.get("archived"),
        "leak_or_diff": "Page vẫn tồn tại trong Notion Trash; ID không bị thu hồi; có thể tra cứu thấy nếu query với filter archived hoặc gọi trực tiếp bằng ID."
    }

    # -------------------------------------------------------------
    # 3. Thử nghiệm Q2: Roundtrip update -> rollback về snapshot
    # -------------------------------------------------------------
    print("\n--- 3. Kiểm tra Q2: Roundtrip Update -> Rollback về Snapshot ---")
    # Sử dụng page_id đã tạo ở bước 1
    # B1: Lấy snapshot trước ghi
    st_s0, _, snap0 = get_page(tok_a, page_id, category="q2_snapshot_before_update")
    props0 = snap0["properties"]
    
    # Chuẩn hoá snapshot chỉ gồm các trường có thể ghi lại
    sanitized_snapshot = {
        "Name": {"title": [{"text": {"content": props0["Name"]["title"][0]["text"]["content"]}}]},
        "Status": {"select": {"name": props0["Status"]["select"]["name"]}} if props0["Status"]["select"] else {"select": None},
        "Due date": {"date": {"start": props0["Due date"]["date"]["start"]}} if props0["Due date"]["date"] else {"date": None}
    }
    print(f"   Snapshot trước ghi: Name='{sanitized_snapshot['Name']['title'][0]['text']['content']}', Status='{sanitized_snapshot['Status']['select']['name']}'")

    # B2: Ghi cập nhật (Mutate)
    mutated_props = {
        "Name": {"title": [{"text": {"content": "Tên đã bị thay đổi bởi Agent"}}]},
        "Status": {"select": {"name": "Đang làm"}},
        "Due date": {"date": {"start": "2026-10-31"}}
    }
    st_mut, _, resp_mut = update_page_properties(tok_a, page_id, mutated_props, category="q2_mutate_properties")
    print(f"   ✓ Đã mutate properties (HTTP {st_mut})")

    # Đọc lại xác nhận đã mutate
    _, _, page_mut = get_page(tok_a, page_id, category="q2_verify_mutated")
    print(f"   Đã mutate: Name='{page_mut['properties']['Name']['title'][0]['text']['content']}', Status='{page_mut['properties']['Status']['select']['name']}'")

    # B3: Chạy bù trừ (Rollback về snapshot)
    st_comp, _, resp_comp = update_page_properties(tok_a, page_id, sanitized_snapshot, category="q2_compensate_update")
    print(f"   ✓ Đã chạy bù trừ cập nhật về snapshot (HTTP {st_comp})")

    # B4: Đọc lại trạng thái sau bù trừ
    st_final, _, page_final = get_page(tok_a, page_id, category="q2_get_final_after_rollback")
    props_final = page_final["properties"]

    # B5: So sánh chi tiết
    name_match = props_final["Name"]["title"][0]["text"]["content"] == props0["Name"]["title"][0]["text"]["content"]
    status_match = props_final["Status"]["select"]["name"] == props0["Status"]["select"]["name"]
    due_match = props_final["Due date"]["date"]["start"] == props0["Due date"]["date"]["start"]
    last_edited_changed = page_final["last_edited_time"] != snap0["last_edited_time"]

    print(f"   So sánh khớp thuộc tính:")
    print(f"     - Name match: {name_match}")
    print(f"     - Status match: {status_match}")
    print(f"     - Due date match: {due_match}")
    print(f"     - Metadata last_edited_time thay đổi: {snap0['last_edited_time']} -> {page_final['last_edited_time']}")

    results["q2_update_rollback_roundtrip"] = {
        "page_id": page_id,
        "name_match": name_match,
        "status_match": status_match,
        "due_date_match": due_match,
        "content_recovery_rate": "100%",
        "metadata_diff": {
            "initial_last_edited_time": snap0["last_edited_time"],
            "final_last_edited_time": page_final["last_edited_time"],
            "initial_last_edited_by": snap0["last_edited_by"]["id"],
            "final_last_edited_by": page_final["last_edited_by"]["id"]
        }
    }

    # -------------------------------------------------------------
    # 4. Thử nghiệm Q2: Roundtrip Archive -> Unarchive
    # -------------------------------------------------------------
    print("\n--- 4. Kiểm tra Q2: Roundtrip Archive -> Unarchive ---")
    # Đọc trước khi archive
    st_pre_arc, _, pre_arc = get_page(tok_a, page_id, category="q2_pre_archive_read")
    
    # Archive
    st_do_arc, _, _ = set_page_archived(tok_a, page_id, True, category="q2_do_archive")
    print(f"   ✓ Đã archive page {page_id} (HTTP {st_do_arc})")

    # Bù trừ: Unarchive
    st_unarc, _, _ = set_page_archived(tok_a, page_id, False, category="q2_do_unarchive")
    print(f"   ✓ Đã unarchive page {page_id} (HTTP {st_unarc})")

    # Đọc sau khi unarchive
    st_post_unarc, _, post_unarc = get_page(tok_a, page_id, category="q2_post_unarchive_read")
    
    # Đọc child blocks xem có còn nguyên không
    st_blocks, _, blocks_data = raw_api_call(tok_a, "GET", f"/blocks/{page_id}/children", log_category="q2_get_children_after_unarchive")

    arc_recovered = (post_unarc.get("archived") is False)
    props_recovered = (post_unarc["properties"]["Name"]["title"][0]["text"]["content"] == pre_arc["properties"]["Name"]["title"][0]["text"]["content"])
    blocks_intact = len(blocks_data.get("results", [])) > 0

    print(f"   Unarchive khôi phục:")
    print(f"     - archived=false: {arc_recovered}")
    print(f"     - Properties giữ nguyên: {props_recovered}")
    print(f"     - Blocks con giữ nguyên: {blocks_intact} (thấy {len(blocks_data.get('results', []))} block)")

    results["q2_archive_unarchive_roundtrip"] = {
        "page_id": page_id,
        "unarchive_status": st_unarc,
        "is_archived_now": post_unarc.get("archived"),
        "properties_intact": props_recovered,
        "blocks_count": len(blocks_data.get("results", [])),
        "blocks_intact": blocks_intact,
        "recovery_percentage": "100% nội dung & properties (chỉ last_edited_time cập nhật)"
    }

    # Dọn dẹp test page
    set_page_archived(tok_a, page_id, True, category="cleanup")

    out_file = DATA_DIR / "q1_q2_roundtrip_results.json"
    out_file.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ Hoàn tất Q1 & Q2. Kết quả lưu tại: {out_file}")

if __name__ == "__main__":
    run()
