# DMXr

Control your DMX lighting fixtures from [SignalRGB](https://signalrgb.com) — sync stage lights, PARs, moving heads, and strobes with your PC lighting effects.

> Currently targets SignalRGB (Windows). [OpenRGB](https://openrgb.org) support for native Linux is planned.

[![Add to SignalRGB](https://github.com/SRGBmods/qmk-plugins/raw/main/_images/add-to-signalrgb.png)](https://srgbmods.net/s?p=addon/install?url=https://github.com/thewrz/DMXr)

## What it does

- Turns any DMX fixture into a draggable tile on the SignalRGB canvas
- RGB color mapping with automatic white extraction for RGBW fixtures
- Strobe-only fixtures (no RGB) are white-gated — they only fire on near-white input, so your strobe doesn't pop on every red/blue effect
- Per-channel overrides let you lock individual channels (strobe speed, gobo, macros) from the web UI while SignalRGB drives everything else
- Resilient USB connection — survives unplug/replug with automatic reconnect and state replay
- Guaranteed blackout on shutdown

## Hardware & fixture support

Tested with an **ENTTEC DMX USB Pro** — other USB-to-DMX adapters may work but haven't been tried.

Fixture-wise, I've only tested with what I own: a couple of RGB PAR cans, two moving heads (color only — pan/tilt isn't driven yet), and a strobe. It works well for RGB color mapping, but fixtures like lasers and movers that need interpreted movement/pattern data are still a work in progress. If you try it with something else and it works (or doesn't), let me know.

## Architecture

- **Node.js server** (Fastify) — fixture management, DMX output, web UI at `http://localhost:8080`
- **SignalRGB plugin** — polls fixtures and sends canvas colors via REST
- **ENTTEC DMX USB Pro** output via `dmx-ts`

## Fixture Libraries

- **Open Fixture Library** — community database at [open-fixture-library.org](https://open-fixture-library.org)
- **Local fixture databases** — auto-detects compatible third-party databases on the system

## Setup

### Plugin (SignalRGB)

Click **Add to SignalRGB** at the top of this page to auto-install the plugin. After install, restart SignalRGB and enable DMXr under **Settings → Plugins**.

**Manual install**: Copy `DMXr.js` and `DMXr.qml` from the repo root to `Documents\WhirlwindFX\Plugins\`.

### Server

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
| `DMX_DRIVER` | `null` | `null` or `enttec-usb-dmx-pro` |
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
npm test          # Run tests (350+)
npx tsc --noEmit  # Type check
```
