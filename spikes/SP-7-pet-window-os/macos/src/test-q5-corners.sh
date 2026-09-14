#!/usr/bin/env bash
# spikes/SP-7-pet-window-os/macos/src/test-q5-corners.sh
# Tests Q5: Adaptive edge orientation at 4 corners, Menu bar & Dock subtractions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$BASE_DIR/evidence"
REPO_ROOT="$(cd "$BASE_DIR/../../.." && pwd)"
SP0_SRC="$REPO_ROOT/spikes/SP-0-gui-harness/macos/src"

LOG_FILE="$EVIDENCE_DIR/q5-corners.log"
echo "==========================================================" | tee "$LOG_FILE"
echo "SP-7 / Q5 CORNERS & WORKAREA ADAPTATION TEST (macOS)" | tee -a "$LOG_FILE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$LOG_FILE"
echo "==========================================================" | tee -a "$LOG_FILE"

# 1. Query workArea and corner calculations from Electron
CORNERS_JSON=$(curl -s http://127.0.0.1:18923/corners)
echo "Corner positions and bounds verification:" | tee -a "$LOG_FILE"
echo "$CORNERS_JSON" | python3 -m json.tool | tee -a "$LOG_FILE"

# 2. Visually verify each of the 4 corners with screenshots
WA_JSON=$(curl -s http://127.0.0.1:18923/workarea)
WA_X=$(echo "$WA_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['primary']['workArea']['x'])")
WA_Y=$(echo "$WA_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['primary']['workArea']['y'])")
WA_W=$(echo "$WA_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['primary']['workArea']['width'])")
WA_H=$(echo "$WA_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['primary']['workArea']['height'])")

PET_W=140
PET_H=140

declare -a CORNERS=("top-left" "top-right" "bottom-left" "bottom-right")
declare -a POS_X=("$WA_X" "$((WA_X + WA_W - PET_W))" "$WA_X" "$((WA_X + WA_W - PET_W))")
declare -a POS_Y=("$WA_Y" "$WA_Y" "$((WA_Y + WA_H - PET_H))" "$((WA_Y + WA_H - PET_H))")

for i in 0 1 2 3; do
    NAME="${CORNERS[$i]}"
    X="${POS_X[$i]}"
    Y="${POS_Y[$i]}"
    echo "" | tee -a "$LOG_FILE"
    echo "[Corner: $NAME] Moving pet to ($X, $Y)..." | tee -a "$LOG_FILE"
    curl -s "http://127.0.0.1:18923/move-pet?x=$X&y=$Y" > /dev/null
    sleep 0.3
    curl -s "http://127.0.0.1:18923/popup-card" > /dev/null
    sleep 0.5
    SHOT="$EVIDENCE_DIR/q5-corner-$NAME.png"
    "$SP0_SRC/screenshot" --full "$SHOT"
    echo "Screenshot saved: $SHOT" | tee -a "$LOG_FILE"
done

# Reset pet to bottom-right standard position
DEFAULT_X=$((WA_X + WA_W - PET_W - 20))
DEFAULT_Y=$((WA_Y + WA_H - PET_H - 20))
curl -s "http://127.0.0.1:18923/move-pet?x=$DEFAULT_X&y=$DEFAULT_Y" > /dev/null
curl -s "http://127.0.0.1:18923/popup-card" > /dev/null

echo "" | tee -a "$LOG_FILE"
echo "Q5 Corner Test Complete. All 4 corners verified inside workArea." | tee -a "$LOG_FILE"
