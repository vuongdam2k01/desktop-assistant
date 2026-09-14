using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32Spy {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct GUITHREADINFO {
        public int cbSize;
        public int flags;
        public IntPtr hwndActive;
        public IntPtr hwndFocus;
        public IntPtr hwndCapture;
        public IntPtr hwndMenuOwner;
        public IntPtr hwndMoveSize;
        public IntPtr hwndCaret;
        public RECT rcCaret;
    }

    [DllImport("user32.dll")]
    public static extern bool GetGUIThreadInfo(uint idThread, ref GUITHREADINFO lpgui);

    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X, Y; }

    public static string CheckCaret() {
        IntPtr fg = GetForegroundWindow();
        if (fg == IntPtr.Zero) return "No foreground window";
        uint pid;
        uint tid = GetWindowThreadProcessId(fg, out pid);
        GUITHREADINFO gui = new GUITHREADINFO();
        gui.cbSize = Marshal.SizeOf(gui);
        if (GetGUIThreadInfo(tid, ref gui)) {
            POINT pt = new POINT { X = gui.rcCaret.Left, Y = gui.rcCaret.Top };
            if (gui.hwndCaret != IntPtr.Zero) {
                ClientToScreen(gui.hwndCaret, ref pt);
                return string.Format("Caret at Screen({0}, {1}) size {2}x{3} hwndCaret={4}",
                    pt.X, pt.Y, gui.rcCaret.Right - gui.rcCaret.Left, gui.rcCaret.Bottom - gui.rcCaret.Top, gui.hwndCaret);
            }
            return "GetGUIThreadInfo succeeded but hwndCaret is null (app might use modern XAML / Chromium / UI Automation)";
        }
        return "GetGUIThreadInfo failed";
    }
}
