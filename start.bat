@echo off
set SOUNDSWITCH_DB_PATH=sscloud.db
set HOST=0.0.0.0
set MDNS_ENABLED=false
set DMX_DRIVER=enttec-usb-dmx-pro
set DMX_DEVICE_PATH=COM3
cd /d C:\Users\adam\DMXr
"C:\Program Files\nodejs\node.exe" --import tsx src/index.ts
