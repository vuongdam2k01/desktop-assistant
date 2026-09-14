#!/usr/bin/env bash
# spikes/SP-11-secure-storage/macos/src/test-keychain-raw-limit.sh
# Tests size limits of raw macOS Keychain generic password entries

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/evidence"
mkdir -p "$EVIDENCE_DIR"

LOG_FILE="$EVIDENCE_DIR/q2-raw-keychain-limits.log"
echo "=== Testing Raw macOS Keychain Size Limits ===" | tee "$LOG_FILE"

TEST_SERVICE="DesktopAssistant-RawLimitTest"

cleanup() {
    security delete-generic-password -s "$TEST_SERVICE" 2>/dev/null || true
}
trap cleanup EXIT

test_size() {
    local size=$1
    local label=$2
    local data=$(python3 -c "import sys; sys.stdout.write('X' * $size)")
    
    cleanup
    echo -n "Testing $label ($size bytes)... " | tee -a "$LOG_FILE"
    
    # Try adding generic password
    if security add-generic-password -a "test_account" -s "$TEST_SERVICE" -w "$data" 2>"$EVIDENCE_DIR/err.tmp"; then
        # Verify read
        local read_len=$(security find-generic-password -a "test_account" -s "$TEST_SERVICE" -w 2>/dev/null | wc -c | tr -d ' ')
        echo "SUCCESS (read $read_len bytes)" | tee -a "$LOG_FILE"
    else
        local err=$(cat "$EVIDENCE_DIR/err.tmp")
        echo "FAILED: $err" | tee -a "$LOG_FILE"
    fi
    cleanup
}

test_size 50 "50 B (Notion Token)"
test_size 400 "400 B (BYO JSON)"
test_size 2560 "2560 B (Windows CredMgr limit)"
test_size 4096 "4 KB"
test_size 16384 "16 KB"
test_size 65536 "64 KB"
test_size 131072 "128 KB"
test_size 524288 "512 KB"
test_size 1048576 "1 MB"

rm -f "$EVIDENCE_DIR/err.tmp"
echo "=== Done ===" | tee -a "$LOG_FILE"
