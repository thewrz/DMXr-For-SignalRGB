# dmx/ — DMX Output Pipeline

## Data Flow

```
Color data (UDP/HTTP)
  -> UniverseManager.applyFixtureUpdate()    validate + clamp + write to driver
  -> DmxDispatcher                           route to correct universe
  -> MultiUniverseCoordinator                fan-out to per-universe managers
  -> DmxMonitor                              poll snapshots for SSE streaming
```

## Key Files

### universe-manager.ts
- Core DMX write interface: `applyFixtureUpdate`, `blackout`, `whiteout`, `resumeNormal`
- Tracks active channels, control mode (normal/blackout/whiteout)
- Motor safe positions: restored during blackout/whiteout to prevent mechanical slam
- Channel locking: flash effects lock channels so normal updates skip them
- `DmxWriteResult { ok, error? }` propagated to API responses via `withDmxStatus`

### dmx-dispatcher.ts
- `DmxDispatcher`: unified facade hiding coordinator-vs-single-manager branching
- All operations always update the primary manager (not in connection pool)
- Optionally delegates to coordinator for universe-scoped operations

### multi-universe-coordinator.ts
- `MultiUniverseCoordinator`: delegates to per-universe managers via `ManagerProvider`
- `blackoutAll` / `whiteoutAll` / `resumeNormalAll` for global operations

### resilient-connection.ts
- Auto-reconnect with exponential backoff (1s to 30s)
- Replays channel snapshot on reconnect
- Reports state changes via callback

### dmx-monitor.ts
- `DmxMonitor`: polls channel snapshots at ~15fps, broadcasts to SSE subscribers
- Groups subscribers by universe to avoid redundant snapshot builds
- Auto-starts/stops polling interval based on subscriber count

### Other Files
- `connection-pool.ts` — manages connections for multi-universe setups
- `universe-registry.ts` — persists universe configs to JSON
- `connection-log.ts` — ring buffer of connection state change events
- `driver-factory.ts` — creates dmx-ts driver instances
- `serial-port-scanner.ts` — auto-detects ENTTEC USB Pro via serial port enumeration
- `error-messages.ts` — user-friendly DMX error translation
