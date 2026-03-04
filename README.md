# DMXr

Control your DMX lighting fixtures from [SignalRGB](https://signalrgb.com) — sync stage lights, PARs, moving heads, and strobes with your PC lighting effects.

> Currently targets SignalRGB (Windows). [OpenRGB](https://openrgb.org) support for native Linux is planned.

[![Add to SignalRGB](https://github.com/SRGBmods/qmk-plugins/raw/main/_images/add-to-signalrgb.png)](https://srgbmods.net/s?p=addon/install?url=https://github.com/thewrz/DMXr)

## What it does

- Turns any DMX fixture into a draggable tile on the SignalRGB canvas
- RGB color mapping with automatic white extraction for RGBW fixtures
- Strobe-only fixtures (no RGB) are white-gated — they only fire on near-white input, so your strobe doesn't pop on every red/blue effect
- Per-channel overrides let you lock individual channels (strobe speed, gobo, macros) from the web UI while SignalRGB drives everything else
- Motor guard protects pan/tilt channels on moving heads during blackout/whiteout
- Multi-server — run multiple DMXr instances on different machines; the plugin discovers and manages all of them
- UDP color transport for lower-latency updates (falls back to HTTP automatically)
- Resilient USB connection — survives unplug/replug with automatic reconnect and state replay
- Guaranteed blackout on shutdown

## Hardware & fixture support

Tested with an **ENTTEC DMX USB Pro** and **Open DMX USB** (FTDI-based) adapters.

Fixture-wise, I've only tested with what I own: a couple of RGB PAR cans, two moving heads (color only — pan/tilt isn't driven yet), and a strobe. It works well for RGB color mapping, but fixtures like lasers and movers that need interpreted movement/pattern data are still a work in progress. If you try it with something else and it works (or doesn't), let me know.

## Architecture

- **Node.js server** (Fastify) — fixture management, DMX output, web UI at `http://localhost:8080`
- **SignalRGB plugin** — discovers servers via mDNS, sends canvas colors over UDP (with HTTP fallback)
- **DMX output** via `dmx-ts` — supports ENTTEC DMX USB Pro and Open DMX USB (FTDI) drivers

## Fixture Libraries

- **Open Fixture Library** — community database at [open-fixture-library.org](https://open-fixture-library.org)
- **Local fixture databases** — auto-detects compatible third-party databases on the system

## Setup

### Plugin (SignalRGB)

Click **Add to SignalRGB** at the top of this page to auto-install the plugin. After install, restart SignalRGB and enable DMXr under **Settings → Plugins**.

**Manual install**: Copy `DMXr.js` and `DMXr.qml` from the repo root to `Documents\WhirlwindFX\Plugins\`.

### Server

**Option A — Portable (recommended):**
Download `DMXr-Server-win-x64.zip` from the
[latest release](https://github.com/thewrz/DMXr/releases/latest),
extract anywhere, and double-click `DMXr-Server.bat`.

**Option B — From source:**
```bash
cd server
npm install
npm start
```

Add fixtures through the web UI at `http://localhost:8080`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `HOST` | `127.0.0.1` | Bind address |
| `DMX_DRIVER` | `null` | `null`, `enttec-usb-dmx-pro`, or `enttec-open-usb-dmx` |
| `DMX_DEVICE_PATH` | `/dev/ttyUSB0` | Serial port for DMX adapter |
| `FIXTURE_DB_PATH` | *(auto-detect)* | Path to a local fixture database file |
| `FIXTURES_PATH` | `./config/fixtures.json` | Persisted fixture configuration |
| `MDNS_ENABLED` | `true` | Advertise via mDNS |
| `API_KEY` | *(none)* | Optional API key for endpoint auth |

### Running as a service

Windows (NSSM):
```bash
nssm install DMXr node.exe tsx src/index.ts
nssm set DMXr AppDirectory C:\path\to\DMXr\server
nssm start DMXr
```

Linux (systemd): see `service/dmxr.service`.

## Development

```bash
cd server
npm test          # Run tests (460+)
npx tsc --noEmit  # Type check
```

## Acknowledgments

DMXr is built on the work of these open-source projects:

- **[dmx-ts](https://github.com/node-dmx/dmx-ts)** — Node.js DMX library with ENTTEC USB Pro driver support. The backbone of all DMX output in this project.
- **[Open Fixture Library](https://open-fixture-library.org)** — Community-maintained database of DMX fixture definitions. Powers the OFL browser and fixture import in the web UI.
- **[Alpine.js](https://alpinejs.dev)** — Lightweight reactive framework that drives the entire web manager UI without a build step.
- **[bonjour-service](https://github.com/onlxltd/bonjour-service)** — mDNS/Zeroconf implementation used for automatic server discovery by the SignalRGB plugin.
- **[NSSM](https://nssm.cc)** — The Non-Sucking Service Manager, used to run DMXr as a Windows service with auto-restart.
