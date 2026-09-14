<#
.SYNOPSIS
    Simulates keyboard and mouse input using Win32 user32.dll SendInput API.
    Attaches a background STA thread to the active input desktop (WinSta0\Default),
    uses Alt-bypass and click-to-focus for reliable window activation,
    and handles 64-bit 40-byte INPUT structs and IME transparency.
.PARAMETER Text
    Unicode text string to inject directly into the foreground/target window.
.PARAMETER Key
    Special key or shortcut combo (e.g. 'Enter', 'Tab', 'Escape', 'Ctrl+S', 'Ctrl+A', 'Ctrl+N', 'Alt+F4').
.PARAMETER MouseMove
    Hashtable with X and Y coordinates to move the mouse cursor to: @{ X = 100; Y = 200 }.
.PARAMETER MouseClick
    Mouse click action: 'Left', 'Right', 'Middle', or 'Double'.
.PARAMETER TargetWindow
    Optional target window handle (IntPtr) to bring to foreground before sending input.
.PARAMETER DelayBetweenKeysMs
    Delay in milliseconds between keystrokes (default 5ms).
#>
[CmdletBinding()]
param(
    [Parameter(ParameterSetName = 'Text')]
    [string]$Text,

    [Parameter(ParameterSetName = 'Key')]
    [string]$Key,

    [Parameter(ParameterSetName = 'Mouse')]
    [hashtable]$MouseMove,

    [Parameter(ParameterSetName = 'Mouse')]
    [ValidateSet('Left', 'Right', 'Middle', 'Double')]
    [string]$MouseClick,

    [Parameter()]
    [IntPtr]$TargetWindow = [IntPtr]::Zero,

    [Parameter()]
    [int]$DelayBetweenKeysMs = 5
)

$ErrorActionPreference = 'Stop'

$csharpCode = @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class NativeInputSimulator {
    [DllImport("user32.dll")]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll")]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, [MarshalAs(UnmanagedType.LPArray), In] INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("ntdll.dll", PreserveSig = false)]
    public static extern void NtSuspendProcess(IntPtr processHandle);

    [DllImport("ntdll.dll", PreserveSig = false)]
    public static extern void NtResumeProcess(IntPtr processHandle);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    // Win32 64-bit INPUT struct (strictly 40 bytes)
    [StructLayout(LayoutKind.Explicit, Size = 40)]
    public struct INPUT {
        [FieldOffset(0)] public uint type;
        [FieldOffset(8)] public MOUSEINPUT mi;
        [FieldOffset(8)] public KEYBDINPUT ki;
        [FieldOffset(8)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct HARDWAREINPUT {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    public const uint INPUT_MOUSE = 0;
    public const uint INPUT_KEYBOARD = 1;

    public const uint KEYEVENTF_KEYDOWN = 0x0000;
    public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_UNICODE = 0x0004;

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;

    public const ushort VK_SHIFT   = 0x10;
    public const ushort VK_CONTROL = 0x11;
    public const ushort VK_MENU    = 0x12; // Alt
    public const ushort VK_ESCAPE  = 0x1B;
    public const ushort VK_RETURN  = 0x0D;
    public const ushort VK_TAB     = 0x09;
    public const ushort VK_BACK    = 0x08;
    public const ushort VK_DELETE  = 0x2E;
    public const ushort VK_F4      = 0x73;

    public const uint DESKTOP_ALL = 0x01FF;

    public static void AttachDesktopAndForeground(IntPtr targetHwnd, out IntPtr hDesk) {
        hDesk = OpenInputDesktop(0, false, DESKTOP_ALL);
        if (hDesk == IntPtr.Zero) hDesk = OpenDesktop("Default", 0, false, DESKTOP_ALL);
        if (hDesk != IntPtr.Zero) {
            SetThreadDesktop(hDesk);
        }

        if (targetHwnd != IntPtr.Zero) {
            ShowWindow(targetHwnd, 9); // SW_RESTORE
            BringWindowToTop(targetHwnd);

            IntPtr hFore = GetForegroundWindow();
            uint pid;
            uint foreThread = GetWindowThreadProcessId(hFore, out pid);
            uint curThread = GetCurrentThreadId();

            // Set target window foreground without pulsing Alt
            if (foreThread != 0 && foreThread != curThread) {
                AttachThreadInput(curThread, foreThread, true);
                SetForegroundWindow(targetHwnd);
                AttachThreadInput(curThread, foreThread, false);
            } else {
                SetForegroundWindow(targetHwnd);
            }

            // Focus window without moving mouse cursor or mouse click
            Thread.Sleep(50);
        }
    }

    public static void DetachDesktop(IntPtr hDesk) {
        if (hDesk != IntPtr.Zero) {
            CloseDesktop(hDesk);
        }
    }

    public static void SendUnicodeString(IntPtr targetHwnd, string text, int delayMs) {
        Thread t = new Thread(() => {
            IntPtr hDesk;
            AttachDesktopAndForeground(targetHwnd, out hDesk);

            INPUT[] inputs = new INPUT[2];
            int cbSize = Marshal.SizeOf(typeof(INPUT));

            foreach (char c in text) {
                inputs[0] = new INPUT();
                inputs[0].type = INPUT_KEYBOARD;
                inputs[0].ki.wVk = 0;
                inputs[0].ki.wScan = (ushort)c;
                inputs[0].ki.dwFlags = KEYEVENTF_UNICODE;

                inputs[1] = new INPUT();
                inputs[1].type = INPUT_KEYBOARD;
                inputs[1].ki.wVk = 0;
                inputs[1].ki.wScan = (ushort)c;
                inputs[1].ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

                SendInput(2, inputs, cbSize);
                if (delayMs > 0) Thread.Sleep(delayMs);
            }

            DetachDesktop(hDesk);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
    }

    public static void SendVkKey(IntPtr targetHwnd, ushort vk, bool ctrl, bool alt, bool shift) {
        Thread t = new Thread(() => {
            IntPtr hDesk;
            AttachDesktopAndForeground(targetHwnd, out hDesk);

            int listCount = 2;
            if (ctrl) listCount += 2;
            if (alt) listCount += 2;
            if (shift) listCount += 2;

            INPUT[] inputs = new INPUT[listCount];
            int idx = 0;

            if (ctrl) {
                inputs[idx] = new INPUT();
                inputs[idx].type = INPUT_KEYBOARD;
                inputs[idx].ki.wVk = VK_CONTROL;
                idx++;
            }
            if (alt) {
                inputs[idx] = new INPUT();
                inputs[idx].type = INPUT_KEYBOARD;
                inputs[idx].ki.wVk = VK_MENU;
                idx++;
            }
            if (shift) {
                inputs[idx] = new INPUT();
                inputs[idx].type = INPUT_KEYBOARD;
                inputs[idx].ki.wVk = VK_SHIFT;
                idx++;
            }

            inputs[idx] = new INPUT();
            inputs[idx].type = INPUT_KEYBOARD;
            inputs[idx].ki.wVk = vk;
            idx++;

            inputs[idx] = new INPUT();
            inputs[idx].type = INPUT_KEYBOARD;
            inputs[idx].ki.wVk = vk;
            inputs[idx].ki.dwFlags = KEYEVENTF_KEYUP;
            idx++;

            if (shift) {
                inputs[idx] = new INPUT();
                inputs[idx].type = INPUT_KEYBOARD;
                inputs[idx].ki.wVk = VK_SHIFT;
                inputs[idx].ki.dwFlags = KEYEVENTF_KEYUP;
                idx++;
            }
            if (alt) {
                inputs[idx] = new INPUT();
                inputs[idx].type = INPUT_KEYBOARD;
                inputs[idx].ki.wVk = VK_MENU;
                inputs[idx].ki.dwFlags = KEYEVENTF_KEYUP;
                idx++;
            }
            if (ctrl) {
                inputs[idx] = new INPUT();
                inputs[idx].type = INPUT_KEYBOARD;
                inputs[idx].ki.wVk = VK_CONTROL;
                inputs[idx].ki.dwFlags = KEYEVENTF_KEYUP;
                idx++;
            }

            SendInput((uint)listCount, inputs, Marshal.SizeOf(typeof(INPUT)));
            DetachDesktop(hDesk);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
    }

    public static void SendMouse(IntPtr targetHwnd, int moveX, int moveY, bool hasMove, string clickType) {
        Thread t = new Thread(() => {
            IntPtr hDesk;
            AttachDesktopAndForeground(targetHwnd, out hDesk);

            if (hasMove) {
                SetCursorPos(moveX, moveY);
                Thread.Sleep(50);
            }

            if (!string.IsNullOrEmpty(clickType)) {
                INPUT[] inputs = new INPUT[2];
                int cbSize = Marshal.SizeOf(typeof(INPUT));

                uint down = MOUSEEVENTF_LEFTDOWN;
                uint up = MOUSEEVENTF_LEFTUP;

                if (clickType.Equals("Right", StringComparison.OrdinalIgnoreCase)) {
                    down = MOUSEEVENTF_RIGHTDOWN;
                    up = MOUSEEVENTF_RIGHTUP;
                } else if (clickType.Equals("Middle", StringComparison.OrdinalIgnoreCase)) {
                    down = MOUSEEVENTF_MIDDLEDOWN;
                    up = MOUSEEVENTF_MIDDLEUP;
                }

                inputs[0] = new INPUT();
                inputs[0].type = INPUT_MOUSE;
                inputs[0].mi.dwFlags = down;

                inputs[1] = new INPUT();
                inputs[1].type = INPUT_MOUSE;
                inputs[1].mi.dwFlags = up;

                SendInput(2, inputs, cbSize);

                if (clickType.Equals("Double", StringComparison.OrdinalIgnoreCase)) {
                    Thread.Sleep(100);
                    SendInput(2, inputs, cbSize);
                }
            }

            DetachDesktop(hDesk);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
    }

    public static POINT GetCursorPosition() {
        POINT pt = new POINT();
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenInputDesktop(0, false, DESKTOP_ALL);
            if (hDesk == IntPtr.Zero) hDesk = OpenDesktop("Default", 0, false, DESKTOP_ALL);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }
            GetCursorPos(out pt);
            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return pt;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'NativeInputSimulator').Type) {
    Add-Type -TypeDefinition $csharpCode
}

    # 1. Handle Mouse
    if ($PSCmdlet.ParameterSetName -eq 'Mouse') {
        $hasMove = ($MouseMove -and $MouseMove.ContainsKey('X') -and $MouseMove.ContainsKey('Y'))
        $mX = if ($hasMove) { [int]$MouseMove.X } else { 0 }
        $mY = if ($hasMove) { [int]$MouseMove.Y } else { 0 }
        [NativeInputSimulator]::SendMouse($TargetWindow, $mX, $mY, $hasMove, $MouseClick)
        return
    }

    # 2. Handle Text
    if ($PSCmdlet.ParameterSetName -eq 'Text') {
        if ([string]::IsNullOrEmpty($Text)) { return }
        [NativeInputSimulator]::SendUnicodeString($TargetWindow, $Text, $DelayBetweenKeysMs)
        return
    }

    # 3. Handle Key
    if ($PSCmdlet.ParameterSetName -eq 'Key') {
        $parts = $Key -split '\+'
        $ctrl = $false
        $alt = $false
        $shift = $false
        $mainKeyStr = $parts[-1].Trim()

        for ($i = 0; $i -lt ($parts.Count - 1); $i++) {
            $modifier = $parts[$i].Trim().ToLower()
            if ($modifier -in @('ctrl', 'control')) { $ctrl = $true }
            if ($modifier -in @('alt')) { $alt = $true }
            if ($modifier -in @('shift')) { $shift = $true }
        }

        $vk = 0
        switch -Regex ($mainKeyStr.ToUpper()) {
            '^ENTER|RETURN$'   { $vk = [NativeInputSimulator]::VK_RETURN }
            '^TAB$'            { $vk = [NativeInputSimulator]::VK_TAB }
            '^ESC|ESCAPE$'     { $vk = [NativeInputSimulator]::VK_ESCAPE }
            '^BACKSPACE|BACK$' { $vk = [NativeInputSimulator]::VK_BACK }
            '^DEL|DELETE$'     { $vk = [NativeInputSimulator]::VK_DELETE }
            '^F4$'             { $vk = [NativeInputSimulator]::VK_F4 }
            '^[A-Z0-9]$'       { $vk = [byte][char]($mainKeyStr.ToUpper()[0]) }
            default {
                throw "Unsupported key definition: $mainKeyStr"
            }
        }

        [NativeInputSimulator]::SendVkKey($TargetWindow, [UInt16]$vk, $ctrl, $alt, $shift)
    }
