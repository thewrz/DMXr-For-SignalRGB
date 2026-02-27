# DMXr-For-SignalRGB

Bridge DMX lighting fixtures into [SignalRGB](https://signalrgb.com/) as first-class canvas devices. Apply any SignalRGB effect to your DMX fixtures — the same way you control your keyboard, mouse, and fans.

**Target hardware:** [ENTTEC DMX USB Pro](https://www.enttec.com/product/dmx-usb-interfaces/dmx-usb-pro-professional-1u-usb-to-dmx512-converter/)

## Features

- **Fixture management** — Add, edit, and remove DMX fixtures via a web UI or REST API
- **Open Fixture Library integration** — Browse and import fixture profiles from [OFL](https://open-fixture-library.org/)
- **mDNS discovery** — SignalRGB automatically discovers the DMXr server on the network (`_dmxr._tcp`)
- **Auto-port** — Server automatically finds an open port if the default (8080) is in use
- **Per-fixture canvas mapping** — Each fixture appears as a draggable device on the SignalRGB canvas
- **Channel mapping** — Automatically maps RGB color data to fixture DMX channels

## Quick Start

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

The server starts on `http://0.0.0.0:8080` with a null DMX driver (no hardware needed for development) and advertises itself via mDNS.

Verify it's running:

```bash
curl http://localhost:8080/health
# {"status":"ok","driver":"null","activeChannels":0,"uptime":5}
```

### 2. Add fixtures via the web UI

Open `http://localhost:8080` in your browser. Search the Open Fixture Library, select a fixture and mode, set the DMX start address, and save.

### 3. Install the SignalRGB plugin

Copy `plugin/DMXr.js` and `plugin/DMXr.qml` to your SignalRGB plugins folder:

```
%userprofile%\Documents\WhirlwindFX\Plugins\
```

Restart SignalRGB. Your fixtures appear automatically under Devices. Enable each device, then drag it onto the canvas and apply an effect.

### 4. Connect real hardware

Set environment variables before starting the server:

```bash
DMX_DRIVER=enttec-usb-dmx-pro
DMX_DEVICE_PATH=COM3          # Windows
# DMX_DEVICE_PATH=/dev/ttyUSB0  # Linux
```

Restart the server. Channel updates now output to the ENTTEC Pro.

## Architecture

```
Browser (http://localhost:8080)     SignalRGB Plugin
         |                                |
         | Fixture CRUD, OFL search       | Polls GET /fixtures, POST /update/colors
         v                                v
+--------------------------------------------------+
|              DMXr Node.js Server (Fastify)        |
|  Web UI ←→ REST API ←→ Fixture Store (JSON)      |
|  OFL Client (cached) → Universe Manager → dmx-ts |
|  mDNS advertiser (_dmxr._tcp via bonjour-service)|
+--------------------------------------------------+
         |
         v
    ENTTEC DMX USB Pro → DMX512 Fixtures
```

## Configuration

### Server (environment variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` for all interfaces) |
| `DMX_DRIVER` | `null` | DMX driver (`null` or `enttec-usb-dmx-pro`) |
| `DMX_DEVICE_PATH` | `/dev/ttyUSB0` | Serial port for DMX interface |
| `MDNS_ENABLED` | `true` | Advertise via mDNS (`_dmxr._tcp`) |
| `PORT_RANGE_SIZE` | `10` | Number of ports to try if default is in use |
| `FIXTURES_PATH` | `./config/fixtures.json` | Fixture store file path |
| `LOG_LEVEL` | `info` | Fastify log level |

### Plugin (SignalRGB settings)

| Setting | Default | Description |
|---------|---------|-------------|
| Server Host | `127.0.0.1` | Manual fallback when mDNS is unavailable |
| Server Port | `8080` | Manual fallback port |
| Enable Debug Log | `true` | Show per-frame values in SignalRGB device console |

## Server API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status, driver info, active channels, uptime |
| `GET` | `/fixtures` | List all fixtures |
| `POST` | `/fixtures` | Create a fixture |
| `PUT` | `/fixtures/:id` | Update a fixture |
| `DELETE` | `/fixtures/:id` | Delete a fixture |
| `POST` | `/update/colors` | Send RGB color data to fixtures |
| `POST` | `/control/blackout` | Set all channels to 0 |
| `POST` | `/control/whiteout` | Set all channels to 255 |
| `POST` | `/fixtures/:id/test` | Flash a fixture for testing |
| `GET` | `/ofl/manufacturers` | List OFL manufacturers |
| `GET` | `/ofl/manufacturers/:key` | List fixtures for a manufacturer |
| `GET` | `/ofl/fixtures/:mfr/:model` | Get fixture details from OFL |

## Development

```bash
cd server
npm test            # Run tests (100 tests across 11 files)
npm run test:watch  # Watch mode
npm run dev         # Start dev server with tsx
```

## Roadmap

- [x] Multi-fixture support via SignalRGB subdevice controllers
- [x] Fixture profiles with OFL integration
- [x] Web UI for fixture management
- [x] mDNS service discovery
- [x] Auto-port increment on bind failure
- [ ] Multi-universe support (>512 channels)
- [ ] WebSocket upgrade for lower latency
- [ ] Fixture grouping and zone mapping

## Links

- [Miro board (progress/ideas)](https://miro.com/app/board/uXjVLyC0vEI=/?share_link_id=676503878203)
- [dmx-ts](https://github.com/node-dmx/dmx-ts)
- [Open Fixture Library](https://open-fixture-library.org/)
- [ENTTEC DMX USB Pro](https://www.enttec.com/product/dmx-usb-interfaces/dmx-usb-pro-professional-1u-usb-to-dmx512-converter/)
- [SignalRGB Discord discussion](https://discord.com/channels/803347488190365737/841741611544346624/1322984821521383446)
