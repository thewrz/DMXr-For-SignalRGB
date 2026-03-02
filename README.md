# DMXr

Bridge DMX lighting fixtures into [SignalRGB](https://signalrgb.com) as first-class canvas devices.

## What it does

- Turns any DMX fixture into a draggable tile on the SignalRGB canvas
- RGB color mapping with automatic white extraction for RGBW fixtures
- Strobe-only fixtures (no RGB) are white-gated — they only fire on near-white input, so your strobe doesn't pop on every red/blue effect
- Per-channel overrides let you lock individual channels (strobe speed, gobo, macros) from the web UI while SignalRGB drives everything else
- Resilient USB connection — survives unplug/replug with automatic reconnect and state replay
- Guaranteed blackout on shutdown

## Architecture

- **Node.js server** (Fastify) — fixture management, DMX output, web UI at `http://localhost:8080`
- **SignalRGB plugin** — polls fixtures and sends canvas colors via REST
- **ENTTEC DMX USB Pro** output via `dmx-ts`

## Fixture Libraries

- **Open Fixture Library** — community database at [open-fixture-library.org](https://open-fixture-library.org)
- **Local fixture databases** — auto-detects compatible third-party databases on the system

## Setup

```bash
npm install
npm start
```

Copy `plugin/DMXr.js` to your SignalRGB plugins folder, then add fixtures through the web UI at `http://localhost:8080`.

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
nssm set DMXr AppDirectory C:\path\to\DMXr
nssm start DMXr
```

Linux (systemd): see `service/dmxr.service`.

## Development

```bash
npm test          # Run tests (350+)
npx tsc --noEmit  # Type check
```
