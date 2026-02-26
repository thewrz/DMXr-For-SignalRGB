# Development Guide

## Prerequisites

- Node.js 18+
- npm
- SignalRGB (for plugin testing)

## Project Structure

```
DMXr-For-SignalRGB/
├── plugin/
│   └── DMXr.js                        # SignalRGB plugin (plain JS, no bundler)
├── server/
│   ├── src/
│   │   ├── index.ts                   # Entry point, graceful shutdown
│   │   ├── server.ts                  # Fastify app factory
│   │   ├── routes/
│   │   │   ├── update.ts             # POST /update — fixture channel updates
│   │   │   └── health.ts             # GET /health — server status
│   │   ├── dmx/
│   │   │   ├── universe-manager.ts   # DMX universe state, channel validation
│   │   │   └── driver-factory.ts     # Creates dmx-ts driver from config
│   │   ├── config/
│   │   │   └── server-config.ts      # Environment-based configuration
│   │   └── types/
│   │       └── protocol.ts           # Shared TypeScript interfaces
│   ├── vitest.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── docs/
│   └── development.md                 # This file
├── .gitignore
└── README.md
```

## Server Setup

```bash
cd server
npm install
npm run dev          # Starts with null DMX driver (no hardware needed)
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `HOST` | `127.0.0.1` | Bind address |
| `DMX_DRIVER` | `null` | DMX driver: `null` or `enttec-usb-dmx-pro` |
| `DMX_DEVICE_PATH` | `/dev/ttyUSB0` | Serial port for ENTTEC Pro |
| `LOG_LEVEL` | `info` | Fastify log level (`silent`, `error`, `warn`, `info`, `debug`) |

### Scripts

```bash
npm run dev            # Run with tsx (auto-reloads on crash, not HMR)
npm run build          # Compile TypeScript to dist/
npm start              # Run compiled JS from dist/
npm test               # Run tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
```

## Testing

Tests use Vitest and Fastify's `.inject()` method (no real HTTP server needed).

```bash
cd server
npm test               # All 29 tests
npm run test:coverage  # Coverage report (100% on business logic)
```

### Test Files

| File | What it tests |
|------|---------------|
| `universe-manager.test.ts` | Channel validation, clamping, blackout, active count |
| `update.test.ts` | POST /update schema validation, success/error responses |
| `health.test.ts` | GET /health response shape, driver name, active channels |
| `server-config.test.ts` | Environment variable loading, defaults |

## Plugin Development

The SignalRGB plugin is plain JavaScript with ES module exports. No bundler or transpiler.

### Install for testing

Copy `plugin/DMXr.js` to:
```
%userprofile%\Documents\WhirlwindFX\Plugins\
```

Restart SignalRGB (or toggle the device off/on). The device appears under "Other Devices".

### How it works

1. `DiscoveryService.connect()` registers a `DMXrController`
2. Each frame, `Controller.Render()`:
   - Reads color from `device.color(0, 0)` → `[R, G, B]`
   - Reads brightness from `device.getBrightness()` → 0.0-1.0
   - Skips if unchanged from last frame
   - Throttles to 60 Hz max
   - POSTs `{ fixture, channels }` to the local server via XMLHttpRequest
3. `Controller.Shutdown()` aborts any in-flight XHR

### Plugin settings

Settings defined in `ControllableParameters()` become global variables in the plugin runtime. They appear in the SignalRGB device settings panel.

## Key Design Decisions

- **Network plugin type** (not Rawusb): ENTTEC Pro uses FTDI serial, not HID. Network type is the correct pattern for server-backed devices.
- **HTTP POST** (not WebSocket): Simpler for MVP. ~1-3ms round-trip on loopback at 60Hz is fine. WebSocket is a clean future upgrade.
- **Server manages DMX addressing**: Plugin sends channel numbers, server validates and outputs. Cleaner separation, server can later serve multiple clients.
- **dmx-ts**: TypeScript port of node-dmx. `driver-factory.ts` isolates this dependency for easy fallback.
- **Immutable patterns**: Channel updates build new objects via `reduce`. Mutable state is confined to closures.

## Manual Testing

```bash
# Health check
curl http://localhost:8080/health

# Send a color update
curl -X POST http://localhost:8080/update \
  -H "Content-Type: application/json" \
  -d '{"fixture":"fixture-1","channels":{"1":255,"2":128,"3":64,"4":200}}'

# Blackout (all channels to 0)
curl -X POST http://localhost:8080/update \
  -H "Content-Type: application/json" \
  -d '{"fixture":"fixture-1","channels":{"1":0,"2":0,"3":0,"4":0}}'
```
