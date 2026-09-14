Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class LayoutHelper {
    [DllImport("user32.dll")]
    public static extern IntPtr LoadKeyboardLayout(string pwszKLID, uint Flags);
    [DllImport("user32.dll")]
    public static extern IntPtr ActivateKeyboardLayout(IntPtr hkl, uint Flags);
    [DllImport("user32.dll")]
    public static extern IntPtr GetKeyboardLayout(uint idThread);
}
'@

$cur = [LayoutHelper]::GetKeyboardLayout(0)
Write-Output "Current layout: $cur"
$us = [LayoutHelper]::LoadKeyboardLayout("00000409", 1)
[LayoutHelper]::ActivateKeyboardLayout($us, 1)
$newLayout = [LayoutHelper]::GetKeyboardLayout(0)
Write-Output "New layout: $newLayout"
