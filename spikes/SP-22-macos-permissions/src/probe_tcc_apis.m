#import <Foundation/Foundation.h>
#import <Cocoa/Cocoa.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>

static CGEventRef dummyTapCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon) {
    return event;
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        BOOL prompt = NO;
        NSString *outFile = @"/tmp/test_permissions_output.log";
        for (int i = 1; i < argc; i++) {
            if (strcmp(argv[i], "--prompt") == 0) prompt = YES;
            if (strcmp(argv[i], "--out") == 0 && i + 1 < argc) {
                outFile = [NSString stringWithUTF8String:argv[i+1]];
            }
        }

        NSMutableString *report = [NSMutableString string];
        [report appendString:@"=== macOS TCC & Permission Probe ===\n"];
        [report appendFormat:@"PID: %d\n", getpid()];
        [report appendFormat:@"Bundle ID: %s\n", [[[NSBundle mainBundle] bundleIdentifier] UTF8String] ?: "(null - raw binary)"];
        [report appendFormat:@"Bundle Path: %s\n", [[[NSBundle mainBundle] bundlePath] UTF8String] ?: "(null)"];
        [report appendFormat:@"Prompt flag: %s\n\n", prompt ? "YES" : "NO"];

        // 1. Accessibility (AX)
        [report appendString:@"[1] ACCESSIBILITY (kTCCServiceAccessibility):\n"];
        Boolean axTrustedPreflight = AXIsProcessTrusted();
        [report appendFormat:@"    Preflight (AXIsProcessTrusted): %s\n", axTrustedPreflight ? "TRUSTED (GRANTED)" : "NOT TRUSTED (DENIED/NOT_DETERMINED)"];
        if (prompt && !axTrustedPreflight) {
            NSDictionary *options = @{(__bridge id)kAXTrustedCheckOptionPrompt: @YES};
            Boolean axTrustedPrompt = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
            [report appendFormat:@"    Prompted check: %s\n", axTrustedPrompt ? "TRUSTED" : "PROMPT_TRIGGERED_OR_DENIED"];
        }

        // 2. Screen Recording (ScreenCapture)
        [report appendString:@"[2] SCREEN RECORDING (kTCCServiceScreenCapture):\n"];
        if (@available(macOS 10.15, *)) {
            BOOL scPreflight = CGPreflightScreenCaptureAccess();
            [report appendFormat:@"    Preflight (CGPreflightScreenCaptureAccess): %s\n", scPreflight ? "GRANTED" : "DENIED/NOT_DETERMINED"];
            if (prompt && !scPreflight) {
                BOOL scRequest = CGRequestScreenCaptureAccess();
                [report appendFormat:@"    Prompted check (CGRequestScreenCaptureAccess): %s\n", scRequest ? "GRANTED" : "PROMPT_TRIGGERED_OR_DENIED"];
            }
        }

        // 3. Input Monitoring (ListenEvent)
        [report appendString:@"[3] INPUT MONITORING (kTCCServiceListenEvent):\n"];
        CFMachPortRef eventTap = CGEventTapCreate(
            kCGHIDEventTap,
            kCGHeadInsertEventTap,
            kCGEventTapOptionListenOnly,
            CGEventMaskBit(kCGEventKeyDown),
            dummyTapCallback,
            NULL
        );
        if (eventTap != NULL) {
            [report appendString:@"    CGEventTapCreate: SUCCESS (GRANTED)\n"];
            CFRelease(eventTap);
        } else {
            [report appendString:@"    CGEventTapCreate: FAILED / NULL (DENIED / NOT AUTHORIZED)\n"];
        }

        // 4. Automation / Apple Events
        [report appendString:@"[4] AUTOMATION / APPLE EVENTS (kTCCServiceAppleEvents):\n"];
        AEAddressDesc targetApp;
        pid_t finderPid = 0;
        NSArray *finderApps = [NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.apple.finder"];
        if (finderApps.count > 0) {
            finderPid = [finderApps.firstObject processIdentifier];
        }
        if (finderPid > 0) {
            AECreateDesc(typeKernelProcessID, &finderPid, sizeof(finderPid), &targetApp);
            OSStatus aeStatus = AEDeterminePermissionToAutomateTarget(&targetApp, typeWildCard, typeWildCard, prompt ? true : false);
            [report appendFormat:@"    Target: Finder (PID %d)\n", finderPid];
            if (aeStatus == noErr) {
                [report appendString:@"    AEDeterminePermission: GRANTED (noErr)\n"];
            } else if (aeStatus == -1744) {
                [report appendString:@"    AEDeterminePermission: NOT DETERMINED (errAEEventWouldRequireUserConsent = -1744)\n"];
            } else if (aeStatus == -1743) {
                [report appendString:@"    AEDeterminePermission: DENIED (errAENoUserInteraction = -1743)\n"];
            } else {
                [report appendFormat:@"    AEDeterminePermission: STATUS %d\n", (int)aeStatus];
            }
            AEDisposeDesc(&targetApp);
        }

        // 5. Files & Folders
        [report appendString:@"[5] FILES & FOLDERS:\n"];
        NSString *homeDir = NSHomeDirectory();
        NSString *appSupport = [homeDir stringByAppendingPathComponent:@"Library/Application Support/DesktopAssistant"];
        NSString *desktopDir = [homeDir stringByAppendingPathComponent:@"Desktop"];
        NSString *documentsDir = [homeDir stringByAppendingPathComponent:@"Documents"];

        [report appendFormat:@"    AppSupport (%s): %s\n", [appSupport UTF8String], (access([appSupport UTF8String], F_OK) == 0 || access([homeDir UTF8String], W_OK) == 0) ? "ACCESSIBLE (ZERO PERMISSION NEEDED)" : "INACCESSIBLE"];
        [report appendFormat:@"    Desktop (%s): %s\n", [desktopDir UTF8String], access([desktopDir UTF8String], R_OK) == 0 ? "ACCESSIBLE" : "DENIED/PROTECTED"];
        [report appendFormat:@"    Documents (%s): %s\n", [documentsDir UTF8String], access([documentsDir UTF8String], R_OK) == 0 ? "ACCESSIBLE" : "DENIED/PROTECTED"];

        [report appendString:@"\n=== Probe complete ===\n"];

        printf("%s", [report UTF8String]);
        [report writeToFile:outFile atomically:YES encoding:NSUTF8StringEncoding error:nil];
    }
    return 0;
}
