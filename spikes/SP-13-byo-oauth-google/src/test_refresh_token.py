#!/usr/bin/env python3
"""Kiểm tra refresh token và mốc 7 ngày (SP-13 Q3).
Đọc spikes/secrets/google-tokens.json, dùng refresh_token để lấy access_token mới,
gọi thử Gmail và Drive API, ghi lại timestamp và phân tích hạn 7 ngày.
"""
import datetime, json, os, pathlib, sys, urllib.request, urllib.parse, urllib.error

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent
SEC = ROOT / "spikes" / "secrets"
CLIENT_FILE = SEC / "google-oauth-client.json"
TOKENS_FILE = SEC / "google-tokens.json"
OUT_LOG = pathlib.Path(__file__).resolve().parent.parent / "evidence" / "q3_token_refresh.log"

def log(msg):
    print(msg)
    with open(OUT_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def main():
    if OUT_LOG.exists():
        OUT_LOG.unlink()

    log(f"=== SP-13 Q3: KIỂM TRA REFRESH TOKEN & HẠN 7 NGÀY TESTING MODE ===")
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    log(f"Thời điểm kiểm tra hiện tại (UTC): {now_utc.isoformat()}")

    if not CLIENT_FILE.exists():
        log(f"LỖI: Không tìm thấy {CLIENT_FILE}")
        sys.exit(1)
    if not TOKENS_FILE.exists():
        log(f"LỖI: Không tìm thấy {TOKENS_FILE}")
        sys.exit(1)

    client_cfg = json.loads(CLIENT_FILE.read_text(encoding="utf-8"))
    client_info = client_cfg.get("installed") or client_cfg.get("web")
    client_id = client_info["client_id"]
    client_secret = client_info["client_secret"]
    token_uri = client_info.get("token_uri", "https://oauth2.googleapis.com/token")

    tokens = json.loads(TOKENS_FILE.read_text(encoding="utf-8"))
    granted_at_str = tokens.get("__granted_at")
    log(f"__granted_at trong google-tokens.json: {granted_at_str}")

    if not granted_at_str:
        log("CẢNH BÁO: Không có trường __granted_at trong file tokens!")
        granted_at = None
    else:
        granted_at = datetime.datetime.fromisoformat(granted_at_str)
        elapsed = now_utc - granted_at
        log(f"Thời gian đã trôi qua kể từ khi cấp: {elapsed} ({elapsed.total_seconds():.1f} giây, {elapsed.total_seconds()/86400:.2f} ngày)")
        expiry_7d = granted_at + datetime.timedelta(days=7)
        log(f"Mốc hết hạn 7 ngày dự kiến: {expiry_7d.isoformat()}")
        remaining = expiry_7d - now_utc
        log(f"Thời gian còn lại tới mốc 7 ngày: {remaining} ({remaining.total_seconds()/86400:.2f} ngày)")

    refresh_tok = tokens.get("refresh_token")
    if not refresh_tok:
        log("LỖI: Không có refresh_token trong google-tokens.json!")
        sys.exit(1)

    log(f"Refresh token hiện hữu: {refresh_tok[:8]}...{refresh_tok[-6:]} (đã che bớt)")

    # Thử refresh token
    log("\nĐang gửi request refresh token tới Google OAuth token endpoint...")
    post_data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_tok,
        "grant_type": "refresh_token"
    }).encode("utf-8")

    req = urllib.request.Request(token_uri, data=post_data, headers={
        "Content-Type": "application/x-www-form-urlencoded"
    })

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read().decode("utf-8")
            refreshed = json.loads(resp_body)
            log("✓ REFRESH TOKEN THÀNH CÔNG! HTTP 200 OK")
            log(f"  token_type: {refreshed.get('token_type')}")
            log(f"  expires_in: {refreshed.get('expires_in')} giây")
            log(f"  scope: {refreshed.get('scope')}")
            new_at = refreshed.get("access_token")
            log(f"  access_token mới: {new_at[:10]}...{new_at[-8:]}")

            # Thử gọi Gmail với access token mới
            log("\nKiểm tra access token mới với Gmail API...")
            gm_req = urllib.request.Request("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=2",
                                           headers={"Authorization": f"Bearer {new_at}"})
            with urllib.request.urlopen(gm_req, timeout=30) as gm_resp:
                gm_data = json.loads(gm_resp.read().decode("utf-8"))
                log(f"✓ Gmail API phản hồi HTTP 200: Đọc thành công {len(gm_data.get('messages', []))} messages")

            # Thử gọi Drive với access token mới
            log("\nKiểm tra access token mới với Google Drive API...")
            dr_req = urllib.request.Request("https://www.googleapis.com/drive/v3/files?pageSize=2&fields=files(id,name)",
                                           headers={"Authorization": f"Bearer {new_at}"})
            with urllib.request.urlopen(dr_req, timeout=30) as dr_resp:
                dr_data = json.loads(dr_resp.read().decode("utf-8"))
                log(f"✓ Google Drive API phản hồi HTTP 200: Đọc thành công {len(dr_data.get('files', []))} files")

    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        log(f"✗ REFRESH TOKEN THẤT BẠI! HTTP {e.code}")
        log(f"  Header: {dict(e.headers)}")
        log(f"  Nội dung lỗi chi tiết:\n{err_body}")

if __name__ == "__main__":
    main()
