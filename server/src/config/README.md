# config/ — Settings, Presets & Server Configuration

## Files

### server-config.ts
- `loadConfig(persisted?)` -> `ServerConfig`
- Merges environment variables over persisted settings
- Validates PORT, DMX_DRIVER (null | enttec-usb-dmx-pro | enttec-open-usb-dmx), PORT_RANGE_SIZE
- Auto-detects SoundSwitch DB path via `findSoundswitchDb()`

### settings-store.ts
- `createSettingsStore(filePath)` -> `SettingsStore { load, update, get }`
- Persists to `./config/settings.json` (dmxDriver, port, host, mDNS, serverId, serverName, etc.)
- Auto-generates `serverId` (UUID) on first load if missing
- Always returns defensive copies (`{ ...current }`) to prevent external mutation

### remap-preset-store.ts
- `createRemapPresetStore(filePath)` -> `RemapPresetStore { load, getAll, get, upsert, remove, save }`
- Stores named channel-remap presets (channelCount + offset mapping)
- Persists to `./config/remap-presets.json`

## Persistence Pattern (saveChain)

All stores use a chained-promise write pattern to prevent concurrent file writes:

```ts
saveChain = saveChain.then(async () => {
  await writeFile(tmpPath, data);
  await rename(tmpPath, filePath);  // atomic swap
});
```

This ensures writes are serialized even when multiple callers trigger saves
concurrently. The atomic rename prevents partial-write corruption on crash.
