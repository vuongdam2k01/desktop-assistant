#include <node_api.h>
#import "window_integration_core.h"
#include <cstring>

static void ThrowError(napi_env env, const char* code, const char* message) {
    napi_value code_val, msg_val, error_obj;
    napi_create_string_utf8(env, code, NAPI_AUTO_LENGTH, &code_val);
    napi_create_string_utf8(env, message ? message : code, NAPI_AUTO_LENGTH, &msg_val);
    napi_create_error(env, code_val, msg_val, &error_obj);
    napi_throw(env, error_obj);
}

static void* ParseTargetPtr(napi_env env, napi_value val) {
    bool is_buffer = false;
    napi_status status = napi_is_buffer(env, val, &is_buffer);
    if (status != napi_ok || !is_buffer) {
        ThrowError(env, "INVALID_NS_VIEW", "Handle must be a buffer");
        return nullptr;
    }

    void* data = nullptr;
    size_t len = 0;
    napi_get_buffer_info(env, val, &data, &len);
    if (len != sizeof(void*)) {
        ThrowError(env, "INVALID_NS_VIEW", "Invalid handle buffer length");
        return nullptr;
    }

    void* ptr = *(void**)data;
    if (!ptr) {
        ThrowError(env, "INVALID_NS_VIEW", "Null view pointer");
        return nullptr;
    }
    return ptr;
}

static napi_value Capabilities(napi_env env, napi_callback_info info) {
    napi_value obj;
    napi_create_object(env, &obj);

    auto set_prop = [&](const char* key, const char* val) {
        napi_value k, v;
        napi_create_string_utf8(env, key, NAPI_AUTO_LENGTH, &k);
        napi_create_string_utf8(env, val, NAPI_AUTO_LENGTH, &v);
        napi_set_property(env, obj, k, v);
    };

    set_prop("presentWithoutActivating", "framework");
    set_prop("setPointerPassthrough", "native");
    set_prop("setVisibleEverywhere", "native");
    set_prop("restoreFocusTo", "native");
    set_prop("setDockPresence", "native");
    set_prop("setExcludedFromCapture", "native");

    return obj;
}

static napi_value ApplyNoActivateTopmost(napi_env env, napi_callback_info info) {
    if (!CoreIsMainThread()) {
        ThrowError(env, "MAIN_THREAD_REQUIRED", "Main thread required");
        return nullptr;
    }

    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    if (argc < 1) {
        ThrowError(env, "INVALID_NS_VIEW", "Missing handle argument");
        return nullptr;
    }

    void* target_ptr = ParseTargetPtr(env, argv[0]);
    if (!target_ptr) return nullptr;

    MatchedTarget target = CoreFindOwnedTarget(target_ptr);
    if (!target.view || !target.window) {
        ThrowError(env, "FOREIGN_NS_VIEW", "Window or view not owned by current process");
        return nullptr;
    }

    int res = CoreApplyNoActivateTopmost(target.window);
    if (res == 2) {
        ThrowError(env, "INVALID_WINDOW_KIND", "Window is not an NSPanel");
        return nullptr;
    } else if (res != 0) {
        ThrowError(env, "STYLE_APPLY_FAILED", "Failed to apply nonactivating panel style");
        return nullptr;
    }

    napi_value undef;
    napi_get_undefined(env, &undef);
    return undef;
}

static napi_value EnablePixelHitTest(napi_env env, napi_callback_info info) {
    if (!CoreIsMainThread()) {
        ThrowError(env, "MAIN_THREAD_REQUIRED", "Main thread required");
        return nullptr;
    }

    size_t argc = 4;
    napi_value argv[4];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    if (argc < 4) {
        ThrowError(env, "INVALID_ALPHA_MASK", "Missing required arguments");
        return nullptr;
    }

    void* target_ptr = ParseTargetPtr(env, argv[0]);
    if (!target_ptr) return nullptr;

    uint32_t width = 0;
    uint32_t height = 0;
    if (napi_get_value_uint32(env, argv[1], &width) != napi_ok ||
        napi_get_value_uint32(env, argv[2], &height) != napi_ok) {
        ThrowError(env, "INVALID_ARGUMENT", "width and height must be numbers");
        return nullptr;
    }

    if (width == 0 || height == 0) {
        ThrowError(env, "INVALID_ALPHA_MASK", "Width and height must be positive integers");
        return nullptr;
    }

    bool is_buffer = false;
    napi_is_buffer(env, argv[3], &is_buffer);
    if (!is_buffer) {
        ThrowError(env, "INVALID_ALPHA_MASK", "Alpha data must be a buffer");
        return nullptr;
    }

    void* alpha_data = nullptr;
    size_t alpha_len = 0;
    napi_get_buffer_info(env, argv[3], &alpha_data, &alpha_len);

    if ((size_t)width * (size_t)height != alpha_len) {
        ThrowError(env, "INVALID_ALPHA_MASK", "Alpha buffer length does not match dimensions");
        return nullptr;
    }

    MatchedTarget target = CoreFindOwnedTarget(target_ptr);
    if (!target.view) {
        ThrowError(env, "FOREIGN_NS_VIEW", "View not owned by current process");
        return nullptr;
    }

    int res = CoreEnablePixelHitTest(target.view, width, height, (const uint8_t*)alpha_data, alpha_len);
    if (res == 3) {
        // The mask was fine; the runtime would not give us a class to route hit testing
        // through. Reporting this as a bad mask would send the caller looking at its own
        // pixels for a fault that is not there.
        ThrowError(env, "HIT_TEST_CLASS_UNAVAILABLE", "Could not install the hit test handler");
        return nullptr;
    }
    if (res != 0) {
        ThrowError(env, "INVALID_ALPHA_MASK", "Failed to configure hit test");
        return nullptr;
    }

    napi_value undef;
    napi_get_undefined(env, &undef);
    return undef;
}

static napi_value DisablePixelHitTest(napi_env env, napi_callback_info info) {
    if (!CoreIsMainThread()) {
        ThrowError(env, "MAIN_THREAD_REQUIRED", "Main thread required");
        return nullptr;
    }

    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    if (argc < 1) {
        ThrowError(env, "INVALID_NS_VIEW", "Missing handle argument");
        return nullptr;
    }

    void* target_ptr = ParseTargetPtr(env, argv[0]);
    if (!target_ptr) return nullptr;

    MatchedTarget target = CoreFindOwnedTarget(target_ptr);
    if (!target.view) {
        ThrowError(env, "FOREIGN_NS_VIEW", "View not owned by current process");
        return nullptr;
    }

    CoreDisablePixelHitTest(target.view);

    napi_value undef;
    napi_get_undefined(env, &undef);
    return undef;
}

static napi_value RememberPreviousFocus(napi_env env, napi_callback_info info) {
    if (!CoreIsMainThread()) {
        ThrowError(env, "MAIN_THREAD_REQUIRED", "Main thread required");
        return nullptr;
    }

    bool ok = CoreRememberPreviousFocus();
    napi_value result;
    napi_get_boolean(env, ok, &result);
    return result;
}

static napi_value RestorePreviousFocus(napi_env env, napi_callback_info info) {
    if (!CoreIsMainThread()) {
        ThrowError(env, "MAIN_THREAD_REQUIRED", "Main thread required");
        return nullptr;
    }

    bool ok = CoreRestorePreviousFocus();
    napi_value result;
    napi_get_boolean(env, ok, &result);
    return result;
}

static napi_value SetActivationPolicy(napi_env env, napi_callback_info info) {
    if (!CoreIsMainThread()) {
        ThrowError(env, "MAIN_THREAD_REQUIRED", "Main thread required");
        return nullptr;
    }

    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    if (argc < 1) {
        ThrowError(env, "INVALID_ACTIVATION_POLICY", "Missing policy argument");
        return nullptr;
    }

    char mode[32];
    size_t mode_len = 0;
    napi_status status = napi_get_value_string_utf8(env, argv[0], mode, sizeof(mode), &mode_len);
    if (status != napi_ok) {
        ThrowError(env, "INVALID_ACTIVATION_POLICY", "Invalid policy string");
        return nullptr;
    }

    if (strcmp(mode, "accessory") != 0 && strcmp(mode, "regular") != 0) {
        ThrowError(env, "INVALID_ACTIVATION_POLICY", "Policy must be 'accessory' or 'regular'");
        return nullptr;
    }

    bool ok = CoreSetActivationPolicy(mode);
    napi_value result;
    napi_get_boolean(env, ok, &result);
    return result;
}

static napi_value ExcludeFromCapture(napi_env env, napi_callback_info info) {
    if (!CoreIsMainThread()) {
        ThrowError(env, "MAIN_THREAD_REQUIRED", "Main thread required");
        return nullptr;
    }

    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    if (argc < 2) {
        ThrowError(env, "INVALID_NS_VIEW", "Missing required arguments");
        return nullptr;
    }

    void* target_ptr = ParseTargetPtr(env, argv[0]);
    if (!target_ptr) return nullptr;

    bool excluded = false;
    // Without coercion a non-boolean argument leaves `excluded` false, which would set the
    // window to shareable and report that the exclusion had been applied.
    if (napi_get_value_bool(env, argv[1], &excluded) != napi_ok) {
        ThrowError(env, "INVALID_ARGUMENT", "excludeFromCapture expects a boolean");
        return nullptr;
    }

    MatchedTarget target = CoreFindOwnedTarget(target_ptr);
    if (!target.window) {
        ThrowError(env, "FOREIGN_NS_VIEW", "Window not owned by current process");
        return nullptr;
    }

    bool ok = CoreExcludeFromCapture(target.window, excluded);
    napi_value result;
    napi_get_boolean(env, ok, &result);
    return result;
}

static napi_value Init(napi_env env, napi_value exports) {
    auto export_fn = [&](const char* name, napi_callback cb) {
        napi_value fn;
        napi_create_function(env, name, NAPI_AUTO_LENGTH, cb, nullptr, &fn);
        napi_set_named_property(env, exports, name, fn);
    };

    export_fn("capabilities", Capabilities);
    export_fn("applyNoActivateTopmost", ApplyNoActivateTopmost);
    export_fn("enablePixelHitTest", EnablePixelHitTest);
    export_fn("disablePixelHitTest", DisablePixelHitTest);
    export_fn("rememberPreviousFocus", RememberPreviousFocus);
    export_fn("restorePreviousFocus", RestorePreviousFocus);
    export_fn("setActivationPolicy", SetActivationPolicy);
    export_fn("excludeFromCapture", ExcludeFromCapture);

    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
