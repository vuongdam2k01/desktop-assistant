#!/usr/bin/env bash
# spikes/SP-7-pet-window-os/macos/src/test-q2-clickthrough.sh
# Tests pixel click-through on macOS: transparent area penetrates, pet body receives clicks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$BASE_DIR/evidence"
REPO_ROOT="$(cd "$BASE_DIR/../../.." && pwd)"
SP0_SRC="$REPO_ROOT/spikes/SP-0-gui-harness/macos/src"

LOG_FILE="$EVIDENCE_DIR/q2-clickthrough.log"
echo "==========================================================" | tee "$LOG_FILE"
echo "SP-7 / Q2 CLICK-THROUGH TEST (macOS)" | tee -a "$LOG_FILE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$LOG_FILE"
echo "==========================================================" | tee -a "$LOG_FILE"

# 1. Reset click counters
curl -s http://127.0.0.1:18923/reset-clicks > /dev/null

# 2. Get pet window bounds
STATUS=$(curl -s http://127.0.0.1:18923/status)
PET_X=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin)['petBounds']['x'])")
PET_Y=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin)['petBounds']['y'])")
PET_W=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin)['petBounds']['width'])")
PET_H=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin)['petBounds']['height'])")

echo "Pet bounds: x=$PET_X, y=$PET_Y, w=$PET_W, h=$PET_H" | tee -a "$LOG_FILE"

# Move TextEdit window under the pet to verify penetration
osascript -e "tell application \"TextEdit\" to set bounds of front window to {$((PET_X - 100)), $((PET_Y - 100)), $((PET_X + 200)), $((PET_Y + 200))}"
sleep 0.5
osascript -e 'tell application "TextEdit" to set text of front document to "BACKGROUND_TEXTEDIT"'
sleep 0.3

# Test 1: Click directly on Pet Center (x + 70, y + 70)
CENTER_X=$((PET_X + 70))
CENTER_Y=$((PET_Y + 70))
echo "" | tee -a "$LOG_FILE"
echo "[Test 1] Moving to Pet Center ($CENTER_X, $CENTER_Y) and clicking..." | tee -a "$LOG_FILE"
"$SP0_SRC/sendkeys" --mouse-move "$CENTER_X" "$CENTER_Y"
sleep 0.2
"$SP0_SRC/sendkeys" --mouse-click "$CENTER_X" "$CENTER_Y"
sleep 0.3

STATUS1=$(curl -s http://127.0.0.1:18923/status)
PET_CLICKS_1=$(echo "$STATUS1" | python3 -c "import sys, json; print(json.load(sys.stdin)['petClicks'])")
echo "Pet clicks after center click: $PET_CLICKS_1 (expected >= 1)" | tee -a "$LOG_FILE"

# Test 2: Click in transparent corner of pet window (x + 5, y + 5)
CORNER_X=$((PET_X + 8))
CORNER_Y=$((PET_Y + 8))
echo "" | tee -a "$LOG_FILE"
echo "[Test 2] Moving to Transparent Corner ($CORNER_X, $CORNER_Y) and clicking..." | tee -a "$LOG_FILE"
"$SP0_SRC/sendkeys" --mouse-move "$CORNER_X" "$CORNER_Y"
sleep 0.2
"$SP0_SRC/sendkeys" --mouse-click "$CORNER_X" "$CORNER_Y"
sleep 0.3

STATUS2=$(curl -s http://127.0.0.1:18923/status)
PET_CLICKS_2=$(echo "$STATUS2" | python3 -c "import sys, json; print(json.load(sys.stdin)['petClicks'])")
echo "Pet clicks after transparent corner click: $PET_CLICKS_2 (expected same: $PET_CLICKS_1)" | tee -a "$LOG_FILE"

# Test 3: Precision boundary scan around pet circle (radius = 55px from center 70,70)
echo "" | tee -a "$LOG_FILE"
echo "[Test 3] Testing radial boundary hit-testing:" | tee -a "$LOG_FILE"

SCAN_RESULTS=()
for dist in 20 40 50 54 58 65 75; do
    TEST_X=$((CENTER_X + dist))
    TEST_Y=$CENTER_Y
    curl -s http://127.0.0.1:18923/reset-clicks > /dev/null
    "$SP0_SRC/sendkeys" --mouse-move "$TEST_X" "$TEST_Y"
    sleep 0.1
    "$SP0_SRC/sendkeys" --mouse-click "$TEST_X" "$TEST_Y"
    sleep 0.2
    CLICKS=$(curl -s http://127.0.0.1:18923/status | python3 -c "import sys, json; print(json.load(sys.stdin)['petClicks'])")
    if [[ "$CLICKS" -ge 1 ]]; then
        HIT="HIT_PET"
    else
        HIT="PASS_THROUGH"
    fi
    echo "  Distance ${dist}px from center (x=$TEST_X, y=$TEST_Y): $HIT" | tee -a "$LOG_FILE"
done

# Capture screenshot of click-through setup
"$SP0_SRC/screenshot" --full "$EVIDENCE_DIR/q2-clickthrough.png"
echo "" | tee -a "$LOG_FILE"
echo "Screenshot saved to $EVIDENCE_DIR/q2-clickthrough.png" | tee -a "$LOG_FILE"
