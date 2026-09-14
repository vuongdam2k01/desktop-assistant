#!/usr/bin/env python3
"""Kiểm tra đọc Google Docs/Sheets/PDF/Ảnh với drive.readonly (SP-13 Q6).
Đọc dữ liệu từ Google Drive API v3 với token trong spikes/secrets/google-tokens.json:
- Liệt kê file trong Drive
- Thử export Google Docs sang text/plain và application/pdf
- Thử export Google Sheets sang text/csv và application/pdf
- Thử đọc file nhị phân (PDF, ảnh, text) qua files.get?alt=media
- Ghi nhận kích thước file thực tế và giới hạn API theo tài liệu chính thức
"""
import json, os, pathlib, sys, urllib.request, urllib.parse, urllib.error

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent
SEC = ROOT / "spikes" / "secrets"
CLIENT_FILE = SEC / "google-oauth-client.json"
TOKENS_FILE = SEC / "google-tokens.json"
OUT_LOG = pathlib.Path(__file__).resolve().parent.parent / "evidence" / "q6_drive_export_read.log"

def log(msg):
    print(msg)
    with open(OUT_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def get_valid_token():
    tokens = json.loads(TOKENS_FILE.read_text(encoding="utf-8"))
    client_cfg = json.loads(CLIENT_FILE.read_text(encoding="utf-8"))
    c = client_cfg.get("installed") or client_cfg.get("web")

    # Thử refresh để chắc chắn token luôn mới
    post_data = urllib.parse.urlencode({
        "client_id": c["client_id"],
        "client_secret": c["client_secret"],
        "refresh_token": tokens["refresh_token"],
        "grant_type": "refresh_token"
    }).encode("utf-8")
    req = urllib.request.Request(c.get("token_uri", "https://oauth2.googleapis.com/token"),
                                 data=post_data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        refreshed = json.loads(resp.read().decode("utf-8"))
        return refreshed["access_token"]

def api_get(url, token, raw=False):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read()
            if raw:
                return {"status": 200, "content_type": content_type, "bytes_len": len(data), "data": data}
            else:
                return {"status": 200, "content_type": content_type, "json": json.loads(data.decode("utf-8"))}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return {"status": e.code, "error": err_body}

def main():
    if OUT_LOG.exists():
        OUT_LOG.unlink()

    log("=== SP-13 Q6: KIỂM TRA ĐỌC GOOGLE DRIVE VỚI drive.readonly ===")
    token = get_valid_token()
    log("✓ Đã lấy access token hợp lệ thành công.")

    # 1. Liệt kê file trong Drive
    list_url = ("https://www.googleapis.com/drive/v3/files?"
                "pageSize=50&fields=files(id,name,mimeType,size,capabilities,exportLinks,createdTime,modifiedTime)")
    log(f"\n1. Đang liệt kê file trong Drive qua endpoint: {list_url}")
    res = api_get(list_url, token)
    if res["status"] != 200:
        log(f"✗ Lỗi liệt kê file: {res}")
        return

    files = res["json"].get("files", [])
    log(f"✓ Tìm thấy {len(files)} file/folder trong Drive:\n")
    log(f"| {'ID':<34} | {'Tên':<35} | {'MIME Type':<40} | {'Kích thước':<10} |")
    log("|" + "-"*36 + "|" + "-"*37 + "|" + "-"*42 + "|" + "-"*12 + "|")
    for f in files:
        sz = f.get("size", "N/A (Doc)")
        log(f"| {f['id']:<34} | {f['name'][:33]:<35} | {f['mimeType'][:38]:<40} | {str(sz):<10} |")

    # Phân loại file để test
    docs = [f for f in files if f["mimeType"] == "application/vnd.google-apps.document"]
    sheets = [f for f in files if f["mimeType"] == "application/vnd.google-apps.spreadsheet"]
    binaries = [f for f in files if not f["mimeType"].startswith("application/vnd.google-apps.")]

    log(f"\nTổng kết phân loại: {len(docs)} Google Docs, {len(sheets)} Google Sheets, {len(binaries)} file nhị phân/ngoài.")

    # 2. Test export Google Docs nếu có
    if docs:
        doc = docs[0]
        log(f"\n2. Test export Google Doc '{doc['name']}' (ID: {doc['id']}):")
        # Export text/plain
        exp_txt_url = f"https://www.googleapis.com/drive/v3/files/{doc['id']}/export?mimeType=text%2Fplain"
        r_txt = api_get(exp_txt_url, token, raw=True)
        if r_txt["status"] == 200:
            log(f"  ✓ Export text/plain thành công: nhận {r_txt['bytes_len']} bytes")
            preview = r_txt["data"].decode("utf-8", errors="replace")[:200].replace("\n", " ")
            log(f"    Xem trước nội dung text: {preview}...")
        else:
            log(f"  ✗ Export text/plain thất bại: {r_txt}")

        # Export application/pdf
        exp_pdf_url = f"https://www.googleapis.com/drive/v3/files/{doc['id']}/export?mimeType=application%2Fpdf"
        r_pdf = api_get(exp_pdf_url, token, raw=True)
        if r_pdf["status"] == 200:
            log(f"  ✓ Export application/pdf thành công: nhận {r_pdf['bytes_len']} bytes (Header: {r_pdf['data'][:4]})")
        else:
            log(f"  ✗ Export application/pdf thất bại: {r_pdf}")
    else:
        log("\n2. Không có file Google Doc có sẵn trong Drive. Ghi nhận khả năng API export theo đặc tả chuẩn.")

    # 3. Test export Google Sheets nếu có
    if sheets:
        sheet = sheets[0]
        log(f"\n3. Test export Google Sheet '{sheet['name']}' (ID: {sheet['id']}):")
        # Export text/csv
        exp_csv_url = f"https://www.googleapis.com/drive/v3/files/{sheet['id']}/export?mimeType=text%2Fcsv"
        r_csv = api_get(exp_csv_url, token, raw=True)
        if r_csv["status"] == 200:
            log(f"  ✓ Export text/csv thành công: nhận {r_csv['bytes_len']} bytes")
            preview_csv = r_csv["data"].decode("utf-8", errors="replace")[:200].replace("\n", " ")
            log(f"    Xem trước nội dung CSV: {preview_csv}...")
        else:
            log(f"  ✗ Export text/csv thất bại: {r_csv}")

        # Export application/pdf
        exp_spdf_url = f"https://www.googleapis.com/drive/v3/files/{sheet['id']}/export?mimeType=application%2Fpdf"
        r_spdf = api_get(exp_spdf_url, token, raw=True)
        if r_spdf["status"] == 200:
            log(f"  ✓ Export Sheet sang PDF thành công: nhận {r_spdf['bytes_len']} bytes")
        else:
            log(f"  ✗ Export Sheet sang PDF thất bại: {r_spdf}")
    else:
        log("\n3. Không có file Google Sheet có sẵn trong Drive.")

    # 4. Test đọc file nhị phân (PDF, Ảnh, Text) qua files.get?alt=media
    if binaries:
        for b in binaries[:5]:
            log(f"\n4. Test tải file nhị phân '{b['name']}' (MIME: {b['mimeType']}, Size: {b.get('size', 'N/A')} bytes):")
            dl_url = f"https://www.googleapis.com/drive/v3/files/{b['id']}?alt=media"
            r_bin = api_get(dl_url, token, raw=True)
            if r_bin["status"] == 200:
                log(f"  ✓ Tải alt=media thành công: {r_bin['bytes_len']} bytes nhận được, Content-Type: {r_bin['content_type']}")
            else:
                log(f"  ✗ Tải alt=media thất bại: {r_bin}")
    else:
        log("\n4. Không có file nhị phân độc lập trong Drive.")

    # 5. Phân tích giới hạn kích thước theo tài liệu & thực tế
    log("\n5. Phân tích giới hạn kích thước file thực tế (Google Drive API v3):")
    log("  - Google Docs / Sheets files.export: Giới hạn cứng 10 MB (10,485,760 bytes). Nếu tài liệu export vượt quá 10MB, API trả về lỗi 403 exportSizeLimitExceeded.")
    log("  - Google Drive binary files.get?alt=media: Không giới hạn API nhân tạo nhỏ; hỗ trợ kích thước tối đa của file trên Drive (lên tới 5TB theo dung lượng Drive của người dùng).")
    log("  - Giới hạn với Agent/LLM ngữ cảnh: Giới hạn thực tế nằm ở bộ nhớ RAM của Desktop app và context window của LLM (ví dụ 128k - 1M token; 10MB text ~ 2.5 triệu tokens vượt context window thông thường). Do đó client cần giới hạn tải tối đa (khuyến nghị <= 20MB cho binary, và cắt lát văn bản khi đưa vào prompt theo FR-GM-03 / FR-DR-01).")

if __name__ == "__main__":
    main()
