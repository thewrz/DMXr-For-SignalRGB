/**
 * DMXRC binary protocol — compact color transport over UDP.
 *
 * Packet layout:
 *   Offset  Size  Field
 *   0       2     magic         0x44 0x58 ("DX")
 *   2       1     version       0x01
 *   3       1     flags         bit0=ping, bit1=blackout
 *   4       2     sequence      uint16 BE
 *   6       8     timestamp     uint64 BE (Date.now())
 *   14      1     fixture_count 0-255
 *   15      N×5   fixtures      [index:1][r:1][g:1][b:1][brightness:1]
 *
 * Total: 15 + (count × 5) bytes
 */

const MAGIC_0 = 0x44; // 'D'
const MAGIC_1 = 0x58; // 'X'
const PROTOCOL_VERSION = 0x01;
const HEADER_SIZE = 15;
const FIXTURE_ENTRY_SIZE = 5;
const MOVEMENT_ENTRY_SIZE = 5;

export const FLAG_PING = 0x01;
export const FLAG_BLACKOUT = 0x02;
export const FLAG_HAS_MOVEMENT = 0x04;

export interface FixtureColorEntry {
  readonly index: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly brightness: number;
}

export interface ColorPacket {
  readonly version: number;
  readonly flags: number;
  readonly sequence: number;
  readonly timestamp: number;
  readonly fixtures: readonly FixtureColorEntry[];
}

export interface MovementEntry {
  readonly index: number;
  readonly panTarget: number;   // uint16, 0xFFFF = no change
  readonly tiltTarget: number;  // uint16, 0xFFFF = no change
}

export interface MovementPacket extends ColorPacket {
  readonly movements: readonly MovementEntry[];
}

export interface ParseError {
  readonly error: string;
}

export function parseColorPacket(buf: Buffer): ColorPacket | MovementPacket | ParseError {
  if (buf.length < HEADER_SIZE) {
    return { error: `packet too short: ${buf.length} bytes (minimum ${HEADER_SIZE})` };
  }

  if (buf[0] !== MAGIC_0 || buf[1] !== MAGIC_1) {
    return { error: `invalid magic: 0x${buf[0].toString(16)}${buf[1].toString(16)}` };
  }

  const version = buf[2];

  if (version !== PROTOCOL_VERSION) {
    return { error: `unsupported version: ${version}` };
  }

  const flags = buf[3];
  const sequence = buf.readUInt16BE(4);
  const high = buf.readUInt32BE(6);
  const low = buf.readUInt32BE(10);
  const timestamp = high * 0x100000000 + low;
  const fixtureCount = buf[14];

  const expectedLength = HEADER_SIZE + fixtureCount * FIXTURE_ENTRY_SIZE;

  if (buf.length < expectedLength) {
    return {
      error: `packet truncated: got ${buf.length} bytes, expected ${expectedLength} for ${fixtureCount} fixtures`,
    };
  }

  const fixtures: FixtureColorEntry[] = [];

  for (let i = 0; i < fixtureCount; i++) {
    const offset = HEADER_SIZE + i * FIXTURE_ENTRY_SIZE;
    fixtures.push({
      index: buf[offset],
      r: buf[offset + 1],
      g: buf[offset + 2],
      b: buf[offset + 3],
      brightness: buf[offset + 4],
    });
  }

  if (flags & FLAG_HAS_MOVEMENT) {
    const movementCountOffset = HEADER_SIZE + fixtureCount * FIXTURE_ENTRY_SIZE;

    if (buf.length < movementCountOffset + 1) {
      return { error: `packet truncated: missing movement count byte` };
    }

    const movementCount = buf[movementCountOffset];
    const movementDataOffset = movementCountOffset + 1;
    const expectedMovementLength = movementDataOffset + movementCount * MOVEMENT_ENTRY_SIZE;

    if (buf.length < expectedMovementLength) {
      return {
        error: `packet truncated: got ${buf.length} bytes, expected ${expectedMovementLength} for ${movementCount} movement entries`,
      };
    }

    const movements: MovementEntry[] = [];

    for (let i = 0; i < movementCount; i++) {
      const offset = movementDataOffset + i * MOVEMENT_ENTRY_SIZE;
      movements.push({
        index: buf[offset],
        panTarget: buf.readUInt16BE(offset + 1),
        tiltTarget: buf.readUInt16BE(offset + 3),
      });
    }

    return { version, flags, sequence, timestamp, fixtures, movements };
  }

  return { version, flags, sequence, timestamp, fixtures };
}

export function encodeColorPacket(packet: ColorPacket): Buffer {
  const buf = Buffer.alloc(HEADER_SIZE + packet.fixtures.length * FIXTURE_ENTRY_SIZE);

  buf[0] = MAGIC_0;
  buf[1] = MAGIC_1;
  buf[2] = packet.version;
  buf[3] = packet.flags;
  buf.writeUInt16BE(packet.sequence, 4);
  buf.writeUInt32BE(Math.floor(packet.timestamp / 0x100000000), 6);
  buf.writeUInt32BE(packet.timestamp >>> 0, 10);
  buf[14] = packet.fixtures.length;

  for (let i = 0; i < packet.fixtures.length; i++) {
    const entry = packet.fixtures[i];
    const offset = HEADER_SIZE + i * FIXTURE_ENTRY_SIZE;
    buf[offset] = entry.index;
    buf[offset + 1] = entry.r;
    buf[offset + 2] = entry.g;
    buf[offset + 3] = entry.b;
    buf[offset + 4] = entry.brightness;
  }

  return buf;
}

export function encodeMovementPacket(packet: MovementPacket): Buffer {
  const colorSize = HEADER_SIZE + packet.fixtures.length * FIXTURE_ENTRY_SIZE;
  const movementSize = 1 + packet.movements.length * MOVEMENT_ENTRY_SIZE;
  const buf = Buffer.alloc(colorSize + movementSize);

  buf[0] = MAGIC_0;
  buf[1] = MAGIC_1;
  buf[2] = packet.version;
  buf[3] = packet.flags;
  buf.writeUInt16BE(packet.sequence, 4);
  buf.writeUInt32BE(Math.floor(packet.timestamp / 0x100000000), 6);
  buf.writeUInt32BE(packet.timestamp >>> 0, 10);
  buf[14] = packet.fixtures.length;

  for (let i = 0; i < packet.fixtures.length; i++) {
    const entry = packet.fixtures[i];
    const offset = HEADER_SIZE + i * FIXTURE_ENTRY_SIZE;
    buf[offset] = entry.index;
    buf[offset + 1] = entry.r;
    buf[offset + 2] = entry.g;
    buf[offset + 3] = entry.b;
    buf[offset + 4] = entry.brightness;
  }

  const movementCountOffset = colorSize;
  buf[movementCountOffset] = packet.movements.length;

  for (let i = 0; i < packet.movements.length; i++) {
    const entry = packet.movements[i];
    const offset = movementCountOffset + 1 + i * MOVEMENT_ENTRY_SIZE;
    buf[offset] = entry.index;
    buf.writeUInt16BE(entry.panTarget, offset + 1);
    buf.writeUInt16BE(entry.tiltTarget, offset + 3);
  }

  return buf;
}

export function isMovementPacket(result: ColorPacket | MovementPacket | ParseError): result is MovementPacket {
  return "movements" in result;
}

export function isParseError(result: ColorPacket | MovementPacket | ParseError): result is ParseError {
  return "error" in result;
}
