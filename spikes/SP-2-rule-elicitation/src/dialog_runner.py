import json
import time
from typing import Dict, Any, List

try:
    from .llm_client import LLMClient
    from .prompts import (
        ELICITATION_SYSTEM_PROMPT_V0,
        USER_SIMULATOR_SYSTEM_PROMPT,
        build_simulator_initial_prompt
    )
except ImportError:
    from llm_client import LLMClient
    from prompts import (
        ELICITATION_SYSTEM_PROMPT_V0,
        USER_SIMULATOR_SYSTEM_PROMPT,
        build_simulator_initial_prompt
    )

class DialogRunner:
    def __init__(self, client: LLMClient, simulator_model: str, max_turns: int = 6):
        self.client = client
        self.simulator_model = simulator_model
        self.max_turns = max_turns

    def run_elicitation(self, rule_info: Dict[str, Any], elicitor_model: str) -> Dict[str, Any]:
        sim_sys_prompt = USER_SIMULATOR_SYSTEM_PROMPT + "\n" + build_simulator_initial_prompt(rule_info)
        sim_messages = [
            {"role": "system", "content": sim_sys_prompt}
        ]

        elicitor_messages = [
            {"role": "system", "content": ELICITATION_SYSTEM_PROMPT_V0}
        ]

        transcript = []
        turn_count = 0
        terminal_status = "TIMEOUT"
        structured_interpretation = ""
        total_elicitor_tokens = 0

        # Turn 1: User starts with initial rough statement
        user_msg = rule_info["user_statement"]
        transcript.append({"sender": "user", "turn": 1, "content": user_msg})
        sim_messages.append({"role": "assistant", "content": user_msg})
        elicitor_messages.append({"role": "user", "content": user_msg})

        while turn_count < self.max_turns:
            turn_count += 1
            print(f"    Turn {turn_count}: Elicitor ({elicitor_model}) responding...")

            res_elicitor = self.client.chat_completion(
                model=elicitor_model,
                messages=elicitor_messages,
                temperature=0.2,
                max_tokens=800
            )
            elicitor_reply = res_elicitor["content"].strip()
            usage = res_elicitor.get("usage", {})
            total_elicitor_tokens += usage.get("total_tokens", 0)

            transcript.append({"sender": "elicitor", "turn": turn_count, "content": elicitor_reply})
            elicitor_messages.append({"role": "assistant", "content": elicitor_reply})
            sim_messages.append({"role": "user", "content": elicitor_reply})

            if "[BẢN DIỄN GIẢI QUY TẮC]" in elicitor_reply:
                structured_interpretation = elicitor_reply

            # Check if terminal status reached directly
            if "[TRẠNG THÁI: CONFIRMED]" in elicitor_reply:
                terminal_status = "CONFIRMED"
                break
            elif "[TRẠNG THÁI: UNSUPPORTED]" in elicitor_reply:
                terminal_status = "UNSUPPORTED"
                break
            elif "[TRẠNG THÁI: CANCELLED]" in elicitor_reply:
                terminal_status = "CANCELLED"
                break

            if turn_count >= self.max_turns:
                break

            # User simulator's turn
            print(f"    Turn {turn_count}: User simulator responding...")
            res_sim = self.client.chat_completion(
                model=self.simulator_model,
                messages=sim_messages,
                temperature=0.3,
                max_tokens=300
            )
            sim_reply = res_sim["content"].strip()
            transcript.append({"sender": "user", "turn": turn_count + 1, "content": sim_reply})
            sim_messages.append({"role": "assistant", "content": sim_reply})
            elicitor_messages.append({"role": "user", "content": sim_reply})

        if terminal_status == "TIMEOUT":
            last_text = "\n".join([t["content"] for t in transcript[-2:]]).lower()
            if any(k in last_text for k in ["xác nhận", "chốt", "chuẩn rồi", "đồng ý", "lưu đi"]):
                if any("[bản diễn giải quy tắc]" in t["content"].lower() for t in transcript):
                    terminal_status = "CONFIRMED"
            if any(k in last_text for k in ["không thể biên dịch", "không hỗ trợ", "unsupported"]):
                terminal_status = "UNSUPPORTED"

        return {
            "rule_id": rule_info["id"],
            "elicitor_model": elicitor_model,
            "turns_taken": turn_count,
            "terminal_status": terminal_status,
            "structured_interpretation": structured_interpretation,
            "total_tokens": total_elicitor_tokens,
            "transcript": transcript
        }
