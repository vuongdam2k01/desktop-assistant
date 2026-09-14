#!/bin/bash
set -e

echo "=== Testing Denial Behavior and Restart Requirements ==="

# We compile a dedicated probe to test AXIsProcessTrustedWithOptions
cat << 'C_EOF' > /tmp/test_ax_prompt.m
#import <Foundation/Foundation.h>
#import <ApplicationServices/ApplicationServices.h>

int main() {
    @autoreleasepool {
        Boolean trusted = AXIsProcessTrusted();
        printf("AXIsProcessTrusted (preflight): %d\n", trusted);
        
        NSDictionary *options = @{(__bridge id)kAXTrustedCheckOptionPrompt: @YES};
        Boolean promptedResult = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
        printf("AXIsProcessTrustedWithOptions (prompt): %d\n", promptedResult);
    }
    return 0;
}
C_EOF
clang -fobjc-arc -framework ApplicationServices -framework Foundation /tmp/test_ax_prompt.m -o spikes/SP-22-macos-permissions/src/bin/test_ax_prompt

echo "Executing test_ax_prompt:"
./spikes/SP-22-macos-permissions/src/bin/test_ax_prompt

echo "Testing ScreenCapture preflight without prompt:"
cat << 'C_EOF' > /tmp/test_sc_preflight.m
#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

int main() {
    @autoreleasepool {
        BOOL granted = CGPreflightScreenCaptureAccess();
        printf("CGPreflightScreenCaptureAccess: %s\n", granted ? "GRANTED" : "DENIED/NOT_DETERMINED");
    }
    return 0;
}
C_EOF
clang -fobjc-arc -framework CoreGraphics -framework Foundation /tmp/test_sc_preflight.m -o spikes/SP-22-macos-permissions/src/bin/test_sc_preflight
./spikes/SP-22-macos-permissions/src/bin/test_sc_preflight

echo "Denial tests complete."
