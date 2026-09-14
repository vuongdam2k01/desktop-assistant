#!/usr/bin/env python3
"""Kiểm chứng Q4: Ánh xạ thao tác 'Di chuyển / sắp xếp lại task' và thuật toán dò schema cột thứ tự."""

import json
import re
from typing import Dict, Any, Optional, Tuple

from common import (
    get_token, get_workspace_info, get_database, query_database,
    update_page_properties, raw_api_call, DATA_DIR
)

ORDER_PATTERNS = [r"^order$", r"^thứ\s*tự$", r"^stt$", r"^vị\s*trí$", r"^pos(ition)?$", r"^rank$", r"^sort$"]
PRIORITY_PATTERNS = [r"^priority$", r"^ưu\s*tiên$", r"^mức\s*độ$", r"^độ\s*ưu\s*tiên$", r"^urgency$", r"^importance$"]
STATUS_PATTERNS = [r"^status$", r"^trạng\s*thái$", r"^state$", r"^tiến\s*độ$"]

def detect_ordering_schema(db_schema: Dict[str, Any]) -> Dict[str, Any]:
    props = db_schema.get("properties", {})
    detected = {
        "order_property": None,
        "priority_property": None,
        "status_property": None,
        "reorder_capability": "none"
    }

    # 1. Tìm cột Order (phải là kiểu number)
    for name, p in props.items():
        if p["type"] == "number":
            for pat in ORDER_PATTERNS:
                if re.search(pat, name.strip(), re.IGNORECASE):
                    detected["order_property"] = {"name": name, "type": "number", "id": p["id"]}
                    break
        if detected["order_property"]:
            break

    # 2. Tìm cột Priority (thường là select hoặc status)
    for name, p in props.items():
        if p["type"] in ("select", "status"):
            for pat in PRIORITY_PATTERNS:
                if re.search(pat, name.strip(), re.IGNORECASE):
                    detected["priority_property"] = {"name": name, "type": p["type"], "id": p["id"]}
                    break
        if detected["priority_property"]:
            break

    # 3. Tìm cột Status
    for name, p in props.items():
        if p["type"] in ("status", "select"):
            for pat in STATUS_PATTERNS:
                if re.search(pat, name.strip(), re.IGNORECASE):
                    detected["status_property"] = {"name": name, "type": p["type"], "id": p["id"]}
                    break
        if detected["status_property"]:
            break

    if detected["order_property"]:
        detected["reorder_capability"] = "numeric_order_property"
    elif detected["status_property"]:
        detected["reorder_capability"] = "status_group_move_only"
    else:
        detected["reorder_capability"] = "unsupported"

    return detected

def run():
    print("=== Chạy kiểm chứng Q4: Di chuyển / Sắp xếp lại task ===")
    tok_a = get_token("A")
    info_a = get_workspace_info("A")
    db_a_id = info_a["databases"][0]["id"]

    tok_c = get_token("C")
    info_c = get_workspace_info("C")
    db_c_id = info_c["databases"][0]["id"]

    results = {
        "workspace_a_schema_detection": {},
        "workspace_c_schema_detection": {},
        "native_order_patch_attempt": {},
        "workspace_c_reorder_test": {}
    }

    # 1. Dò schema Workspace A
    st_a, _, db_a = get_database(tok_a, db_a_id, category="q4_get_db_a")
    det_a = detect_ordering_schema(db_a)
    print(f"Workspace A (spike-a-simple):")
    print(f"   - Order property: {det_a['order_property']}")
    print(f"   - Status property: {det_a['status_property']}")
    print(f"   - Reorder capability: {det_a['reorder_capability']}")
    results["workspace_a_schema_detection"] = det_a

    # 2. Thử gọi PATCH native position trên Notion API (để chứng minh Notion không có thuộc tính vị trí ngầm)
    print("\n--- Thử PATCH position trực tiếp lên Notion API ---")
    st_q, _, sample_a = query_database(tok_a, db_a_id, page_size=1, category="q4_query_sample_a")
    sample_page_id = sample_a["results"][0]["id"]
    st_pos, _, pos_resp = raw_api_call(
        tok_a, "PATCH", f"/pages/{sample_page_id}",
        body={"position": {"after": sample_page_id}},
        log_category="q4_patch_native_position"
    )
    print(f"   PATCH position: HTTP {st_pos} — {pos_resp.get('message', '')[:100]}")
    results["native_order_patch_attempt"] = {
        "status": st_pos,
        "response": pos_resp,
        "conclusion": "Notion API không có thuộc tính hoặc endpoint native nào cho phép đổi vị trí hiển thị (row position) của page trong view."
    }

    # 3. Dò schema Workspace C
    print(f"\nWorkspace C (spike-c-order):")
    st_c, _, db_c = get_database(tok_c, db_c_id, category="q4_get_db_c")
    det_c = detect_ordering_schema(db_c)
    print(f"   - Order property: {det_c['order_property']}")
    print(f"   - Priority property: {det_c['priority_property']}")
    print(f"   - Status property: {det_c['status_property']}")
    print(f"   - Reorder capability: {det_c['reorder_capability']}")
    results["workspace_c_schema_detection"] = det_c

    # 4. Thực nghiệm đổi thứ tự trên Workspace C
    print("\n--- Thực nghiệm đổi Order trên Workspace C ---")
    st_qc, _, tasks_c = query_database(tok_c, db_c_id, page_size=2, category="q4_query_two_tasks_c")
    task1 = tasks_c["results"][0]
    task2 = tasks_c["results"][1]
    id1, id2 = task1["id"], task2["id"]
    order1 = task1["properties"]["Order"]["number"]
    order2 = task2["properties"]["Order"]["number"]
    name1 = task1["properties"]["Name"]["title"][0]["text"]["content"]
    name2 = task2["properties"]["Name"]["title"][0]["text"]["content"]
    print(f"   Task 1 '{name1}': Order = {order1}")
    print(f"   Task 2 '{name2}': Order = {order2}")

    # Đổi thứ tự: hoán đổi Order giữa task 1 và task 2
    new_order1 = order2
    new_order2 = order1
    print(f"   -> Hoán đổi Order: Task 1 set to {new_order1}, Task 2 set to {new_order2}")
    st_u1, _, _ = update_page_properties(tok_c, id1, {"Order": {"number": new_order1}}, category="q4_reorder_task1")
    st_u2, _, _ = update_page_properties(tok_c, id2, {"Order": {"number": new_order2}}, category="q4_reorder_task2")

    # Kiểm tra lại
    st_g1, _, g1 = raw_api_call(tok_c, "GET", f"/pages/{id1}", log_category="q4_verify_reorder1")
    st_g2, _, g2 = raw_api_call(tok_c, "GET", f"/pages/{id2}", log_category="q4_verify_reorder2")
    cur_order1 = g1["properties"]["Order"]["number"]
    cur_order2 = g2["properties"]["Order"]["number"]
    print(f"   Sau khi hoán đổi: Task 1 Order={cur_order1}, Task 2 Order={cur_order2}")

    # Chạy bù trừ (undo) hoàn trả lại Order ban đầu
    print("   -> Bù trừ: Trả Order về giá trị snapshot ban đầu...")
    update_page_properties(tok_c, id1, {"Order": {"number": order1}}, category="q4_undo_reorder1")
    update_page_properties(tok_c, id2, {"Order": {"number": order2}}, category="q4_undo_reorder2")

    # Kiểm tra sau bù trừ
    _, _, final1 = raw_api_call(tok_c, "GET", f"/pages/{id1}", log_category="q4_check_undo_order1")
    _, _, final2 = raw_api_call(tok_c, "GET", f"/pages/{id2}", log_category="q4_check_undo_order2")
    final_order1 = final1["properties"]["Order"]["number"]
    final_order2 = final2["properties"]["Order"]["number"]
    print(f"   Sau bù trừ: Task 1 Order={final_order1}, Task 2 Order={final_order2} (Khớp 100%: {final_order1 == order1 and final_order2 == order2})")

    results["workspace_c_reorder_test"] = {
        "task1_id": id1,
        "task2_id": id2,
        "initial_orders": [order1, order2],
        "swapped_orders": [cur_order1, cur_order2],
        "restored_orders": [final_order1, final_order2],
        "reorder_successful": (cur_order1 == new_order1 and cur_order2 == new_order2),
        "undo_successful": (final_order1 == order1 and final_order2 == order2)
    }

    out_file = DATA_DIR / "q4_ordering_results.json"
    out_file.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✓ Hoàn tất Q4. Kết quả lưu tại: {out_file}")

if __name__ == "__main__":
    run()
