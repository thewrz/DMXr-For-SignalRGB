# DMXr-For-SignalRGB

Bridge DMX lighting fixtures into [SignalRGB](https://signalrgb.com/) as first-class canvas devices. Apply any SignalRGB effect to your DMX fixtures — the same way you control your keyboard, mouse, and fans.

**Target hardware:** [ENTTEC DMX USB Pro](https://www.enttec.com/product/dmx-usb-interfaces/dmx-usb-pro-professional-1u-usb-to-dmx512-converter/)

## Quick Start

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

The server starts on `http://127.0.0.1:8080` with a null DMX driver (no hardware needed for development).

Verify it's running:

```bash
curl http://localhost:8080/health
# {"status":"ok","driver":"null","activeChannels":0,"uptime":5}
```

### 2. Install the SignalRGB plugin

Copy `plugin/DMXr.js` to your SignalRGB plugins folder:

```
%userprofile%\Documents\WhirlwindFX\Plugins\
```

Restart SignalRGB. The **DMXr Fixture 1** device appears under Other Devices. Drag it onto the canvas and apply an effect — the server logs channel values to stdout.

### 3. Connect real hardware

Create `server/.env` (copy from `.env.example`):

```env
DMX_DRIVER=enttec-usb-dmx-pro
DMX_DEVICE_PATH=COM3          # Windows
# DMX_DEVICE_PATH=/dev/ttyUSB0  # Linux
```

Restart the server. Channel updates now output to the ENTTEC Pro.

## Architecture

```
SignalRGB Effect Engine
        |
        v
DMXr Plugin (JS)          reads device.color(0,0) each frame
        |                  maps to 4 DMX channels (Brightness, R, G, B)
        | HTTP POST        sends JSON to local server
        v
DMXr Server (Node.js)     validates channels, manages DMX universe
        |
        v
dmx-ts library            outputs via ENTTEC USB DMX Pro driver
        |
        v
DMX Fixtures              receive DMX512 signal
```

## Plugin Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Server Port | 8080 | Port the DMXr server is listening on |
| DMX Start Channel | 1 | First DMX channel for this fixture (1-512) |
| Enable Debug Log | false | Show per-frame channel values in SignalRGB device console |

## Server API

**GET /health** — Server status

**POST /update** — Send channel values
```json
{
  "fixture": "fixture-1",
  "channels": { "1": 255, "2": 128, "3": 64, "4": 200 }
}
```

## Development

See [docs/development.md](docs/development.md) for setup details, testing, and project structure.

## Roadmap

- [ ] Multi-fixture support via SignalRGB subdevices
- [ ] Fixture profiles (RGB, RGBW, RGBWA+UV)
- [ ] Open Fixture Library integration
- [ ] Multi-universe support (>512 channels)
- [ ] WebSocket upgrade for lower latency
- [ ] Web UI for DMX universe management

## Links

- [Miro board (progress/ideas)](https://miro.com/app/board/uXjVLyC0vEI=/?share_link_id=676503878203)
- [node-dmx](https://github.com/node-dmx/dmx) / [dmx-ts](https://github.com/node-dmx/dmx-ts)
- [Open Fixture Library](https://github.com/OpenLightingProject/open-fixture-library)
- [ENTTEC DMX USB Pro](https://www.enttec.com/product/dmx-usb-interfaces/dmx-usb-pro-professional-1u-usb-to-dmx512-converter/)
- [SignalRGB Discord discussion](https://discord.com/channels/803347488190365737/841741611544346624/1322984821521383446)
