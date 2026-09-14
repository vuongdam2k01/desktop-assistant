[CmdletBinding()]
param(
    [int]$Port = 3838
)

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/close" -Method Post -TimeoutSec 2 -ErrorAction SilentlyContinue | Out-Null
    Start-Sleep -Milliseconds 500
} catch {}

# Kill any lingering electron processes started for sp3
Get-Process -Name "electron" -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
        if ($cmd -match "sp3-electron-rive") {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}
Write-Host "Cleanup completed."
