#!/usr/bin/env python3
"""Hạ tầng chung cho Spike SP-1: Gọi trực tiếp Notion REST API qua HTTP thô, ghi log chi tiết."""

import json
import os
import pathlib
import time
import urllib.request
import urllib.error
import urllib.parse
from typing import Any, Dict, Optional, Tuple

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent.parent.parent
SPIKE_DIR = pathlib.Path(__file__).resolve().parent.parent
EVIDENCE_DIR = SPIKE_DIR / "evidence"
RAW_LOGS_DIR = EVIDENCE_DIR / "raw_logs"
DATA_DIR = EVIDENCE_DIR / "data"

RAW_LOGS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Đọc environment
ENV_FILE = ROOT_DIR / "spikes" / ".env.local"
if not ENV_FILE.exists():
    raise FileNotFoundError(f"Không tìm thấy file {ENV_FILE}")

ENV = {}
for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        ENV[k.strip()] = v.strip()

# Đọc fixtures
FIXTURES_FILE = ROOT_DIR / "spikes" / "fixtures" / "notion.json"
FIXTURES = json.loads(FIXTURES_FILE.read_text(encoding="utf-8"))

NOTION_VERSION = "2022-06-28"

def get_token(workspace_key: str) -> str:
    key_name = f"NOTION_TOKEN_{workspace_key.upper()}"
    tok = ENV.get(key_name)
    if not tok:
        raise ValueError(f"Thiếu biến môi trường {key_name}")
    return tok

def get_workspace_info(workspace_key: str) -> Dict[str, Any]:
    return FIXTURES["workspaces"][workspace_key.upper()]

_log_counter = 0

def raw_api_call(
    token: str,
    method: str,
    path: str,
    body: Optional[Dict[str, Any]] = None,
    extra_headers: Optional[Dict[str, str]] = None,
    log_category: str = "general"
) -> Tuple[int, Dict[str, str], Any]:
    """
    Gọi Notion API thô, ghi log toàn bộ request và response headers + body.
    Trả về: (status_code, response_headers_dict, response_body_json_or_text)
    """
    global _log_counter
    _log_counter += 1
    call_id = f"{int(time.time()*1000)}_{_log_counter:04d}_{method}_{path.strip('/').replace('/', '_')}"

    url = f"https://api.notion.com/v1{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
    }
    if extra_headers:
        headers.update(extra_headers)

    req_body_bytes = None
    if body is not None:
        req_body_bytes = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=req_body_bytes, headers=headers, method=method)

    status_code = None
    resp_headers = {}
    resp_data = None
    err_str = None
    start_time = time.time()

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            status_code = resp.status
            resp_headers = dict(resp.headers.items())
            raw_content = resp.read().decode("utf-8")
            try:
                resp_data = json.loads(raw_content)
            except Exception:
                resp_data = raw_content
    except urllib.error.HTTPError as e:
        status_code = e.code
        resp_headers = dict(e.headers.items())
        raw_content = e.read().decode("utf-8")
        try:
            resp_data = json.loads(raw_content)
        except Exception:
            resp_data = raw_content
        err_str = str(e)
    except Exception as e:
        status_code = -1
        err_str = str(e)
    duration_ms = int((time.time() - start_time) * 1000)

    # Ghi log thô vào evidence/raw_logs/
    log_entry = {
        "call_id": call_id,
        "category": log_category,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "duration_ms": duration_ms,
        "request": {
            "method": method,
            "url": url,
            "headers": {k: ("Bearer ***" if k.lower() == "authorization" else v) for k, v in headers.items()},
            "body": body
        },
        "response": {
            "status_code": status_code,
            "headers": resp_headers,
            "body": resp_data,
            "error": err_str
        }
    }

    log_file = RAW_LOGS_DIR / f"{log_category}_{call_id}.json"
    log_file.write_text(json.dumps(log_entry, indent=2, ensure_ascii=False), encoding="utf-8")

    return status_code, resp_headers, resp_data

def get_page(token: str, page_id: str, category: str = "get_page") -> Tuple[int, Dict[str, str], Any]:
    return raw_api_call(token, "GET", f"/pages/{page_id}", log_category=category)

def update_page_properties(token: str, page_id: str, properties: Dict[str, Any], category: str = "update_page") -> Tuple[int, Dict[str, str], Any]:
    return raw_api_call(token, "PATCH", f"/pages/{page_id}", body={"properties": properties}, log_category=category)

def set_page_archived(token: str, page_id: str, archived: bool, category: str = "archive_page") -> Tuple[int, Dict[str, str], Any]:
    return raw_api_call(token, "PATCH", f"/pages/{page_id}", body={"archived": archived}, log_category=category)

def create_page(token: str, parent: Dict[str, Any], properties: Dict[str, Any], children: Optional[list] = None, category: str = "create_page") -> Tuple[int, Dict[str, str], Any]:
    body = {"parent": parent, "properties": properties}
    if children:
        body["children"] = children
    return raw_api_call(token, "POST", "/pages", body=body, log_category=category)

def query_database(token: str, database_id: str, filter_dict: Optional[Dict[str, Any]] = None, page_size: int = 100, category: str = "query_db") -> Tuple[int, Dict[str, str], Any]:
    body = {"page_size": page_size}
    if filter_dict:
        body["filter"] = filter_dict
    return raw_api_call(token, "POST", f"/databases/{database_id}/query", body=body, log_category=category)

def get_database(token: str, database_id: str, category: str = "get_db") -> Tuple[int, Dict[str, str], Any]:
    return raw_api_call(token, "GET", f"/databases/{database_id}", log_category=category)
