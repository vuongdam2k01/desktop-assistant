#!/usr/bin/env python3
"""Kiểm tra cổng động vs cổng cố định (SP-13 Q2).
Kiểm tra phản hồi của Google OAuth 2.0 Authorization Server với các biến thể redirect_uri:
- http://localhost:8765 (cổng cố định trong script)
- http://localhost:54321 (cổng động ngẫu nhiên)
- http://localhost:19283 (cổng động khác)
- http://localhost (không có cổng)
- http://127.0.0.1:8765 (IP loopback kèm cổng)
- http://127.0.0.1 (IP loopback không kèm cổng)
- http://localhost:99999 (cổng ngoài dải hợp lệ)
- https://example.com/oauth/callback (URI không đăng ký)
"""
import base64, hashlib, json, os, pathlib, secrets, sys, urllib.request, urllib.parse, urllib.error

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent
SEC = ROOT / "spikes" / "secrets"
CLIENT_FILE = SEC / "google-oauth-client.json"
OUT_LOG = pathlib.Path(__file__).resolve().parent.parent / "evidence" / "q2_dynamic_ports.log"

def log(msg):
    print(msg)
    with open(OUT_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def test_redirect_uri(client_id, redirect_uri):
    v = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode()
    ch = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b"=").decode()

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly",
        "access_type": "offline",
        "prompt": "consent",
        "code_challenge": ch,
        "code_challenge_method": "S256"
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    })

    try:
        # Không tự động follow redirect nếu có
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
        resp = opener.open(req, timeout=15)
        code = resp.getcode()
        body = resp.read().decode("utf-8", errors="replace")
        # Kiểm tra xem có chứa lỗi redirect_uri_mismatch trong HTML không
        is_mismatch = "redirect_uri_mismatch" in body or "Error 400" in body
        return {"status": "SUCCESS" if not is_mismatch else "ERROR_PAGE", "http_code": code, "snippet": body[:200]}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return {"status": "HTTP_ERROR", "http_code": e.code, "snippet": err_body[:300]}
    except Exception as ex:
        return {"status": "EXCEPTION", "error": str(ex)}

def main():
    if OUT_LOG.exists():
        OUT_LOG.unlink()

    log("=== SP-13 Q2: KIỂM TRA CỔNG ĐỘNG VS CỔNG CỐ ĐỊNH GOOGLE OAUTH ===")
    cfg = json.loads(CLIENT_FILE.read_text(encoding="utf-8"))
    c = cfg.get("installed") or cfg.get("web")
    client_id = c["client_id"]
    registered_uris = c.get("redirect_uris", [])
    log(f"OAuth Client Type: {'installed (Desktop app)' if 'installed' in cfg else 'web'}")
    log(f"Redirect URIs đã đăng ký trong client JSON: {registered_uris}\n")

    test_cases = [
        ("http://localhost:8765", "Cổng 8765 cố định của script test"),
        ("http://localhost:54321", "Cổng 54321 động ngẫu nhiên"),
        ("http://localhost:19283", "Cổng 19283 động ngẫu nhiên"),
        ("http://localhost", "Không chỉ định cổng (khớp chính xác redirect_uris khai báo)"),
        ("http://127.0.0.1:8765", "IP Loopback 127.0.0.1 kèm cổng 8765"),
        ("http://127.0.0.1", "IP Loopback 127.0.0.1 không kèm cổng"),
        ("http://localhost:80", "Cổng chuẩn 80"),
        ("https://example.com/oauth/callback", "Tên miền ngoài không đăng ký (kiểm tra đối chứng lỗi)")
    ]

    results = []
    for uri, desc in test_cases:
        log(f"--> Kiểm tra: {uri}")
        log(f"    Mô tả: {desc}")
        res = test_redirect_uri(client_id, uri)
        log(f"    Kết quả: {res['status']} (HTTP {res.get('http_code')})")
        if res['status'] == "SUCCESS":
            log(f"    => Google CHẤP NHẬN redirect_uri này (phục vụ trang đăng nhập/consent bình thường).")
        else:
            log(f"    => Google TỪ CHỐI. Snippet: {res.get('snippet', '')[:150]}...")
        log("")
        results.append({"uri": uri, "desc": desc, "result": res})

    log("=== BẢNG TỔNG HỢP KIỂM CHỨNG Q2 ===")
    for r in results:
        accepted = "✓ CHẤP NHẬN (HỢP LỆ)" if r["result"]["status"] == "SUCCESS" else "✗ TỪ CHỐI (LỖI)"
        log(f"| {r['uri']:<35} | {accepted:<22} | {r['desc']} |")

if __name__ == "__main__":
    main()
