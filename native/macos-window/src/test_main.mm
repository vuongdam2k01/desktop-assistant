#import <Cocoa/Cocoa.h>
#import "window_integration_core.h"
#include <cassert>
#include <iostream>

int main(int argc, const char* argv[]) {
    @autoreleasepool {
        std::cout << "[test_macos_window] Initializing NSApplication...\n";
        [NSApplication sharedApplication];

        assert(CoreIsMainThread() && "CoreIsMainThread must be true on main thread");

        std::cout << "[test_macos_window] Testing NSPanel creation and CoreApplyNoActivateTopmost...\n";
        NSRect frame = NSMakeRect(100, 100, 320, 320);
        NSPanel* panel = [[NSPanel alloc] initWithContentRect:frame
                                                    styleMask:NSWindowStyleMaskBorderless
                                                      backing:NSBackingStoreBuffered
                                                        defer:NO];
        NSView* contentView = [[NSView alloc] initWithFrame:frame];
        [panel setContentView:contentView];

        // 1. Verify standard window rejection as INVALID_WINDOW_KIND
        NSWindow* standardWin = [[NSWindow alloc] initWithContentRect:frame
                                                           styleMask:NSWindowStyleMaskTitled
                                                             backing:NSBackingStoreBuffered
                                                               defer:NO];
        int rejectKind = CoreApplyNoActivateTopmost(standardWin);
        assert(rejectKind == 2 && "Standard NSWindow must be rejected with 2 (INVALID_WINDOW_KIND)");

        // 2. Apply on owned NSPanel
        int res = CoreApplyNoActivateTopmost(panel);
        assert(res == 0 && "CoreApplyNoActivateTopmost must succeed on NSPanel");

        assert(([panel styleMask] & NSWindowStyleMaskNonactivatingPanel) &&
               "Style mask must contain NSWindowStyleMaskNonactivatingPanel");

        NSWindowCollectionBehavior expectedBehaviors =
            NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorFullScreenAuxiliary;
        assert(([panel collectionBehavior] & expectedBehaviors) == expectedBehaviors &&
               "Collection behavior must contain CanJoinAllSpaces and FullScreenAuxiliary");

        assert([panel level] == NSScreenSaverWindowLevel &&
               "Window level must be NSScreenSaverWindowLevel");

        // 3. Test CoreFindOwnedTarget
        MatchedTarget target = CoreFindOwnedTarget((__bridge void*)contentView);
        assert(target.window == panel && target.view == contentView &&
               "CoreFindOwnedTarget must locate owned panel and view");

        void* fakePtr = (void*)0xDEADBEEF;
        MatchedTarget fakeTarget = CoreFindOwnedTarget(fakePtr);
        assert(fakeTarget.window == nil && fakeTarget.view == nil &&
               "CoreFindOwnedTarget must return nil for foreign pointer");

        // 4. Test Pixel Hit Testing on 4x4 fixture
        std::cout << "[test_macos_window] Testing Pixel Hit Testing with 4x4 mask...\n";
        uint32_t maskW = 4;
        uint32_t maskH = 4;
        uint8_t alphaData[16] = {
            0,   0,   0,   0,
            0, 255, 255,   0,
            0, 255, 255,   0,
            0,   0,   0,   0
        };

        int hitRes = CoreEnablePixelHitTest(contentView, maskW, maskH, alphaData, sizeof(alphaData));
        assert(hitRes == 0 && "CoreEnablePixelHitTest must succeed with 4x4 mask");

        NSPoint cornerPoint = NSMakePoint(5, 5);
        NSPoint centerPoint = NSMakePoint(160, 160);

        NSView* hitCorner = [contentView hitTest:cornerPoint];
        assert(hitCorner == nil && "hitTest at transparent corner must return nil");

        NSView* hitCenter = [contentView hitTest:centerPoint];
        assert(hitCenter != nil && "hitTest at opaque center must return non-nil view");

        // Disable pixel hit test -> corner now returns view
        CoreDisablePixelHitTest(contentView);
        NSView* hitCornerAfter = [contentView hitTest:cornerPoint];
        assert(hitCornerAfter != nil && "hitTest after disable must return view");

        // 5. Test Activation Policy
        std::cout << "[test_macos_window] Testing Activation Policy...\n";
        bool accOk = CoreSetActivationPolicy("accessory");
        assert(accOk && "CoreSetActivationPolicy('accessory') must succeed");

        bool regOk = CoreSetActivationPolicy("regular");
        assert(regOk && "CoreSetActivationPolicy('regular') must succeed");

        bool invOk = CoreSetActivationPolicy("invalid_mode");
        assert(!invOk && "CoreSetActivationPolicy with invalid mode must return false");

        // 6. Test ExcludeFromCapture
        std::cout << "[test_macos_window] Testing ExcludeFromCapture...\n";
        bool excOk = CoreExcludeFromCapture(panel, true);
        assert(excOk && "CoreExcludeFromCapture(true) must succeed");
        assert([panel sharingType] == NSWindowSharingNone && "Sharing type must be NSWindowSharingNone");

        bool incOk = CoreExcludeFromCapture(panel, false);
        assert(incOk && "CoreExcludeFromCapture(false) must succeed");
        assert([panel sharingType] == NSWindowSharingReadOnly && "Sharing type must be NSWindowSharingReadOnly");

        // 7. Test Focus Restoration
        std::cout << "[test_macos_window] Testing Focus Restoration...\n";
        bool restEmpty = CoreRestorePreviousFocus();
        assert(!restEmpty && "CoreRestorePreviousFocus with empty store must return false");

        std::cout << "[test_macos_window] All native AppKit core tests passed successfully.\n";
    }
    return 0;
}
