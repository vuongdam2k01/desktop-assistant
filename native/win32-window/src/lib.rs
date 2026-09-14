use napi::bindgen_prelude::Buffer;
use napi_derive::napi;
use std::collections::HashMap;

mod hit_test;
mod owned_window;

#[napi(object)]
pub struct WindowPlacementOptions {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub visible: bool,
}

impl From<WindowPlacementOptions> for owned_window::PlacementData {
    fn from(opts: WindowPlacementOptions) -> Self {
        Self {
            x: opts.x,
            y: opts.y,
            width: opts.width,
            height: opts.height,
            visible: opts.visible,
        }
    }
}

#[napi]
pub fn capabilities() -> HashMap<String, String> {
    let mut map = HashMap::new();
    map.insert("presentWithoutActivating".to_string(), "native".to_string());
    map.insert("setPointerPassthrough".to_string(), "native".to_string());
    map.insert("setVisibleEverywhere".to_string(), "framework".to_string());
    map.insert("restoreFocusTo".to_string(), "unavailable".to_string());
    map.insert("setDockPresence".to_string(), "framework".to_string());
    map.insert("setExcludedFromCapture".to_string(), "framework".to_string());
    map
}

#[napi(js_name = "apply_no_activate_topmost")]
pub fn apply_no_activate_topmost(handle: Buffer) -> napi::Result<()> {
    let hwnd = owned_window::parse_hwnd(handle.as_ref())?;
    owned_window::apply_no_activate_topmost(hwnd)
}

#[napi(js_name = "move_without_activate")]
pub fn move_without_activate(
    handle: Buffer,
    placement: WindowPlacementOptions,
) -> napi::Result<()> {
    let hwnd = owned_window::parse_hwnd(handle.as_ref())?;
    owned_window::move_without_activate(hwnd, &placement.into())
}

#[napi(js_name = "enable_pixel_hit_test")]
pub fn enable_pixel_hit_test(
    handle: Buffer,
    width: u32,
    height: u32,
    alpha: Buffer,
) -> napi::Result<()> {
    let hwnd = owned_window::parse_hwnd(handle.as_ref())?;
    owned_window::validate_hwnd_ownership(hwnd)?;
    owned_window::validate_hwnd_thread(hwnd)?;
    hit_test::enable_hit_test(hwnd, width, height, alpha.to_vec())
}

#[napi(js_name = "disable_pixel_hit_test")]
pub fn disable_pixel_hit_test(handle: Buffer) -> napi::Result<()> {
    let hwnd = owned_window::parse_hwnd(handle.as_ref())?;

    // The mask is this process's own memory and is released first, unconditionally. Gating
    // it on the window still existing means a window destroyed before teardown keeps its
    // mask for the life of the process, which for a high-resolution pet is hundreds of
    // kilobytes per window lifecycle.
    hit_test::disable_hit_test(hwnd)?;

    owned_window::validate_hwnd_ownership(hwnd)?;
    owned_window::validate_hwnd_thread(hwnd)?;
    hit_test::remove_subclass(hwnd)
}
