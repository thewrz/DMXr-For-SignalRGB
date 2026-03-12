# Changelog

All notable changes to DMXr are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- DMX write result propagation and action feedback toasts
- Optimistic concurrency control (version field on fixtures)
- SSE heartbeat and destroyed-guard for connection cleanup
- Puppeteer UI test infrastructure (23 tests across 6 suites)
- Onboarding tour and contextual help system
- Movement control for moving fixtures (pan/tilt)
- Multi-select fixture management with batch operations
- Marquee drag-select on DMX grid
- Selection-aware groups with multi-fixture drag-move
- Per-fixture color calibration
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
- Dependabot, CODEOWNERS, and security audit CI job

### Fixed
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

[Unreleased]: https://github.com/thewrz/DMXr/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/thewrz/DMXr/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/thewrz/DMXr/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/thewrz/DMXr/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/thewrz/DMXr/releases/tag/v1.0.0
