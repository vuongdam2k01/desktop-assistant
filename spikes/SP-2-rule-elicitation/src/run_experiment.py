import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Any, List

# Add src to sys.path
SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from config import (
    LLM_MODEL_STRONG,
    LLM_MODEL_CHEAP,
    EVIDENCE_DIR,
    RULES_FILE
)
from corpus_parser import parse_corpus
from llm_client import LLMClient
from dialog_runner import DialogRunner
from evaluator import Evaluator
from prompts import ELICITATION_SYSTEM_PROMPT_V0

def save_transcript(output_dir: Path, rule_id: str, dialog_res: Dict[str, Any], eval_res: Dict[str, Any]):
    # Save JSON
    json_path = output_dir / f"{rule_id}.json"
    full_data = {
        "dialog": dialog_res,
        "evaluation": eval_res
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(full_data, f, ensure_ascii=False, indent=2)

    # Save human-readable Markdown
    md_path = output_dir / f"{rule_id}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Transcript {rule_id} — Model: {dialog_res['elicitor_model']}\n\n")
        f.write(f"- **Số lượt:** {dialog_res['turns_taken']}\n")
        f.write(f"- **Trạng thái:** {dialog_res['terminal_status']}\n")
        f.write(f"- **Hội tụ (Q1):** {'ĐẠT' if eval_res.get('q1_is_converged') else 'KHÔNG'}\n")
        f.write(f"- **Đúng ý (Q2):** {'ĐÚNG' if eval_res.get('q2_intent_accurate') else 'SAI'} (Chặn thừa: {eval_res.get('q2_false_block')}, Chặn thiếu: {eval_res.get('q2_false_allow')})\n")
        f.write(f"- **Xử lý FR-AP-04 (Q3):** Báo rõ không hỗ trợ: {eval_res.get('q3_explicitly_reported_unsupported')}, Âm thầm hạ cấp: {eval_res.get('q3_silent_downgrade')}\n")
        f.write(f"- **Hỏi lan man (Q4):** {eval_res.get('q4_clarification_quality')} (Số câu thừa: {eval_res.get('q4_wandering_questions_count')})\n\n")
        f.write("## Diễn biến hội thoại\n\n")
        for t in dialog_res["transcript"]:
            sender_name = "👤 Người dùng" if t["sender"] == "user" else "🤖 Elicitation Agent"
            f.write(f"### {sender_name} (Lượt {t['turn']})\n\n{t['content']}\n\n")
        f.write("## Đánh giá chi tiết của Evaluator\n\n")
        f.write(f"- **Nhận xét Q2:** {eval_res.get('q2_analysis')}\n")
        f.write(f"- **Nhận xét Q3:** {eval_res.get('q3_analysis')}\n")
        f.write(f"- **Nhận xét Q4:** {eval_res.get('q4_analysis')}\n")

def run_model_batch(rules: List[Dict[str, Any]], model_name: str, batch_name: str, force: bool = False) -> List[Dict[str, Any]]:
    client = LLMClient()
    runner = DialogRunner(client=client, simulator_model=LLM_MODEL_STRONG, max_turns=6)
    evaluator = Evaluator(client=client, judge_model=LLM_MODEL_STRONG)

    output_dir = EVIDENCE_DIR / f"transcripts_{batch_name}"
    output_dir.mkdir(parents=True, exist_ok=True)

    batch_evals = []
    print(f"\n==================================================")
    print(f"BẮT ĐẦU BATCH: {batch_name.upper()} ({model_name})")
    print(f"Tổng số quy tắc: {len(rules)}")
    print(f"==================================================")

    for idx, r in enumerate(rules, 1):
        rule_id = r["id"]
        json_path = output_dir / f"{rule_id}.json"

        # Kiểm tra file đã tồn tại để bỏ qua (trừ khi có cờ --force)
        if json_path.exists() and not force:
            print(f"SKIP {batch_name}/{rule_id} (đã có)")
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                batch_evals.append(data["evaluation"])
            continue

        print(f"\n[{idx}/{len(rules)}] Chạy {rule_id} ({r['difficulty']})...")
        t0 = time.time()
        dialog_res = runner.run_elicitation(r, elicitor_model=model_name)
        dt_dialog = time.time() - t0
        print(f"    -> Hội thoại kết thúc sau {dialog_res['turns_taken']} lượt ({dt_dialog:.1f}s), trạng thái: {dialog_res['terminal_status']}")

        print(f"    -> Đang chấm điểm với Evaluator...")
        t1 = time.time()
        eval_res = evaluator.evaluate_dialogue(r, dialog_res)
        dt_eval = time.time() - t1
        print(f"    -> Chấm điểm xong ({dt_eval:.1f}s): Q1 converged={eval_res['q1_is_converged']}, Q2 accurate={eval_res['q2_intent_accurate']}, Q3 silent_downgrade={eval_res['q3_silent_downgrade']}")

        save_transcript(output_dir, rule_id, dialog_res, eval_res)
        batch_evals.append(eval_res)

        # Small delay between runs
        time.sleep(1)

    return batch_evals

def compute_summary_stats(evals: List[Dict[str, Any]], model_name: str, rules: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    n = len(evals)
    if n == 0:
        return {}

    rule_lookup = {r["id"]: r for r in rules} if rules else {}

    turns = [e["turns_taken"] for e in evals]
    converged_count = sum(1 for e in evals if e.get("q1_is_converged"))
    intent_acc_count = sum(1 for e in evals if e.get("q2_intent_accurate"))
    false_block_count = sum(1 for e in evals if e.get("q2_false_block"))
    false_allow_count = sum(1 for e in evals if e.get("q2_false_allow"))

    # Q3 subset: R-08, R-18, R-19, R-20
    q3_rules = ["R-08", "R-18", "R-19", "R-20"]
    q3_evals = [e for e in evals if e["rule_id"] in q3_rules]
    q3_reported_count = sum(1 for e in q3_evals if e.get("q3_explicitly_reported_unsupported"))
    q3_silent_downgrades = sum(1 for e in q3_evals if e.get("q3_silent_downgrade"))
    q3_details = {}
    for e in q3_evals:
        q3_details[e["rule_id"]] = {
            "explicitly_reported": e.get("q3_explicitly_reported_unsupported"),
            "silent_downgrade": e.get("q3_silent_downgrade"),
            "analysis": e.get("q3_analysis")
        }

    # Q4: wandering
    total_wandering_qs = sum(e.get("q4_wandering_questions_count", 0) for e in evals)
    quality_counts = {}
    excessive_questions_count = sum(1 for e in evals if e.get("q4_excessive_questions_per_turn"))
    for e in evals:
        q = e.get("q4_clarification_quality", "unknown")
        quality_counts[q] = quality_counts.get(q, 0) + 1

    turns_sorted = sorted(turns)
    median_turns = turns_sorted[n // 2] if n % 2 != 0 else (turns_sorted[n // 2 - 1] + turns_sorted[n // 2]) / 2

    # Breakdown by difficulty
    by_difficulty = {}
    if rule_lookup:
        for diff_key in ["dễ", "trung bình", "khó"]:
            diff_evals = [
                e for e in evals 
                if rule_lookup.get(e["rule_id"], {}).get("difficulty", "").lower().startswith(diff_key)
            ]
            if diff_evals:
                d_turns = [e["turns_taken"] for e in diff_evals]
                d_sorted = sorted(d_turns)
                d_n = len(diff_evals)
                d_med = d_sorted[d_n // 2] if d_n % 2 != 0 else (d_sorted[d_n // 2 - 1] + d_sorted[d_n // 2]) / 2
                d_acc = sum(1 for e in diff_evals if e.get("q2_intent_accurate"))
                d_fb = sum(1 for e in diff_evals if e.get("q2_false_block"))
                d_fa = sum(1 for e in diff_evals if e.get("q2_false_allow"))
                by_difficulty[diff_key] = {
                    "count": d_n,
                    "turns_mean": round(sum(d_turns) / d_n, 2),
                    "turns_median": d_med,
                    "turns_min": min(d_turns),
                    "turns_max": max(d_turns),
                    "accurate_count": d_acc,
                    "accuracy_rate": round(d_acc / d_n * 100, 1),
                    "false_block_count": d_fb,
                    "false_allow_count": d_fa
                }

    return {
        "model_name": model_name,
        "total_rules": n,
        "q1_convergence": {
            "converged_count": converged_count,
            "convergence_rate": round(converged_count / n * 100, 1),
            "turns_mean": round(sum(turns) / n, 2),
            "turns_median": median_turns,
            "turns_min": min(turns),
            "turns_max": max(turns),
            "by_difficulty": by_difficulty
        },
        "q2_intent_accuracy": {
            "accurate_count": intent_acc_count,
            "accuracy_rate": round(intent_acc_count / n * 100, 1),
            "false_block_count": false_block_count,
            "false_block_rate": round(false_block_count / n * 100, 1),
            "false_allow_count": false_allow_count,
            "false_allow_rate": round(false_allow_count / n * 100, 1)
        },
        "q3_uncompilable_handling": {
            "total_q3_cases": len(q3_evals),
            "explicitly_reported_count": q3_reported_count,
            "explicitly_reported_rate": round(q3_reported_count / len(q3_evals) * 100, 1) if q3_evals else 0,
            "silent_downgrades_count": q3_silent_downgrades,
            "silent_downgrade_rate": round(q3_silent_downgrades / len(q3_evals) * 100, 1) if q3_evals else 0,
            "cases": q3_details
        },
        "q4_wandering": {
            "total_wandering_questions": total_wandering_qs,
            "avg_wandering_per_dialog": round(total_wandering_qs / n, 2),
            "excessive_questions_per_turn_count": excessive_questions_count,
            "quality_breakdown": quality_counts,
            "turn_distribution": {t: turns.count(t) for t in sorted(set(turns))}
        }
    }
def generate_rule_templates_sp8(rules: List[Dict[str, Any]]) -> str:
    """Generates the required rule patterns catalog for SP-8 Rule IR."""
    content = """# Danh mục Mẫu Quy Tắc Phê Duyệt (Rule Patterns Catalog) — Input cho SP-8 Rule IR

> Tạo từ kết quả Spike SP-2 (11/09/2026).
> Đây là ĐẦU RA QUAN TRỌNG NHẤT của SP-2: danh sách các mẫu quy tắc bắt buộc mà kiến trúc Rule IR (SP-8) và Evaluator cứng phải diễn đạt được mà không cần đọc lại toàn bộ transcript.

---

## 1. Trục phân loại biểu thức điều kiện (Predicate Axes)

Dựa trên phân tích toàn bộ 20 quy tắc R-01..R-20 và các quyết định đã chốt của Product Owner (11/09/2026), Rule IR bắt buộc phải có các trường biểu diễn cho 7 trục điều kiện:

1. **Thao tác / Tool Call (`tool_pattern`)**:
   - Khớp danh sách tool: `archive_page`, `delete_block`, `update_page_properties`, `create_page`, `update_database`.
   - Khớp nhóm thao tác: `WRITE_TOOLS = {create_page, update_page_properties, archive_page, delete_block, update_database}`.
   - Thao tác ĐỌC (`query_database`, `get_page`, `search`) luôn được miễn trừ theo thiết kế (R-10).

2. **Đối tượng & Vùng tác động (`target_scope`)**:
   - `target.database_id == <id>`: Định danh database đích cụ thể (neo theo UUID, không neo theo tên chuỗi hiển thị).
   - `target.database_id in <list_of_ids>`: Nhóm database (ví dụ: database team R-06).
   - `target.id in <ancestor_ids>`: Phân cấp phân vùng (page con/database con nằm dưới một page gốc, ví dụ Q3 roadmap R-10).

3. **Thuộc tính thay đổi (`property_change` / `property_transition`)**:
   - `changed_properties contains <prop_name>`: Ví dụ `Due date in changed_properties` (R-02), `Assignee in changed_properties` (R-11).
   - `property_transition`: Chuyển đổi trạng thái cụ thể:
     * `Status.new == 'Done'` (chỉ chặn khi mark Done, R-05).
     * `Assignee.new != {current_user}` (chặn khi gán cho người khác, R-11).
     * `Assignee.new contains <boss_id>` (gán cho sếp).

4. **Thời gian máy (`temporal_condition`)**:
   - Đánh giá theo đồng hồ hệ thống (`local_time`, múi giờ máy người dùng UTC+7):
     * `local_time not in [08:00, 18:00)` (ngoài giờ làm việc, R-04).
     * `day_of_week in [Saturday, Sunday]` (cuối tuần chặn cả ngày theo quyết định PO, R-04).

5. **Quyền sở hữu / Tác giả (`ownership_condition`)**:
   - `target.created_by`: Người tạo đối tượng:
     * `target.created_by not in {current_user, app_bot}` (đối tượng không do người dùng hoặc bot của người dùng tạo, R-12; PO chốt bot = user).
     * `target.created_by in PM_USER_IDS` (task do PM Linh/Tuấn tạo, R-13).
   - `target.Assignee`: Người phụ trách:
     * `current_user in target.Assignee` (task gán cho tôi).
     * `Linh_id in target.Assignee` HOẶC `target.created_by == Linh_id` (R-08; PO chốt cả hai OR).

6. **Ngưỡng số lượng & Trạng thái tích luỹ (`threshold_condition`)**:
   - `job_cumulative_count(write_operations) > 5`: Tổng số thao tác ghi trong cùng 1 job vượt quá ngưỡng 5 (R-15 theo quyết định PO).
   - `job_cumulative_count(changed_property == 'Due date') > 3`: Đổi deadline quá 3 task trong cùng 1 job (R-16).
   - `calendar_day_count(create_page) >= 10`: Đếm xuyên job trong ngày lịch từ 00:00 (R-17, đòi hỏi bộ đếm bền trong SQLite ledger).

7. **Ngoại lệ dựa trên trạng thái Job / Ledger (`exception_predicate`)**:
   - `target.page_id in ledger[current_job].created_page_ids`: Ngoại lệ cho phép xoá/archive task nếu chính job hiện tại vừa tạo ra task đó (R-07).

---

## 2. Bảng Ma Trận 20 Mẫu Quy Tắc (R-01 .. R-20) cho SP-8

| Mã | Câu nói ví dụ từ corpus | Điều kiện logic Rule IR bắt buộc | Hành động IR | Độ khó biểu diễn | Khả năng biên dịch |
| --- | --- | --- | --- | --- | --- |
| **R-01** | *"xoá gì cũng phải hỏi tao trước"* | `tool in [archive_page, delete_block]` | `APPROVAL` | Dễ | CÓ |
| **R-02** | *"đụng đến deadline là phải báo"* | `tool == update_page_properties AND 'Due date' in changed_properties` (không áp cho create) | `APPROVAL` | Dễ | CÓ |
| **R-03** | *"đừng đụng vào database HR portal"* | `tool in WRITE_TOOLS AND target.database_id == HR_PORTAL_DB_ID` | `APPROVAL` | Dễ | CÓ |
| **R-04** | *"ngoài giờ làm việc đừng tự ý sửa gì"* | `tool in WRITE_TOOLS AND (local_time not in [08:00, 18:00) OR is_weekend(local_time))` | `APPROVAL` | Dễ | CÓ |
| **R-05** | *"status cứ update dont ask, except khi mark Done"* | `tool == update_page_properties AND Status.new == 'Done'` | `APPROVAL` | Dễ | CÓ |
| **R-06** | *"chỉ tạo task trong personal, cấm tạo vào team"* | `tool == create_page AND target.database_id in TEAM_DB_IDS` | `APPROVAL` | Dễ | CÓ |
| **R-07** | *"đừng archive task trừ khi chính mày vừa tạo trong lần chạy này"* | `tool == archive_page AND target.page_id not in ledger[current_job].created_pages` | `APPROVAL` | Khó (cần ledger job) | CÓ |
| **R-08** | *"task của Linh thì đừng đụng vào"* | `tool in WRITE_TOOLS AND ('Linh' in target.Assignee OR target.created_by == 'Linh')` | `APPROVAL` | Trung bình | MỘT PHẦN (ngoại lệ chat ngoài duyệt tay) |
| **R-09** | *"đừng bao giờ archive cả database"* | `tool == archive_database OR (tool == update_database AND archived == true)` | `DENY` (Hardline) | Dễ | CÓ |
| **R-10** | *"never touch the Q3 roadmap page and its children"* | `tool in WRITE_TOOLS AND ROADMAP_PAGE_ID in (target.id + target.ancestor_ids)` | `DENY` | Trung bình (cây phả hệ) | CÓ |
| **R-11** | *"đừng tự ý đổi assignee của người khác, nhất là gán cho sếp"* | `tool == update_page_properties AND Assignee in changed_properties AND Assignee.new != {current_user}` | `APPROVAL` | Trung bình | CÓ |
| **R-12** | *"task ko phải tao tạo thì đừng sửa"* | `tool in {update_page_properties, archive_page, delete_block} AND target.created_by not in {current_user, app_bot}` | `APPROVAL` | Trung bình (bot=user) | CÓ |
| **R-13** | *"for PM-created tasks, status only. nothing else"* | `target.created_by in PM_IDS AND (tool != update_page_properties OR changed_properties - {'Status'} != empty)` | `APPROVAL` | Trung bình | CÓ |
| **R-14** | *"task của tao thì làm gì cũng đc, còn lại thì hỏi"* | `tool in WRITE_TOOLS AND NOT (current_user in target.Assignee OR target.created_by in {current_user, app_bot})` | `APPROVAL` | Trung bình | CÓ |
| **R-15** | *"sửa nhiều quá thì hỏi tao, đừng tự làm 1 đống"* | `count_distinct(job_modified_pages) > 5` | `APPROVAL` | Trung bình (đếm job) | CÓ |
| **R-16** | *"changing deadline of more than 3 tasks at once → confirm"* | `tool == update_page_properties AND 'Due date' in changed_properties AND count_distinct(job_deadline_modified_pages) > 3` | `APPROVAL` | Trung bình (lũy kế job) | CÓ |
| **R-17** | *"dont let it create more than like 10 tasks a day"* | `tool == create_page AND count(ledger.created_pages, since=today_00_00) >= 10` | `APPROVAL` | Khó (bộ đếm bền ledger) | CÓ |
| **R-18** | *"đừng làm gì ngu ngốc"* | Không có vị từ kỹ thuật -> **TỪ CHỐI TẠO RULE IR CỨNG**. Gợi ý Smart Mode. | `UNSUPPORTED` | Rất khó (ngữ nghĩa mờ) | KHÔNG |
| **R-19** | *"cái gì quan trọng thì hỏi tao, còn lại tự xử"* | Chặn cứng phần định nghĩa: `tool in WRITE_TOOLS AND (Priority == 'High' OR Due_date <= today+3d)`. Phần cảm nhận mờ giao Smart Mode. | `APPROVAL` | Khó (rút gọn vị từ) | MỘT PHẦN |
| **R-20** | *"just make sure nothing breaks the sprint ok"* | Không có thuộc tính Sprint -> **TỪ CHỐI TẠO RULE IR CỨNG**. Gợi ý map sang Due date. | `UNSUPPORTED` | Rất khó (thiếu schema) | KHÔNG |

---

## 3. Phân tích Ranh giới Cái KHÔNG biểu diễn được (Boundary of Uncompilability)

Theo FR-AP-04 và các bài học từ SP-2:

1. **Khái niệm mang tính đánh giá cảm tính / chủ quan (R-18 - "ngu ngốc", "hợp lý", "nguy hiểm")**:
   - *Lý do không biểu diễn được:* Rule IR là hệ thống deterministic không dùng LLM khi đánh giá ở hard gate. Khái niệm như "ngu ngốc" không có trường tương ứng trong payload tool call.
   - *Hành vi chuẩn của Elicitation Agent:* Phải từ chối tạo rule confirmed, cảnh báo rõ cho người dùng, và điều hướng: "Hệ thống chặn cứng không thể nhận diện hành vi 'ngu ngốc'. Để phòng ngừa rủi ro tổng quát, bạn có thể bật chế độ Smart Mode (LLM Risk Judge) hoặc thiết lập các quy tắc cụ thể (như cấm xoá, giới hạn số lượng)".
   - *Lỗi nghiêm trọng cần cấm:* Tuyệt đối không âm thầm hạ cấp bằng cách thêm dòng "Hãy cẩn thận, đừng làm gì ngu ngốc" vào system prompt của worker agent rồi báo cho người dùng là đã thiết lập xong.

2. **Khái niệm phụ thuộc vào ngữ cảnh ngoài hệ thống (R-08 - "trừ khi Linh nhắn qua tin nhắn ngoài")**:
   - *Lý do không biểu diễn được:* Desktop Assistant tương tác Notion không có quyền đọc tin nhắn Slack/Zalo cá nhân của người dùng với Linh tại thời điểm chạy tool call.
   - *Hành vi chuẩn của Elicitation Agent:* Giải thích rằng ngoại lệ này không tự động nhận biết được; quy tắc sẽ chặn cứng mọi hành vi sửa task của Linh, và khi bot dừng hỏi phê duyệt, người dùng sẽ tự bấm Approve nếu đã có tin nhắn của Linh.

3. **Thuộc tính không tồn tại trong Schema của Workspace (R-20 - "Sprint")**:
   - *Lý do không biểu diễn được:* Cả 3 workspace Notion (A, B, C) đều không có thuộc tính kiểu `Sprint` hay `Iteration`.
   - *Hành vi chuẩn của Elicitation Agent:* Thông báo workspace hiện tại không có thuộc tính Sprint. Không được tự ý bịa ra trường "Sprint" trong IR. Hướng dẫn người dùng chọn thuộc tính thay thế (ví dụ: Due date trong tuần này, hoặc Priority High).

---

## 4. Khuyến nghị kiến trúc Rule IR cho SP-8

1. **Cấu trúc JSON Schema đóng (Closed Deterministic Schema)**:
   - Một rule IR gồm: `id`, `name`, `action` (`APPROVAL` | `DENY`), `priority`, `predicate`.
   - `predicate` là cây biểu thức logic đệ quy gồm:
     * Logic nodes: `{"and": [...]}`, `{"or": [...]}`, `{"not": ...}`
     * Comparison nodes: `{"field": "...", "operator": "eq"|"in"|"contains"|"gt"|"gte", "value": ...}`
     * Ledger query nodes: `{"ledger_counter": "job_modified_pages", "operator": "gt", "value": 5}`
2. **Không phụ thuộc LLM tại Runtime**:
   - Evaluator của SP-8 phải chạy hoàn toàn bằng TypeScript / regex / so sánh logic thuần túy (<1ms) để đảm bảo độ trễ không làm chậm vòng lặp agent (NFR-RL).
3. **Hai cổng hành động phân biệt rõ rệt**:
   - `APPROVAL`: Treo tool call, kích hoạt Card phê duyệt trên UI Pet/Electron để người dùng bấm (Allow / Deny).
   - `DENY`: Hardline blocklist (FR-AP-10) từ chối lập tức, ghi lỗi vào ledger, không hiển thị nút Allow cho người dùng.
"""
    return content

def main():
    parser = argparse.ArgumentParser(description="Chạy thực nghiệm SP-2: Hội thoại đúc kết quy tắc")
    parser.add_argument("--force", action="store_true", help="Ép chạy lại toàn bộ transcript kể cả khi file đã tồn tại")
    args = parser.parse_args()

    print("Khởi động thực nghiệm SP-2...")
    rules = parse_corpus()
    print(f"Đã nạp {len(rules)} quy tắc từ {RULES_FILE.name}")

    # Save elicitation prompt v0
    prompt_v0_path = EVIDENCE_DIR / "elicitation_prompt_v0.md"
    with open(prompt_v0_path, "w", encoding="utf-8") as f:
        f.write("# System Prompt Đúc Kết Quy Tắc Phê Duyệt v0 (SP-2 Output)\n\n")
        f.write("```markdown\n")
        f.write(ELICITATION_SYSTEM_PROMPT_V0)
        f.write("\n```\n")
    print(f"Đã lưu prompt v0 vào {prompt_v0_path}")

    # Run Batch 1: STRONG
    strong_evals = run_model_batch(rules, LLM_MODEL_STRONG, "strong", force=args.force)

    # Run Batch 2: CHEAP
    cheap_evals = run_model_batch(rules, LLM_MODEL_CHEAP, "cheap", force=args.force)

    # Summary stats
    summary_strong = compute_summary_stats(strong_evals, LLM_MODEL_STRONG, rules=rules)
    summary_cheap = compute_summary_stats(cheap_evals, LLM_MODEL_CHEAP, rules=rules)

    full_summary = {
        "timestamp": "2026-09-11T14:30:00+07:00",
        "models": {
            "strong": summary_strong,
            "cheap": summary_cheap
        }
    }

    summary_path = EVIDENCE_DIR / "metrics_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(full_summary, f, ensure_ascii=False, indent=2)
    print(f"\nĐã lưu tổng hợp số đo vào {summary_path}")

    # Generate Rule Patterns Catalog for SP-8
    rule_templates_content = generate_rule_templates_sp8(rules)
    
    # Save to requested filename: evidence/rule-patterns-for-ir.md
    rule_patterns_path = EVIDENCE_DIR / "rule-patterns-for-ir.md"
    with open(rule_patterns_path, "w", encoding="utf-8") as f:
        f.write(rule_templates_content)
    print(f"Đã lưu danh mục mẫu quy tắc cho SP-8 vào {rule_patterns_path}")

    # Also keep backward compatibility filename rule_templates_for_sp8.md
    compat_path = EVIDENCE_DIR / "rule_templates_for_sp8.md"
    with open(compat_path, "w", encoding="utf-8") as f:
        f.write(rule_templates_content)

    print("\nThực nghiệm SP-2 HOÀN THÀNH!")

if __name__ == "__main__":
    main()
