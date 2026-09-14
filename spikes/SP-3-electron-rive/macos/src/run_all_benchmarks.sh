#!/usr/bin/env bash
# spikes/SP-3-electron-rive/macos/src/run_all_benchmarks.sh
# Master runner for SP-3/mac benchmark suite

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ELECTRON_DIR="$SCRIPT_DIR/electron-rive"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

echo "=== PREPARING ENVIRONMENT ==="

# 1. Compile native helper if not already compiled
if [[ ! -f "$SCRIPTS_DIR/measure_pixels" ]]; then
  echo "Compiling native measure_pixels tool..."
  clang -framework Foundation -framework AppKit -framework CoreGraphics -O2 \
        -o "$SCRIPTS_DIR/measure_pixels" "$SCRIPTS_DIR/measure_pixels.m"
fi

# 2. Check if Pet Electron app is already running on port 3838
STARTED_ELECTRON=0
if ! curl -s http://127.0.0.1:3838/ping > /dev/null 2>&1; then
  echo "Starting Pet Electron app in background..."
  npx electron "$ELECTRON_DIR/main.js" &
  ELECTRON_PID=$!
  STARTED_ELECTRON=1

  # Wait for ping ready
  echo -n "Waiting for Pet app to become ready..."
  for i in {1..30}; do
    if curl -s http://127.0.0.1:3838/ping > /dev/null 2>&1; then
      echo " READY!"
      break
    fi
    sleep 0.5
    echo -n "."
  done
else
  echo "Pet Electron app already running on port 3838."
fi

# 3. Run benchmarks
echo "Running node benchmark script..."
node "$SCRIPTS_DIR/run-benchmarks.js"

echo "=== BENCHMARK SUITE FINISHED ==="
