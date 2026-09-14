#!/usr/bin/env bash
# spikes/SP-7-pet-window-os/macos/src/test-q1-focus.sh
# 10 consecutive runs of focus-stealing test during typing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$BASE_DIR/evidence"
REPO_ROOT="$(cd "$BASE_DIR/../../.." && pwd)"
SP0_SRC="$REPO_ROOT/spikes/SP-0-gui-harness/macos/src"

TOTAL_RUNS=${1:-10}
TEST_MODE=${2:-"panel"} # panel | normal | nonfocusable
DOCK_MODE=${3:-"show"}  # show | hide

mkdir -p "$EVIDENCE_DIR"

EXPECTED_FILE="$EVIDENCE_DIR/q1-expected-200chars.txt"
python3 -c "open('$EXPECTED_FILE', 'w').write('0123456789' * 20)"
EXPECTED_LEN=200

SUMMARY_LOG="$EVIDENCE_DIR/q1-focus-summary.log"
echo "==========================================================" | tee "$SUMMARY_LOG"
echo "SP-7 / Q1 FOCUS TEST (macOS) - $TOTAL_RUNS RUNS CONSECUTIVE AUTOMATION" | tee -a "$SUMMARY_LOG"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$SUMMARY_LOG"
echo "Mode: $TEST_MODE (dock: $DOCK_MODE)" | tee -a "$SUMMARY_LOG"
echo "Target: $EXPECTED_LEN characters pumped into TextEdit via CGEvent" | tee -a "$SUMMARY_LOG"
echo "Event: Dialogue Card pops up MID-STREAM at ~2.5s (char ~100)" | tee -a "$SUMMARY_LOG"
echo "Pass Criteria: 200/200 chars received in every run (0 lost)" | tee -a "$SUMMARY_LOG"
echo "==========================================================" | tee -a "$SUMMARY_LOG"

# Configure Electron mode
curl -s "http://127.0.0.1:18923/set-mode?mode=$TEST_MODE&dock=$DOCK_MODE" > /dev/null
sleep 0.5

PASS_COUNT=0
FAIL_COUNT=0

for run in $(seq 1 "$TOTAL_RUNS"); do
    RUN_LOG="$EVIDENCE_DIR/q1-focus-run-$run.log"
    OUTPUT_FILE="$EVIDENCE_DIR/q1-textedit-run$run-output.txt"
    echo "" | tee -a "$SUMMARY_LOG"
    echo "--- Starting Run $run of $TOTAL_RUNS ---" | tee "$RUN_LOG" | tee -a "$SUMMARY_LOG"

    # Ensure card is hidden
    curl -s http://127.0.0.1:18923/hide-card > /dev/null
    sleep 0.3

    # Activate TextEdit and reset text
    osascript -e 'tell application "TextEdit" to activate'
    sleep 0.5
    osascript -e 'tell application "TextEdit" to make new document' 2>/dev/null || true
    osascript -e 'tell application "TextEdit" to set text of front document to ""'
    sleep 0.3

    # Schedule mid-stream popup at 2.5s
    (sleep 2.5 && curl -s http://127.0.0.1:18923/popup-card > /dev/null) &

    # Pump 200 characters with 25ms delay (exact 5.0s typing stream)
    START_TIME=$(date +%s%N)
    "$SP0_SRC/sendkeys" --text "$(cat "$EXPECTED_FILE")" 25
    END_TIME=$(date +%s%N)
    DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))

    sleep 0.8

    # In Run 1, take screenshot showing card popped up next to editor
    if [[ $run -eq 1 ]]; then
        SHOT_PATH="$EVIDENCE_DIR/q1-focus-editor-during-popup.png"
        "$SP0_SRC/screenshot" --full "$SHOT_PATH"
        echo "Screenshot captured at run 1: $SHOT_PATH" | tee -a "$RUN_LOG" | tee -a "$SUMMARY_LOG"
    fi

    # Check status from Electron
    STATUS=$(curl -s http://127.0.0.1:18923/status)
    CARD_VISIBLE=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('cardVisible'))")
    CARD_FOCUSED=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('cardFocused'))")

    # Read back text from TextEdit
    ACTUAL_TEXT=$(osascript -e 'tell application "TextEdit" to get text of front document')
    printf "%s" "$ACTUAL_TEXT" > "$OUTPUT_FILE"
    ACTUAL_LEN=${#ACTUAL_TEXT}

    echo "Typing duration: ${DURATION_MS}ms" | tee -a "$RUN_LOG"
    echo "Card visible: $CARD_VISIBLE, Card focused: $CARD_FOCUSED" | tee -a "$RUN_LOG"
    echo "Expected length: $EXPECTED_LEN | Actual length: $ACTUAL_LEN" | tee -a "$RUN_LOG" | tee -a "$SUMMARY_LOG"

    if [[ "$ACTUAL_LEN" -eq "$EXPECTED_LEN" && "$ACTUAL_TEXT" == "$(cat "$EXPECTED_FILE")" ]]; then
        echo "Run $run: PASS (200/200 characters received, 0 lost)" | tee -a "$RUN_LOG" | tee -a "$SUMMARY_LOG"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "Run $run: FAIL ($ACTUAL_LEN/$EXPECTED_LEN characters received)" | tee -a "$RUN_LOG" | tee -a "$SUMMARY_LOG"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

echo "" | tee -a "$SUMMARY_LOG"
echo "==========================================================" | tee -a "$SUMMARY_LOG"
echo "Q1 FOCUS TEST COMPLETE:" | tee -a "$SUMMARY_LOG"
echo "Total Runs: $TOTAL_RUNS | Pass: $PASS_COUNT | Fail: $FAIL_COUNT | Pass Rate: $(( PASS_COUNT * 100 / TOTAL_RUNS ))%" | tee -a "$SUMMARY_LOG"
echo "==========================================================" | tee -a "$SUMMARY_LOG"
