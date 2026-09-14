#!/bin/bash
set -u

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_DIR="$BASE_DIR/../evidence"
BUILDS_DIR="$BASE_DIR/../builds"
SERVER_DIR="$BASE_DIR/server"
RUN_DIR="/tmp/sp16-running-app"

mkdir -p "$EVIDENCE_DIR" "$RUN_DIR"

echo "=== BẮT ĐẦU DRY-RUN AUTO-UPDATE TRÊN MACOS (Q4) ==="
echo "Thời gian: $(date)"
echo "macOS: $(sw_vers -productVersion) ($(sw_vers -buildVersion)) | Kiến trúc: $(uname -m)"

# 1. Dọn dẹp tiến trình cũ
pkill -f "update-server.js" 2>/dev/null || true
pkill -f "DesktopAssistantSpikeMac" 2>/dev/null || true
sleep 1

# 2. Xoá log cũ và chuẩn bị thư mục ShipIt cache
rm -f "$EVIDENCE_DIR/updater-app.log" "$EVIDENCE_DIR/server-requests.log"
SHIPIT_CACHE_DIR="$HOME/Library/Caches/com.desktopassistant.sp16mac.ShipIt"
if [ -d "$SHIPIT_CACHE_DIR" ]; then
    rm -rf "$SHIPIT_CACHE_DIR"/*
fi
mkdir -p "$SHIPIT_CACHE_DIR"

# 3. Khởi động HTTP Server phục vụ bản v1.0.1
echo "-> Khởi động update server trên port 8089..."
node "$SERVER_DIR/update-server.js" > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

HEALTH=$(curl -s http://127.0.0.1:8089/health || echo "fail")
echo "-> Server health: $HEALTH"
if [[ "$HEALTH" != *"ok"* ]]; then
    echo "LỖI: Server không khởi động được!"
    exit 1
fi

# 4. Chuẩn bị bản v1.0.0
echo "-> Sao chép bản v1.0.0 vào thư mục thực thi $RUN_DIR ..."
rm -rf "$RUN_DIR/DesktopAssistantSpikeMac.app"
cp -R "$BUILDS_DIR/v1.0.0/DesktopAssistantSpikeMac.app" "$RUN_DIR/"

# Gỡ bỏ quarantine nếu có để app mở được
xattr -cr "$RUN_DIR/DesktopAssistantSpikeMac.app"

echo "-> Kiểm tra chữ ký bản v1.0.0 đang chuẩn bị chạy:"
codesign -dvv "$RUN_DIR/DesktopAssistantSpikeMac.app" 2>&1 | grep -E "Authority|Identifier|flags"

# 5. Khởi chạy bản v1.0.0
echo "-> Khởi chạy bản v1.0.0..."
"$RUN_DIR/DesktopAssistantSpikeMac.app/Contents/MacOS/DesktopAssistantSpikeMac" &
APP_PID=$!
echo "-> Tiến trình v1.0.0 PID: $APP_PID"

# 6. Chờ tiến trình kiểm tra cập nhật, tải về và thực hiện quitAndInstall
echo "-> Đang theo dõi log tiến trình cập nhật trong 25 giây..."
for i in {1..25}; do
    sleep 1
    if [ -f "$EVIDENCE_DIR/updater-app.log" ]; then
        LAST_LINE=$(tail -n 1 "$EVIDENCE_DIR/updater-app.log")
        echo "   [$i/25s] $LAST_LINE"
    fi

    # Kiểm tra xem tiến trình cũ đã thoát chưa
    if ! kill -0 "$APP_PID" 2>/dev/null; then
        echo "-> Tiến trình v1.0.0 (PID $APP_PID) đã đóng!"
        break
    fi
done

# Chờ thêm 5s để ShipIt xử lý giải nén và relaunch
echo "-> Chờ ShipIt hoàn tất thay thế và khởi động lại..."
sleep 5

# Chụp màn hình hiện tại để lưu bằng chứng
screencapture -x "$EVIDENCE_DIR/dryrun-after-update.png" 2>/dev/null || true

# 7. Thu thập log của ShipIt
echo "=== THU THẬP LOG CỦA SQUIRREL.MAC / SHIPIT ==="
SHIPIT_LOG_OUT="$EVIDENCE_DIR/squirrel-shipit-update.log"
echo "=== SHIPIT STDOUT & STDERR ===" > "$SHIPIT_LOG_OUT"
if [ -d "$SHIPIT_CACHE_DIR" ]; then
    ls -la "$SHIPIT_CACHE_DIR" >> "$SHIPIT_LOG_OUT"
    for f in "$SHIPIT_CACHE_DIR"/*.log; do
        if [ -f "$f" ]; then
            echo "--- File: $(basename "$f") ---" >> "$SHIPIT_LOG_OUT"
            cat "$f" >> "$SHIPIT_LOG_OUT"
        fi
    done
fi

# 8. Kiểm tra phiên bản thực tế của app sau khi cập nhật
echo "=== KIỂM TRA PHIÊN BẢN ỨNG DỤNG SAU AUTO-UPDATE ==="
PLIST_PATH="$RUN_DIR/DesktopAssistantSpikeMac.app/Contents/Info.plist"
if [ -f "$PLIST_PATH" ]; then
    INSTALLED_VER=$(defaults read "$PLIST_PATH" CFBundleShortVersionString 2>/dev/null || echo "unknown")
    echo "-> Phiên bản trong Info.plist của app: $INSTALLED_VER"
else
    echo "-> KHÔNG TÌM THẤY Info.plist tại $PLIST_PATH"
fi

# Kiểm tra tiến trình đang chạy mới
NEW_PID=$(pgrep -f "DesktopAssistantSpikeMac" || echo "none")
echo "-> Tiến trình đang chạy sau cập nhật: $NEW_PID"

# Dọn dẹp server
kill $SERVER_PID 2>/dev/null || true
pkill -f "DesktopAssistantSpikeMac" 2>/dev/null || true

echo "=== HOÀN TẤT DRY-RUN AUTO-UPDATE ==="
