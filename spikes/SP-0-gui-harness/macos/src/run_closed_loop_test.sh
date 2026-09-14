#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$BASE_DIR/evidence"
REPO_ROOT="$(cd "$BASE_DIR/../../.." && pwd)"
TARGET_TEXT_FILE="$REPO_ROOT/spikes/SP-0-gui-harness/evidence/q3-sendkeys-200chars.txt"
OUTPUT_FILE="$EVIDENCE_DIR/closed-loop-textedit-output.txt"
SCREENSHOT_FILE="$EVIDENCE_DIR/closed-loop-textedit.png"
LOG_FILE="$EVIDENCE_DIR/closed-loop-run.log"

echo "=== STARTING CLOSED-LOOP TEST FOR SP-0/mac ===" | tee "$LOG_FILE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$LOG_FILE"

# 1. Read expected text
EXPECTED_TEXT=$(cat "$TARGET_TEXT_FILE")
EXPECTED_LEN=$(python3 -c "import sys; sys.stdout.write(str(len(open('$TARGET_TEXT_FILE').read().strip())))")
echo "Expected text length: $EXPECTED_LEN characters" | tee -a "$LOG_FILE"

# 2. Launch / Focus TextEdit
echo "[Step 1] Launching and activating TextEdit..." | tee -a "$LOG_FILE"
osascript -e 'tell application "TextEdit" to activate'
sleep 0.5
osascript -e 'tell application "TextEdit" to make new document' 2>/dev/null || true
osascript -e 'tell application "TextEdit" to set text of front document to ""'
sleep 0.3

# 3. Inject 200 characters via CGEvent
echo "[Step 2] Injecting 200 characters using sendkeys --text..." | tee -a "$LOG_FILE"
"$SCRIPT_DIR/sendkeys" --text "$EXPECTED_TEXT"
sleep 1.0

# 4. Capture screenshot of TextEdit window
echo "[Step 3] Capturing screenshot of TextEdit..." | tee -a "$LOG_FILE"
"$SCRIPT_DIR/screenshot" --app TextEdit "$SCREENSHOT_FILE"
echo "Screenshot saved: $SCREENSHOT_FILE" | tee -a "$LOG_FILE"

# 5. Save document to file
echo "[Step 4] Saving document to disk at $OUTPUT_FILE..." | tee -a "$LOG_FILE"
rm -f "$OUTPUT_FILE"
osascript -e 'tell application "TextEdit" to get text of front document' > "$OUTPUT_FILE"

# 6. Verify and Count
echo "[Step 5] Verifying character count and bit-by-bit equality..." | tee -a "$LOG_FILE"
python3 -c "
with open('$TARGET_TEXT_FILE', 'r', encoding='utf-8') as f:
    expected = f.read().strip()
with open('$OUTPUT_FILE', 'r', encoding='utf-8') as f:
    actual = f.read().strip()

print(f'Expected chars : {len(expected)}')
print(f'Actual chars   : {len(actual)}')
print(f'Exact Match    : {expected == actual}')
if expected == actual and len(actual) == 200:
    print('RESULT: 200/200 PASS - 100% BIT-BY-BIT EQUAL')
else:
    print('RESULT: FAIL')
    print('Expected:', repr(expected))
    print('Actual:  ', repr(actual))
" | tee -a "$LOG_FILE"

echo "=== CLOSED-LOOP TEST FINISHED ===" | tee -a "$LOG_FILE"
