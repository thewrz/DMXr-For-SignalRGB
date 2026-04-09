# Changelog

All notable changes to DMXr are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.1] - 2026-04-08

### Security
- `basic-ftp` bumped via `npm audit fix` ([GHSA-chqc-8p9q-pq6q](https://github.com/advisories/GHSA-chqc-8p9q-pq6q) — high, FTP command injection via CRLF; transitive dev dep from puppeteer)
- `brace-expansion` bumped via `npm audit fix` ([GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) — moderate, ReDoS)
- `vite` bumped transitively via `vitest` 4.1.3 ([GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r), [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583))

### Changed
- `@fastify/static` 9.0.0 → 9.1.0 (includes upstream `sendFile` option-override fix)
- `vitest` 4.1.1 → 4.1.3
- `@vitest/coverage-v8` 4.1.1 → 4.1.3
- `@playwright/test` 1.58.2 → 1.59.1 (dev)
- `@types/node` 25.5.0 → 25.5.2 (dev)

## [1.3.0] - 2026-03-12

### Added
- Real-time DMX hardware indicator in web UI top bar (connected/disconnected/reconnecting)
- Always-on SSE connection log stream — hardware state updates push to UI instantly
- `control_mode_changed` event type for immediate blackout/whiteout UI feedback on reconnect
- DMX write result propagation and action feedback toasts
- Optimistic concurrency control (version field on fixtures)
- SSE heartbeat and destroyed-guard for connection cleanup
- Puppeteer UI test infrastructure (23 tests across 6 suites)
- Onboarding tour and contextual help system
- Movement control for moving fixtures (pan/tilt interpolation)
- Multi-select fixture management with batch operations
- Marquee drag-select on DMX grid with visual rectangle overlay
- Selection-aware groups with multi-fixture drag-move
- Per-fixture color calibration (gain/offset per RGB channel)
- Connection event log for DMX diagnostics
- Offline OFL cache for disconnected environments
- Fixture grouping and bulk control
- Channel remap UI, presets, and single-channel test
- Fixture card color swatch and overflow menu layout
- Configuration backup and restore (export/import)
- Fixture duplicate and bulk add operations
- One-time plugin update check against GitHub
- Live DMX channel monitor with SSE streaming (grid + fixture views)
- Universe selector and multi-universe awareness
- ControlMode state sync (blackout/whiteout) across all clients
- Custom fixture builder with template store and library provider
- Generic fixture type icons with category derivation
- OFL JSON import/export for fixtures
- Built-in generic fixture templates
- Server naming in web UI with live mDNS republish
- Flash click-to-sustain with channel locking
- DMXr logo across README, web UI, and SignalRGB plugin
- CLAUDE.md and per-module README files
- Prometheus metrics endpoint and structured log format config
- MIT license
- Dependabot, CODEOWNERS, and security audit CI job

### Fixed
- USB disconnect no longer crashes server (serial port error/close events properly handled)
- Null TypeError on Windows serial port close event (`null !== undefined` guard)
- Single-universe `onStateChange` now pushes to ConnectionLog for SSE propagation
- Startup defaults no longer bypass blackout (S100 strobe bug)
- ENTTEC flushed to blackout on connect and reconnect
- Error boundaries added to shutdown sequence
- Request body size limits and input bounds enforcement
- Fixture validation before replace-mode deletion in config import
- Save errors now logged instead of silently swallowed
- saveChain added to remap-preset-store for concurrent write safety
- Group-control timers tracked and cleared on shutdown
- mDNS storm reduction (reuse socket, disable probes, debounce republish)
- Alpine reactive storm from @mousemove on body
- Motor guard slider range and Auto mode
- Server stays in blackout mode on startup until client resumes
- Per-device icons in SignalRGB via setImageFromBase64

### Changed
- Shared ConnectionLog injected from index.ts into both DMX stacks
- Refactored style.css into feature-scoped CSS files
- Split fixture-manager.js into motor-guard, fixture-reset, color-calibration mixins
- Extracted Fastify schemas from fixtures route
- Error logging added to silent catch blocks
- Browse source tabs replaced with dropdown select
- DMX monitor rendering optimized for RDP

## [1.2.0] - 2026-03-03

### Added
- Dependabot for automated dependency updates
- CODEOWNERS file
- Security audit CI job

### Changed
- Bumped dmx-ts from 0.1.1 to 0.4.0
- Bumped vitest from 3.2.4 to 4.0.18
- Updated CI actions (checkout v6, setup-node v6, upload-artifact v7)

### Fixed
- Bonjour mock repaired for vitest 4 ESM constructor handling
- @vitest/coverage-v8 peer dependency alignment

## [1.1.0] - 2026-03-03

### Added
- Multi-server support with server identity and plugin registry
- Multi-server QML settings panel with per-server status cards
- Open DMX USB (FTDI) driver support
- Motor guard UI toggle with atomic blackout/whiteout preserving pan/tilt
- DMX fixture reset button with auto-detection
- Debug endpoints (`/debug/raw`, `/debug/fixture/:id`)
- Verbose pipeline logging for DMX channel debugging
- Manual server probing as mDNS fallback
- UDP port exposed in health response

### Fixed
- Motor guard clamps slider range and Auto mode for motor channels
- Motor-safe blackout/whiteout with per-fixture guard settings
- Pan/tilt restored in color frames (tilt regression fix)
- Rate limit increased from 100 to 600 req/min
- Override values pushed to DMX immediately on PATCH
- SoundSwitch range clamping; positional channels excluded from color frames
- QML-saved server settings now read for multi-server probe

### Changed
- CI triggers build on tag push with draft release artifacts

## [1.0.1] - 2026-03-02

### Added
- Momentary press-and-hold flash that overrides blackout

### Fixed
- UDP color data no longer overrides blackout/whiteout state

## [1.0.0] - 2026-03-02

### Added
- Initial release
- SignalRGB plugin with CompGen + device.color hybrid approach
- Node.js server (Fastify) with REST API and web UI
- DMX output via dmx-ts (ENTTEC DMX USB Pro)
- UDP color transport (DMXRC binary protocol) with HTTP fallback
- Persistent fixture store with atomic file writes
- Fixture channel mapping and color pipeline (RGB/RGBW)
- White-gated strobe support
- Per-channel overrides from web UI
- Blackout/whiteout control
- mDNS server discovery
- Auto COM port detection
- Multi-platform build workflow (Windows, Linux, macOS)
- Linux systemd installer and launcher scripts
- Alpine.js web manager UI

[Unreleased]: https://github.com/thewrz/DMXr/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/thewrz/DMXr/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/thewrz/DMXr/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/thewrz/DMXr/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/thewrz/DMXr/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/thewrz/DMXr/releases/tag/v1.0.0
