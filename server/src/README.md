# server/src/ — Server Architecture

Entry point: `index.ts` orchestrates startup; `server.ts` builds the Fastify app.

## Startup Flow (index.ts)

1. Load persisted settings and server config
2. Auto-detect DMX port (serial-port-scanner)
3. Create DMX stack (connection + universe manager + latency tracker)
4. Load stores (fixtures, groups, remap presets, user fixtures)
5. Initialize fixture defaults on DMX universe
6. Create multi-universe stack (registry, connection pool, coordinator)
7. Start movement engine tick loop (25ms interval)
8. Create library stack (OFL + local-db + user + builtin providers)
9. Start UDP color server and DMX monitor
10. Build Fastify HTTP server with all route registrations
11. Install shutdown handlers, bind HTTP + UDP listeners, advertise mDNS

## Module Dependency Graph

```
index.ts
  +-> bootstrap/     Startup orchestration (DMX, libraries, shutdown)
  +-> config/        Settings store, server config, remap presets
  +-> dmx/           Connection, universe manager, coordinator, dispatcher, monitor
  +-> fixtures/      Fixture store, color pipeline, movement, groups, overrides
  +-> libraries/     Provider registry (OFL, local-db, user, builtin)
  +-> routes/        Fastify route handlers + JSON schemas
  +-> udp/           DMXRC binary protocol, UDP color server
  +-> ofl/           OFL API client with disk cache
  +-> logging/       Pipeline logger (sampled verbose tracing)
  +-> types/         Protocol types, fixture config shapes
  +-> utils/         Format helpers (shortId)
```

## Smaller Modules

- **signalrgb/** — `component-writer.ts`: generates SignalRGB component JSON for fixtures
- **soundswitch/** — SoundSwitch local DB client + fixture classifier (better-sqlite3)
- **metrics/** — `latency-tracker.ts`: rolling circular-buffer stats (min/avg/p95/p99)
- **middleware/** — `api-key-auth.ts`: optional API key guard on API routes
- **ui/** — `channel-label.ts` (fixture name abbreviation), `ofl-convert.ts` (OFL/DMXr type mapping), `css-parser.ts`/`css-theme.ts`
- **mdns/** — mDNS service advertisement via bonjour-service
