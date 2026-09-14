#!/bin/bash
set -u

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_DIR="$BASE_DIR/../evidence"
BUILDS_DIR="$BASE_DIR/../builds"
LOG_FILE="$EVIDENCE_DIR/quarantine-gatekeeper.log"

mkdir -p "$EVIDENCE_DIR"

echo "=== KIỂM CHỨNG GATEKEEPER VÀ QUARANTINE TRÊN MACOS (Q5) ===" | tee "$LOG_FILE"
echo "Thời gian: $(date)" | tee -a "$LOG_FILE"
echo "macOS: $(sw_vers -productVersion) ($(sw_vers -buildVersion))" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

TEST_APP_DIR="/tmp/test-gatekeeper"
rm -rf "$TEST_APP_DIR"
mkdir -p "$TEST_APP_DIR"

cp -R "$BUILDS_DIR/v1.0.1/DesktopAssistantSpikeMac.app" "$TEST_APP_DIR/CleanApp.app"
cp -R "$BUILDS_DIR/v1.0.1/DesktopAssistantSpikeMac.app" "$TEST_APP_DIR/QuarantinedApp.app"

# Gỡ bỏ attribute trên CleanApp
xattr -cr "$TEST_APP_DIR/CleanApp.app"

# Gắn thuộc tính com.apple.quarantine mô phỏng tải từ trình duyệt (Safari/Chrome)
# Format quarantine: flag;timestamp;agent_name;uuid
xattr -w com.apple.quarantine "0181;66e44b80;Safari;D7C91910-1234-5678-ABCD-0123456789AB" "$TEST_APP_DIR/QuarantinedApp.app"

echo "1. THUỘC TÍNH MỞ RỘNG (XATTR):" | tee -a "$LOG_FILE"
echo "-> CleanApp:" | tee -a "$LOG_FILE"
xattr -l "$TEST_APP_DIR/CleanApp.app" | tee -a "$LOG_FILE"
echo "-> QuarantinedApp:" | tee -a "$LOG_FILE"
xattr -l "$TEST_APP_DIR/QuarantinedApp.app" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "2. ĐÁNH GIÁ SPCTL GATEKEEPER:" | tee -a "$LOG_FILE"
echo "-> spctl --assess trên CleanApp (không có quarantine):" | tee -a "$LOG_FILE"
spctl --assess -vv --type exec "$TEST_APP_DIR/CleanApp.app" 2>&1 | tee -a "$LOG_FILE" || true

echo "-> spctl --assess trên QuarantinedApp (có quarantine):" | tee -a "$LOG_FILE"
spctl --assess -vv --type exec "$TEST_APP_DIR/QuarantinedApp.app" 2>&1 | tee -a "$LOG_FILE" || true
echo "" | tee -a "$LOG_FILE"

echo "3. THỰC NGHIỆM MỞ APP CÓ QUARANTINE QUA HỆ THỐNG (OPEN LỆNH):" | tee -a "$LOG_FILE"
echo "Khởi chạy open QuarantinedApp..." | tee -a "$LOG_FILE"
OPEN_OUT=$(open "$TEST_APP_DIR/QuarantinedApp.app" 2>&1) || true
echo "Output của lệnh open: $OPEN_OUT" | tee -a "$LOG_FILE"

# Chờ 2 giây và chụp ảnh màn hình hộp thoại Gatekeeper cảnh báo
sleep 2
screencapture -x "$EVIDENCE_DIR/gatekeeper-quarantine-prompt.png" 2>/dev/null || true
echo "Đã chụp ảnh màn hình hộp thoại Gatekeeper: $EVIDENCE_DIR/gatekeeper-quarantine-prompt.png" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "=== HOÀN TẤT THỬ NGHIỆM GATEKEEPER ===" | tee -a "$LOG_FILE"
