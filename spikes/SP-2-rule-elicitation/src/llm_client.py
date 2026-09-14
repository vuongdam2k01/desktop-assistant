import json
import time
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

try:
    from .config import LLM_BASE_URL, LLM_API_KEY
except ImportError:
    from config import LLM_BASE_URL, LLM_API_KEY

class LLMClient:
    def __init__(self, base_url: str = LLM_BASE_URL, api_key: str = LLM_API_KEY):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1500,
        max_retries: int = 5,
        timeout: int = 60
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        for attempt in range(1, max_retries + 1):
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    res_body = response.read().decode("utf-8")
                    res_json = json.loads(res_body)
                    choice = res_json.get("choices", [{}])[0]
                    message = choice.get("message", {})
                    content = message.get("content", "")
                    usage = res_json.get("usage", {})
                    return {
                        "content": content,
                        "usage": usage,
                        "raw": res_json
                    }
            except urllib.error.HTTPError as e:
                err_content = e.read().decode("utf-8") if e.fp else ""
                # Check for rate limit or retry header
                retry_after_hdr = e.headers.get("Retry-After") if e.headers else None
                backoff_time = 2 ** attempt
                if retry_after_hdr:
                    try:
                        backoff_time = max(backoff_time, float(retry_after_hdr))
                    except ValueError:
                        pass
                
                print(f"[LLMClient HẠ TẦNG] HTTP {e.code} (Rate Limit / Infra) lượt {attempt}/{max_retries}: {err_content[:200]}")
                print(f"    -> Đang đợi {backoff_time:.1f}s trước khi retry...")
                if attempt == max_retries:
                    raise RuntimeError(f"Lỗi hạ tầng LLM sau {max_retries} lần thử: HTTP {e.code} - {err_content}")
                time.sleep(backoff_time)
            except Exception as e:
                backoff_time = 2 ** attempt
                print(f"[LLMClient HẠ TẦNG] Lỗi kết nối lượt {attempt}/{max_retries}: {str(e)}")
                print(f"    -> Đang đợi {backoff_time:.1f}s trước khi retry...")
                if attempt == max_retries:
                    raise
                time.sleep(backoff_time)
