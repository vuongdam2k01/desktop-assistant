#!/bin/bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$BASE_DIR/app"
BUILDS_DIR="$BASE_DIR/../builds"
SERVER_UPDATES="$BASE_DIR/server/updates"

mkdir -p "$BUILDS_DIR/v1.0.0" "$BUILDS_DIR/v1.0.1" "$SERVER_UPDATES"

echo "=== ĐÓNG GÓI BẢN V1.0.0 ==="
cd "$APP_DIR"
node -e '
  const pkg = require("./package.json");
  pkg.version = "1.0.0";
  require("fs").writeFileSync("./package.json", JSON.stringify(pkg, null, 2));
'
rm -rf dist
CSC_NAME="DesktopAssistant Dev Test A" npx electron-builder --mac --arm64

cp dist/latest-mac.yml "$BUILDS_DIR/v1.0.0/"
cp dist/*.zip "$BUILDS_DIR/v1.0.0/" || true
cp dist/*.dmg "$BUILDS_DIR/v1.0.0/" || true
cp -R dist/mac-arm64/DesktopAssistantSpikeMac.app "$BUILDS_DIR/v1.0.0/"
echo "-> Hoàn tất v1.0.0"

echo "=== ĐÓNG GÓI BẢN V1.0.1 ==="
node -e '
  const pkg = require("./package.json");
  pkg.version = "1.0.1";
  require("fs").writeFileSync("./package.json", JSON.stringify(pkg, null, 2));
'
rm -rf dist
CSC_NAME="DesktopAssistant Dev Test A" npx electron-builder --mac --arm64

cp dist/latest-mac.yml "$BUILDS_DIR/v1.0.1/"
cp dist/*.zip "$BUILDS_DIR/v1.0.1/" || true
cp dist/*.dmg "$BUILDS_DIR/v1.0.1/" || true
cp -R dist/mac-arm64/DesktopAssistantSpikeMac.app "$BUILDS_DIR/v1.0.1/"
echo "-> Hoàn tất v1.0.1"

# Copy v1.0.1 lên update server
echo "=== PUBLISH BẢN V1.0.1 LÊN UPDATE SERVER ==="
rm -rf "$SERVER_UPDATES"/*
cp dist/latest-mac.yml "$SERVER_UPDATES/"
cp dist/*.zip "$SERVER_UPDATES/" || true
cp dist/*.dmg "$SERVER_UPDATES/" || true
echo "Danh sách file trên server cập nhật:"
ls -la "$SERVER_UPDATES"

echo "=== BUILD HOÀN TẤT THÀNH CÔNG ==="
