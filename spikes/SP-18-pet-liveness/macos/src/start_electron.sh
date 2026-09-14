#!/usr/bin/env bash
# spikes/SP-18-pet-liveness/macos/src/start_electron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Kill any existing Electron
pkill -f "electron.*SP-18-pet-liveness" || true
pkill -f "Electron.*sp18" || true
sleep 1

echo "Starting Electron Pet Liveness..."
npx electron "$BASE_DIR" > "$BASE_DIR/evidence/electron-stdout.log" 2>&1 &
ELECTRON_PID=$!
echo "Launched Electron background process with PID: $ELECTRON_PID"

# Wait for HTTP server to become responsive
for i in {1..20}; do
  if curl -s http://127.0.0.1:3838/ping | grep -q '"status":"ok"'; then
    echo "Electron Pet Liveness is READY on http://127.0.0.1:3838"
    exit 0
  fi
  sleep 0.5
done

echo "Timed out waiting for Electron Pet Liveness to start!"
cat "$BASE_DIR/evidence/electron-stdout.log"
exit 1
