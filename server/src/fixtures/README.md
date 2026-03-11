# fixtures/ — Fixture Store, Color Pipeline & Movement

## Fixture Store
- `fixture-store.ts`: CRUD for `FixtureConfig[]`, persisted to `./config/fixtures.json`
- `group-store.ts`: fixture groups with membership tracking, persisted to `./config/groups.json`
- `user-fixture-store.ts`: user-created fixture templates (custom definitions)
- All stores use the `saveChain` pattern (see config/README) with 250ms debounced saves

## Color Pipeline (mapColor)

`channel-mapper.ts` runs a pipeline of stages in sequence:

```
whiteGateStage -> brightnessScaleStage -> calibrationStage -> whiteExtractionStage -> colorMappingStage
```

Each stage is a pure function `(PipelineContext) -> PipelineContext` (immutable pattern).

- **whiteGateStage** — for basic strobe fixtures, zeroes all channels unless input is near-white
- **brightnessScaleStage** — scales RGB by brightness when no dimmer channel exists
- **calibrationStage** — applies per-fixture gain/offset color calibration
- **whiteExtractionStage** — extracts common minimum from RGB into white channel (RGBW fixtures)
- **colorMappingStage** — maps channels by type (ColorIntensity, Intensity, Strobe, Pan/Tilt, etc.)

## Channel Remap
- `channel-remap.ts`: pure address-translation layer for fixtures with swapped channels
- `resolveAddress(fixture, logicalOffset)` -> absolute DMX address with remap applied

## Overrides
- `fixture-override-service.ts`: `computeOverrideChannels()` computes DMX values for manual overrides
- Motor-safe clamping applied to Pan/Tilt/Focus/Zoom channels

## Movement Engine
- `movement-interpolator.ts`: `MovementEngine` class manages pan/tilt state per fixture
- 16-bit internal math, smoothing curves (linear, ease-in-out, s-curve)
- `movement-tick.ts`: 25ms tick handler converts engine output to DMX channel writes

## Other Files
- `motor-guard.ts`: clamps motor channels to safe range (avoids mechanical extremes)
- `fixture-capabilities.ts`: `analyzeFixture()` derives capabilities from channel definitions
- `fixture-validator.ts`: validates fixture add/update requests
- `fixture-color-extractor.ts`: extracts current RGB from DMX snapshot
- `builtin-templates.ts`: hardcoded generic fixture templates (RGB PAR, dimmer, etc.)
