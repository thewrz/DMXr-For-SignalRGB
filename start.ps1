$env:SOUNDSWITCH_DB_PATH = "sscloud.db"
$env:HOST = "0.0.0.0"
$env:MDNS_ENABLED = "false"
Set-Location "C:\Users\adam\DMXr"
& node --import tsx src/index.ts 2>&1 | Out-File -FilePath "C:\Users\adam\DMXr\dmxr.log" -Encoding UTF8
