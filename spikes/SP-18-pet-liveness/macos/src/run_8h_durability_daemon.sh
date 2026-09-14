#!/usr/bin/env bash
# spikes/SP-18-pet-liveness/macos/src/run_8h_durability_daemon.sh
# 8-hour detached durability daemon for SP-18/mac NFR-RL-04
# Runs in background, keeps system awake via caffeinate, samples every 15 minutes.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$BASE_DIR/evidence"
HELPER="$SCRIPT_DIR/bin/liveness_helper"

mkdir -p "$EVIDENCE_DIR"
LOG_FILE="$EVIDENCE_DIR/q3-8hour-durability.log"
JSON_FILE="$EVIDENCE_DIR/q3-8hour-durability.json"

echo "=== STARTING 8-HOUR DETACHED DURABILITY DAEMON ===" > "$LOG_FILE"
echo "Start time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$LOG_FILE"

# Prevent system sleep and display sleep (SP-0/mac Q6)
caffeinate -d -i -s -u -t 28800 &
CAFF_PID=$!
echo "Caffeinate PID: $CAFF_PID (Active for 28800s = 8 hours)" >> "$LOG_FILE"

# Find Electron Main PID
ELECTRON_PID=$(curl -s http://127.0.0.1:3838/ping | grep -o '"pid":[0-9]*' | cut -d: -f2)
if [ -z "$ELECTRON_PID" ]; then
  echo "ERROR: Electron Pet Liveness is not running on port 3838" >> "$LOG_FILE"
  exit 1
fi
echo "Monitoring Electron PID: $ELECTRON_PID" >> "$LOG_FILE"

TOTAL_ITERATIONS=32
INTERVAL_SEC=900 # 15 minutes

for i in $(seq 1 $TOTAL_ITERATIONS); do
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  STATS=$("$HELPER" stats "$ELECTRON_PID" 2>/dev/null || echo '{"error": "inspect_failed"}')
  METRICS=$(curl -s http://127.0.0.1:3838/metrics 2>/dev/null || echo '{"error": "curl_failed"}')
  
  ENTRY="{\"step\": $i, \"timestamp\": \"$TIMESTAMP\", \"stats\": $STATS, \"metrics\": $METRICS}"
  echo "$ENTRY" >> "$LOG_FILE"
  
  if [ "$i" -lt "$TOTAL_ITERATIONS" ]; then
    sleep "$INTERVAL_SEC"
  fi
done

echo "End time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$LOG_FILE"
echo "=== 8-HOUR DURABILITY MEASUREMENT COMPLETED ===" >> "$LOG_FILE"
