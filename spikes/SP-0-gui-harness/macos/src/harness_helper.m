// spikes/SP-0-gui-harness/macos/src/harness_helper.c
// Native macOS GUI Harness Helper (Apple Silicon / Intel)
// Provides low-level CoreGraphics, Accessibility, and AppKit primitives.

#include <CoreGraphics/CoreGraphics.h>
#include <ApplicationServices/ApplicationServices.h>
#include <CoreFoundation/CoreFoundation.h>
#include <AppKit/AppKit.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// 1. List on-screen windows
void list_windows(int json_output) {
    CFArrayRef windowList = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
    if (!windowList) {
        if (json_output) printf("[]\n");
        else printf("Failed to query window list\n");
        return;
    }
    CFIndex count = CFArrayGetCount(windowList);
    if (json_output) printf("[\n");

    int first = 1;
    for (CFIndex i = 0; i < count; i++) {
        CFDictionaryRef window = (CFDictionaryRef)CFArrayGetValueAtIndex(windowList, i);
        CFNumberRef windowNumber = (CFNumberRef)CFDictionaryGetValue(window, kCGWindowNumber);
        CFStringRef ownerName = (CFStringRef)CFDictionaryGetValue(window, kCGWindowOwnerName);
        CFStringRef windowName = (CFStringRef)CFDictionaryGetValue(window, kCGWindowName);
        CFNumberRef windowLayer = (CFNumberRef)CFDictionaryGetValue(window, kCGWindowLayer);
        CFDictionaryRef bounds = (CFDictionaryRef)CFDictionaryGetValue(window, kCGWindowBounds);

        int wid = 0, layer = 0;
        if (windowNumber) CFNumberGetValue(windowNumber, kCFNumberIntType, &wid);
        if (windowLayer) CFNumberGetValue(windowLayer, kCFNumberIntType, &layer);

        char ownerBuf[256] = "";
        char nameBuf[256] = "";
        if (ownerName) CFStringGetCString(ownerName, ownerBuf, sizeof(ownerBuf), kCFStringEncodingUTF8);
        if (windowName) CFStringGetCString(windowName, nameBuf, sizeof(nameBuf), kCFStringEncodingUTF8);

        CGRect rect = CGRectZero;
        if (bounds) CGRectMakeWithDictionaryRepresentation(bounds, &rect);

        if (json_output) {
            if (!first) printf(",\n");
            first = 0;
            printf("  {\"id\": %d, \"layer\": %d, \"owner\": \"%s\", \"title\": \"%s\", \"x\": %d, \"y\": %d, \"w\": %d, \"h\": %d}",
                   wid, layer, ownerBuf, nameBuf, (int)rect.origin.x, (int)rect.origin.y, (int)rect.size.width, (int)rect.size.height);
        } else {
            printf("ID: %-6d | Layer: %-3d | Owner: %-20s | Title: %-25s | Bounds: (%d,%d,%d,%d)\n",
                   wid, layer, ownerBuf, nameBuf, (int)rect.origin.x, (int)rect.origin.y, (int)rect.size.width, (int)rect.size.height);
        }
    }
    if (json_output) printf("\n]\n");
    CFRelease(windowList);
}

// 2. Type Unicode string using CGEvent with optional delay (microseconds)
void send_unicode_string(const char *utf8_str, int delay_us) {
    if (delay_us <= 0) delay_us = 3000;
    CFStringRef cfStr = CFStringCreateWithCString(kCFAllocatorDefault, utf8_str, kCFStringEncodingUTF8);
    if (!cfStr) return;
    CFIndex len = CFStringGetLength(cfStr);
    UniChar *buffer = (UniChar *)malloc(sizeof(UniChar) * len);
    CFStringGetCharacters(cfStr, CFRangeMake(0, len), buffer);

    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    for (CFIndex i = 0; i < len; i++) {
        CGEventRef keyDown = CGEventCreateKeyboardEvent(source, 0, true);
        CGEventKeyboardSetUnicodeString(keyDown, 1, &buffer[i]);
        CGEventPost(kCGHIDEventTap, keyDown);
        CFRelease(keyDown);

        CGEventRef keyUp = CGEventCreateKeyboardEvent(source, 0, false);
        CGEventKeyboardSetUnicodeString(keyUp, 1, &buffer[i]);
        CGEventPost(kCGHIDEventTap, keyUp);
        CFRelease(keyUp);

        usleep(delay_us);
    }
    CFRelease(source);
    free(buffer);
    CFRelease(cfStr);
}

// 3. Send key shortcut
CGKeyCode get_virtual_keycode(const char *key) {
    if (strcasecmp(key, "a") == 0) return 0x00;
    if (strcasecmp(key, "s") == 0) return 0x01;
    if (strcasecmp(key, "d") == 0) return 0x02;
    if (strcasecmp(key, "f") == 0) return 0x03;
    if (strcasecmp(key, "h") == 0) return 0x04;
    if (strcasecmp(key, "g") == 0) return 0x05;
    if (strcasecmp(key, "z") == 0) return 0x06;
    if (strcasecmp(key, "x") == 0) return 0x07;
    if (strcasecmp(key, "c") == 0) return 0x08;
    if (strcasecmp(key, "v") == 0) return 0x09;
    if (strcasecmp(key, "q") == 0) return 0x0C;
    if (strcasecmp(key, "w") == 0) return 0x0D;
    if (strcasecmp(key, "return") == 0 || strcasecmp(key, "enter") == 0) return 0x24;
    if (strcasecmp(key, "tab") == 0) return 0x30;
    if (strcasecmp(key, "space") == 0) return 0x31;
    if (strcasecmp(key, "delete") == 0 || strcasecmp(key, "backspace") == 0) return 0x33;
    if (strcasecmp(key, "escape") == 0 || strcasecmp(key, "esc") == 0) return 0x35;
    return 0xFFFF;
}

void send_key_combo(int cmd, int shift, int opt, int ctrl, const char *key) {
    CGKeyCode vk = get_virtual_keycode(key);
    if (vk == 0xFFFF) {
        fprintf(stderr, "Unsupported key: %s\n", key);
        return;
    }
    CGEventFlags flags = 0;
    if (cmd) flags |= kCGEventFlagMaskCommand;
    if (shift) flags |= kCGEventFlagMaskShift;
    if (opt) flags |= kCGEventFlagMaskAlternate;
    if (ctrl) flags |= kCGEventFlagMaskControl;

    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    CGEventRef down = CGEventCreateKeyboardEvent(source, vk, true);
    CGEventSetFlags(down, flags);
    CGEventPost(kCGHIDEventTap, down);
    CFRelease(down);

    usleep(20000);

    CGEventRef up = CGEventCreateKeyboardEvent(source, vk, false);
    CGEventSetFlags(up, flags);
    CGEventPost(kCGHIDEventTap, up);
    CFRelease(up);
    CFRelease(source);
}

// 4. Mouse Move & Click
void mouse_move(double x, double y) {
    CGPoint pt = CGPointMake(x, y);
    CGEventRef ev = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, pt, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, ev);
    CFRelease(ev);
}

void mouse_click(double x, double y) {
    CGPoint pt = CGPointMake(x, y);
    CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pt, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, down);
    CFRelease(down);
    usleep(20000);
    CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pt, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, up);
    CFRelease(up);
}

void mouse_double_click(double x, double y) {
    CGPoint pt = CGPointMake(x, y);
    CGEventRef down1 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pt, kCGMouseButtonLeft);
    CGEventSetIntegerValueField(down1, kCGMouseEventClickState, 1);
    CGEventPost(kCGHIDEventTap, down1);
    CFRelease(down1);
    usleep(10000);

    CGEventRef up1 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pt, kCGMouseButtonLeft);
    CGEventSetIntegerValueField(up1, kCGMouseEventClickState, 1);
    CGEventPost(kCGHIDEventTap, up1);
    CFRelease(up1);
    usleep(10000);

    CGEventRef down2 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pt, kCGMouseButtonLeft);
    CGEventSetIntegerValueField(down2, kCGMouseEventClickState, 2);
    CGEventPost(kCGHIDEventTap, down2);
    CFRelease(down2);
    usleep(10000);

    CGEventRef up2 = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pt, kCGMouseButtonLeft);
    CGEventSetIntegerValueField(up2, kCGMouseEventClickState, 2);
    CGEventPost(kCGHIDEventTap, up2);
    CFRelease(up2);
}

// 5. Activate application by bundle ID
int activate_bundle(const char *bundle_id) {
    @autoreleasepool {
        NSString *bid = [NSString stringWithUTF8String:bundle_id];
        NSArray *apps = [NSRunningApplication runningApplicationsWithBundleIdentifier:bid];
        if ([apps count] == 0) return 0;
        NSRunningApplication *app = [apps firstObject];
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
        return [app activateWithOptions:NSApplicationActivateIgnoringOtherApps] ? 1 : 0;
#pragma clang diagnostic pop
    }
}

// 6. List running applications and activation policies
void list_apps(const char *filter) {
    @autoreleasepool {
        NSArray *apps = [[NSWorkspace sharedWorkspace] runningApplications];
        for (NSRunningApplication *app in apps) {
            NSString *name = [app localizedName];
            NSString *bid = [app bundleIdentifier];
            if (filter && strlen(filter) > 0) {
                if (![name localizedCaseInsensitiveContainsString:[NSString stringWithUTF8String:filter]] &&
                    (!bid || ![bid localizedCaseInsensitiveContainsString:[NSString stringWithUTF8String:filter]])) {
                    continue;
                }
            }
            NSApplicationActivationPolicy policy = [app activationPolicy];
            const char *policyStr = "Unknown";
            if (policy == NSApplicationActivationPolicyRegular) policyStr = "Regular (in Dock/Switcher)";
            else if (policy == NSApplicationActivationPolicyAccessory) policyStr = "Accessory (Hidden from Dock/Switcher)";
            else if (policy == NSApplicationActivationPolicyProhibited) policyStr = "Prohibited (Background Daemon)";

            printf("PID: %-6d | Policy: %-36s | Active: %d | Name: %s\n",
                   [app processIdentifier], policyStr, [app isActive], [name UTF8String]);
        }
    }
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: harness_helper <command> [args...]\n");
        printf("Commands:\n");
        printf("  list [--json]                  List on-screen windows\n");
        printf("  type <string> [delay_ms]       Send Unicode string\n");
        printf("  combo <cmd> <shift> <opt> <ctrl> <key>  Send key combo (e.g. 1 0 0 0 s for Cmd+S)\n");
        printf("  move <x> <y>                   Move mouse to (x, y)\n");
        printf("  click <x> <y>                  Click mouse at (x, y)\n");
        printf("  dclick <x> <y>                 Double-click at (x, y)\n");
        printf("  activate <bundle_id>           Activate application\n");
        printf("  apps [filter]                  List running apps and activation policies\n");
        return 1;
    }

    const char *cmd = argv[1];
    if (strcmp(cmd, "list") == 0) {
        int json = (argc > 2 && strcmp(argv[2], "--json") == 0);
        list_windows(json);
    } else if (strcmp(cmd, "type") == 0 && argc > 2) {
        int delay_us = 3000;
        if (argc > 3) {
            delay_us = atoi(argv[3]) * 1000;
        }
        send_unicode_string(argv[2], delay_us);
    } else if (strcmp(cmd, "combo") == 0 && argc > 6) {
        int cmd_flag = atoi(argv[2]);
        int shift_flag = atoi(argv[3]);
        int opt_flag = atoi(argv[4]);
        int ctrl_flag = atoi(argv[5]);
        send_key_combo(cmd_flag, shift_flag, opt_flag, ctrl_flag, argv[6]);
    } else if (strcmp(cmd, "move") == 0 && argc > 3) {
        mouse_move(atof(argv[2]), atof(argv[3]));
    } else if (strcmp(cmd, "click") == 0 && argc > 3) {
        mouse_click(atof(argv[2]), atof(argv[3]));
    } else if (strcmp(cmd, "dclick") == 0 && argc > 3) {
        mouse_double_click(atof(argv[2]), atof(argv[3]));
    } else if (strcmp(cmd, "activate") == 0 && argc > 2) {
        int ok = activate_bundle(argv[2]);
        if (!ok) {
            fprintf(stderr, "Failed to activate %s\n", argv[2]);
            return 1;
        }
    } else if (strcmp(cmd, "apps") == 0) {
        const char *filter = (argc > 2) ? argv[2] : "";
        list_apps(filter);
    } else {
        fprintf(stderr, "Unknown command or invalid arguments\n");
        return 1;
    }
    return 0;
}
