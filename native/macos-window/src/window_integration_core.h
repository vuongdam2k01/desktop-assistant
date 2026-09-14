#ifndef WINDOW_INTEGRATION_CORE_H
#define WINDOW_INTEGRATION_CORE_H

#import <Cocoa/Cocoa.h>
#include <cstdint>
#include <cstddef>

struct MatchedTarget {
    NSWindow* window;
    NSView* view;
};

// Returns true if running on the main thread
bool CoreIsMainThread();

// Validates pointer by searching [NSApp windows] hierarchy without direct dereference
// Returns MatchedTarget with nil members if not found
MatchedTarget CoreFindOwnedTarget(void* target_ptr);

// Applies NSWindowStyleMaskNonactivatingPanel, Spaces / fullscreen auxiliary behaviors, and screen-saver level
// Returns 0 on success, or non-zero error code
int CoreApplyNoActivateTopmost(NSWindow* window);

// Installs instance-local runtime subclass on view to intercept hitTest:
// Alpha 0 or out-of-bounds returns nil; non-zero alpha delegates to original hitTest:
int CoreEnablePixelHitTest(NSView* view, uint32_t width, uint32_t height, const uint8_t* alpha_data, size_t alpha_len);

// Restores original instance class on view and removes associated mask
int CoreDisablePixelHitTest(NSView* view);

// Remembers current frontmost application processIdentifier if not DesktopAssistant
bool CoreRememberPreviousFocus();

// Restores focus to remembered processIdentifier; returns false if gone or self
bool CoreRestorePreviousFocus();

// Maps 'accessory' -> NSApplicationActivationPolicyAccessory, 'regular' -> NSApplicationActivationPolicyRegular
bool CoreSetActivationPolicy(const char* mode);

// Sets NSWindowSharingNone when excluded, NSWindowSharingReadOnly when restored
bool CoreExcludeFromCapture(NSWindow* window, bool excluded);

#endif // WINDOW_INTEGRATION_CORE_H
