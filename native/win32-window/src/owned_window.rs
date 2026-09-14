#[cfg(windows)]
use windows_sys::Win32::Foundation::{GetLastError, SetLastError, HWND};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{GetCurrentProcessId, GetCurrentThreadId};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, GetWindowThreadProcessId, IsWindow, SetWindowLongPtrW, SetWindowPos,
    GWL_EXSTYLE, HWND_TOPMOST,
};

pub const WS_EX_NOACTIVATE_VAL: isize = 0x0800_0000;
pub const WS_EX_TOPMOST_VAL: isize = 0x0000_0008;

pub const SWP_NOSIZE_VAL: u32 = 0x0001;
pub const SWP_NOMOVE_VAL: u32 = 0x0002;
pub const SWP_NOZORDER_VAL: u32 = 0x0004;
pub const SWP_NOACTIVATE_VAL: u32 = 0x0010;
pub const SWP_FRAMECHANGED_VAL: u32 = 0x0020;
pub const SWP_SHOWWINDOW_VAL: u32 = 0x0040;
pub const SWP_HIDEWINDOW_VAL: u32 = 0x0080;
pub const SWP_NOOWNERZORDER_VAL: u32 = 0x0200;
pub const SWP_NOSENDCHANGING_VAL: u32 = 0x0400;

pub struct PlacementData {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub visible: bool,
}

pub fn compute_ex_style(existing: isize) -> isize {
    existing | WS_EX_NOACTIVATE_VAL | WS_EX_TOPMOST_VAL
}

pub fn topmost_style_pos_flags() -> u32 {
    SWP_NOMOVE_VAL
        | SWP_NOSIZE_VAL
        | SWP_NOACTIVATE_VAL
        | SWP_NOOWNERZORDER_VAL
        | SWP_NOSENDCHANGING_VAL
        | SWP_FRAMECHANGED_VAL
}

pub fn move_pos_flags(visible: bool) -> u32 {
    let visibility = if visible {
        SWP_SHOWWINDOW_VAL
    } else {
        SWP_HIDEWINDOW_VAL
    };
    SWP_NOACTIVATE_VAL
        | SWP_NOOWNERZORDER_VAL
        | SWP_NOSENDCHANGING_VAL
        | SWP_NOZORDER_VAL
        | visibility
}

pub fn validate_placement(placement: &PlacementData) -> Result<(), &'static str> {
    if placement.width <= 0 || placement.height <= 0 {
        return Err("INVALID_PLACEMENT");
    }
    Ok(())
}

pub fn parse_hwnd(buf: &[u8]) -> Result<isize, napi::Error> {
    if buf.len() != std::mem::size_of::<isize>() {
        return Err(napi::Error::from_reason("INVALID_HWND"));
    }
    let bytes: [u8; std::mem::size_of::<isize>()] = buf
        .try_into()
        .map_err(|_| napi::Error::from_reason("INVALID_HWND"))?;
    let val = isize::from_ne_bytes(bytes);
    if val == 0 {
        return Err(napi::Error::from_reason("INVALID_HWND"));
    }
    Ok(val)
}

pub fn validate_hwnd_ownership(hwnd_val: isize) -> Result<(), napi::Error> {
    #[cfg(windows)]
    {
        let hwnd = hwnd_val as HWND;
        if unsafe { IsWindow(hwnd) } == 0 {
            return Err(napi::Error::from_reason("INVALID_HWND"));
        }
        let mut process_id: u32 = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut process_id) };
        if process_id != unsafe { GetCurrentProcessId() } {
            return Err(napi::Error::from_reason("FOREIGN_HWND"));
        }
    }
    #[cfg(not(windows))]
    {
        let _ = hwnd_val;
    }
    Ok(())
}

/// Refuses a window that belongs to another thread.
///
/// Window subclassing is only safe on the thread that owns the window: the subclass chain
/// is per-window state that the owning thread's message loop walks, and installing or
/// removing a link from elsewhere corrupts it rather than failing. The process check above
/// does not cover this — a worker thread in this very process passes it — so the two checks
/// are separate, and this one matches the main-thread requirement the macOS module states.
pub fn validate_hwnd_thread(hwnd_val: isize) -> Result<(), napi::Error> {
    #[cfg(windows)]
    {
        let hwnd = hwnd_val as HWND;
        let mut process_id: u32 = 0;
        let owning_thread = unsafe { GetWindowThreadProcessId(hwnd, &mut process_id) };
        if owning_thread != unsafe { GetCurrentThreadId() } {
            return Err(napi::Error::from_reason("WRONG_THREAD"));
        }
    }
    #[cfg(not(windows))]
    {
        let _ = hwnd_val;
    }
    Ok(())
}

pub fn apply_no_activate_topmost(hwnd_val: isize) -> Result<(), napi::Error> {
    validate_hwnd_ownership(hwnd_val)?;

    #[cfg(windows)]
    {
        let hwnd = hwnd_val as HWND;
        unsafe {
            SetLastError(0);
            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            if ex_style == 0 && GetLastError() != 0 {
                return Err(napi::Error::from_reason("STYLE_APPLY_FAILED"));
            }

            let new_ex_style = compute_ex_style(ex_style);
            SetLastError(0);
            let prev = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex_style);
            if prev == 0 && GetLastError() != 0 {
                return Err(napi::Error::from_reason("STYLE_APPLY_FAILED"));
            }

            let flags = topmost_style_pos_flags();
            let ok = SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, flags);
            if ok == 0 {
                return Err(napi::Error::from_reason("STYLE_APPLY_FAILED"));
            }
        }
    }

    Ok(())
}

pub fn move_without_activate(
    hwnd_val: isize,
    placement: &PlacementData,
) -> Result<(), napi::Error> {
    validate_hwnd_ownership(hwnd_val)?;
    validate_placement(placement).map_err(|e| napi::Error::from_reason(e))?;

    #[cfg(windows)]
    {
        let hwnd = hwnd_val as HWND;
        let flags = move_pos_flags(placement.visible);
        unsafe {
            let ok = SetWindowPos(
                hwnd,
                std::ptr::null_mut(),
                placement.x,
                placement.y,
                placement.width,
                placement.height,
                flags,
            );
            if ok == 0 {
                return Err(napi::Error::from_reason("SET_WINDOW_POS_FAILED"));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_ex_style() {
        let initial: isize = 0;
        let computed = compute_ex_style(initial);
        assert_eq!(computed & WS_EX_NOACTIVATE_VAL, WS_EX_NOACTIVATE_VAL);
        assert_eq!(computed & WS_EX_TOPMOST_VAL, WS_EX_TOPMOST_VAL);

        let existing: isize = 0x0001_0000;
        let computed2 = compute_ex_style(existing);
        assert_eq!(computed2 & existing, existing);
        assert_eq!(computed2 & WS_EX_NOACTIVATE_VAL, WS_EX_NOACTIVATE_VAL);
        assert_eq!(computed2 & WS_EX_TOPMOST_VAL, WS_EX_TOPMOST_VAL);
    }

    #[test]
    fn test_topmost_style_pos_flags() {
        let flags = topmost_style_pos_flags();
        assert_eq!(flags & SWP_NOMOVE_VAL, SWP_NOMOVE_VAL);
        assert_eq!(flags & SWP_NOSIZE_VAL, SWP_NOSIZE_VAL);
        assert_eq!(flags & SWP_NOACTIVATE_VAL, SWP_NOACTIVATE_VAL);
        assert_eq!(flags & SWP_NOOWNERZORDER_VAL, SWP_NOOWNERZORDER_VAL);
        assert_eq!(flags & SWP_NOSENDCHANGING_VAL, SWP_NOSENDCHANGING_VAL);
        assert_eq!(flags & SWP_FRAMECHANGED_VAL, SWP_FRAMECHANGED_VAL);
    }

    #[test]
    fn test_move_pos_flags() {
        let flags_vis = move_pos_flags(true);
        assert_eq!(flags_vis & SWP_NOACTIVATE_VAL, SWP_NOACTIVATE_VAL);
        assert_eq!(flags_vis & SWP_NOOWNERZORDER_VAL, SWP_NOOWNERZORDER_VAL);
        assert_eq!(flags_vis & SWP_NOSENDCHANGING_VAL, SWP_NOSENDCHANGING_VAL);
        assert_eq!(flags_vis & SWP_NOZORDER_VAL, SWP_NOZORDER_VAL);
        assert_eq!(flags_vis & SWP_SHOWWINDOW_VAL, SWP_SHOWWINDOW_VAL);
        assert_eq!(flags_vis & SWP_HIDEWINDOW_VAL, 0);

        let flags_hide = move_pos_flags(false);
        assert_eq!(flags_hide & SWP_SHOWWINDOW_VAL, 0);
        assert_eq!(flags_hide & SWP_HIDEWINDOW_VAL, SWP_HIDEWINDOW_VAL);
    }

    #[test]
    fn test_validate_placement() {
        assert!(validate_placement(&PlacementData {
            x: 10,
            y: 20,
            width: 300,
            height: 200,
            visible: true
        })
        .is_ok());

        assert!(validate_placement(&PlacementData {
            x: -100,
            y: -200,
            width: 300,
            height: 200,
            visible: false
        })
        .is_ok());

        assert!(validate_placement(&PlacementData {
            x: 0,
            y: 0,
            width: 0,
            height: 200,
            visible: true
        })
        .is_err());

        assert!(validate_placement(&PlacementData {
            x: 0,
            y: 0,
            width: 100,
            height: -5,
            visible: true
        })
        .is_err());
    }

    #[test]
    fn test_parse_hwnd() {
        assert!(parse_hwnd(&[]).is_err());
        assert!(parse_hwnd(&[1, 2, 3]).is_err());

        let zero = 0isize.to_ne_bytes();
        assert!(parse_hwnd(&zero).is_err());

        let val = 0x1234_5678isize;
        let buf = val.to_ne_bytes();
        assert_eq!(parse_hwnd(&buf).unwrap(), val);
    }
}
