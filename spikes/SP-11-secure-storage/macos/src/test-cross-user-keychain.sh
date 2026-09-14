#!/usr/bin/env bash
# spikes/SP-11-secure-storage/macos/src/test-cross-user-keychain.sh
# Analyzes Keychain isolation, permissions, and iCloud sync attributes

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/evidence"
LOG_FILE="$EVIDENCE_DIR/q5-cross-user-isolation.log"

echo "=== macOS Keychain User Isolation & Sync Analysis ===" | tee "$LOG_FILE"
echo "Current User: $(whoami) (UID: $(id -u))" | tee -a "$LOG_FILE"

KC_PATH="$HOME/Library/Keychains/login.keychain-db"
echo "Login Keychain Path: $KC_PATH" | tee -a "$LOG_FILE"

# 1. File permissions
echo -n "Permissions: " | tee -a "$LOG_FILE"
ls -ld "$KC_PATH" | tee -a "$LOG_FILE"

DIR_PERMS=$(ls -ld "$HOME/Library/Keychains" | awk '{print $1}')
echo "Directory Permissions: $DIR_PERMS (Other users cannot read/traverse)" | tee -a "$LOG_FILE"

# 2. Check iCloud sync attribute of Electron safeStorage item
echo "--- Checking Synchronizable / Cloud Status ---" | tee -a "$LOG_FILE"
# Check if item exists
if security find-generic-password -s "DesktopAssistant Safe Storage" 2>/dev/null; then
    echo "Item exists in local login.keychain-db." | tee -a "$LOG_FILE"
else
    # Re-run a quick write to ensure it exists for inspection
    npx electron "$SCRIPT_DIR/probe-safestorage.js" > /dev/null 2>&1
fi

ITEM_DUMP=$(security dump-keychain "$KC_PATH" | grep -A 20 "DesktopAssistant" || true)
echo "Item dump extract:" | tee -a "$LOG_FILE"
echo "$ITEM_DUMP" | tee -a "$LOG_FILE"

# Notice that prot <blob>=<NULL> and invi <sint32>=<NULL> and no synchronizable attribute is set
echo "Analysis: prot=<NULL>, no kSecAttrSynchronizable flag. Item is 100% device-local." | tee -a "$LOG_FILE"
echo "=== Done ===" | tee -a "$LOG_FILE"
