import json
import re
from typing import Dict, Any, List
try:
    from .llm_client import LLMClient
    from .config import LLM_MODEL_STRONG
except ImportError:
    from llm_client import LLMClient
    from config import LLM_MODEL_STRONG

EVALUATOR_SYSTEM_PROMPT = """Bạn là chuyên gia thẩm định chất lượng hội thoại đúc kết quy tắc phê duyệt cho Desktop Assistant (theo PRD FR-AP-02 và FR-AP-04).
Nhiệm vụ của bạn là đọc toàn bộ transcript hội thoại và bản diễn giải quy tắc cuối cùng của Elicitation Agent, sau đó đối chiếu với GROUND TRUTH của bài toán để chấm điểm chính xác và khách quan.

CÁC TIÊU CHÍ ĐÁNH GIÁ:
1. Q2 - ĐÚNG Ý NGƯỜI DÙNG (Intent Accuracy):
   - Bản đúc kết cuối cùng (hoặc kết luận cuối cùng) có khớp với "Ý định thật" và "Điều kiện → hành động bị chặn" trong Ground Truth không?
   - Chặn đúng cái cần chặn: true/false.
   - Có bị Chặn Thừa (false-block: chặn những thứ người dùng không muốn chặn, ví dụ chặn cả Đọc, hoặc chặn cả Tạo mới khi chỉ muốn chặn Sửa)? true/false.
   - Có bị Chặn Thiếu (false-allow: bỏ lọt thao tác người dùng muốn chặn)? true/false.
   - Overall intent_accurate: true/false (true nếu chặn đúng, không chặn thừa, không chặn thiếu).

2. Q3 - XỬ LÝ CA KHÔNG / MỘT PHẦN BIÊN DỊCH ĐƯỢC (FR-AP-04):
   - Với các ca KHÔNG biên dịch được (R-18, R-20) hoặc MỘT PHẦN (R-08, R-19):
     + Agent có báo rõ ràng phần không hỗ trợ cho người dùng không? (explicitly_reported_unsupported: true/false)
     + Agent có bị LỖI NGHIÊM TRỌNG "âm thầm hạ cấp thành nhắc nhở mềm trong prompt" (silent_downgrade: true/false) không? (silent_downgrade = true nếu agent tự ý lưu lời nhắc mơ hồ vào system prompt hoặc tạo rule confirmed cho các thuộc tính không có thật).
     + Với ca CÓ biên dịch được bình thường: silent_downgrade = false, explicitly_reported_unsupported = true (N/A).

3. Q4 - HỎI LAN MAN (Wandering Analysis):
   - Agent có hỏi các câu hỏi không cần thiết, đi chệch khỏi "Thông tin còn thiếu" không? (wandering_questions_count: int).
   - Agent có dồn quá nhiều câu hỏi trong một lượt (>2 câu) không? (excessive_questions_per_turn: true/false).
   - Đánh giá chất lượng làm rõ: "tập trung" | "hơi lan man" | "rất lan man".

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON (không kèm markdown phụ ngoài JSON):
{
  "q2_intent_accurate": true,
  "q2_false_block": false,
  "q2_false_allow": false,
  "q2_analysis": "Giải thích ngắn gọn đối chiếu với Ý định thật...",
  "q3_explicitly_reported_unsupported": true,
  "q3_silent_downgrade": false,
  "q3_analysis": "Giải thích về FR-AP-04...",
  "q4_wandering_questions_count": 0,
  "q4_excessive_questions_per_turn": false,
  "q4_clarification_quality": "tập trung",
  "q4_analysis": "Giải thích về phong cách hỏi..."
}
"""

class Evaluator:
    def __init__(self, client: LLMClient, judge_model: str = LLM_MODEL_STRONG):
        self.client = client
        self.judge_model = judge_model

    def evaluate_dialogue(self, rule_info: Dict[str, Any], dialog_result: Dict[str, Any]) -> Dict[str, Any]:
        transcript_text = "\n".join([
            f"[{t['sender'].upper()} T{t['turn']}]: {t['content']}"
            for t in dialog_result["transcript"]
        ])

        prompt = f"""DƯỚI ĐÂY LÀ DỮ LIỆU ĐỂ CHẤM ĐIỂM:

[GROUND TRUTH TỪ CORPUS]
- Mã quy tắc: {rule_info['id']}
- Câu mở đầu người dùng: "{rule_info['user_statement']}"
- Ý định thật: {rule_info['true_intent']}
- Thông tin còn thiếu: {rule_info['missing_info']}
- Khả năng biên dịch theo chuẩn: {rule_info['compilable']}
- Điều kiện → hành động bị chặn chuẩn: {rule_info['condition_action']}
- Phần không hỗ trợ (nếu có): {rule_info['unsupported']}

[KẾT QUẢ PHIÊN HỘI THOẠI CẦN CHẤM]
- Model thử nghiệm: {dialog_result['elicitor_model']}
- Số lượt thực hiện: {dialog_result['turns_taken']}
- Trạng thái kết thúc: {dialog_result['terminal_status']}
- Bản diễn giải thu được:
{dialog_result['structured_interpretation']}

[TOÀN BỘ TRANSCRIPT]
{transcript_text}

Hãy đánh giá và trả về JSON theo đúng định dạng.
"""
        res = self.client.chat_completion(
            model=self.judge_model,
            messages=[
                {"role": "system", "content": EVALUATOR_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=1000
        )

        content = res["content"].strip()
        # Parse JSON
        m = re.search(r"\{.*\}", content, re.DOTALL)
        if m:
            eval_data = json.loads(m.group(0))
        else:
            raise ValueError(f"Could not parse evaluator output: {content}")

        # Add deterministic metadata
        eval_data["rule_id"] = rule_info["id"]
        eval_data["elicitor_model"] = dialog_result["elicitor_model"]
        eval_data["turns_taken"] = dialog_result["turns_taken"]
        eval_data["terminal_status"] = dialog_result["terminal_status"]
        eval_data["total_tokens"] = dialog_result.get("total_tokens", 0)

        # Q1 convergence
        # A dialogue converged if it reached CONFIRMED for compilable/partial,
        # or reached UNSUPPORTED for uncompilable rules.
        is_converged = False
        if rule_info["compilable"] in ["CÓ", "MỘT PHẦN"]:
            is_converged = (dialog_result["terminal_status"] == "CONFIRMED")
        else: # KHÔNG
            is_converged = (dialog_result["terminal_status"] == "UNSUPPORTED" or not eval_data.get("q3_silent_downgrade", True))

        eval_data["q1_is_converged"] = is_converged

        return eval_data
