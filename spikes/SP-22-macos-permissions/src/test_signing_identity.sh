#!/bin/bash
set -e

echo "=== Investigating macOS TCC Code Identity & Designated Requirements ==="

APP="spikes/SP-22-macos-permissions/src/TestPermissions.app"

echo "1. Reading Designated Requirement of TestPermissions.app:"
codesign -d -r- "$APP"

echo ""
echo "2. Analyzing CDHash:"
codesign -dvvv "$APP" 2>&1 | grep -E "(Identifier|Format|CodeDirectory|CDHash|Signature)"

echo ""
echo "3. Testing requirement compilation with csreq:"
# Extract designated requirement
DR=$(codesign -d -r- "$APP" 2>&1 | sed 's/designated => //')
echo "Extracted requirement: $DR"

echo "Done."
