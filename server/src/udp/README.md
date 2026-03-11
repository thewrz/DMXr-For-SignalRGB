# udp/ — DMXRC Binary Protocol & UDP Color Server

## DMXRC Protocol Spec (packet-parser.ts)

Compact binary protocol for real-time color transport from SignalRGB plugin.

```
Offset  Size  Field
0       2     magic           0x44 0x58 ("DX")
2       1     version         0x01
3       1     flags           bit0=ping, bit1=blackout, bit2=has_movement
4       2     sequence        uint16 BE
6       8     timestamp       uint64 BE (Date.now() from sender)
14      1     fixture_count   0-255
15      N*5   fixtures        [index:1][r:1][g:1][b:1][brightness:1]
```

When `FLAG_HAS_MOVEMENT` is set, an additional movement section follows:
```
+0      1     movement_count
+1      M*5   movements       [index:1][panTarget:2 BE][tiltTarget:2 BE]
```

Exports: `parseColorPacket`, `encodeColorPacket`, `encodeMovementPacket`,
`isParseError`, `isMovementPacket`, `FLAG_PING`, `FLAG_BLACKOUT`, `FLAG_HAS_MOVEMENT`

## UDP Color Server (udp-color-server.ts)

- `createUdpColorServer(deps)` -> `UdpColorServer { start, close, getStats, getPort }`
- Binds a UDP4 socket; processes incoming DMXRC packets
- Feeds parsed colors through `processColorBatch` / `processColorBatchMulti`
- Forwards movement entries to `MovementEngine.setTarget()`
- Handles ping echo, blackout flag, sequence gap detection
- Records network latency and color-map timing to `LatencyTracker`
- Tracks stats: packetsReceived, packetsProcessed, parseErrors, sequenceGaps
