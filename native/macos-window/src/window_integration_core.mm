#import "window_integration_core.h"
#import <objc/runtime.h>
#import <objc/message.h>

// Shared with the Windows module; see native/win32-window/src/hit_test.rs.
static const uint8_t DA_POINTER_ALPHA_THRESHOLD = 10;

static const char kOriginalClassKey = 0;
static const char kMaskDataKey = 0;

@interface DAPixelMaskHolder : NSObject
@property (nonatomic, assign) uint32_t width;
@property (nonatomic, assign) uint32_t height;
@property (nonatomic, strong) NSData* data;
@end

@implementation DAPixelMaskHolder
@end

static id SubclassHitTest(id self, SEL _cmd, NSPoint point) {
    DAPixelMaskHolder* holder = objc_getAssociatedObject(self, &kMaskDataKey);
    Class origClass = (Class)objc_getAssociatedObject(self, &kOriginalClassKey);
    Class callClass = origClass ? origClass : [self class];

    if (!holder || holder.width == 0 || holder.height == 0) {
        struct objc_super sup = {
            .receiver = self,
            .super_class = callClass
        };
        return ((id(*)(struct objc_super*, SEL, NSPoint))objc_msgSendSuper)(&sup, _cmd, point);
    }

    NSPoint localPoint = [self convertPoint:point fromView:[self superview]];
    NSRect bounds = [self bounds];

    if (!NSPointInRect(localPoint, bounds) || bounds.size.width <= 0.0 || bounds.size.height <= 0.0) {
        return nil;
    }

    double norm_x = (localPoint.x - bounds.origin.x) / bounds.size.width;
    double norm_y = 0.0;
    if ([self isFlipped]) {
        norm_y = (localPoint.y - bounds.origin.y) / bounds.size.height;
    } else {
        norm_y = (bounds.origin.y + bounds.size.height - localPoint.y) / bounds.size.height;
    }

    if (norm_x < 0.0 || norm_x >= 1.0 || norm_y < 0.0 || norm_y >= 1.0) {
        return nil;
    }

    size_t mask_x = (size_t)(norm_x * holder.width);
    size_t mask_y = (size_t)(norm_y * holder.height);

    if (mask_x >= holder.width || mask_y >= holder.height) {
        return nil;
    }

    const uint8_t* bytes = (const uint8_t*)[holder.data bytes];
    uint8_t alpha = bytes[mask_y * holder.width + mask_x];

    // A pointer falls through wherever the character is not visibly drawn. The boundary is
    // the same on every platform on purpose: the same mask produced the same silhouette, so
    // a click near an anti-aliased edge must resolve the same way whichever platform the
    // user is on. Fully opaque is not the right boundary, because a pixel at alpha 5 is one
    // the user cannot see and would not expect to have hit.
    if (alpha < DA_POINTER_ALPHA_THRESHOLD) {
        return nil;
    }

    struct objc_super sup = {
        .receiver = self,
        .super_class = callClass
    };
    return ((id(*)(struct objc_super*, SEL, NSPoint))objc_msgSendSuper)(&sup, _cmd, point);
}

bool CoreIsMainThread() {
    return [NSThread isMainThread];
}

static NSView* FindViewRecursive(NSView* current, void* target_ptr) {
    if ((__bridge void*)current == target_ptr) {
        return current;
    }
    for (NSView* sub in [current subviews]) {
        NSView* match = FindViewRecursive(sub, target_ptr);
        if (match) return match;
    }
    return nil;
}

MatchedTarget CoreFindOwnedTarget(void* target_ptr) {
    MatchedTarget target = { nil, nil };
    if (!target_ptr) return target;

    for (NSWindow* win in [NSApp windows]) {
        NSView* content = [win contentView];
        if (content) {
            NSView* found = FindViewRecursive(content, target_ptr);
            if (found) {
                target.window = win;
                target.view = found;
                return target;
            }
        }
    }
    return target;
}

int CoreApplyNoActivateTopmost(NSWindow* window) {
    if (!window) return 1;
    if (![window isKindOfClass:[NSPanel class]]) {
        return 2; // INVALID_WINDOW_KIND
    }
    NSPanel* panel = (NSPanel*)window;
    [panel setStyleMask:([panel styleMask] | NSWindowStyleMaskNonactivatingPanel)];
    [panel setCollectionBehavior:([panel collectionBehavior] |
        NSWindowCollectionBehaviorCanJoinAllSpaces |
        NSWindowCollectionBehaviorFullScreenAuxiliary)];
    [panel setLevel:NSScreenSaverWindowLevel];
    return 0;
}

int CoreEnablePixelHitTest(NSView* view, uint32_t width, uint32_t height, const uint8_t* alpha_data, size_t alpha_len) {
    if (!view || width == 0 || height == 0 || !alpha_data) {
        return 1;
    }
    if ((size_t)width * (size_t)height != alpha_len) {
        return 1;
    }

    Class origClass = (Class)objc_getAssociatedObject(view, &kOriginalClassKey);
    if (!origClass) {
        Class currentClass = object_getClass(view);

        NSString* subclassName = [NSString stringWithFormat:@"DAHitTest_%s_%p", class_getName(currentClass), view];
        const char* cSubclassName = [subclassName UTF8String];
        Class subClass = objc_getClass(cSubclassName);
        if (!subClass) {
            subClass = objc_allocateClassPair(currentClass, cSubclassName, 0);
            if (!subClass) {
                return 3; // HIT_TEST_CLASS_UNAVAILABLE
            }
            Method origMethod = class_getInstanceMethod(currentClass, @selector(hitTest:));
            const char* types = origMethod ? method_getTypeEncoding(origMethod) : "@@:{CGPoint=dd}";
            if (!class_addMethod(subClass, @selector(hitTest:), (IMP)SubclassHitTest, types)) {
                objc_disposeClassPair(subClass);
                return 3; // HIT_TEST_CLASS_UNAVAILABLE
            }
            objc_registerClassPair(subClass);
        }

        object_setClass(view, subClass);

        // The association is what tells a later call that this view is already swizzled, and
        // what a disable call restores the view to. Recording it before the swizzle succeeded
        // meant a failure both reported success and made every later attempt short-circuit,
        // leaving the view with its own hitTest: for the life of the process.
        objc_setAssociatedObject(view, &kOriginalClassKey, currentClass, OBJC_ASSOCIATION_ASSIGN);
    }

    DAPixelMaskHolder* holder = [[DAPixelMaskHolder alloc] init];
    holder.width = width;
    holder.height = height;
    holder.data = [NSData dataWithBytes:alpha_data length:alpha_len];
    objc_setAssociatedObject(view, &kMaskDataKey, holder, OBJC_ASSOCIATION_RETAIN_NONATOMIC);

    return 0;
}

int CoreDisablePixelHitTest(NSView* view) {
    if (!view) return 1;
    Class origClass = (Class)objc_getAssociatedObject(view, &kOriginalClassKey);
    if (origClass) {
        object_setClass(view, origClass);
        objc_setAssociatedObject(view, &kOriginalClassKey, nil, OBJC_ASSOCIATION_ASSIGN);
    }
    objc_setAssociatedObject(view, &kMaskDataKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    return 0;
}

static pid_t g_rememberedPid = 0;

bool CoreRememberPreviousFocus() {
    NSRunningApplication* front = [[NSWorkspace sharedWorkspace] frontmostApplication];
    if (!front) {
        g_rememberedPid = 0;
        return false;
    }
    pid_t pid = [front processIdentifier];
    pid_t currentPid = [[NSRunningApplication currentApplication] processIdentifier];
    if (pid != 0 && pid != currentPid) {
        g_rememberedPid = pid;
        return true;
    }
    // If frontmost app is currently DesktopAssistant, preserve any previously remembered external PID
    return (g_rememberedPid != 0);
}

bool CoreRestorePreviousFocus() {
    pid_t target = g_rememberedPid;
    g_rememberedPid = 0;
    if (target == 0) return false;

    pid_t currentPid = [[NSRunningApplication currentApplication] processIdentifier];
    if (target == currentPid) return false;

    NSRunningApplication* app = [NSRunningApplication runningApplicationWithProcessIdentifier:target];
    if (!app || [app isTerminated]) {
        return false;
    }
    return [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
}

bool CoreSetActivationPolicy(const char* mode) {
    if (!mode) return false;
    NSApplicationActivationPolicy policy;
    if (strcmp(mode, "accessory") == 0) {
        policy = NSApplicationActivationPolicyAccessory;
    } else if (strcmp(mode, "regular") == 0) {
        policy = NSApplicationActivationPolicyRegular;
    } else {
        return false;
    }
    return [NSApp setActivationPolicy:policy];
}

bool CoreExcludeFromCapture(NSWindow* window, bool excluded) {
    if (!window) return false;
    [window setSharingType:(excluded ? NSWindowSharingNone : NSWindowSharingReadOnly)];
    return true;
}
