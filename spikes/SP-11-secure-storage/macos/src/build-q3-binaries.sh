#!/usr/bin/env bash
# spikes/SP-11-secure-storage/macos/src/build-q3-binaries.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
mkdir -p "$BIN_DIR"
TEST_KC="/Users/<user>/Library/Keychains/test_sign.keychain-db"

echo "=== Building Q3 Test Binaries ==="

# 1. Ad-hoc v1
clang -O2 -framework Security -framework CoreFoundation -DVERSION_STR=\"1.0.0\" \
  "$SCRIPT_DIR/keychain-acl-test.c" -o "$BIN_DIR/bin_adhoc_v1"
codesign -s - --force --identifier "com.desktopassistant.adhoc" "$BIN_DIR/bin_adhoc_v1"

# 2. Ad-hoc v2 (different code, modified binary)
clang -O2 -framework Security -framework CoreFoundation -DVERSION_STR=\"2.0.0\" -DEXTRA_NOP=1 \
  "$SCRIPT_DIR/keychain-acl-test.c" -o "$BIN_DIR/bin_adhoc_v2"
codesign -s - --force --identifier "com.desktopassistant.adhoc" "$BIN_DIR/bin_adhoc_v2"

# 3. Cert A v1
clang -O2 -framework Security -framework CoreFoundation -DVERSION_STR=\"1.0.0\" \
  "$SCRIPT_DIR/keychain-acl-test.c" -o "$BIN_DIR/bin_certA_v1"
codesign -s "DesktopAssistant Dev Test A" --keychain "$TEST_KC" --force \
  --identifier "com.desktopassistant.stable" "$BIN_DIR/bin_certA_v1"

# 4. Cert A v2 (updated code, same Certificate A & identifier - simulating auto-update)
clang -O2 -framework Security -framework CoreFoundation -DVERSION_STR=\"2.0.0\" -DEXTRA_NOP=1 \
  "$SCRIPT_DIR/keychain-acl-test.c" -o "$BIN_DIR/bin_certA_v2"
codesign -s "DesktopAssistant Dev Test A" --keychain "$TEST_KC" --force \
  --identifier "com.desktopassistant.stable" "$BIN_DIR/bin_certA_v2"

# 5. Cert B (different certificate identity - simulating hijacked or mismatched signature)
clang -O2 -framework Security -framework CoreFoundation -DVERSION_STR=\"2.0.0\" \
  "$SCRIPT_DIR/keychain-acl-test.c" -o "$BIN_DIR/bin_certB"
codesign -s "DesktopAssistant Dev Test B" --keychain "$TEST_KC" --force \
  --identifier "com.desktopassistant.stable" "$BIN_DIR/bin_certB"

echo "=== Codesign Verification ==="
for f in "$BIN_DIR"/*; do
    echo "--- $(basename "$f") ---"
    codesign -dv --verbose=2 "$f" 2>&1 | grep -E "Signature|Authority|Identifier|CDHash"
    echo "Designated Requirement:"
    codesign -d -r- "$f" 2>&1 | tail -n 1
done
