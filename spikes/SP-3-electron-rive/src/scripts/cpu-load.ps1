[CmdletBinding()]
param(
    [int]$TargetPercent = 80,
    [int]$DurationSeconds = 12
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$jsWorker = Join-Path $scriptDir "cpu-load.js"

Write-Host "Starting Node CPU stress worker (Target: ~$TargetPercent%, Duration: ${DurationSeconds}s)..."
$p = Start-Process -FilePath "node" -ArgumentList "`"$jsWorker`" $TargetPercent $DurationSeconds" -PassThru

$samples = @()
$deadline = (Get-Date).AddSeconds($DurationSeconds)
while (-not $p.HasExited -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 1
    try {
        $c = (Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue
        if ($c) {
            $samples += [Math]::Round($c, 1)
            Write-Host "Current CPU: $([Math]::Round($c, 1))%"
        }
    } catch {}
}

if (-not $p.HasExited) {
    $p.WaitForExit(3000) | Out-Null
}

$avg = if ($samples.Count -gt 0) { [Math]::Round(($samples | Measure-Object -Average).Average, 1) } else { 0 }
Write-Host "CPU Stress completed. Average CPU load: $avg%"

return [PSCustomObject]@{
    TargetPercent   = $TargetPercent
    DurationSeconds = $DurationSeconds
    AverageCpu      = $avg
    Samples         = $samples
}
