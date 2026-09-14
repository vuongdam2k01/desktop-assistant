use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::{Arc, LazyLock};

#[cfg(windows)]
use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
#[cfg(windows)]
use windows_sys::Win32::Graphics::Gdi::ScreenToClient;
#[cfg(windows)]
use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetClientRect, HTTRANSPARENT, WM_NCDESTROY, WM_NCHITTEST,
};

pub const SUBCLASS_ID: usize = 0xDE5C_A551;

pub struct PixelMask {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

pub fn checked_mask_size(width: u32, height: u32, data_len: usize) -> Result<usize, &'static str> {
    if width == 0 || height == 0 {
        return Err("INVALID_ALPHA_MASK");
    }
    let expected = width
        .checked_mul(height)
        .ok_or("INVALID_ALPHA_MASK")? as usize;
    if expected != data_len {
        return Err("INVALID_ALPHA_MASK");
    }
    Ok(expected)
}

pub fn map_client_to_mask(
    client_x: i32,
    client_y: i32,
    client_w: i32,
    client_h: i32,
    mask_w: u32,
    mask_h: u32,
) -> Option<(usize, usize)> {
    if client_x < 0
        || client_y < 0
        || client_w <= 0
        || client_h <= 0
        || client_x >= client_w
        || client_y >= client_h
        || mask_w == 0
        || mask_h == 0
    {
        return None;
    }

    let mask_x = (client_x as u64 * mask_w as u64 / client_w as u64) as usize;
    let mask_y = (client_y as u64 * mask_h as u64 / client_h as u64) as usize;

    if mask_x < mask_w as usize && mask_y < mask_h as usize {
        Some((mask_x, mask_y))
    } else {
        None
    }
}

/// What this window does about a pointer position, once the mask has been consulted.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum HitDecision {
    /// The pixel is transparent: report the position as belonging to whatever lies behind.
    PassThrough,
    /// The character is drawn here. The answer belongs to the window procedure above this
    /// one, which is where a drag region becomes a drag; deciding it here would leave the
    /// pet visible, clickable, and impossible to move.
    Delegate,
}

/// The boundary between "the character is drawn here" and "this is padding".
///
/// Fully opaque is not the right boundary: a pixel at alpha 5 is one the user cannot see
/// and would not expect to have hit. The macOS module uses the same value, so the same mask
/// yields the same clickable silhouette on both platforms.
pub const POINTER_ALPHA_THRESHOLD: u8 = 10;

pub fn hit_decision(alpha: u8) -> HitDecision {
    if alpha < POINTER_ALPHA_THRESHOLD {
        HitDecision::PassThrough
    } else {
        HitDecision::Delegate
    }
}
static MASK_STORE: LazyLock<RwLock<HashMap<isize, Arc<PixelMask>>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

pub fn set_mask(hwnd: isize, width: u32, height: u32, data: Vec<u8>) {
    MASK_STORE.write().insert(
        hwnd,
        Arc::new(PixelMask {
            width,
            height,
            data,
        }),
    );
}

pub fn get_mask(hwnd: isize) -> Option<Arc<PixelMask>> {
    MASK_STORE.read().get(&hwnd).cloned()
}

pub fn remove_mask(hwnd: isize) {
    MASK_STORE.write().remove(&hwnd);
}


#[cfg(windows)]
pub unsafe extern "system" fn subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _uidsubclass: usize,
    _refdata: usize,
) -> LRESULT {
    if msg == WM_NCHITTEST {
        let screen_x = (lparam as usize & 0xffff) as i16 as i32;
        let screen_y = ((lparam as usize >> 16) & 0xffff) as i16 as i32;

        let mut pt = POINT {
            x: screen_x,
            y: screen_y,
        };
        ScreenToClient(hwnd, &mut pt);

        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        GetClientRect(hwnd, &mut rect);
        let client_w = rect.right - rect.left;
        let client_h = rect.bottom - rect.top;

        if let Some(mask) = get_mask(hwnd as isize) {
            if let Some((mask_x, mask_y)) = map_client_to_mask(
                pt.x,
                pt.y,
                client_w,
                client_h,
                mask.width,
                mask.height,
            ) {
                let idx = mask_y * mask.width as usize + mask_x;
                let alpha = mask.data.get(idx).copied().unwrap_or(0);
                if hit_decision(alpha) == HitDecision::PassThrough {
                    return HTTRANSPARENT as LRESULT;
                }
            }
        }
        // Either the character is drawn here, or the mask could not be consulted at all —
        // a mask that was never set, or client bounds that could not be read. In both cases
        // the window above decides, so a mask that is missing costs the pet nothing more
        // than its click-through, rather than making the whole window untouchable.
    }

    if msg == WM_NCDESTROY {
        RemoveWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID);
        remove_mask(hwnd as isize);
    }

    DefSubclassProc(hwnd, msg, wparam, lparam)
}

pub fn enable_hit_test(
    hwnd_val: isize,
    width: u32,
    height: u32,
    data: Vec<u8>,
) -> Result<(), napi::Error> {
    checked_mask_size(width, height, data.len()).map_err(|e| napi::Error::from_reason(e))?;

    // The subclass goes in first. Until it is installed nothing consults the mask, and the
    // procedure delegates when no mask is present, so the window behaves normally in the
    // window between the two steps. Storing the mask first would leave it resident for the
    // life of the process if the installation then failed, while telling the caller that
    // per-pixel hit testing was live.
    #[cfg(windows)]
    {
        let hwnd = hwnd_val as HWND;
        let installed = unsafe { SetWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID, 0) };
        if installed == 0 {
            return Err(napi::Error::from_reason("SUBCLASS_INSTALL_FAILED"));
        }
    }

    set_mask(hwnd_val, width, height, data);

    Ok(())
}

/// Releases the mask this process holds for a window. Takes no view on whether the window
/// still exists, because the memory is ours either way.
pub fn disable_hit_test(hwnd_val: isize) -> Result<(), napi::Error> {
    remove_mask(hwnd_val);
    Ok(())
}

/// Detaches the window procedure. Unlike the mask, this touches the window itself, so the
/// caller validates the handle and the thread before reaching here.
pub fn remove_subclass(hwnd_val: isize) -> Result<(), napi::Error> {
    #[cfg(windows)]
    {
        let hwnd = hwnd_val as HWND;
        unsafe {
            RemoveWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID);
        }
    }
    #[cfg(not(windows))]
    {
        let _ = hwnd_val;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checked_mask_size() {
        assert!(checked_mask_size(10, 10, 100).is_ok());
        assert!(checked_mask_size(10, 10, 99).is_err());
        assert!(checked_mask_size(0, 10, 0).is_err());
        assert!(checked_mask_size(10, 0, 0).is_err());
        assert!(checked_mask_size(u32::MAX, u32::MAX, 100).is_err());
    }

    #[test]
    fn test_coordinate_mapping() {
        // (x=0, y=0) in 100x100 maps to (0, 0) in 10x10 mask
        let mapped = map_client_to_mask(0, 0, 100, 100, 10, 10);
        assert_eq!(mapped, Some((0, 0)));

        // (x=50, y=50) in 100x100 maps to (5, 5) in 10x10 mask
        let mapped = map_client_to_mask(50, 50, 100, 100, 10, 10);
        assert_eq!(mapped, Some((5, 5)));

        // Out of bounds negative
        assert_eq!(map_client_to_mask(-1, 50, 100, 100, 10, 10), None);
        assert_eq!(map_client_to_mask(50, -1, 100, 100, 10, 10), None);

        // Out of bounds >= client size
        assert_eq!(map_client_to_mask(100, 50, 100, 100, 10, 10), None);
        assert_eq!(map_client_to_mask(50, 100, 100, 100, 10, 10), None);

        // Invalid client rect (<= 0)
        assert_eq!(map_client_to_mask(5, 5, 0, 100, 10, 10), None);
        assert_eq!(map_client_to_mask(5, 5, 100, 0, 10, 10), None);
    }

    // A transparent pixel is the only case this window answers by itself. Everywhere the
    // character is drawn the answer belongs to the framework above, which is what turns a
    // press into a window drag; answering HTCLIENT here instead means the pet can be seen
    // and clicked but never moved.
    #[test]
    fn test_hit_decision_delegates_wherever_the_character_is_drawn() {
        assert_eq!(hit_decision(0), HitDecision::PassThrough);
        assert_eq!(hit_decision(9), HitDecision::PassThrough);
        assert_eq!(hit_decision(10), HitDecision::Delegate);
        assert_eq!(hit_decision(255), HitDecision::Delegate);
    }
}
