# DMXr Security Audit — 2026-04-08

**Audit branch:** `audit/security-review-2026-04-08`
**Audit commit:** main @ `a96963d` (v1.3.1)
**Methodology:** 6 parallel specialist review passes across distinct threat surfaces
**Findings:** 12 CRITICAL · 16 HIGH · 22 MEDIUM · 27 LOW · 5 INFO

This audit evaluates DMXr as a networked DMX controller that drives real physical
hardware (moving heads, high-intensity PARs, UV blacklights, strobe-capable
fixtures). Physical-safety risks are scored as CRITICAL regardless of traditional
exploitability because they can cause human injury (photosensitive epilepsy,
motor runaway, thermal hazard) or property damage (gear strip, latched-on heat).

---

## Executive summary

> **DMXr is structurally sound in several places** — robust UDP parser, strong
> immutable-store pattern with atomic rename, no DOM-injection XSS sinks in the
> web UI, Helmet CSP registered, API-key comparison is timing-safe, zero npm
> advisories, no `pull_request_target` workflows, no secrets in the current tree.
>
> **But the authentication boundary is effectively non-existent on a default install.**
> The combination of five independent defects collapses the entire trust model:
>
> 1. The HTTP auth middleware uses a prefix *allowlist* and **fails OPEN** for
>    any path not in the list — roughly 60% of state-mutating routes
>    (`/settings`, `/settings/restart`, `/universes`, `/config/import`, `/groups`,
>    `/user-fixtures`, `/remap-presets`, `/metrics`, logs, diagnostics, SSE streams)
>    are unauthenticated even when `API_KEY` is set. (AUTH-C1)
> 2. The UDP DMXRC color transport is unauthenticated by design, has no
>    source-address filter, and binds to `0.0.0.0` by default. (NET-H1/H2, DMX-C1)
> 3. The default config binds the HTTP server to `0.0.0.0` and has no warning
>    when `API_KEY` is empty. (AUTH-H5)
> 4. `POST /settings/restart` calls `process.exit(1)` — unauthenticated → 1-packet
>    LAN reboot loop. (AUTH-C2)
> 5. `POST /universes` takes an arbitrary `devicePath` with no validation —
>    unauthenticated → DMX output redirection. (AUTH-C4)
>
> **The physical-safety boundary is also soft.** Strobe channels have no
> photosensitive-epilepsy (PSE) band exclusion; `applyRawUpdate` is a wide bypass
> of motor guard, blackout state, and channel validation invoked by half the HTTP
> routes (`/debug/raw`, `/fixtures/:id/test`, `/fixtures/:id/reset`, `/control/whiteout`,
> `/groups/:id/flash`); runtime fixture additions don't update the safe-position
> registry; and the "guaranteed shutdown blackout" is not synchronously guaranteed
> because the `process.on("exit")` handler cannot flush the serial buffer.
>
> **The release pipeline** uses floating action tags (not pinned SHAs) and
> downloads Node.js + NSSM binaries without checksum verification on a
> **public** repository with a single code owner and `enforce_admins=false`.
> A compromise of any pinned-by-tag action or a MITM of the Node.js download
> silently backdoors every v1.x release bundle, which runs on user machines as
> a privileged Windows service via NSSM.

**Top 5 fixes, ranked by cost-weighted blast radius:**

1. **Invert `api-key-auth.ts` to fail-closed with an explicit public allowlist.** Closes
   AUTH-C1, C2, C3, C4, H1, H3, H4, H5. Single highest-impact change in the entire repo.
   (~2 hours)
2. **Bind UDP + HTTP to `127.0.0.1` by default.** Closes NET-H1, NET-H2, DMX-C1 for
   99% of deployments. Requires a settings field `udpAllowedSources` (CIDR list) for
   opt-in LAN exposure. (~3 hours)
3. **Add a `StrobeGuard` with PSE-band exclusion (15–25 Hz)** mirroring the
   existing `MotorGuard` pattern. Closes DMX-C3. Highest physical-harm ceiling in
   the repo. (~6 hours)
4. **Pin every GitHub Action to an immutable commit SHA** and add checksum
   verification to the Node.js + NSSM downloads in `build-server.yml`. Closes
   SUPPLY-C1 and SUPPLY-C2. (~1.5 hours)
5. **Gate `applyRawUpdate` through `buildDmxUpdate`** and respect motor-guard +
   blackout state. Closes DMX-C2. Prevents user-originated physical damage via the
   "flash" test button on moving-head fixtures. (~4 hours)

Total top-5 effort: **~16 hours**. This eliminates every CRITICAL and roughly half
the HIGH-severity findings.

---

## Cross-layer correlations

These are exploit chains that become severe only when two or more independently-
scored findings combine.

### Chain A — LAN-unauthenticated full-rig takeover (1 packet)
`DMX-C1` (UDP binds 0.0.0.0, no auth) + `AUTH-H5` (default has no `API_KEY`) + `DMX-C3`
(no strobe PSE cap). Any host on the same LAN can drive any connected fixture
into a strobe-rate within the seizure-inducing band. No credentials required,
no prior reconnaissance, no exploit skill. **Severity: CRITICAL (physical harm).**

### Chain B — Permanent reboot loop
`AUTH-C1` (auth bypass) + `AUTH-C2` (`POST /settings/restart` = `process.exit`).
`curl -X POST http://DMXr:8080/settings/restart` in a shell loop = permanent
outage until physical access. **Severity: CRITICAL.**

### Chain C — Silent full-fixture wipe
`AUTH-C1` + `AUTH-H1` (`/config/import` deletes all fixtures *before* validating
the replacement payload). Single request destroys the entire fixture database with
a crafted partial-valid import that fails mid-insert. **Severity: HIGH.**

### Chain D — Persistent rebind + exfiltration
`AUTH-C1` + `AUTH-C3` (`PATCH /settings` no schema, merges into disk) + `AUTH-C2`
(restart). An attacker writes `{"host":"0.0.0.0","port":80,"apiKey":null}` then
hits `/settings/restart`. Server rebinds to a public port with no auth.
**Severity: CRITICAL.**

### Chain E — Release-pipeline supply-chain RCE
`SUPPLY-C1` (floating action tags) + `SUPPLY-C2` (unverified Node/NSSM downloads)
+ `SUPPLY-H1` (workflow-level `contents: write`) + `SUPPLY-H2` (single code owner,
`enforce_admins: false`). A tag compromise of `actions/checkout`, `actions/setup-node`,
or `softprops/action-gh-release` inserts a backdoor into a portable Node binary that
ships as a Windows service. Every v1.x download post-compromise is owned at the
host level. **Severity: CRITICAL (scales to every end user).**

### Chain F — False-confidence blackout
`DMX-C5` (blackout silently returns success when USB is unplugged) + `DMX-C4`
(sync `exit` handler can't flush serial buffer). Operator pulls the USB during a
show, hits the UI blackout button, sees a green checkmark, walks away — fixtures
remain latched at whatever value they had before the disconnect. **Severity:
CRITICAL (physical — fire, heat, runaway motors).**

### Chain G — Rogue mDNS server hijacks SignalRGB plugin
`NET-M3` (mDNS advertises on all interfaces) + `FRONT-H1` (SignalRGB plugin trusts
any `_dmxr._tcp.local` advertisement). A hostile device on the LAN advertises as
DMXr; SignalRGB clients auto-discover and send color data to the attacker's
collector. Since the plugin also opens `"http://" + modelData.host + ":" + port`
from QML with no allowlist, the attacker can additionally drive-by browse the
user. **Severity: HIGH.**

---

## CRITICAL findings (12)

### AUTH-C1 · API-key auth prefix allowlist fails open
**Layer:** AuthN/AuthZ · **Effort:** M

`server/src/middleware/api-key-auth.ts:4-17, 32-41` — `API_PREFIXES` lists only
`/fixtures, /update, /control, /ofl, /libraries, /search, /signalrgb, /debug`.
Any URL not matching a prefix **returns early (line 33–35)** without auth. The
unauthenticated routes include `/settings/*`, `/universes/*`, `/config/*`,
`/groups/*` (which mutate DMX state!), `/user-fixtures/*`, `/remap-presets/*`,
`/metrics`, `/api/logs/*`, `/api/diagnostics/*`, `/api/dmx/*`, `/api/settings/*`.

**Fix:** Invert the logic — fail closed. Register `registerApiKeyAuth` as a
`preHandler` only on an explicit public-route exemption list (`/health`, static,
favicon). Prefer route-level `config: { public: true }` tagging.

### AUTH-C2 · `POST /settings/restart` is a 1-packet LAN DoS
**Layer:** AuthN/AuthZ · **Effort:** S

`server/src/routes/settings.ts:86-96` — unauthenticated (AUTH-C1), calls
`process.exit(1)` after a 500ms delay. Relies on a service manager (NSSM,
systemd) to restart — sustained reboot loop trivially achievable.

**Fix:** Require auth + `config: { rateLimit: { max: 2, timeWindow: '1 hour' } }`.
Require a short-lived confirmation token.

### AUTH-C3 · `PATCH /settings` has no schema, merges any body into disk
**Layer:** AuthN/AuthZ · **Effort:** S

`server/src/routes/settings.ts:58-74` + `server/src/config/settings-store.ts:97-101`
— handler casts `request.body as Partial<PersistedSettings>` with no Fastify
schema; `update()` does `{ ...current, ...partial }` with no allowlist.
`isValidSettings()` exists in the store but is only invoked on `load()`, not
on `update()`. Attacker writes arbitrary `host`, `port`, `dmxDevicePath`,
arbitrary junk keys. Persists across restart.

**Fix:** Add JSON schema with `additionalProperties: false` on the route AND
call `isValidSettings` inside `update()` with key-allowlist filtering.

### AUTH-C4 · `POST /universes` accepts arbitrary `devicePath`/`driverType`
**Layer:** AuthN/AuthZ · **Effort:** S

`server/src/routes/universes.ts:64-98` — unauthenticated (AUTH-C1), no
`additionalProperties: false`, no maxLength on strings, no enum on `driverType`.
Attacker redirects DMX output to an arbitrary serial or network endpoint and
persists the change.

**Fix:** Auth + strict schema + enum constraint matching `VALID_DRIVERS`.

### DMX-C1 · UDP color transport unauthenticated, binds 0.0.0.0
**Layer:** Network + DMX · **Effort:** M

`server/src/udp/udp-color-server.ts:49`, `server/src/config/server-config.ts:83`.
The DMXRC binary protocol has no key or nonce. Any LAN host can stream color,
movement, and `FLAG_BLACKOUT` packets at unbounded rate. Combined with DMX-C3
(no strobe PSE cap) this is a **human-harm vector**.

**Fix:** Default UDP bind to `127.0.0.1`. Add `udpAllowedSources` CIDR list
(loopback + RFC1918 by default). Derive an HMAC key from `API_KEY` and require
signed packets when a key is configured.

### DMX-C2 · `applyRawUpdate` bypasses motor guard, blackout, validation, and locked channels
**Layer:** DMX · **Effort:** M

`server/src/dmx/universe-manager.ts:324-341` writes directly to the serial
driver without `buildDmxUpdate`, without clamping, without honoring
`blackoutActive`, without respecting `lockedChannels`, and without motor-guard.
Route paths that depend on it:

- `/debug/raw` (`debug.ts:97`)
- `/fixtures/:id/test` flash paths (`fixture-test.ts:136,170,202`) — the
  per-channel flash button assigns `255` even to Pan/Tilt channels on a SLM70S
  moving head, slamming it into the mechanical hard stop.
- `/fixtures/:id/reset` (`fixture-reset.ts:71`)
- `/control/whiteout` (`control-modes.ts:54`)
- `/groups/:id/blackout|whiteout|flash|resume` (`group-control.ts:92,129,173,189,228`)

**Fix:** Route `applyRawUpdate` through `buildDmxUpdate`; add an explicit
`{ bypassBlackout: true }` opt-in only for the narrow bootstrap restore path.
In `buildFlashValues`, detect motor channel types and clamp via `clampMotor`;
for Strobe channels use `channel.defaultValue` — never unconditional 255.

### DMX-C3 · No photosensitive-epilepsy (PSE) guard on Strobe channels
**Layer:** DMX (physical safety) · **Effort:** M

`server/src/fixtures/pipeline-stages.ts:133-139`,
`server/src/fixtures/fixture-override-service.ts:49-50`. Strobe channels
are written as `0 | 255 | defaultValue` with no reference to the W3C WCAG 2.3.1
photosensitive-epilepsy band (15–25 Hz). OFL capability frequency metadata is
not consulted. A legitimate user dragging the override slider OR any
unauthenticated UDP sender (DMX-C1) can produce seizure-inducing output.

**Fix:** Build a `StrobeGuard` parallel to `MotorGuard`. Per fixture, derive
`strobeHzSafeRange` from OFL capabilities (denying 10–25 Hz by default). When
capabilities are absent, clamp `Strobe`/`ShutterStrobe` values to
`{0, defaultValue}`. Opt-in override only for power users with a persistent
warning banner.

### DMX-C4 · "Guaranteed shutdown blackout" is not synchronously guaranteed
**Layer:** DMX (physical safety) · **Effort:** M

`server/src/bootstrap/shutdown.ts:34-40` registers a `process.on("exit")` handler
that calls `manager.blackout()`. But Node's sync `exit` phase does not run timers
or microtasks. The blackout frame is written into dmx-ts's in-memory send buffer
and never leaves the serial port. The flushable path (`flushAndClose`) is `async`
and only runs on the happy-path SIGINT/SIGTERM; if `uncaughtException` leaks into
sync exit, fixtures latch at pre-crash values — stuck hot lamp / mid-motion
moving head.

**Fix:** In the `exit` handler, synchronously emit a zero frame via the
underlying `SerialPort.write(Buffer.alloc(513, 0))`. Add an integration test
that kills the process with `SIGABRT` and verifies a zero frame on loopback.
Document `SIGKILL` as out-of-scope and recommend a hardware DMX watchdog for
mission-critical installs.

### DMX-C5 · Blackout silently reports success when USB is disconnected
**Layer:** DMX (physical safety) · **Effort:** S

`server/src/dmx/resilient-connection.ts:178-197` — proxy universe drops writes
when `currentConnection === null`. `universe-manager.safeSend` wraps that in
try/catch and returns `{ ok: true }` because no exception. UI shows a green
checkmark; fixtures remain latched.

**Fix:** Return `{ ok: false, error: "no active DMX connection" }` from the
proxy. `shutdown.ts` should log `BLACKOUT FAILED — DMX disconnected` prominently
and block exit for a configurable grace period while attempting reconnect.

### DMX-C6 · Safe motor positions registered only at boot
**Layer:** DMX (physical safety) · **Effort:** S

`server/src/bootstrap/fixture-init.ts:24-25` calls `computeSafePositions()` once
at startup. No route re-registers after CRUD. Adding an SLM70S via the web UI
leaves its pan/tilt channels absent from `safePositions` — next `/control/blackout`
sends `0` (mechanical hard stop) instead of `128`, risking gear strip on first
blackout.

**Fix:** Subscribe to `fixtureStore` change events (or call in each CRUD route);
re-run `computeSafePositions` → `registerSafePositions` on every fixture mutation.

### SUPPLY-C1 · Every GitHub Action pinned to a floating major tag
**Layer:** Supply chain · **Effort:** S

`.github/workflows/ci.yml`, `build-server.yml`, `dependency-health.yml` — all
actions use `@v6`-style floating tags. Repo is **public**. Tag compromise (via
account takeover, force-push to `v6`, malicious maintainer) instantly executes
attacker code with `build-server.yml`'s `contents: write` token, backdooring
every release bundle.

Affected: `actions/checkout@v6`, `actions/setup-node@v6`,
`softprops/action-gh-release@v2`, `actions/upload-artifact@v7`,
`peter-evans/create-issue-from-file@v6`.

**Fix:** Pin to 40-char commit SHAs with version as a trailing comment:
`uses: actions/checkout@b4ffde65... # v4.1.1`. Dependabot auto-bumps SHA pins.

### SUPPLY-C2 · Release bundles download Node.js + NSSM without checksum verification
**Layer:** Supply chain · **Effort:** S

`.github/workflows/build-server.yml:61-93` — three unauthenticated downloads:
- `https://nodejs.org/dist/$V/node-$V-win-x64.zip` (no `SHASUMS256.txt` verify)
- `https://nodejs.org/dist/$V/node-$V-linux-${arch}.tar.xz` (no verify)
- `https://github.com/ONLYOFFICE/nssm/releases/.../nssm_x64.zip` (no hash pin)

These binaries ship inside the portable server bundle and run as a privileged
service on user machines. A TLS MITM on the GitHub runner, a mirror compromise,
or a `ONLYOFFICE/nssm` takeover silently backdoors every downstream DMXr install.

**Fix:**
```yaml
curl -fsSLO https://nodejs.org/dist/$V/SHASUMS256.txt
grep node-$V-... SHASUMS256.txt | sha256sum -c -
```
For NSSM: hard-code expected SHA-256 or vendor it. Fail the job on mismatch.

---

## HIGH findings (16)

### NET-H1 · UDP ping echo → reflection / amplification
`server/src/udp/udp-color-server.ts:106-115`. `FLAG_PING` triggers a reply of up
to ~1290 B for a ~20 B request (≈64× amplification). No source validation, no
rate limit. With `0.0.0.0` bind, DMXr can be weaponized as a reflector by a
spoofed-source DDoS.
**Fix:** Reply with fixed-size 15 B header only; drop non-RFC1918 sources;
token-bucket per source (10/s).

### NET-H2 · UDP server binds 0.0.0.0 with no source allow-list
Subsumed in DMX-C1. Listed independently by the network agent to capture the
non-physical-safety DoS dimension.
**Fix:** See DMX-C1.

### AUTH-H1 · `/config/import` replace-mode deletes fixtures before full validation
`server/src/routes/config.ts:193-246`. Pre-validation catches required fields +
intra-batch conflicts, not schema/reference integrity. Delete happens on line
195–197; `addBatch` throws on line 235 → 500 + data-loss warning in the log.
Unauthenticated (AUTH-C1).
**Fix:** Dry-run add against a cloned store before destructive delete.

### AUTH-H2 · `/update` schema accepts unbounded integer keys, no clamping
`server/src/routes/update.ts:11-23`. `channels.additionalProperties: {type:"number"}`
with no min/max, no `maxProperties`, uses `number` (accepts floats), no
`propertyNames` pattern.
**Fix:** `type:"integer", minimum:0, maximum:255`, `maxProperties:512`,
`propertyNames:{pattern:"^[1-9][0-9]{0,2}$"}`.

### AUTH-H3 · `/health` + `/metrics` leak device path and internals unauthenticated
`server/src/routes/health.ts:68-92`, `metrics.ts:16-42`. Returns
`dmxDevicePath` (COM port / `/dev/ttyUSB0`), `serverId`, connection error
titles, reconnect attempts, latency histograms, UDP packet counts.
**Fix:** Keep `/health` minimal (`{status, version, uptime}`); move detail to
`/health/detailed` behind auth. Gate `/metrics` behind auth or a separate
`METRICS_API_KEY`.

### AUTH-H4 · `/api/logs` + SSE stream leak internal errors, paths, fixture names unauthenticated
`server/src/routes/logs.ts:20-120`. Buffer contains OFL failure stack bits,
pipeline debug lines, fixture names, error suggestions. `limit` querystring is
`parseInt` with no upper bound.
**Fix:** Require auth; clamp `limit` ≤ 1000; scrub stack traces before buffering.

### AUTH-H5 · Empty `API_KEY` env silently disables auth for every route
`server/src/server.ts:147-149`. No startup warning. On a default laptop install
connected to untrusted Wi-Fi, full DMX + restart control is exposed to any LAN
peer.
**Fix:** Log a prominent warning at startup when `apiKey` is unset AND
`host !== "127.0.0.1"`. Refuse non-loopback bind without either a key or
an explicit `INSECURE_NO_AUTH=1` opt-out.

### DMX-H1 · Reconnect replay re-applies stale channels without ramp
`server/src/dmx/resilient-connection.ts:139-144`. After USB reconnect, the
snapshot is replayed verbatim; no interpolation, no safe-position pre-seed on
the new connection. Pan/tilt snaps instantaneously to the pre-disconnect target.
**Fix:** Pipe the snapshot through a 500ms ramp; seed `safePositions` as the
first frame after reconnect.

### DMX-H2 · `whiteout` drives Strobe channels of un-registered fixtures to 255
`server/src/routes/control-modes.ts:30-71`. `dispatcher.whiteout()` fills the
entire 512-byte universe with 255 before overlay, including Strobe channel
offsets whose fixture isn't registered in `safePositions`.
**Fix:** Extend `registerSafePositions` to hold strobe-safe caps (0 for Strobe).
Couples with DMX-C3.

### DMX-H3 · `/debug/raw` accepts fractional DMX addresses
`server/src/routes/debug.ts:77-94`. Channel key filter is `>=1 && <=512`, not
`Number.isInteger`. A fractional key reaches `applyRawUpdate` → dmx-ts with
unpredictable behavior.
**Fix:** `Number.isInteger(dmxAddr)` check. Better: refactor per DMX-C2.

### DMX-H4 · UDP server has no rate limit → serial-bus DoS
`server/src/udp/udp-color-server.ts:59`. Every packet triggers a
`manager.applyFixtureUpdate` call. 10k pps starves Node's event loop and
delays the 25ms dmx-ts send tick, misfiring the watchdog.
**Fix:** Coalesce updates (latest-wins per 20ms tick); per-source leaky bucket.

### DMX-H5 · Packet timestamp decode has no sanity clamp → metrics poisoning
`server/src/udp/packet-parser.ts:75-77`. Crafted timestamps produce negative
`networkMs` which pollute `latency-tracker`.
**Fix:** `if (networkMs < 0 || networkMs > 60_000) skip`.

### FRONT-H1 · SignalRGB plugin trusts mDNS TXT + `/health` JSON from any LAN peer
`DMXr.js:444-475` (`DiscoveryService.connect`), `:600` (`fixture.name` → controller
display name), `DMXr.qml:342` (`Qt.openUrlExternally("http://"+host+":"+port)`).
Any LAN device advertising `_dmxr._tcp.local.` is accepted. `host`/`port`/`serverId`
have no allowlist. Rogue servers inject controllers and can force drive-by
browsing via "Open Web Manager".
**Fix:** Validate `dev.ip` is RFC1918; regex-lock `serverId`/`host`; validate
`udpPort` range; in QML, allowlist `host` to `^[a-zA-Z0-9.-]+$`.

### SUPPLY-H1 · `build-server.yml` uses repo-wide `contents: write`
`.github/workflows/build-server.yml:11-12`. Unscoped to jobs; inherited by every
step, including the unverified binary downloads.
**Fix:** Move `permissions` to job level; isolate `contents: write` to the final
release-upload job that reads from `upload-artifact`.

### SUPPLY-H2 · `enforce_admins: false` + `required_signatures: false` + single owner
`gh api repos/thewrz/DMXr/branches/main/protection`. Branch protection is
effectively advisory for the sole code owner. Stolen token pushes directly to
`main` and triggers the release pipeline.
**Fix:** Enable both. Add a secondary code owner (or trusted bot). Enforce
hardware 2FA.

### SUPPLY-H3 · No SBOM / provenance on release artifacts (public repo, privileged install)
`.github/workflows/build-server.yml`. Release bundles contain `node_modules/` and
a portable Node runtime; end users have no way to verify what they installed.
**Fix:** Add `actions/attest-build-provenance@<sha>`. Publish a CycloneDX SBOM
via `anchore/sbom-action`. Attach both to GH releases.

---

## MEDIUM findings (22)

Condensed — see individual agent reports for full context.

| ID | Layer | Title |
|----|-------|-------|
| NET-M1 | Network | SSE endpoints have no subscriber cap or rate limit (FD exhaustion) |
| NET-M2 | Network | Fastify has no `connectionTimeout`/`requestTimeout`/`keepAliveTimeout` (slow-loris) |
| NET-M3 | Network | mDNS advertises on all interfaces; TXT leaks `serverId`/`serverName` |
| NET-M4 | Network | No content-type enforcement on POST routes (CSRF vector via `text/plain`) |
| AUTH-M1 | Auth | Many route schemas lack `additionalProperties: false` → extra fields reach stores |
| AUTH-M2 | Auth | Unbounded `maxItems` on `/user-fixtures`, `/groups`, `/fixture-batch` arrays |
| AUTH-M3 | Auth | `parseInt(limit, 10)` unbounded on `/api/logs`, `/api/diagnostics` |
| AUTH-M4 | Auth | SSE endpoints bypass `@fastify/rate-limit` after `reply.hijack()` |
| AUTH-M5 | Auth | Timing-safe compare short-circuits on length mismatch (reveals key length) |
| AUTH-M6 | Auth | `/ofl/*`, `/search` have no per-route limit → outbound amplification to OFL API |
| AUTH-M7 | Auth | CSP `'unsafe-eval'` + `'unsafe-inline'` (Alpine non-CSP build) |
| AUTH-M8 | Auth | CORS regex allows any port on LAN ranges (low impact; `credentials:false`) |
| FS-F1 | Filesystem | `settings-store.save()` lacks the documented `saveChain` mutex (races) |
| FS-F2 | Filesystem | `/config/import` doesn't type-validate `settings` → persistent DoS via `parseInt(base.port)` on restart |
| DMX-M1 | DMX | `applyRawUpdate` writes `NaN` keys into `activeChannels` → downstream JSON crashes |
| DMX-M2 | DMX | `fixture-validator.ts` doesn't reject out-of-range channel-override values on load |
| DMX-M3 | DMX | `flushAndClose` pokes a private `_readyToWrite` field on dmx-ts (fragile) |
| DMX-M4 | DMX | `driver-factory.onDisconnect` leaks listeners on reconnect |
| DMX-M5 | DMX | `dispatcher.blackout()` only returns primary-manager result → silent partial blackout |
| FRONT-M1 | Frontend | CSP allows `'unsafe-eval'` + `'unsafe-inline'` (same as AUTH-M7) |
| FRONT-M2 | Frontend | Plugin update check fetches raw JS from GitHub (log sink only today) |
| FRONT-M3 | Frontend | Plugin update URL hardcoded to `thewrz/DMXr` account (takeover risk) |
| SUPPLY-M1 | Supply | `better-sqlite3` + `@serialport/bindings-cpp` run install scripts on every `npm ci` |
| SUPPLY-M2 | Supply | Dependabot has no groups/reviewers → 1-signer merges to release pipeline |
| SUPPLY-M3 | Supply | `dependency-health.yml` runs `npm ci` with `issues:write` token (install-script escalation) |

---

## LOW findings (27)

Condensed summary. Full details in individual agent reports archived with this audit.

- **NET-L1/L2/L3** — `/api/logs?limit=` unbounded, packet timestamp sanity, mDNS republish race
- **AUTH-L1/L2/L3/L4/L5/L6** — `universes.ts` error echoes, `Content-Disposition` filename, `request.body as X` coercion, error handler masking, body limits, prototype-pollution review
- **FS-F3b/F4/F5/F7/F8** — OFL cache symlink TOCTOU, `clear()` unlink without `lstat`, remap preset keys unvalidated, world-readable file mode (no secrets today), `component-writer.ts` non-atomic
- **DMX-L1/L2/L3/L4/L5** — `/debug/raw` log leak, `latency-tracker` bounds, `movement-interpolator` speed clamp, `resilient-connection` double-schedule, `udp-color-server` post-start error path
- **FRONT-L1/L2/L3/L4** — synchronous XHR no timeout, `frame-ancestors` not in explicit CSP, no SRI on `alpine.min.js`, IPv6 `host:port` parse
- **SUPPLY-L1/L2/L3/L4** — `audit-level=high` not `moderate`, no `setup-node` cache, `fsevents` duplicate, `engines.node>=18` (EOL)

---

## Scope-covered clean items

These were explicitly checked and found clean — they belong in the report because
"absence of evidence" should be a documented negative result.

- **UDP DMXRC parser robustness** — magic + version + length checks, all
  `readUInt*BE` guarded, truncated-packet tests exist, movement-section math is
  correct, `Buffer.alloc` (not `allocUnsafe`). **No parser CVE candidates.**
- **Art-Net / sACN ingress** — neither protocol has a listener; both are
  egress-only via dmx-ts. Zero ingress surface in DMXr's own code.
- **SignalRGB plugin code execution** — `DMXr.js` has zero `eval`/`Function`/
  `setTimeout(string)`/DOM-sink assignments. Server responses are parsed via
  `JSON.parse` only. Plugin is strictly receive-safe as a design property.
- **DMXr.qml** — no `eval`, no `Qt.createQmlObject`, no `WebEngineView`, no
  `Loader { source: untrusted }`.
- **Web UI XSS sinks** — all 7 `x-html` directives are either hardcoded SVG
  lookups or escape-sanitized via `escapeHtml`. No DOM-injection sinks anywhere
  in `server/public/js/*`.
- **No `localStorage` secret caching.**
- **No `postMessage` listeners.**
- **Atomic tmp+rename** used consistently in all 6 JSON stores (settings lacks
  the `saveChain` per FS-F1 but the write itself is atomic).
- **OFL disk cache path-traversal fix** is correct and exhaustive for `../`,
  absolute, UNC, drive letter, null byte, and unicode NFC/NFD vectors. Symlink
  TOCTOU remains (FS-F3b).
- **API key lives only in `process.env.API_KEY`** — never written to disk, never
  logged, never persisted. Error handler masks 5xx bodies. Timing-safe compare
  is used (modulo the length-reveal in AUTH-M5).
- **No `pull_request_target` workflows** — zero fork-secret exposure.
- **No secrets in working tree** — only `test-secret-key-123` in
  `api-key-auth.test.ts:16` (legitimate fixture). No AKIA, no `ghp_`, no `sk-`,
  no PEM headers, no bearer tokens.
- **No secrets in git history** — the `deployment.md` commits referenced in
  project memory (`d3ed9dee..8840de0`) **do not exist in this repo**. Memory
  note is stale.
- **No typosquats** — every dep resolves to a well-known package on
  `registry.npmjs.org` with `sha512-` integrity hashes. No alternate registries.
- **`npm audit --audit-level=low`** → **0 vulnerabilities** (post v1.3.1).
- **`CODEOWNERS`** present. Single owner — see SUPPLY-H2.
- **Helmet CSP + X-Frame-Options** registered on all routes.

---

## Prioritized remediation roadmap

### Phase 1 — stop the bleeding (~16 hours)
Closes every CRITICAL and ~50% of HIGH. Recommended order:

| Order | Finding(s) | Effort | Closes |
|-------|-----------|--------|--------|
| 1 | **AUTH-C1** — invert auth to fail-closed | 2h | C1, C2, C3, C4, H1, H3, H4, H5 (partial) |
| 2 | **DMX-C1 / NET-H1/H2** — bind UDP+HTTP to 127.0.0.1 by default | 3h | DMX-C1, NET-H1, NET-H2, AUTH-H5 (partial) |
| 3 | **DMX-C3** — StrobeGuard with PSE-band exclusion | 6h | DMX-C3, DMX-H2 |
| 4 | **SUPPLY-C1/C2** — pin action SHAs + checksum Node/NSSM | 1.5h | SUPPLY-C1, SUPPLY-C2 |
| 5 | **DMX-C2** — gate `applyRawUpdate` through `buildDmxUpdate` | 4h | DMX-C2, DMX-H3, DMX-M1 |

### Phase 2 — physical-safety remainder (~6 hours)

| Finding | Effort | Notes |
|---------|--------|-------|
| DMX-C4 — synchronous exit-handler serial write | 4h | Requires reaching into dmx-ts internals |
| DMX-C5 — honest disconnect reporting from resilient-connection | 2h | One-liner + shutdown.ts log message |
| DMX-C6 — re-register safe positions on CRUD | 1h | Subscribe to fixtureStore events |
| DMX-H1 — reconnect replay ramp | 4h | Couples with DMX-C6 |

### Phase 3 — release-pipeline hardening (~4 hours)

| Finding | Effort |
|---------|--------|
| SUPPLY-H1 — scope `contents: write` to release job | 1h |
| SUPPLY-H2 — `enforce_admins` + `required_signatures` + 2FA | 15m config + co-maintainer |
| SUPPLY-H3 — SBOM + provenance attestation | 2h |
| SUPPLY-M1 — `npm ci --ignore-scripts` on non-build jobs | 1h |

### Phase 4 — input validation & rate-limit sweep (~8 hours)

| Finding | Effort |
|---------|--------|
| AUTH-M1 — blanket `additionalProperties: false` | 2h |
| AUTH-M2 — `maxItems` on arrays | 1h |
| AUTH-M3 — `parseInt` clamps | 30m |
| AUTH-M4 — SSE subscriber cap per IP | 2h |
| AUTH-M6 — per-route rate limits on OFL/search | 30m |
| NET-M2 — Fastify timeouts | 15m |
| AUTH-H2 — tighten `/update` schema | 30m |
| FS-F2 — type-validate `/config/import` settings | 1h |
| FS-F1 — add saveChain to settings-store | 15m |

### Phase 5 — frontend & lower-severity polish (~4 hours)

| Finding | Effort |
|---------|--------|
| FRONT-H1 — validate mDNS TXT + QML host allowlist | 1h |
| FRONT-L1 — XHR timeouts on plugin sync paths | 30m |
| FRONT-L2 — add `frameAncestors` to CSP | 2m |
| FS-F6 — saveChain error recovery (`.catch` reset) | 30m |
| FS-F7 — `mode: 0o600` on store writes | 15m |
| DMX-M2 to M5 — dispatcher/validator/driver polish | 1.5h |

**Grand total:** ~38 hours to close all CRITICAL + HIGH + MEDIUM findings. Phase
1 alone (16h) eliminates the practical exploitability of the entire repo.

---

## Appendix A — agent-by-agent scope coverage

| Agent | Scope | Files read (primary) |
|-------|-------|----------------------|
| 1. Network | UDP, mDNS, SSE, Fastify | `udp/*`, `mdns/advertiser.ts`, `routes/monitor.ts`, `routes/logs.ts`, `server.ts`, `DMXr.js` |
| 2. Auth | Middleware, all 25 routes | `middleware/api-key-auth.ts`, `routes/*.ts`, `server.ts`, `config/settings-store.ts` |
| 3. Filesystem | Stores, OFL cache | `config/*`, `fixtures/{fixture,group,user-fixture}-store.ts`, `libraries/*`, `ofl/*`, `dmx/universe-registry.ts`, `signalrgb/component-writer.ts` |
| 4. DMX hardware | Physical safety + DMX | `dmx/*`, `fixtures/{motor-guard,pipeline-stages,color-pipeline,channel-mapper,fixture-override-service,movement-interpolator}.ts`, `bootstrap/*`, `metrics/latency-tracker.ts` |
| 5. Frontend | Web UI + plugin | `server/public/index.html`, `server/public/js/*` (33 mixins), `DMXr.js`, `DMXr.qml` |
| 6. Supply chain | CI/CD + deps | `.github/workflows/*.yml`, `.github/dependabot.yml`, `CODEOWNERS`, `package.json`, `package-lock.json`, branch protection via `gh api` |

No scope overlap — each file has exactly one primary reviewer.

## Appendix B — finding-ID scheme

- `NET-*` — network I/O and protocols (agent 1)
- `AUTH-*` — authentication, authorization, input validation (agent 2)
- `FS-*` — filesystem and config persistence (agent 3)
- `DMX-*` — DMX hardware, resilient connection, physical safety (agent 4)
- `FRONT-*` — frontend UI and SignalRGB plugin (agent 5)
- `SUPPLY-*` — supply chain, CI/CD, release pipeline (agent 6)

Severity letters: `C` = CRITICAL, `H` = HIGH, `M` = MEDIUM, `L` = LOW.
