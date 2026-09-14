$sw = [System.Diagnostics.Stopwatch]::StartNew()
Write-Output "Starting node async pop-up trigger..."
Start-Process node -ArgumentList "-e `"setTimeout(() => { const req = require('http').request({host:'127.0.0.1',port:18923,path:'/popup-card',method:'POST'}, res => console.log('popped')); req.end(); }, 400)`"" -WindowStyle Hidden
Write-Output "Trigger scheduled at $($sw.ElapsedMilliseconds) ms"
