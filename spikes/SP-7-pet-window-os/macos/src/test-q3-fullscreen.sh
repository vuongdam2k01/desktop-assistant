#!/usr/bin/env bash
# spikes/SP-7-pet-window-os/macos/src/test-q3-fullscreen.sh
# Tests Q3: Always-on-top over native fullscreen, Spaces, Mission Control, Stage Manager

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$BASE_DIR/evidence"
REPO_ROOT="$(cd "$BASE_DIR/../../.." && pwd)"
SP0_SRC="$REPO_ROOT/spikes/SP-0-gui-harness/macos/src"

LOG_FILE="$EVIDENCE_DIR/q3-fullscreen.log"
echo "==========================================================" | tee "$LOG_FILE"
echo "SP-7 / Q3 FULLSCREEN & SPACES TEST (macOS)" | tee -a "$LOG_FILE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$LOG_FILE"
echo "==========================================================" | tee -a "$LOG_FILE"

# 1. Test Always-On-Top over Fullscreen App
echo "" | tee -a "$LOG_FILE"
echo "[Step 1] Opening Fullscreen Test Window via Electron..." | tee -a "$LOG_FILE"
curl -s http://127.0.0.1:18923/open-fullscreen-test > /dev/null
sleep 2.0

# Trigger card popup
curl -s http://127.0.0.1:18923/popup-card > /dev/null
sleep 1.0

# Capture screenshot with fullscreen window active
SHOT_FULLSCREEN="$EVIDENCE_DIR/q3-fullscreen.png"
"$SP0_SRC/screenshot" --full "$SHOT_FULLSCREEN"
echo "Screenshot captured: $SHOT_FULLSCREEN" | tee -a "$LOG_FILE"

# Close fullscreen test window
curl -s http://127.0.0.1:18923/close-fullscreen-test > /dev/null
sleep 1.0

# 2. Test Mission Control behavior
echo "" | tee -a "$LOG_FILE"
echo "[Step 2] Testing Mission Control behavior..." | tee -a "$LOG_FILE"
# Open Mission Control
open -a "Mission Control" || true
sleep 1.5
SHOT_MC="$EVIDENCE_DIR/q3-mission-control.png"
"$SP0_SRC/screenshot" --full "$SHOT_MC"
echo "Screenshot captured: $SHOT_MC" | tee -a "$LOG_FILE"
# Dismiss Mission Control by pressing Escape
"$SP0_SRC/sendkeys" --key esc
sleep 1.0

# 3. Test Space persistence
echo "" | tee -a "$LOG_FILE"
echo "[Step 3] Testing Spaces Collection Behavior..." | tee -a "$LOG_FILE"
# Query collection behavior / visibleOnAllWorkspaces via window status
STATUS=$(curl -s http://127.0.0.1:18923/status)
echo "Pet status: $STATUS" | tee -a "$LOG_FILE"

echo "Q3 Test Completed Successfully." | tee -a "$LOG_FILE"
