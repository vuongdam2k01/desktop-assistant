import re
from typing import List, Dict, Any

try:
    from .config import RULES_FILE
except ImportError:
    from config import RULES_FILE

def parse_corpus(filepath=None) -> List[Dict[str, Any]]:
    if filepath is None:
        filepath = RULES_FILE
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    rules = []
    pattern = r"### (R-\d+)\s*\n(.*?)(?=\n### R-\d+|\n## |\n---|\Z)"
    matches = re.findall(pattern, content, re.DOTALL)

    for rule_id, block in matches:
        def extract_field(field_name: str, text: str) -> str:
            field_pattern = rf"- \*\*{re.escape(field_name)}\*\*\s*(.*?)(?=\n- \*\*|\Z)"
            m = re.search(field_pattern, text, re.DOTALL)
            if m:
                val = m.group(1).strip()
                val = re.sub(r'^\s*["“](.*)["”]\s*$', r'\1', val)
                return val.strip()
            return ""

        user_statement = extract_field("Câu người dùng nói:", block)
        true_intent = extract_field("Ý định thật:", block)
        missing_info = extract_field("Thông tin còn thiếu:", block)
        compilable = extract_field("Biên dịch được thành luật cứng?", block)
        condition_action = extract_field("Nếu CÓ — điều kiện → hành động bị chặn:", block)
        unsupported = extract_field("Nếu KHÔNG/MỘT PHẦN — phần nào không hỗ trợ:", block)
        difficulty = extract_field("Độ khó:", block).split("\n")[0].strip()

        rules.append({
            "id": rule_id,
            "user_statement": user_statement,
            "true_intent": true_intent,
            "missing_info": missing_info,
            "compilable": compilable,
            "condition_action": condition_action,
            "unsupported": unsupported,
            "difficulty": difficulty,
            "raw_block": block.strip()
        })

    return rules
