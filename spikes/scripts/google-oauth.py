#!/usr/bin/env python3
"""Kiểm chứng BYO OAuth client cho Google (tiền đề của SP-13).

  python3 scripts/google-oauth.py auth       -> in ra URL để mở trên trình duyệt
  python3 scripts/google-oauth.py exchange   -> đọc secrets/oauth-callback.txt, đổi token, thử đọc Gmail + Drive
"""
import base64, hashlib, json, os, pathlib, secrets, sys, urllib.parse, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEC = ROOT / "secrets"
CLIENT = SEC / "google-oauth-client.json"
PKCE = SEC / ".pkce"
CB = SEC / "oauth-callback.txt"
TOK = SEC / "google-tokens.json"
REDIRECT = "http://localhost:8765"
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/drive.readonly"]

def cfg():
    d = json.loads(CLIENT.read_text())
    return d.get("installed") or d.get("web")

def post(url, data):
    req = urllib.request.Request(url, urllib.parse.urlencode(data).encode(),
                                 {"Content-Type": "application/x-www-form-urlencoded"})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        return {"__http_error": e.code, "__body": e.read().decode()[:600]}

def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        return {"__http_error": e.code, "__body": e.read().decode()[:600]}

def cmd_auth():
    c = cfg()
    v = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode()
    ch = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b"=").decode()
    PKCE.write_text(v); PKCE.chmod(0o600)
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "response_type": "code", "client_id": c["client_id"], "redirect_uri": REDIRECT,
        "scope": " ".join(SCOPES), "access_type": "offline", "prompt": "consent",
        "code_challenge": ch, "code_challenge_method": "S256"})
    print("\n1) Mở URL này trên trình duyệt, đăng nhập bằng đúng tài khoản đã thêm làm Test user:\n")
    print(url)
    print("\n2) Qua màn cảnh báo 'Google hasn't verified this app' -> Advanced -> Go to ... (unsafe)")
    print("3) Duyệt cả hai quyền. Trình duyệt sẽ nhảy sang http://localhost:8765/?code=... và BÁO LỖI KHÔNG KẾT NỐI ĐƯỢC — đúng như vậy.")
    print(f"4) Copy TOÀN BỘ URL trên thanh địa chỉ, lưu vào: {CB}")
    print("   (dùng editor trên chính máy này, đừng dán vào khung chat — code là credential)")
    print("5) Rồi báo tôi chạy bước exchange.\n")

def cmd_exchange():
    c = cfg()
    if not CB.exists(): sys.exit(f"Chưa có {CB}")
    parsed = urllib.parse.urlparse(CB.read_text().strip())
    qs = urllib.parse.parse_qs(parsed.query)
    if "error" in qs: sys.exit("Google trả lỗi: " + qs["error"][0])
    if "code" not in qs: sys.exit("URL không chứa ?code=")
    r = post(c["token_uri"], {"grant_type": "authorization_code", "code": qs["code"][0],
        "client_id": c["client_id"], "client_secret": c["client_secret"],
        "redirect_uri": REDIRECT, "code_verifier": PKCE.read_text().strip()})
    if "__http_error" in r: sys.exit(f"Đổi token THẤT BẠI {r['__http_error']}: {r['__body']}")
    TOK.write_text(json.dumps(r, indent=2)); TOK.chmod(0o600); CB.unlink()
    at = r["access_token"]
    print("✓ Đổi token thành công")
    print("  refresh_token:", "CÓ" if r.get("refresh_token") else "KHÔNG CÓ (thiếu access_type=offline?)")
    print("  scope được cấp:", r.get("scope"))
    print("  access_token hết hạn sau:", r.get("expires_in"), "giây")

    print("\n--- Gmail ---")
    g = get("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3", at)
    if "__http_error" in g: print(f"  ✗ {g['__http_error']}: {g['__body'][:300]}")
    else:
        ids = [m["id"] for m in g.get("messages", [])]
        print(f"  ✓ đọc được danh sách, {len(ids)} message")
        if ids:
            m = get(f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{ids[0]}?format=metadata&metadataHeaders=Subject&metadataHeaders=From", at)
            hs = {h["name"]: h["value"] for h in m.get("payload", {}).get("headers", [])}
            print("    thư mới nhất — From:", hs.get("From", "?")[:60])
            print("                   Subject:", hs.get("Subject", "?")[:60])

    print("\n--- Drive ---")
    d = get("https://www.googleapis.com/drive/v3/files?pageSize=5&fields=files(id,name,mimeType)", at)
    if "__http_error" in d: print(f"  ✗ {d['__http_error']}: {d['__body'][:300]}")
    else:
        fs = d.get("files", [])
        print(f"  ✓ đọc được danh sách, {len(fs)} file")
        for f in fs[:3]: print("    -", f["name"][:50], "|", f["mimeType"].split(".")[-1])
    print(f"\nToken đã lưu: {TOK}")


def cmd_serve():
    """Listener loopback — ĐÚNG cơ chế Electron sẽ dùng trong sản phẩm thật."""
    import http.server, threading, urllib.parse as up
    c = cfg()
    v = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode()
    ch = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b"=").decode()
    PKCE.write_text(v); PKCE.chmod(0o600)
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "response_type": "code", "client_id": c["client_id"], "redirect_uri": REDIRECT,
        "scope": " ".join(SCOPES), "access_type": "offline", "prompt": "consent",
        "code_challenge": ch, "code_challenge_method": "S256"})
    got = {}
    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            qs = up.parse_qs(up.urlparse(self.path).query)
            got.update({k: v[0] for k, v in qs.items()})
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers()
            ok = "code" in qs
            self.wfile.write(("<h2>" + ("Xong. Quay lai terminal." if ok else "Loi: " + qs.get("error", ["?"])[0]) + "</h2>").encode())
            threading.Thread(target=self.server.shutdown, daemon=True).start()
    srv = http.server.HTTPServer(("127.0.0.1", 8765), H)
    print("Listener dang cho o http://127.0.0.1:8765 (toi da 300 giay)\n")
    print("Mo URL nay tren trinh duyet:\n"); print(url); print()
    t = threading.Thread(target=srv.serve_forever, daemon=True); t.start(); t.join(300)
    if "error" in got: sys.exit("Google tra loi: " + got["error"])
    if "code" not in got: sys.exit("Het gio, khong nhan duoc code.")
    print("Da bat duoc authorization code tu dong — khong can copy gi.\n")
    CB.write_text("http://localhost:8765/?code=" + up.quote(got["code"]))
    cmd_exchange()

{"auth": cmd_auth, "serve": cmd_serve, "exchange": cmd_exchange}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()
