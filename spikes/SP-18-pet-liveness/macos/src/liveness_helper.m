#import <Cocoa/Cocoa.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <mach/mach.h>
#import <libproc.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/time.h>

static double get_time_ms(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (tv.tv_sec * 1000.0) + (tv.tv_usec / 1000.0);
}

// 1. Process Memory & CPU stats
void print_pid_stats(pid_t pid) {
    struct proc_taskallinfo tai;
    int ret = proc_pidinfo(pid, PROC_PIDTASKALLINFO, 0, &tai, sizeof(tai));
    if (ret <= 0) {
        printf("{\"error\": \"Failed to inspect PID %d\"}\n", pid);
        return;
    }

    uint64_t rss_bytes = tai.ptinfo.pti_resident_size;
    uint64_t virt_bytes = tai.ptinfo.pti_virtual_size;
    uint64_t user_time_ms = tai.ptinfo.pti_total_user / 1000000;
    uint64_t system_time_ms = tai.ptinfo.pti_total_system / 1000000;
    int threads = tai.ptinfo.pti_threadnum;

    printf("{\"pid\": %d, \"rss_bytes\": %llu, \"rss_mb\": %.2f, \"virt_mb\": %.2f, \"user_time_ms\": %llu, \"system_time_ms\": %llu, \"threads\": %d}\n",
           pid, rss_bytes, (double)rss_bytes / (1024.0 * 1024.0), (double)virt_bytes / (1024.0 * 1024.0),
           user_time_ms, system_time_ms, threads);
}

// 2. Frontmost Application
void print_frontmost(void) {
    @autoreleasepool {
        NSRunningApplication *app = [[NSWorkspace sharedWorkspace] frontmostApplication];
        if (!app) {
            printf("{\"error\": \"No frontmost application found\"}\n");
            return;
        }
        printf("{\"name\": \"%s\", \"bundleId\": \"%s\", \"pid\": %d, \"active\": %s}\n",
               [[app localizedName] UTF8String],
               [[app bundleIdentifier] ? [app bundleIdentifier] : @"" UTF8String],
               [app processIdentifier],
               [app isActive] ? "true" : "false");
    }
}

// 3. Restore focus to PID
void restore_focus(pid_t pid) {
    @autoreleasepool {
        double t0 = get_time_ms();
        NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
        if (!app) {
            printf("{\"success\": false, \"error\": \"PID not found\"}\n");
            return;
        }
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
        BOOL ok = [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
#pragma clang diagnostic pop
        double t1 = get_time_ms();
        printf("{\"success\": %s, \"latency_ms\": %.3f, \"name\": \"%s\", \"pid\": %d}\n",
               ok ? "true" : "false", t1 - t0, [[app localizedName] UTF8String], pid);
    }
}

// 4. Caret Position
void print_caret_pos(void) {
    @autoreleasepool {
        if (!AXIsProcessTrusted()) {
            printf("{\"error\": \"Accessibility not trusted\"}\n");
            return;
        }
        AXUIElementRef sysWide = AXUIElementCreateSystemWide();
        AXUIElementRef focusedElem = NULL;
        AXError err = AXUIElementCopyAttributeValue(sysWide, kAXFocusedUIElementAttribute, (CFTypeRef *)&focusedElem);
        if (err != kAXErrorSuccess || !focusedElem) {
            printf("{\"found\": false, \"reason\": \"no_focused_element\", \"error_code\": %d}\n", err);
            CFRelease(sysWide);
            return;
        }

        CFTypeRef selectedRangeVal = NULL;
        err = AXUIElementCopyAttributeValue(focusedElem, kAXSelectedTextRangeAttribute, &selectedRangeVal);
        if (err == kAXErrorSuccess && selectedRangeVal) {
            AXValueRef boundsVal = NULL;
            err = AXUIElementCopyParameterizedAttributeValue(focusedElem, kAXBoundsForRangeParameterizedAttribute, selectedRangeVal, (CFTypeRef *)&boundsVal);
            if (err == kAXErrorSuccess && boundsVal) {
                CGRect caretRect;
                AXValueGetValue(boundsVal, kAXValueCGRectType, &caretRect);
                printf("{\"found\": true, \"type\": \"caret\", \"x\": %.1f, \"y\": %.1f, \"w\": %.1f, \"h\": %.1f}\n",
                       caretRect.origin.x, caretRect.origin.y, caretRect.size.width, caretRect.size.height);
                CFRelease(boundsVal);
                CFRelease(selectedRangeVal);
                CFRelease(focusedElem);
                CFRelease(sysWide);
                return;
            }
            CFRelease(selectedRangeVal);
        }

        // Fallback: get bounds of focused element
        CFTypeRef posVal = NULL, sizeVal = NULL;
        AXUIElementCopyAttributeValue(focusedElem, kAXPositionAttribute, &posVal);
        AXUIElementCopyAttributeValue(focusedElem, kAXSizeAttribute, &sizeVal);
        if (posVal && sizeVal) {
            CGPoint pt; CGSize sz;
            AXValueGetValue((AXValueRef)posVal, kAXValueCGPointType, &pt);
            AXValueGetValue((AXValueRef)sizeVal, kAXValueCGSizeType, &sz);
            printf("{\"found\": true, \"type\": \"element_bounds\", \"x\": %.1f, \"y\": %.1f, \"w\": %.1f, \"h\": %.1f}\n",
                   pt.x, pt.y, sz.width, sz.height);
            CFRelease(posVal);
            CFRelease(sizeVal);
        } else {
            printf("{\"found\": false, \"reason\": \"no_caret_bounds\"}\n");
        }
        CFRelease(focusedElem);
        CFRelease(sysWide);
    }
}

// 5. Windows list with timing
void list_windows_bench(int include_titles) {
    @autoreleasepool {
        double t0 = get_time_ms();
        CFArrayRef winList = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
        double t1 = get_time_ms();
        if (!winList) {
            printf("{\"error\": \"Failed to get window list\"}\n");
            return;
        }
        CFIndex count = CFArrayGetCount(winList);
        printf("{\"query_time_ms\": %.3f, \"total_windows\": %ld, \"windows\": [\n", t1 - t0, count);
        for (CFIndex i = 0; i < count; i++) {
            CFDictionaryRef dict = (CFDictionaryRef)CFArrayGetValueAtIndex(winList, i);
            CFNumberRef num = (CFNumberRef)CFDictionaryGetValue(dict, kCGWindowNumber);
            CFNumberRef layerNum = (CFNumberRef)CFDictionaryGetValue(dict, kCGWindowLayer);
            CFNumberRef ownerPidNum = (CFNumberRef)CFDictionaryGetValue(dict, kCGWindowOwnerPID);
            CFStringRef ownerName = (CFStringRef)CFDictionaryGetValue(dict, kCGWindowOwnerName);
            CFStringRef winName = (CFStringRef)CFDictionaryGetValue(dict, kCGWindowName);
            CFDictionaryRef bounds = (CFDictionaryRef)CFDictionaryGetValue(dict, kCGWindowBounds);

            int wid = 0, layer = 0, pid = 0;
            if (num) CFNumberGetValue(num, kCFNumberIntType, &wid);
            if (layerNum) CFNumberGetValue(layerNum, kCFNumberIntType, &layer);
            if (ownerPidNum) CFNumberGetValue(ownerPidNum, kCFNumberIntType, &pid);

            CGRect rect = CGRectZero;
            if (bounds) CGRectMakeWithDictionaryRepresentation(bounds, &rect);

            char oBuf[256] = "";
            char tBuf[256] = "";
            if (ownerName) CFStringGetCString(ownerName, oBuf, sizeof(oBuf), kCFStringEncodingUTF8);
            if (include_titles && winName) CFStringGetCString(winName, tBuf, sizeof(tBuf), kCFStringEncodingUTF8);

            printf("  {\"id\": %d, \"pid\": %d, \"layer\": %d, \"owner\": \"%s\", \"title\": \"%s\", \"x\": %.0f, \"y\": %.0f, \"w\": %.0f, \"h\": %.0f}%s\n",
                   wid, pid, layer, oBuf, tBuf, rect.origin.x, rect.origin.y, rect.size.width, rect.size.height, (i == count - 1 ? "" : ","));
        }
        printf("]}\n");
        CFRelease(winList);
    }
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: liveness_helper <cmd> [args...]\n");
        printf("Commands:\n");
        printf("  stats <pid>\n");
        printf("  frontmost\n");
        printf("  restore_focus <pid>\n");
        printf("  caret\n");
        printf("  windows [--titles]\n");
        return 1;
    }

    const char *cmd = argv[1];
    if (strcmp(cmd, "stats") == 0 && argc > 2) {
        print_pid_stats(atoi(argv[2]));
    } else if (strcmp(cmd, "frontmost") == 0) {
        print_frontmost();
    } else if (strcmp(cmd, "restore_focus") == 0 && argc > 2) {
        restore_focus(atoi(argv[2]));
    } else if (strcmp(cmd, "caret") == 0) {
        print_caret_pos();
    } else if (strcmp(cmd, "windows") == 0) {
        int titles = (argc > 2 && strcmp(argv[2], "--titles") == 0);
        list_windows_bench(titles);
    } else {
        fprintf(stderr, "Unknown command\n");
        return 1;
    }
    return 0;
}
