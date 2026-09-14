#!/bin/bash
set -u

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$BASE_DIR/app"
EVIDENCE_DIR="$BASE_DIR/../evidence"
mkdir -p "$EVIDENCE_DIR"
LOG_FILE="$EVIDENCE_DIR/hardened-runtime-crash.log"

echo "=== KIỂM CHỨNG HARDENED RUNTIME VÀ ENTITLEMENTS TRÊN MACOS (Q2) ===" | tee "$LOG_FILE"
echo "Thời gian: $(date)" | tee -a "$LOG_FILE"
echo "macOS: $(sw_vers -productVersion) ($(sw_vers -buildVersion)) | Kiến trúc: $(uname -m)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Tạo các file entitlements thử nghiệm
PLIST_DIR="/tmp/sp16-entitlements"
mkdir -p "$PLIST_DIR"

cat << 'PLIST' > "$PLIST_DIR/empty.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict></dict></plist>
PLIST

cat << 'PLIST' > "$PLIST_DIR/no-jit.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
</dict>
</plist>
PLIST

cat << 'PLIST' > "$PLIST_DIR/no-unsigned-mem.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key><true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
</dict>
</plist>
PLIST

cat << 'PLIST' > "$PLIST_DIR/full.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key><true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
    <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
PLIST

run_test_case() {
    local CASE_NAME="$1"
    local USE_RUNTIME="$2"
    local PLIST="$3"
    local SIGN_ID="${4:--}"

    echo "------------------------------------------------------------" | tee -a "$LOG_FILE"
    echo "TEST CASE: $CASE_NAME" | tee -a "$LOG_FILE"
    echo "  Options: Runtime=$USE_RUNTIME | Plist=$(basename "$PLIST") | Identity=$SIGN_ID" | tee -a "$LOG_FILE"

    # Tạo bản copy riêng của Electron.app để ký
    local TARGET_APP="/tmp/test-apps/$CASE_NAME/Electron.app"
    rm -rf "/tmp/test-apps/$CASE_NAME"
    mkdir -p "/tmp/test-apps/$CASE_NAME"
    cp -R "$APP_DIR/node_modules/electron/dist/Electron.app" "$TARGET_APP"

    # Lệnh ký codesign
    local SIGN_OPTS=("-f" "-s" "$SIGN_ID")
    if [ "$USE_RUNTIME" = "yes" ]; then
        SIGN_OPTS+=("--options" "runtime")
    fi
    if [ -n "$PLIST" ] && [ -f "$PLIST" ]; then
        SIGN_OPTS+=("--entitlements" "$PLIST")
    fi

    # Ký các dynamic libraries và frameworks bên trong trước
    find "$TARGET_APP/Contents/Frameworks" -type f -name "*.dylib" -exec codesign "${SIGN_OPTS[@]}" {} + 2>/dev/null || true
    for fw in "$TARGET_APP/Contents/Frameworks/"*.framework; do
        if [ -d "$fw" ]; then
            codesign "${SIGN_OPTS[@]}" "$fw" 2>/dev/null || true
        fi
    done

    # Ký binary chính
    codesign "${SIGN_OPTS[@]}" "$TARGET_APP/Contents/MacOS/Electron" 2>&1 | tee -a "$LOG_FILE"
    codesign "${SIGN_OPTS[@]}" "$TARGET_APP" 2>&1 | tee -a "$LOG_FILE"

    echo "  Kiểm tra chữ ký:" | tee -a "$LOG_FILE"
    codesign -dvv "$TARGET_APP" 2>&1 | grep -E "Authority|flags|TeamIdentifier" | tee -a "$LOG_FILE"

    # Chạy thử Electron với một inline script tối thiểu
    echo "  Khởi chạy tiến trình kiểm tra (timeout 5s)..." | tee -a "$LOG_FILE"
    local RUN_OUT
    local EXIT_CODE=0
    RUN_OUT=$(ELECTRON_RUN_AS_NODE=1 "$TARGET_APP/Contents/MacOS/Electron" -e 'console.log("V8 JS executed successfully: " + (1+1)); process.exit(0);' 2>&1) || EXIT_CODE=$?

    echo "  Exit code: $EXIT_CODE" | tee -a "$LOG_FILE"
    echo "  Output / Error: $RUN_OUT" | tee -a "$LOG_FILE"

    if [ "$EXIT_CODE" -eq 0 ]; then
        echo "  --> KẾT QUẢ: THÀNH CÔNG (Pass)" | tee -a "$LOG_FILE"
    else
        echo "  --> KẾT QUẢ: GÃY / CRASH (Fail - Exit Code $EXIT_CODE)" | tee -a "$LOG_FILE"
    fi
}

# 1. Baseline: Ad-hoc không bật Hardened Runtime
run_test_case "case1-adhoc-no-runtime" "no" "$PLIST_DIR/empty.plist" "-"

# 2. Hardened Runtime BẬT, KHÔNG CÓ entitlements
run_test_case "case2-runtime-no-entitlements" "yes" "$PLIST_DIR/empty.plist" "-"

# 3. Hardened Runtime BẬT, THIẾU allow-jit
run_test_case "case3-runtime-no-jit" "yes" "$PLIST_DIR/no-jit.plist" "-"

# 4. Hardened Runtime BẬT, THIẾU allow-unsigned-executable-memory
run_test_case "case4-runtime-no-unsigned-mem" "yes" "$PLIST_DIR/no-unsigned-mem.plist" "-"

# 5. Hardened Runtime BẬT, ĐẦY ĐỦ entitlements (Ad-hoc)
run_test_case "case5-runtime-full-entitlements-adhoc" "yes" "$PLIST_DIR/full.plist" "-"

# 6. Hardened Runtime BẬT, ĐẦY ĐỦ entitlements (Ký bằng cert tự tạo "DesktopAssistant Dev Test A")
run_test_case "case6-runtime-full-selfsigned" "yes" "$PLIST_DIR/full.plist" "DesktopAssistant Dev Test A"

echo "" | tee -a "$LOG_FILE"
echo "=== HOÀN TẤT THỰC NGHIỆM HARDENED RUNTIME ===" | tee -a "$LOG_FILE"
