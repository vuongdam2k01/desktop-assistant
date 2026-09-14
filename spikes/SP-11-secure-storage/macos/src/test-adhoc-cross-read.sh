#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
EVIDENCE_DIR="$SCRIPT_DIR/../evidence"

echo "=== Testing Ad-hoc v1 -> Ad-hoc v2 Cross-Read ==="

# Launch bin_adhoc_v2 read in background
"$BIN_DIR/bin_adhoc_v2" read "DesktopAssistant-Q3-Adhoc" "token" > "$EVIDENCE_DIR/q3-adhoc-v2-result.log" 2>&1 &
BG_PID=$!

sleep 1

# Check if SecurityAgent window popped up
if pgrep -x SecurityAgent > /dev/null; then
    echo "SecurityAgent dialog detected on screen!"
    screencapture -x "$EVIDENCE_DIR/q3-prompt-adhoc_v2.png"
    echo "Screenshot saved to q3-prompt-adhoc_v2.png"
    
    # Click Deny to avoid hanging
    osascript -e 'tell application "System Events" to tell process "SecurityAgent" to click button "Deny" of window 1' 2>/dev/null || true
    echo "Clicked Deny"
fi

wait $BG_PID || true
echo "=== Result from bin_adhoc_v2 ==="
cat "$EVIDENCE_DIR/q3-adhoc-v2-result.log"
