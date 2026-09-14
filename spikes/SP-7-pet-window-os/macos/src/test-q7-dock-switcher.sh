#!/usr/bin/env bash
# spikes/SP-7-pet-window-os/macos/src/test-q7-dock-switcher.sh
# Tests Q7: Dock, Cmd-Tab App Switcher, and Two-Window Architecture (ADR-002)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$BASE_DIR/evidence"
REPO_ROOT="$(cd "$BASE_DIR/../../.." && pwd)"
SP0_SRC="$REPO_ROOT/spikes/SP-0-gui-harness/macos/src"

LOG_FILE="$EVIDENCE_DIR/q7-dock-switcher.log"
echo "==========================================================" | tee "$LOG_FILE"
echo "SP-7 / Q7 DOCK, APP SWITCHER & TWO-WINDOW TEST (macOS)" | tee -a "$LOG_FILE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$LOG_FILE"
echo "==========================================================" | tee -a "$LOG_FILE"

# 1. Query running applications in macOS (AppKit NSRunningApplication)
python3 -c "
import AppKit

def check_app_in_switcher(bundle_id_or_name):
    apps = AppKit.NSWorkspace.sharedWorkspace().runningApplications()
    found = []
    for a in apps:
        name = a.localizedName()
        policy = a.activationPolicy() # 0 = Regular, 1 = Accessory, 2 = Prohibited
        if 'Electron' in name or 'desktop-assistant' in name:
            found.append({
                'name': name,
                'pid': a.processIdentifier(),
                'policy': policy,
                'policy_name': 'Regular (in Dock/Switcher)' if policy == 0 else ('Accessory (Hidden from Dock/Switcher)' if policy == 1 else 'Prohibited'),
                'active': a.isActive()
            })
    return found

print('Current Electron processes:')
for a in check_app_in_switcher('Electron'):
    print(f'  PID {a[\"pid\"]}: {a[\"name\"]} | Policy: {a[\"policy_name\"]} | Active: {a[\"active\"]}')
" | tee -a "$LOG_FILE"

# 2. Test toggling Dock to HIDE (Accessory Mode)
echo "" | tee -a "$LOG_FILE"
echo "[Step 2] Setting Dock Mode = HIDE (NSApplicationActivationPolicyAccessory)..." | tee -a "$LOG_FILE"
curl -s "http://127.0.0.1:18923/set-mode?mode=panel&dock=hide" > /dev/null
sleep 1.0

python3 -c "
import AppKit
for a in AppKit.NSWorkspace.sharedWorkspace().runningApplications():
    if 'Electron' in a.localizedName():
        p = a.activationPolicy()
        pname = 'Regular (Dock)' if p == 0 else ('Accessory (Hidden)' if p == 1 else 'Prohibited')
        print(f'  After dock.hide() -> PID {a.processIdentifier()}: {pname}')
" | tee -a "$LOG_FILE"

SHOT_DOCK_HIDDEN="$EVIDENCE_DIR/q7-dock-hidden.png"
"$SP0_SRC/screenshot" --full "$SHOT_DOCK_HIDDEN"
echo "Screenshot saved: $SHOT_DOCK_HIDDEN" | tee -a "$LOG_FILE"

# 3. Test toggling Dock to SHOW (Regular Mode for App Window)
echo "" | tee -a "$LOG_FILE"
echo "[Step 3] Setting Dock Mode = SHOW (NSApplicationActivationPolicyRegular)..." | tee -a "$LOG_FILE"
curl -s "http://127.0.0.1:18923/set-mode?mode=panel&dock=show" > /dev/null
sleep 1.0

python3 -c "
import AppKit
for a in AppKit.NSWorkspace.sharedWorkspace().runningApplications():
    if 'Electron' in a.localizedName():
        p = a.activationPolicy()
        pname = 'Regular (Dock)' if p == 0 else ('Accessory (Hidden)' if p == 1 else 'Prohibited')
        print(f'  After dock.show() -> PID {a.processIdentifier()}: {pname}')
" | tee -a "$LOG_FILE"

SHOT_DOCK_VISIBLE="$EVIDENCE_DIR/q7-dock-visible.png"
"$SP0_SRC/screenshot" --full "$SHOT_DOCK_VISIBLE"
echo "Screenshot saved: $SHOT_DOCK_VISIBLE" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "Q7 Test Completed Successfully." | tee -a "$LOG_FILE"
