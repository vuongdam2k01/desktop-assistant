#!/usr/bin/env bash
# spikes/SP-7-pet-window-os/macos/src/run_all_tests.sh
# Master runner for all SP-7 macOS tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== RUNNING ALL SP-7 / macOS TESTS ==="

# Check health of Electron pet
if ! curl -s http://127.0.0.1:18923/health > /dev/null; then
    echo "Starting Electron pet app..."
    npx electron "$SCRIPT_DIR/electron-pet/main.js" &
    sleep 3
fi

echo "1. Running Q1 Focus Tests (10 runs)..."
"$SCRIPT_DIR/test-q1-focus.sh" 10 panel show

echo "2. Running Q2 Click-through Tests..."
"$SCRIPT_DIR/test-q2-clickthrough.sh"

echo "3. Running Q3 Fullscreen & Spaces Tests..."
"$SCRIPT_DIR/test-q3-fullscreen.sh"

echo "4. Running Q4 Multi-Monitor & Fallback Tests..."
"$SCRIPT_DIR/test-q4-multimonitor.sh"

echo "5. Running Q5 Corner Orientation Tests..."
"$SCRIPT_DIR/test-q5-corners.sh"

echo "6. Running Q7 Dock & Switcher Tests..."
"$SCRIPT_DIR/test-q7-dock-switcher.sh"

echo "=== ALL SP-7 macOS TESTS FINISHED SUCCESSFULLY ==="
