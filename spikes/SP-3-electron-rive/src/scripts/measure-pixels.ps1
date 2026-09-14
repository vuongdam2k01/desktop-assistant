[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,

    [string]$OutputPath = $null
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$fullPath = (Resolve-Path $ImagePath).Path
$bmp = [System.Drawing.Bitmap]::FromFile($fullPath)

Write-Host "Analyzing pixel borders in image: $fullPath ($($bmp.Width)x$($bmp.Height))"

# Scan across horizontal lines through middle of character
$midY = [int]($bmp.Height / 2)
$scanYs = @([int]($bmp.Height * 0.35), [int]($bmp.Height * 0.5), [int]($bmp.Height * 0.65))
$scanlines = @()
$edgeTransitions = @()

foreach ($y in $scanYs) {
    $linePixels = @()
    $prevAlpha = -1
    $edgeFound = $false

    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $p = $bmp.GetPixel($x, $y)
        
        # Look for alpha transition (transparent -> opaque or opaque -> transparent)
        if ($prevAlpha -ne -1) {
            $diff = [Math]::Abs($p.A - $prevAlpha)
            if ($diff -gt 20 -and -not $edgeFound) {
                # Record 5 pixels across the transition
                $startIdx = [Math]::Max(0, $x - 2)
                $endIdx = [Math]::Min($bmp.Width - 1, $x + 2)
                $transition = @()
                for ($tx = $startIdx; $tx -le $endIdx; $tx++) {
                    $tp = $bmp.GetPixel($tx, $y)
                    $transition += [PSCustomObject]@{
                        X = $tx; Y = $y; R = $tp.R; G = $tp.G; B = $tp.B; A = $tp.A
                    }
                }
                $edgeTransitions += [PSCustomObject]@{
                    ScanY       = $y
                    EdgeX       = $x
                    Pixels      = $transition
                    Type        = if ($p.A -gt $prevAlpha) { 'EnteringBody' } else { 'ExitingBody' }
                }
                $edgeFound = $true
            }
        }
        $prevAlpha = $p.A
    }
}

# Analyze edge quality: check whether semi-transparent pixels suffer from dark halo
$semiTransparentPixels = @()
$hasDarkFringing = $false
$fringeSamples = @()

foreach ($et in $edgeTransitions) {
    foreach ($pix in $et.Pixels) {
        if ($pix.A -gt 10 -and $pix.A -lt 245) {
            $semiTransparentPixels += $pix
            # Dark halo check: if RGB drops below 25 while Alpha > 30 (abnormal blackening)
            $luminance = (0.299 * $pix.R + 0.587 * $pix.G + 0.114 * $pix.B)
            if ($luminance -lt 15 -and $pix.A -gt 40) {
                $hasDarkFringing = $true
                $fringeSamples += $pix
            }
        }
    }
}

$bmp.Dispose()

$result = [PSCustomObject]@{
    ImagePath               = $fullPath
    TotalTransitionsFound   = $edgeTransitions.Count
    SemiTransparentPixelCount = $semiTransparentPixels.Count
    HasDarkFringing         = $hasDarkFringing
    Verdict                 = if ($hasDarkFringing) { "DIRTY_HALO_DETECTED" } else { "CLEAN_ANTI_ALIASING" }
    SampleTransitions       = $edgeTransitions
}

if ($OutputPath) {
    $outJson = $result | ConvertTo-Json -Depth 5
    $fullOut = [System.IO.Path]::GetFullPath($OutputPath)
    $outDir = [System.IO.Path]::GetDirectoryName($fullOut)
    if (-not [System.IO.Directory]::Exists($outDir)) { [System.IO.Directory]::CreateDirectory($outDir) | Out-Null }
    [System.IO.File]::WriteAllText($fullOut, $outJson)
    Write-Host "Edge analysis saved to: $fullOut"
}


Write-Host "Pixel analysis verdict: $($result.Verdict) (Found $($edgeTransitions.Count) edges, $($semiTransparentPixels.Count) anti-aliased border pixels)"
return $result
