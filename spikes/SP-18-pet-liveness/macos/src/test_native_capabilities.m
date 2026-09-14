#import <Cocoa/Cocoa.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#include <stdio.h>
#include <sys/time.h>

static double get_time_ms(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (tv.tv_sec * 1000.0) + (tv.tv_usec / 1000.0);
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        printf("=== TESTING NATIVE MACOS CAPABILITIES FOR SP-18 ===\n");

        // 1. Check Permissions
        BOOL hasAX = AXIsProcessTrusted();
        BOOL hasScreen = CGPreflightScreenCaptureAccess();
        printf("[PERM] Accessibility: %s\n", hasAX ? "YES" : "NO");
        printf("[PERM] Screen Recording: %s\n", hasScreen ? "YES" : "NO");

        // 2. Window Enumeration (Q10, Q11)
        double t0 = get_time_ms();
        CFArrayRef winList = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
        double t1 = get_time_ms();
        printf("[Q10] Window enumeration took %.2f ms\n", t1 - t0);

        if (winList) {
            CFIndex count = CFArrayGetCount(winList);
            printf("[Q10] Total on-screen windows found: %ld\n", count);
            int withTitle = 0;
            int withoutTitle = 0;
            for (CFIndex i = 0; i < count; i++) {
                CFDictionaryRef dict = (CFDictionaryRef)CFArrayGetValueAtIndex(winList, i);
                CFStringRef ownerName = (CFStringRef)CFDictionaryGetValue(dict, kCGWindowOwnerName);
                CFStringRef winName = (CFStringRef)CFDictionaryGetValue(dict, kCGWindowName);
                CFDictionaryRef bounds = (CFDictionaryRef)CFDictionaryGetValue(dict, kCGWindowBounds);

                CGRect rect = CGRectZero;
                if (bounds) CGRectMakeWithDictionaryRepresentation(bounds, &rect);

                if (winName && CFStringGetLength(winName) > 0) {
                    withTitle++;
                } else {
                    withoutTitle++;
                }

                if (i < 5) {
                    char oBuf[128] = "Unknown";
                    char tBuf[128] = "(none)";
                    if (ownerName) CFStringGetCString(ownerName, oBuf, sizeof(oBuf), kCFStringEncodingUTF8);
                    if (winName) CFStringGetCString(winName, tBuf, sizeof(tBuf), kCFStringEncodingUTF8);
                    printf("  - Win #%ld: Owner='%s' Title='%s' Bounds=(%.0f, %.0f, %.0f, %.0f)\n",
                           i, oBuf, tBuf, rect.origin.x, rect.origin.y, rect.size.width, rect.size.height);
                }
            }
            printf("[Q11] Windows with Title: %d | Windows without Title: %d\n", withTitle, withoutTitle);
            CFRelease(winList);
        }

        // 3. Foreground Application Tracking (Q12)
        NSRunningApplication *frontApp = [[NSWorkspace sharedWorkspace] frontmostApplication];
        printf("[Q12] Frontmost App (via NSWorkspace, 0 perms): Name='%s' BundleID='%s' PID=%d\n",
               [[frontApp localizedName] UTF8String],
               [[frontApp bundleIdentifier] UTF8String],
               [frontApp processIdentifier]);

        // 4. Caret Position Tracking (Q15)
        if (hasAX) {
            AXUIElementRef sysWide = AXUIElementCreateSystemWide();
            AXUIElementRef focusedElem = NULL;
            AXError err = AXUIElementCopyAttributeValue(sysWide, kAXFocusedUIElementAttribute, (CFTypeRef *)&focusedElem);
            if (err == kAXErrorSuccess && focusedElem) {
                CFTypeRef selectedRangeVal = NULL;
                err = AXUIElementCopyAttributeValue(focusedElem, kAXSelectedTextRangeAttribute, &selectedRangeVal);
                if (err == kAXErrorSuccess && selectedRangeVal) {
                    AXValueRef boundsVal = NULL;
                    err = AXUIElementCopyParameterizedAttributeValue(focusedElem, kAXBoundsForRangeParameterizedAttribute, selectedRangeVal, (CFTypeRef *)&boundsVal);
                    if (err == kAXErrorSuccess && boundsVal) {
                        CGRect caretRect;
                        AXValueGetValue(boundsVal, kAXValueCGRectType, &caretRect);
                        printf("[Q15] Caret detected: Origin=(%.1f, %.1f) Size=(%.1f, %.1f)\n",
                               caretRect.origin.x, caretRect.origin.y, caretRect.size.width, caretRect.size.height);
                        CFRelease(boundsVal);
                    } else {
                        printf("[Q15] Focused element has text range but no bounds (err=%d)\n", err);
                    }
                    CFRelease(selectedRangeVal);
                } else {
                    // Try getting position of focused element itself
                    CFTypeRef posVal = NULL, sizeVal = NULL;
                    AXUIElementCopyAttributeValue(focusedElem, kAXPositionAttribute, &posVal);
                    AXUIElementCopyAttributeValue(focusedElem, kAXSizeAttribute, &sizeVal);
                    CGPoint pt = CGPointZero;
                    CGSize sz = CGSizeZero;
                    if (posVal) AXValueGetValue((AXValueRef)posVal, kAXValueCGPointType, &pt);
                    if (sizeVal) AXValueGetValue((AXValueRef)sizeVal, kAXValueCGSizeType, &sz);
                    printf("[Q15] Focused element bounds: Origin=(%.1f, %.1f) Size=(%.1f, %.1f)\n",
                           pt.x, pt.y, sz.width, sz.height);
                    if (posVal) CFRelease(posVal);
                    if (sizeVal) CFRelease(sizeVal);
                }
                CFRelease(focusedElem);
            } else {
                printf("[Q15] No focused UI element or AX error: %d\n", err);
            }
            CFRelease(sysWide);
        } else {
            printf("[Q15] AX is not trusted, cannot read caret position\n");
        }

        // 5. Window Sharing Exclusion test (Q29)
        printf("[Q29] NSWindow sharingType supported: NSWindowSharingNone=0, NSWindowSharingReadOnly=1\n");
    }
    return 0;
}
