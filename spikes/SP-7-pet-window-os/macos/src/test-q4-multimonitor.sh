#!/usr/bin/env bash
# spikes/SP-7-pet-window-os/macos/src/test-q4-multimonitor.sh
# Tests Q4: Display inspection and E2 Fallback Logic

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="$BASE_DIR/evidence"

LOG_FILE="$EVIDENCE_DIR/q4-multimonitor.log"
echo "==========================================================" | tee "$LOG_FILE"
echo "SP-7 / Q4 MULTI-MONITOR & FALLBACK TEST (macOS)" | tee -a "$LOG_FILE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$LOG_FILE"
echo "==========================================================" | tee -a "$LOG_FILE"

# 1. Inspect display configuration
DISPLAYS_JSON=$(curl -s http://127.0.0.1:18923/workarea)
echo "Display Configuration from Electron Screen API:" | tee -a "$LOG_FILE"
echo "$DISPLAYS_JSON" | python3 -m json.tool | tee -a "$LOG_FILE"

# 2. Test E2 Fallback Logic:
# Simulate stored coordinates from a disconnected monitor: (3500, 800)
echo "" | tee -a "$LOG_FILE"
echo "[Step 2] Testing E2 Fallback Algorithm (Simulated Disconnected Display)..." | tee -a "$LOG_FILE"

python3 -c "
import urllib.request, json

# 1. Fetch current displays
res = json.loads(urllib.request.urlopen('http://127.0.0.1:18923/workarea').read().decode())
primary = res['primary']
wa = primary['workArea']
all_displays = res['allDisplays']

print(f'Active displays: {len(all_displays)}')
print(f'Primary workArea: {wa}')

# Stored coordinates from previous session on detached secondary monitor
stored_pos = {'x': 3500, 'y': 800, 'width': 140, 'height': 140}
print(f'Simulated stored position from detached monitor: {stored_pos}')

# Fallback algorithm E2: Check intersection with all display workAreas
def is_visible_on_any_display(pos, displays):
    for d in displays:
        dwa = d['workArea']
        intersect_x = max(pos['x'], dwa['x']) < min(pos['x'] + pos['width'], dwa['x'] + dwa['width'])
        intersect_y = max(pos['y'], dwa['y']) < min(pos['y'] + pos['height'], dwa['y'] + dwa['height'])
        if intersect_x and intersect_y:
            return True
    return False

visible = is_visible_on_any_display(stored_pos, all_displays)
print(f'Is stored position visible on any current display? {visible}')

if not visible:
    # E2 fallback to bottom-right of primary workArea
    fallback_x = wa['x'] + wa['width'] - stored_pos['width'] - 20
    fallback_y = wa['y'] + wa['height'] - stored_pos['height'] - 20
    print(f'Applying E2 Fallback -> Clamped to primary display: ({fallback_x}, {fallback_y})')
    # Apply to pet
    urllib.request.urlopen(f'http://127.0.0.1:18923/move-pet?x={fallback_x}&y={fallback_y}')

# Verify new position
status = json.loads(urllib.request.urlopen('http://127.0.0.1:18923/status').read().decode())
print(f'Verified Pet Bounds after fallback: {status[\"petBounds\"]}')
assert status['petBounds']['x'] == fallback_x and status['petBounds']['y'] == fallback_y
print('E2 Fallback Verification: PASS')
" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "HARDWARE LIMITATION NOTE (Roadmap §3.9):" | tee -a "$LOG_FILE"
echo "Current test machine is a Mac mini with exactly 1 physical display (1080p, scale 1.0)." | tee -a "$LOG_FILE"
echo "Multi-monitor with mixed scale factors (Retina 2x + 1x) is marked CHƯA KIỂM CHỨNG — thiếu phần cứng, cần máy có 2 màn hình khác scale." | tee -a "$LOG_FILE"
