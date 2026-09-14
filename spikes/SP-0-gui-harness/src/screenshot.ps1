<#
.SYNOPSIS
    Captures full screen or a specific window/region and saves it as a PNG file.
    Works reliably on Windows native even when executed from custom sub-desktops/sandboxes
    by attaching a clean worker thread to the active input desktop.
.PARAMETER OutputPath
    Destination file path (.png).
.PARAMETER WindowHandle
    Optional window handle (IntPtr) to capture specific window bounds.
.PARAMETER Bounds
    Optional custom rectangle [System.Drawing.Rectangle] or hashtable @{X=..; Y=..; Width=..; Height=..}.
.PARAMETER AllScreens
    If switch is present, captures entire virtual desktop across all displays.
.PARAMETER DesktopName
    Optional specific desktop name (e.g. 'Default'). Defaults to active input desktop.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$OutputPath,

    [Parameter()]
    [IntPtr]$WindowHandle = [IntPtr]::Zero,

    [Parameter()]
    [object]$Bounds = $null,

    [Parameter()]
    [switch]$AllScreens,

    [Parameter()]
    [string]$DesktopName = $null
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$screenCaptureHelper = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;

public class NativeScreenCapture {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    public const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    public const uint SRCCOPY = 0x00CC0020;
    public const uint DESKTOP_ALL = 0x01FF;

    public const int SM_XVIRTUALSCREEN = 76;
    public const int SM_YVIRTUALSCREEN = 77;
    public const int SM_CXVIRTUALSCREEN = 78;
    public const int SM_CYVIRTUALSCREEN = 79;
    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
        public int Width { get { return Right - Left; } }
        public int Height { get { return Bottom - Top; } }
    }

    public static bool CaptureRegion(string desktopName, int x, int y, int width, int height, string filePath, out string errorMsg) {
        bool success = false;
        string err = null;

        Thread t = new Thread(() => {
            IntPtr hDesk = IntPtr.Zero;
            try {
                if (!string.IsNullOrEmpty(desktopName)) {
                    hDesk = OpenDesktop(desktopName, 0, false, DESKTOP_ALL);
                } else {
                    hDesk = OpenInputDesktop(0, false, DESKTOP_ALL);
                    if (hDesk == IntPtr.Zero) {
                        hDesk = OpenDesktop("Default", 0, false, DESKTOP_ALL);
                    }
                }

                if (hDesk != IntPtr.Zero) {
                    SetThreadDesktop(hDesk);
                }

                IntPtr hDeskDC = GetDC(IntPtr.Zero);
                if (hDeskDC == IntPtr.Zero) {
                    err = "GetDC(0) failed with error: " + Marshal.GetLastWin32Error();
                    return;
                }

                IntPtr hMemDC = CreateCompatibleDC(hDeskDC);
                if (hMemDC == IntPtr.Zero) {
                    err = "CreateCompatibleDC failed with error: " + Marshal.GetLastWin32Error();
                    ReleaseDC(IntPtr.Zero, hDeskDC);
                    return;
                }

                IntPtr hBmp = CreateCompatibleBitmap(hDeskDC, width, height);
                if (hBmp == IntPtr.Zero) {
                    err = "CreateCompatibleBitmap failed with error: " + Marshal.GetLastWin32Error();
                    DeleteDC(hMemDC);
                    ReleaseDC(IntPtr.Zero, hDeskDC);
                    return;
                }

                IntPtr hOld = SelectObject(hMemDC, hBmp);
                bool bltOk = BitBlt(hMemDC, 0, 0, width, height, hDeskDC, x, y, SRCCOPY);
                SelectObject(hMemDC, hOld);

                if (bltOk) {
                    using (Bitmap bmp = Bitmap.FromHbitmap(hBmp)) {
                        bmp.Save(filePath, ImageFormat.Png);
                    }
                    success = true;
                } else {
                    err = "BitBlt failed with error: " + Marshal.GetLastWin32Error();
                }

                DeleteObject(hBmp);
                DeleteDC(hMemDC);
                ReleaseDC(IntPtr.Zero, hDeskDC);
            } catch (Exception ex) {
                err = ex.ToString();
            } finally {
                if (hDesk != IntPtr.Zero) {
                    CloseDesktop(hDesk);
                }
            }
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();

        errorMsg = err;
        return success;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'NativeScreenCapture').Type) {
    Add-Type -TypeDefinition $screenCaptureHelper -ReferencedAssemblies System.Drawing
}

# Resolve target capture bounds
$targetX = 0
$targetY = 0
$targetW = 0
$targetH = 0

if ($Bounds -ne $null) {
    if ($Bounds -is [System.Drawing.Rectangle] -and -not $Bounds.IsEmpty) {
        $targetX = $Bounds.X; $targetY = $Bounds.Y; $targetW = $Bounds.Width; $targetH = $Bounds.Height
    } elseif ($Bounds -is [System.Collections.IDictionary]) {
        $targetX = [int]$Bounds.X; $targetY = [int]$Bounds.Y; $targetW = [int]$Bounds.Width; $targetH = [int]$Bounds.Height
    }
} elseif ($WindowHandle -ne [IntPtr]::Zero) {
    $rect = New-Object NativeScreenCapture+RECT
    $hr = [NativeScreenCapture]::DwmGetWindowAttribute($WindowHandle, [NativeScreenCapture]::DWMWA_EXTENDED_FRAME_BOUNDS, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf($rect))
    if ($hr -ne 0 -or $rect.Width -le 0 -or $rect.Height -le 0) {
        [NativeScreenCapture]::GetWindowRect($WindowHandle, [ref]$rect) | Out-Null
    }
    if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
        $targetX = $rect.Left; $targetY = $rect.Top; $targetW = $rect.Width; $targetH = $rect.Height
    }
}

if ($targetW -le 0 -or $targetH -le 0) {
    if ($AllScreens) {
        $targetX = [NativeScreenCapture]::GetSystemMetrics([NativeScreenCapture]::SM_XVIRTUALSCREEN)
        $targetY = [NativeScreenCapture]::GetSystemMetrics([NativeScreenCapture]::SM_YVIRTUALSCREEN)
        $targetW = [NativeScreenCapture]::GetSystemMetrics([NativeScreenCapture]::SM_CXVIRTUALSCREEN)
        $targetH = [NativeScreenCapture]::GetSystemMetrics([NativeScreenCapture]::SM_CYVIRTUALSCREEN)
    } else {
        $targetX = 0
        $targetY = 0
        $targetW = [NativeScreenCapture]::GetSystemMetrics([NativeScreenCapture]::SM_CXSCREEN)
        $targetH = [NativeScreenCapture]::GetSystemMetrics([NativeScreenCapture]::SM_CYSCREEN)
    }
}

$fullDest = [System.IO.Path]::GetFullPath($OutputPath)
$destDir = [System.IO.Path]::GetDirectoryName($fullDest)
if (-not [System.IO.Directory]::Exists($destDir)) {
    [System.IO.Directory]::CreateDirectory($destDir) | Out-Null
}

$errMsg = $null
$ok = [NativeScreenCapture]::CaptureRegion($DesktopName, $targetX, $targetY, $targetW, $targetH, $fullDest, [ref]$errMsg)

if (-not $ok) {
    throw "Screenshot capture failed: $errMsg"
}

$fileItem = Get-Item -Path $fullDest
return [PSCustomObject]@{
    Path      = $fileItem.FullName
    X         = $targetX
    Y         = $targetY
    Width     = $targetW
    Height    = $targetH
    SizeBytes = $fileItem.Length
}
