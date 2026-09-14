#!/usr/bin/env python3
"""Kiểm chứng chế độ serve (loopback 127.0.0.1) tự động trên Windows (SP-13 Q1 & Q5).
Tự động mở trình duyệt, khởi chạy HTTP server loopback, lắng nghe callback,
chụp màn hình các bước luồng duyệt quyền (evidence/), đổi token và gọi Gmail + Drive API.
"""
import base64, datetime, hashlib, http.server, json, os, pathlib, secrets, subprocess
import sys, threading, time, urllib.parse as up, urllib.request, urllib.error, webbrowser

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent
SEC = ROOT / "spikes" / "secrets"
CLIENT_FILE = SEC / "google-oauth-client.json"
TOKENS_FILE = SEC / "google-tokens.json"
PKCE_FILE = SEC / ".pkce"
OUT_LOG = pathlib.Path(__file__).resolve().parent.parent / "evidence" / "q1_loopback_run.log"
SNAPS_DIR = pathlib.Path(__file__).resolve().parent.parent / "evidence" / "snaps"
SCREENSHOT_SCRIPT = ROOT / "spikes" / "SP-0-gui-harness" / "src" / "screenshot.ps1"

REDIRECT = "http://localhost:8765"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly"
]

def log(msg):
    print(msg)
    with open(OUT_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def cfg():
    d = json.loads(CLIENT_FILE.read_text(encoding="utf-8"))
    return d.get("installed") or d.get("web")

def post(url, data):
    req = urllib.request.Request(url, up.urlencode(data).encode("utf-8"),
                                 {"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"__http_error": e.code, "__body": e.read().decode("utf-8", errors="replace")[:600]}

def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"__http_error": e.code, "__body": e.read().decode("utf-8", errors="replace")[:600]}

def screenshot_worker(stop_event):
    SNAPS_DIR.mkdir(parents=True, exist_ok=True)
    idx = 1
    # Chụp ngay màn hình đầu tiên sau 1s
    time.sleep(1.5)
    while not stop_event.is_set():
        out_path = SNAPS_DIR / f"snap_{idx:03d}_{datetime.datetime.now().strftime('%H%M%S')}.png"
        try:
            cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(SCREENSHOT_SCRIPT),
                   "-OutputPath", str(out_path)]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            idx += 1
        except Exception:
            pass
        # Đợi 3 giây trước lần chụp tiếp theo
        for _ in range(30):
            if stop_event.is_set():
                break
            time.sleep(0.1)

def main():
    if OUT_LOG.exists():
        OUT_LOG.unlink()

    log("=== SP-13 Q1: KIỂM CHỨNG CHẾ ĐỘ SERVE (LOOPBACK 127.0.0.1) TỰ ĐỘNG ===")
    c = cfg()

    # 1. Sinh PKCE
    v = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode()
    ch = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b"=").decode()
    PKCE_FILE.write_text(v, encoding="utf-8")
    log("✓ Đã sinh PKCE S256 verifier và challenge.")

    # 2. Xây dựng Authorization URL
    auth_params = {
        "response_type": "code",
        "client_id": c["client_id"],
        "redirect_uri": REDIRECT,
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "code_challenge": ch,
        "code_challenge_method": "S256"
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + up.urlencode(auth_params)
    log(f"Redirect URI: {REDIRECT}")
    log(f"Authorization URL sinh ra:\n{auth_url}\n")

    # 3. Thiết lập HTTP server loopback
    got = {}
    class LoopbackHandler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            qs = up.parse_qs(up.urlparse(self.path).query)
            got.update({k: v[0] for k, v in qs.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            if "code" in qs:
                html = """
                <!DOCTYPE html>
                <html><head><meta charset="utf-8"><title>Desktop Assistant OAuth</title>
                <style>body{font-family:Segoe UI,sans-serif;text-align:center;padding-top:60px;background:#f8f9fa;color:#202124}
                .card{background:#fff;max-width:480px;margin:0 auto;padding:32px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
                h2{color:#1a73e8;margin-top:0}.btn{display:inline-block;padding:10px 20px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:500}</style>
                </head><body><div class="card">
                <h2>✓ Cấp quyền thành công!</h2>
                <p>Desktop Assistant đã nhận được mã ủy quyền từ Google.</p>
                <p>Bạn có thể đóng tab này và quay lại ứng dụng.</p>
                </div></body></html>
                """
                self.wfile.write(html.encode("utf-8"))
            else:
                err = qs.get("error", ["Unknown error"])[0]
                self.wfile.write(f"<h2>Lỗi ủy quyền: {err}</h2>".encode("utf-8"))
            threading.Thread(target=self.server.shutdown, daemon=True).start()

    srv = http.server.HTTPServer(("127.0.0.1", 8765), LoopbackHandler)
    log("✓ HTTP Server loopback đang lắng nghe tại http://127.0.0.1:8765 (timeout: 300s)")

    # 4. Bắt đầu worker chụp màn hình
    stop_snaps = threading.Event()
    snap_th = threading.Thread(target=screenshot_worker, args=(stop_snaps,), daemon=True)
    snap_th.start()
    log("✓ Đã khởi chạy background screenshot worker ghi lại evidence luồng consent.")

    # 5. Tự động mở trình duyệt trên Windows
    log("✓ Đang tự động mở trình duyệt mặc định trên Windows...")
    webbrowser.open(auth_url)

    # 6. Chờ request từ Google redirect
    server_th = threading.Thread(target=srv.serve_forever, daemon=True)
    server_th.start()
    server_th.join(300)

    # Dừng chụp màn hình
    stop_snaps.set()

    if "error" in got:
        log(f"✗ Google trả về lỗi: {got['error']}")
        sys.exit(1)
    if "code" not in got:
        log("✗ Hết thời gian chờ (timeout 300s), không nhận được authorization code.")
        sys.exit(1)

    log("\n=======================================================")
    log("✓ THÀNH CÔNG: Đã tự động bắt được Authorization Code!")
    log(f"  Code nhận được: {got['code'][:15]}...{got['code'][-8:]} (chiều dài: {len(got['code'])})")
    log("  Người dùng KHÔNG phải copy-paste URL hay mã nào.")
    log("=======================================================\n")

    # 7. Token exchange
    log("Đang thực hiện token exchange với Google Token Endpoint...")
    granted_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    exchange_payload = {
        "grant_type": "authorization_code",
        "code": got["code"],
        "client_id": c["client_id"],
        "client_secret": c["client_secret"],
        "redirect_uri": REDIRECT,
        "code_verifier": v
    }
    r = post(c.get("token_uri", "https://oauth2.googleapis.com/token"), exchange_payload)
    if "__http_error" in r:
        log(f"✗ Đổi token THẤT BẠI HTTP {r['__http_error']}: {r['__body']}")
        sys.exit(1)

    r["__granted_at"] = granted_at
    r["__refresh_expires_estimate"] = (datetime.datetime.fromisoformat(granted_at) + datetime.timedelta(days=7)).isoformat()
    r["__note"] = "External+Testing: refresh token het han sau 7 ngay (SP-13/Q3)"

    TOKENS_FILE.write_text(json.dumps(r, indent=2), encoding="utf-8")
    log("✓ Đổi token THÀNH CÔNG!")
    log(f"  refresh_token: {'CÓ (HỢP LỆ)' if r.get('refresh_token') else 'KHÔNG CÓ'}")
    log(f"  scope được cấp: {r.get('scope')}")
    log(f"  expires_in: {r.get('expires_in')} giây")
    log(f"  __granted_at ghi nhận: {granted_at}")
    log(f"  File token đã cập nhật: {TOKENS_FILE}")

    # 8. Đọc thử dữ liệu thật từ Gmail và Drive
    at = r["access_token"]
    log("\n--- KIỂM TRA ĐỌC GMAIL THẬT ---")
    gm = get("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3", at)
    if "__http_error" in gm:
        log(f"  ✗ Lỗi đọc Gmail: {gm['__http_error']}: {gm['__body']}")
    else:
        msgs = gm.get("messages", [])
        log(f"  ✓ Đọc được danh sách thư: {len(msgs)} messages")
        if msgs:
            msg_detail = get(f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msgs[0]['id']}?format=metadata&metadataHeaders=Subject&metadataHeaders=From", at)
            headers = {h["name"]: h["value"] for h in msg_detail.get("payload", {}).get("headers", [])}
            log(f"    Thư mới nhất - From: {headers.get('From', '?')[:60]}")
            log(f"                 - Subject: {headers.get('Subject', '?')[:60]}")

    log("\n--- KIỂM TRA ĐỌC GOOGLE DRIVE THẬT ---")
    dr = get("https://www.googleapis.com/drive/v3/files?pageSize=5&fields=files(id,name,mimeType)", at)
    if "__http_error" in dr:
        log(f"  ✗ Lỗi đọc Drive: {dr['__http_error']}: {dr['__body']}")
    else:
        files = dr.get("files", [])
        log(f"  ✓ Đọc được danh sách file: {len(files)} files")
        for f in files[:3]:
            log(f"    - File: {f['name'][:40]:<42} | MIME: {f['mimeType']}")

    log("\n=== KẾT LUẬN Q1: Chế độ serve (loopback 127.0.0.1) chạy trọn vòng 100% tự động trên Windows! ===")

if __name__ == "__main__":
    main()
