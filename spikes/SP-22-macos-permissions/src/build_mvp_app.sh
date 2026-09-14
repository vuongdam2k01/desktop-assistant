#!/bin/bash
set -e

SOURCE_APP="spikes/SP-12-sqlite-ledger/macos/node_modules/electron/dist/Electron.app"
DEST_APP="spikes/SP-22-macos-permissions/src/DesktopAssistantMVP.app"
BUNDLE_ID="com.desktopassistant.mvp.clean"

echo "=== Building DesktopAssistantMVP.app with bundle ID $BUNDLE_ID ==="

rm -rf "$DEST_APP"
cp -R "$SOURCE_APP" "$DEST_APP"

# Update Info.plist
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BUNDLE_ID" "$DEST_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName DesktopAssistantMVP" "$DEST_APP/Contents/Info.plist"

# Put app code into Resources/app
mkdir -p "$DEST_APP/Contents/Resources/app"
cp spikes/SP-22-macos-permissions/src/mvp_clean_run/main.js "$DEST_APP/Contents/Resources/app/"
cp spikes/SP-22-macos-permissions/src/mvp_clean_run/index.html "$DEST_APP/Contents/Resources/app/"
cp spikes/SP-22-macos-permissions/src/mvp_clean_run/card.html "$DEST_APP/Contents/Resources/app/"
cp spikes/SP-22-macos-permissions/src/mvp_clean_run/package.json "$DEST_APP/Contents/Resources/app/"

# Resign ad-hoc
codesign --force --deep --sign - "$DEST_APP"

echo "DesktopAssistantMVP.app built and signed successfully."
