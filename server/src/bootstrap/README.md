# bootstrap/ — Startup & Shutdown Orchestration

Extracted from `index.ts` to keep the entry point concise. Each file creates
one subsystem and returns typed handles for the rest of the startup chain.

## Files

### dmx-setup.ts
- `createDmxStack(config, logger)` -> `{ connection, manager, latencyTracker }`
- Creates a `ResilientConnection` (auto-reconnect with exponential backoff)
- Wires `UniverseManager` on top with send-timing callbacks to the latency tracker
- Uses late-binding (`managerRef`) so the connection's snapshot callback can
  reference the manager before it exists

### multi-universe-setup.ts
- `createMultiUniverseStack(config, logger, tracker, fallbackManager)` -> `{ registry, pool, coordinator, connectionLog }`
- Loads persisted universe configs from `./config/universes.json`
- Bootstraps a connection + manager for each configured universe
- Registers the single-universe manager as fallback on `DEFAULT_UNIVERSE_ID`

### library-setup.ts
- `createLibraryStack(config, oflClient, userFixtureStore)` -> `LibraryRegistry`
- Wires all four library providers: OFL, local-db (SoundSwitch), user fixtures, builtins

### fixture-init.ts
- `initializeFixtureDefaults(fixtureStore, manager)`
- Registers motor safe positions (Pan/Tilt center values)
- Pushes all channel defaults via `applyRawUpdate` (bypasses blackout guard)

### shutdown.ts
- `installShutdownHandlers(deps)` -> shutdown function
- Handles SIGINT, SIGTERM, SIGHUP, uncaughtException, unhandledRejection
- Clears movement interval and all route timer maps
- Guaranteed blackout: synchronous `process.on("exit")` as last resort
- Shutdown order: timers -> mDNS -> libraries -> monitor -> blackout -> UDP -> HTTP -> connections
