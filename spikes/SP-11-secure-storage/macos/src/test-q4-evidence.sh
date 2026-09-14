#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
EVIDENCE_DIR="$SCRIPT_DIR/../evidence"
LOG_FILE="$EVIDENCE_DIR/q4-deny-and-locked-keychain.log"

echo "=== Testing Q4: User Deny & Locked Keychain Scenarios ===" | tee "$LOG_FILE"

# Scenario 1: User clicks Deny on Keychain prompt
echo "--- Scenario 1: User Denial (errSecUserCanceled = -128) ---" | tee -a "$LOG_FILE"
# Write with Adhoc v1
"$BIN_DIR/bin_adhoc_v1" write "DesktopAssistant-DenyTest" "token" "CONFIDENTIAL_TOKEN_XYZ" >> "$LOG_FILE" 2>&1

# Read with Adhoc v2 in background (triggers prompt)
"$BIN_DIR/bin_adhoc_v2" read "DesktopAssistant-DenyTest" "token" > "$EVIDENCE_DIR/deny-run.tmp" 2>&1 &
BG_PID=$!
sleep 1

# Click Deny
osascript -e 'tell application "System Events" to tell process "SecurityAgent" to click button "Deny" of window 1' 2>/dev/null || true
wait $BG_PID || true

cat "$EVIDENCE_DIR/deny-run.tmp" | tee -a "$LOG_FILE"
rm -f "$EVIDENCE_DIR/deny-run.tmp"
"$BIN_DIR/bin_adhoc_v1" delete "DesktopAssistant-DenyTest" "token" > /dev/null 2>&1 || true

# Scenario 2: Locked Keychain
echo "--- Scenario 2: Locked Keychain (errSecInteractionNotAllowed = -25308) ---" | tee -a "$LOG_FILE"
TEST_KC="/Users/<user>/Library/Keychains/q4_locked.keychain-db"
rm -f "$TEST_KC"
security create-keychain -p secretpass123 "$TEST_KC"
security unlock-keychain -p secretpass123 "$TEST_KC"
security add-generic-password -a "auth_token" -s "DesktopAssistant-LockedService" -w "LOCKED_SECRET_VALUE" "$TEST_KC"
echo "Item added to test keychain." | tee -a "$LOG_FILE"

# Lock it
security lock-keychain "$TEST_KC"
echo "Locked keychain." | tee -a "$LOG_FILE"

# Try reading from locked keychain via CLI without unlocking
echo "Attempting read from locked keychain:" | tee -a "$LOG_FILE"
security find-generic-password -a "auth_token" -s "DesktopAssistant-LockedService" "$TEST_KC" 2>&1 | tee -a "$LOG_FILE" || true

# Clean up
security delete-keychain "$TEST_KC" 2>/dev/null || true
echo "=== Done ===" | tee -a "$LOG_FILE"
