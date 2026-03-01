# DMXr

Bridge DMX lighting fixtures into [SignalRGB](https://signalrgb.com) as first-class canvas devices.

## Architecture

- **Node.js server** with Fastify — manages fixtures, DMX output, and a web UI
- **SignalRGB plugin** — samples canvas tile colors and sends them to the server
- **ENTTEC DMX USB Pro** support via `dmx-ts`

## Fixture Libraries

DMXr supports multiple fixture definition sources:

- **Open Fixture Library** — community-maintained database at [open-fixture-library.org](https://open-fixture-library.org)
- **Local fixture databases** — auto-detects compatible third-party fixture databases installed on the system

## Setup

```bash
npm install
npm run build
npm start
```

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

## Development

```bash
npm test          # Run tests
npx tsc --noEmit  # Type check
```
