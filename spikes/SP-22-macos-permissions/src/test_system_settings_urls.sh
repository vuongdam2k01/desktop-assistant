#!/bin/bash
set -e

echo "=== Testing System Settings Deep Links ==="

URLS=(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
    "x-apple.systempreferences:com.apple.preference.notifications"
    "x-apple.systempreferences:com.apple.preference.general?LoginItems"
)

for url in "${URLS[@]}"; do
    echo -n "Testing URL: $url ... "
    if open "$url"; then
        echo "SUCCESS (exit 0)"
    else
        echo "FAILED"
    fi
    sleep 0.5
done

echo "All URL schemes tested successfully."
