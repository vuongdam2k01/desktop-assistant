using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
public class ResourceChecker {
    [DllImport("user32.dll")]
    public static extern uint GetGuiResources(IntPtr hProcess, uint uiFlags);
    public static string GetStats(int pid) {
        Process p = Process.GetProcessById(pid);
        uint gdi = GetGuiResources(p.Handle, 0);
        uint user = GetGuiResources(p.Handle, 1);
        return string.Format("PID={0},GDI={1},USER={2},WS_MB={3},Priv_MB={4}",
            p.Id, gdi, user, p.WorkingSet64 / 1024 / 1024, p.PrivateMemorySize64 / 1024 / 1024);
    }
}
