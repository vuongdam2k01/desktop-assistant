using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Automation.Text;

namespace NativeLiveness {
    public class Helper {
        // --- Win32 Structures & Delegates ---
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
            public int Width { get { return Right - Left; } }
            public int Height { get { return Bottom - Top; } }
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT {
            public int X;
            public int Y;
        }

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

        [StructLayout(LayoutKind.Sequential)]
        public struct MSG {
            public IntPtr hwnd;
            public uint message;
            public UIntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public POINT pt;
        }

        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        public delegate void WinEventDelegate(IntPtr hWinEventHook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);

        // --- Win32 API Imports ---
        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true)]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll")]
        public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool CloseDesktop(IntPtr hDesktop);

        [DllImport("user32.dll")]
        public static extern bool SetThreadDesktop(IntPtr hDesktop);

        [DllImport("user32.dll")]
        public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool GetGUIThreadInfo(uint idThread, ref GUITHREADINFO lpgui);

        [DllImport("user32.dll")]
        public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr", SetLastError = true)]
        private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "GetWindowLong", SetLastError = true)]
        private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

        public static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) {
            if (IntPtr.Size == 8) return GetWindowLongPtr64(hWnd, nIndex);
            return new IntPtr(GetWindowLong32(hWnd, nIndex));
        }

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
        private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
        private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

        public static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong) {
            if (IntPtr.Size == 8) return SetWindowLongPtr64(hWnd, nIndex, dwNewLong);
            return new IntPtr(SetWindowLong32(hWnd, nIndex, dwNewLong.ToInt32()));
        }

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        public static extern uint GetGuiResources(IntPtr hProcess, uint uiFlags);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr SetWinEventHook(uint eventMin, uint eventMax, IntPtr hmodWinEventProc, WinEventDelegate lpfnWinEventProc, uint idProcess, uint idThread, uint dwFlags);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool UnhookWinEvent(IntPtr hWinEventHook);

        [DllImport("user32.dll")]
        public static extern sbyte GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        public static extern bool TranslateMessage([In] ref MSG lpMsg);

        [DllImport("user32.dll")]
        public static extern IntPtr DispatchMessage([In] ref MSG lpMsg);

        [DllImport("user32.dll")]
        public static extern bool PostThreadMessage(uint idThread, uint msg, UIntPtr wParam, IntPtr lParam);

        [DllImport("dwmapi.dll")]
        public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out bool pvAttribute, int cbAttribute);

        [DllImport("kernel32.dll")]
        public static extern uint GetCurrentThreadId();

        // Constants
        public const int GWL_EXSTYLE = -20;
        public const int WS_EX_NOACTIVATE = 0x08000000;
        public const int WS_EX_TOPMOST = 0x00000008;
        public const int WS_EX_TRANSPARENT = 0x00000020;
        public const int WS_EX_LAYERED = 0x00080000;

        public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOZORDER = 0x0004;
        public const uint SWP_NOACTIVATE = 0x0010;
        public const uint SWP_SHOWWINDOW = 0x0040;
        public const uint SWP_NOOWNERZORDER = 0x0200;
        public const uint SWP_NOSENDCHANGING = 0x0400;

        public const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
        public const uint WINEVENT_OUTOFCONTEXT = 0;
        public const uint WINEVENT_SKIPOWNPROCESS = 2;
        public const uint DESKTOP_ALL = 0x01FF;
        public const uint WM_QUIT = 0x0012;

        public const int DWMWA_CLOAKED = 14;

        // --- Hook State ---
        private static IntPtr _fgHook = IntPtr.Zero;
        private static WinEventDelegate _fgDelegate;
        private static Thread _hookThread = null;
        private static uint _hookThreadId = 0;
        private static AutoResetEvent _hookReady = new AutoResetEvent(false);
        public static List<string> FgEvents = new List<string>();
        private static object _lock = new object();

        // 1. Configure Window Non-Activating & TopMost
        public static bool ApplyNoActivateTopMost(IntPtr hwnd) {
            try {
                long exStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE).ToInt64();
                exStyle |= WS_EX_NOACTIVATE | WS_EX_TOPMOST;
                SetWindowLongPtr(hwnd, GWL_EXSTYLE, new IntPtr(exStyle));

                return SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING | SWP_SHOWWINDOW);
            } catch {
                return false;
            }
        }

        // 2. Fast Move Window Without Focus Activation
        public static bool MoveWindowFast(IntPtr hwnd, int x, int y, int width, int height) {
            uint flags = SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING | SWP_SHOWWINDOW;
            if (width <= 0 || height <= 0) {
                flags |= SWP_NOSIZE;
            }
            return SetWindowPos(hwnd, HWND_TOPMOST, x, y, width, height, flags);
        }

        // 3. Query Process Performance & OS Handles
        public static string GetProcessStats(int pid) {
            try {
                Process p = Process.GetProcessById(pid);
                uint gdi = GetGuiResources(p.Handle, 0);
                uint user = GetGuiResources(p.Handle, 1);
                long ws = p.WorkingSet64;
                long priv = p.PrivateMemorySize64;
                double cpu = p.TotalProcessorTime.TotalSeconds;

                return "{\"pid\":" + pid + ",\"gdi\":" + gdi + ",\"user\":" + user + ",\"workingSetMb\":" + (ws / 1048576.0).ToString("F2", System.Globalization.CultureInfo.InvariantCulture) + ",\"privateMb\":" + (priv / 1048576.0).ToString("F2", System.Globalization.CultureInfo.InvariantCulture) + ",\"cpuSec\":" + cpu.ToString("F3", System.Globalization.CultureInfo.InvariantCulture) + "}";
            } catch (Exception ex) {
                return "{\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
            }
        }

        // 4. Enumeration of Open Windows (Q10) with Desktop Context
        public class WindowItem {
            public long Hwnd;
            public string Title;
            public string ClassName;
            public int X, Y, Width, Height;
            public int ProcessId;
            public string ProcessName;
            public bool IsForeground;
        }

        public static List<WindowItem> EnumerateWindows() {
            List<WindowItem> list = new List<WindowItem>();
            Thread th = new Thread(() => {
                IntPtr hDesk = OpenInputDesktop(0, false, DESKTOP_ALL);
                if (hDesk == IntPtr.Zero) hDesk = OpenDesktop("Default", 0, false, DESKTOP_ALL);
                if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

                IntPtr fgHwnd = GetForegroundWindow();

                EnumWindowsProc proc = (hWnd, lParam) => {
                    if (!IsWindowVisible(hWnd)) return true;

                    bool cloaked;
                    if (DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, sizeof(bool)) == 0 && cloaked) {
                        return true;
                    }

                    RECT rect;
                    if (!GetWindowRect(hWnd, out rect)) return true;
                    if (rect.Width <= 0 || rect.Height <= 0) return true;

                    StringBuilder titleSb = new StringBuilder(512);
                    GetWindowText(hWnd, titleSb, 512);
                    string title = titleSb.ToString();
                    if (string.IsNullOrEmpty(title)) return true;

                    StringBuilder classSb = new StringBuilder(256);
                    GetClassName(hWnd, classSb, 256);

                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    string procName = "";
                    try {
                        procName = Process.GetProcessById((int)pid).ProcessName;
                    } catch {}

                    list.Add(new WindowItem {
                        Hwnd = hWnd.ToInt64(),
                        Title = title,
                        ClassName = classSb.ToString(),
                        X = rect.Left,
                        Y = rect.Top,
                        Width = rect.Width,
                        Height = rect.Height,
                        ProcessId = (int)pid,
                        ProcessName = procName,
                        IsForeground = (hWnd == fgHwnd)
                    });
                    return true;
                };

                if (hDesk != IntPtr.Zero) {
                    EnumDesktopWindows(hDesk, proc, IntPtr.Zero);
                    CloseDesktop(hDesk);
                } else {
                    EnumWindows(proc, IntPtr.Zero);
                }
            });

            th.SetApartmentState(ApartmentState.STA);
            th.Start();
            th.Join(3000);
            return list;
        }

        // 5. WinEvent Foreground Hook with Message Pump Thread (Q11)
        public static bool StartForegroundHook() {
            lock (_lock) {
                if (_hookThread != null) return true;
                FgEvents.Clear();
                _hookThread = new Thread(() => {
                    IntPtr hDesk = OpenInputDesktop(0, false, DESKTOP_ALL);
                    if (hDesk == IntPtr.Zero) hDesk = OpenDesktop("Default", 0, false, DESKTOP_ALL);
                    if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

                    _hookThreadId = GetCurrentThreadId();
                    _fgDelegate = new WinEventDelegate(OnForegroundChanged);
                    _fgHook = SetWinEventHook(
                        EVENT_SYSTEM_FOREGROUND,
                        EVENT_SYSTEM_FOREGROUND,
                        IntPtr.Zero,
                        _fgDelegate,
                        0, 0,
                        WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
                    );

                    _hookReady.Set();

                    MSG msg;
                    while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
                        TranslateMessage(ref msg);
                        DispatchMessage(ref msg);
                    }

                    if (_fgHook != IntPtr.Zero) {
                        UnhookWinEvent(_fgHook);
                        _fgHook = IntPtr.Zero;
                    }
                    if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
                });

                _hookThread.SetApartmentState(ApartmentState.STA);
                _hookThread.IsBackground = true;
                _hookThread.Start();
                return _hookReady.WaitOne(3000);
            }
        }

        private static void OnForegroundChanged(IntPtr hWinEventHook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint dwEventThread, uint dwmsEventTime) {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hwnd, sb, 256);
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            string proc = "";
            try { proc = Process.GetProcessById((int)pid).ProcessName; } catch {}

            string entry = string.Format("{0:O}|{1}|{2}|{3}|{4}",
                DateTime.UtcNow, hwnd.ToInt64(), pid, proc, sb.ToString());
            lock (_lock) {
                FgEvents.Add(entry);
                if (FgEvents.Count > 1000) FgEvents.RemoveAt(0);
            }
        }

        public static List<string> GetForegroundEvents() {
            lock (_lock) {
                return new List<string>(FgEvents);
            }
        }

        public static bool StopForegroundHook() {
            lock (_lock) {
                if (_hookThread == null) return true;
                PostThreadMessage(_hookThreadId, WM_QUIT, UIntPtr.Zero, IntPtr.Zero);
                _hookThread.Join(1500);
                _hookThread = null;
                return true;
            }
        }

        // 6. Caret Position Detection (Q14)
        public static string DetectCaretPosition() {
            string result = "{\"found\":false,\"reason\":\"No foreground window\"}";
            Thread th = new Thread(() => {
                IntPtr hDesk = OpenInputDesktop(0, false, DESKTOP_ALL);
                if (hDesk == IntPtr.Zero) hDesk = OpenDesktop("Default", 0, false, DESKTOP_ALL);
                if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

                IntPtr fgHwnd = GetForegroundWindow();
                if (fgHwnd == IntPtr.Zero) {
                    if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
                    return;
                }

                uint pid;
                uint tid = GetWindowThreadProcessId(fgHwnd, out pid);

                // Strategy 1: Win32 GetGUIThreadInfo
                GUITHREADINFO gui = new GUITHREADINFO();
                gui.cbSize = Marshal.SizeOf(gui);
                if (GetGUIThreadInfo(tid, ref gui) && gui.hwndCaret != IntPtr.Zero) {
                    POINT pt = new POINT { X = gui.rcCaret.Left, Y = gui.rcCaret.Top };
                    ClientToScreen(gui.hwndCaret, ref pt);
                    int w = gui.rcCaret.Right - gui.rcCaret.Left;
                    int h = gui.rcCaret.Bottom - gui.rcCaret.Top;
                    if (w >= 0 && h > 0) {
                        result = "{\"found\":true,\"strategy\":\"GetGUIThreadInfo\",\"x\":" + pt.X + ",\"y\":" + pt.Y + ",\"width\":" + w + ",\"height\":" + h + ",\"hwnd\":" + gui.hwndCaret.ToInt64() + "}";
                        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
                        return;
                    }
                }

                // Strategy 2: UI Automation TextPattern on FocusedElement
                try {
                    AutomationElement focused = AutomationElement.FocusedElement;
                    if (focused != null) {
                        object patternObj;
                        if (focused.TryGetCurrentPattern(TextPattern.Pattern, out patternObj)) {
                            TextPattern textPattern = (TextPattern)patternObj;
                            TextPatternRange[] selection = textPattern.GetSelection();
                            if (selection != null && selection.Length > 0) {
                                System.Windows.Rect[] rects = selection[0].GetBoundingRectangles();
                                if (rects != null && rects.Length > 0) {
                                    result = "{\"found\":true,\"strategy\":\"UIAutomationTextPattern\",\"x\":" + ((int)rects[0].X) + ",\"y\":" + ((int)rects[0].Y) + ",\"width\":" + ((int)rects[0].Width) + ",\"height\":" + ((int)rects[0].Height) + "}";
                                    if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
                                    return;
                                }
                            }
                        }

                        // Fallback: Control Bounding Box
                        System.Windows.Rect controlRect = focused.Current.BoundingRectangle;
                        if (controlRect.Width > 0 && controlRect.Height > 0) {
                            result = "{\"found\":true,\"strategy\":\"UIAutomationControlBounds\",\"x\":" + ((int)controlRect.X) + ",\"y\":" + ((int)controlRect.Y) + ",\"width\":" + ((int)controlRect.Width) + ",\"height\":" + ((int)controlRect.Height) + "}";
                            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
                            return;
                        }
                    }
                } catch (Exception ex) {
                    result = "{\"found\":false,\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}";
                }

                if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
            });

            th.SetApartmentState(ApartmentState.STA);
            th.Start();
            th.Join(3000);
            return result;
        }
    }
}
