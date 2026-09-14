#!/bin/bash
set -e

BUNDLE_ID="com.desktopassistant.mvp.clean"
APP="$PWD/spikes/SP-22-macos-permissions/src/DesktopAssistantMVP.app"
SCREENSHOT="$PWD/spikes/SP-22-macos-permissions/evidence/mvp-zero-tcc-screenshot.png"

echo "=== STEP 1: RESETTING ALL TCC PERMISSIONS FOR $BUNDLE_ID ==="
tccutil reset All "$BUNDLE_ID" || true

echo "=== STEP 2: CLEARING OLD RUN ARTIFACTS ==="
rm -f /tmp/mvp_zero_tcc_run.log /tmp/mvp_zero_tcc_result.json

echo "=== STEP 3: LAUNCHING DesktopAssistantMVP.app ON CLEAN STATE ==="
open -a "$APP"

echo "Waiting for windows to render and job to process..."
sleep 5

echo "=== STEP 4: CAPTURING VERIFICATION SCREENSHOT ==="
screencapture -x "$SCREENSHOT"
echo "Screenshot saved to $SCREENSHOT"

echo "Waiting for app to complete end-to-end test..."
sleep 4

echo "=== STEP 5: VERIFYING RESULTS ==="
if [ -f /tmp/mvp_zero_tcc_result.json ]; then
    echo "Result JSON found:"
    cat /tmp/mvp_zero_tcc_result.json
    cp /tmp/mvp_zero_tcc_result.json spikes/SP-22-macos-permissions/evidence/
    cp /tmp/mvp_zero_tcc_run.log spikes/SP-22-macos-permissions/evidence/
    echo "SUCCESS: MVP Clean Run verified with ZERO TCC permissions!"
else
    echo "ERROR: Result JSON not found! Check log:"
    cat /tmp/mvp_zero_tcc_run.log || true
    exit 1
fi
