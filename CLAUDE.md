# DMXr for SignalRGB

DMXr bridges DMX lighting fixtures into SignalRGB as first-class canvas devices. Two-component architecture: a SignalRGB JS plugin and a Node.js server using Fastify + dmx-ts for ENTTEC DMX USB Pro output.

## Repo Structure

```
DMXr/
├── DMXr.js                      # SignalRGB plugin (UDP/HTTP color transport)
├── DMXr.qml                     # SignalRGB settings panel UI
├── docs/images/                 # SVG logos, fixture icons
└── server/
    ├── src/                     # All server TypeScript
    │   ├── bootstrap/           # Startup orchestration (DMX, library, shutdown)
    │   ├── config/              # Settings, remap-preset, server-config stores
    │   ├── dmx/                 # Universe manager, dispatcher, connection pool, monitor
    │   ├── fixtures/            # Fixture/group/user-fixture stores, color pipeline, channel mapper
    │   ├── libraries/           # Library registry (OFL + user fixtures)
    │   ├── routes/              # Fastify route handlers (~25 route modules)
    │   ├── ofl/                 # Open Fixture Library client + disk cache
    │   ├── udp/                 # UDP color server (DMXRC binary protocol)
    │   ├── mdns/                # mDNS service advertisement
    │   ├── metrics/             # Latency tracker
    │   ├── middleware/           # API key auth
    │   └── utils/               # Formatting, validation helpers
    ├── public/                  # Alpine.js web UI (no build step)
    │   ├── js/                  # app.js + 26 mixin files
    │   └── css/                 # Feature-scoped CSS files
    └── config/                  # fixtures.json, settings.json (gitignored)
```

## Architecture

```
Browser (http://localhost:8080)       SignalRGB Plugin (DMXr.js)
  |  Fixture CRUD, library browse       |  UDP: DMXRC binary protocol (colors)
  |  Channel overrides, monitor         |  HTTP: GET /fixtures (fallback)
  v                                     v
+-----------------------------------------------------------+
|               DMXr Node.js Server (Fastify)               |
|                                                           |
|  Web UI <-> REST API <-> Fixture Store (JSON)             |
|  OFL Client (disk-cached) -> Library Registry             |
|  UDP Color Server -> Color Pipeline -> DMX Dispatcher     |
|  Universe Manager -> Multi-Universe Coordinator -> dmx-ts |
|  Movement Engine (pan/tilt interpolation)                 |
|  Latency Tracker -> GET /metrics                          |
+-----------------------------------------------------------+
                          |
                    ENTTEC DMX USB Pro
                          |
                     DMX Universe
```

## Development

```bash
cd server
npm test          # vitest (tests co-located: *.test.ts next to source)
npx tsc --noEmit  # type check (strict mode)
npm run build     # compile to dist/
```

## Key Conventions

### Server (TypeScript)

- **Immutable state objects** in all stores -- never mutate, always spread-copy
- **saveChain promise serialization** for concurrent write safety (fixture-store, group-store, settings-store, remap-preset-store, universe-registry)
- **Atomic file writes** -- write to temp file, then rename
- **DmxWriteResult propagation** -- hardware errors bubble up through dispatcher/coordinator/universe-manager for feedback to callers
- **TypeScript strict mode** throughout
- **Test files co-located** with source (`foo.ts` / `foo.test.ts`)
- **Mock patterns**: stores and dispatcher are injected as dependencies, easily mocked in tests

### Frontend (Alpine.js Web UI)

- **Mixin pattern**: 22 mixins merged via `Object.defineProperties` in `app.js`
- **No build step** -- vanilla JS, served as static files by Fastify
- **Each mixin** is a standalone JS file in `public/js/` (e.g., `drag-drop.js`, `settings.js`, `dmx-monitor.js`)
- **CSS split** into feature-scoped files in `public/css/`

### SignalRGB Plugin

- `DMXr.js` at repo root (required location for addon auto-install)
- `DMXr.qml` for settings panel UI
- Uses `device.color(x,y)` to sample canvas (not `getColors("Inline")` which is broken)

## Note

For deployment credentials, SSH access, and machine-specific details -- query local `.claude/` memory files (not committed to repo). These vary per developer machine.

## Maintenance

When you add, remove, or rename a file, or change a module's public interface:

1. Update the relevant README.md in that module's directory
2. If the repo structure changed, update the tree in this file
3. Keep READMEs under 50 lines -- intent and connections, not implementation details
