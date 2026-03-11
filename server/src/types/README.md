# types/ — Protocol Types & Shared Interfaces

## protocol.ts

Central type definitions used across the entire server. All interfaces use
`readonly` properties to enforce immutability.

### Core Types
- `FixtureConfig` — stored fixture with channels, overrides, remap, calibration, movement config
- `FixtureChannel` — single DMX channel definition (offset, name, type, color, defaultValue)
- `ChannelOverride` — per-channel manual override (value + enabled flag)
- `ChannelMap` — `Record<string, number>` mapping channel addresses to values
- `FixtureSource` — `"ofl" | "local-db" | "custom" | "builtin"`
- `ColorCalibration` — per-fixture RGB gain/offset

### Universe Types
- `UniverseConfig` — persisted universe (id, name, devicePath, driverType)
- `DEFAULT_UNIVERSE_ID` — `"default"` constant for backward compatibility

### Request/Response Types
- `FixtureUpdatePayload` / `FixtureUpdateResponse` — POST /update
- `AddFixtureRequest` / `UpdateFixtureRequest` — fixture CRUD
- `FixtureGroup` / `AddGroupRequest` / `UpdateGroupRequest` — group CRUD
- `HealthResponse` — GET /health shape
- `ColorUpdatePayload` — POST /update/colors

### Movement Types
- `MovementConfig` is imported from `fixtures/movement-types.ts` and used in `FixtureConfig`

## serialport.d.ts

Ambient type declarations for the `serialport` package.
