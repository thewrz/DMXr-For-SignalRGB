import { describe, it, expect } from "vitest";
import {
  parseColorPacket,
  encodeColorPacket,
  encodeMovementPacket,
  isParseError,
  isMovementPacket,
  FLAG_PING,
  FLAG_BLACKOUT,
  FLAG_HAS_MOVEMENT,
  type ColorPacket,
  type MovementPacket,
} from "./packet-parser.js";

function makePacket(overrides: Partial<ColorPacket> = {}): ColorPacket {
  return {
    version: 1,
    flags: 0,
    sequence: 42,
    timestamp: 1709400000000,
    fixtures: [
      { index: 0, r: 255, g: 128, b: 64, brightness: 200 },
    ],
    ...overrides,
  };
}

describe("encodeColorPacket", () => {
  it("encodes a single-fixture packet to correct size", () => {
    const buf = encodeColorPacket(makePacket());
    expect(buf.length).toBe(20); // 15 header + 5 per fixture
  });

  it("encodes magic bytes", () => {
    const buf = encodeColorPacket(makePacket());
    expect(buf[0]).toBe(0x44);
    expect(buf[1]).toBe(0x58);
  });

  it("encodes version", () => {
    const buf = encodeColorPacket(makePacket());
    expect(buf[2]).toBe(1);
  });

  it("encodes flags", () => {
    const buf = encodeColorPacket(makePacket({ flags: FLAG_PING | FLAG_BLACKOUT }));
    expect(buf[3]).toBe(0x03);
  });

  it("encodes sequence as uint16 BE", () => {
    const buf = encodeColorPacket(makePacket({ sequence: 0x1234 }));
    expect(buf[4]).toBe(0x12);
    expect(buf[5]).toBe(0x34);
  });

  it("encodes timestamp as uint64 BE", () => {
    const ts = 1709400000000;
    const buf = encodeColorPacket(makePacket({ timestamp: ts }));
    const high = buf.readUInt32BE(6);
    const low = buf.readUInt32BE(10);
    expect(high * 0x100000000 + low).toBe(ts);
  });

  it("encodes fixture count", () => {
    const buf = encodeColorPacket(makePacket({
      fixtures: [
        { index: 0, r: 255, g: 0, b: 0, brightness: 255 },
        { index: 1, r: 0, g: 255, b: 0, brightness: 128 },
        { index: 2, r: 0, g: 0, b: 255, brightness: 64 },
      ],
    }));
    expect(buf[14]).toBe(3);
    expect(buf.length).toBe(30); // 15 + 3*5
  });

  it("encodes fixture data correctly", () => {
    const buf = encodeColorPacket(makePacket({
      fixtures: [{ index: 3, r: 100, g: 150, b: 200, brightness: 250 }],
    }));
    expect(buf[15]).toBe(3);   // index
    expect(buf[16]).toBe(100); // r
    expect(buf[17]).toBe(150); // g
    expect(buf[18]).toBe(200); // b
    expect(buf[19]).toBe(250); // brightness
  });

  it("encodes empty fixture list", () => {
    const buf = encodeColorPacket(makePacket({ fixtures: [] }));
    expect(buf.length).toBe(15);
    expect(buf[14]).toBe(0);
  });
});

describe("parseColorPacket", () => {
  it("round-trips encode/parse", () => {
    const original = makePacket();
    const buf = encodeColorPacket(original);
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.version).toBe(original.version);
      expect(parsed.flags).toBe(original.flags);
      expect(parsed.sequence).toBe(original.sequence);
      expect(parsed.timestamp).toBe(original.timestamp);
      expect(parsed.fixtures).toEqual(original.fixtures);
    }
  });

  it("rejects too-short buffer", () => {
    const result = parseColorPacket(Buffer.alloc(10));
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("too short");
    }
  });

  it("rejects invalid magic bytes", () => {
    const buf = encodeColorPacket(makePacket());
    buf[0] = 0x00;
    const result = parseColorPacket(buf);
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("invalid magic");
    }
  });

  it("rejects unsupported version", () => {
    const buf = encodeColorPacket(makePacket());
    buf[2] = 0x99;
    const result = parseColorPacket(buf);
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("unsupported version");
    }
  });

  it("rejects truncated fixture data", () => {
    const buf = encodeColorPacket(makePacket({
      fixtures: [
        { index: 0, r: 255, g: 0, b: 0, brightness: 255 },
        { index: 1, r: 0, g: 255, b: 0, brightness: 128 },
      ],
    }));
    // Truncate: remove last 3 bytes so second fixture is incomplete
    const truncated = buf.subarray(0, buf.length - 3);
    const result = parseColorPacket(truncated);
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("truncated");
    }
  });

  it("parses ping flag", () => {
    const buf = encodeColorPacket(makePacket({ flags: FLAG_PING }));
    const parsed = parseColorPacket(buf);
    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.flags & FLAG_PING).toBe(FLAG_PING);
    }
  });

  it("parses blackout flag", () => {
    const buf = encodeColorPacket(makePacket({ flags: FLAG_BLACKOUT }));
    const parsed = parseColorPacket(buf);
    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.flags & FLAG_BLACKOUT).toBe(FLAG_BLACKOUT);
    }
  });

  it("handles sequence wrap at 65535", () => {
    const buf = encodeColorPacket(makePacket({ sequence: 65535 }));
    const parsed = parseColorPacket(buf);
    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.sequence).toBe(65535);
    }
  });

  it("parses multiple fixtures", () => {
    const fixtures = [
      { index: 0, r: 255, g: 0, b: 0, brightness: 255 },
      { index: 1, r: 0, g: 255, b: 0, brightness: 200 },
      { index: 2, r: 0, g: 0, b: 255, brightness: 100 },
      { index: 3, r: 128, g: 128, b: 128, brightness: 50 },
    ];
    const buf = encodeColorPacket(makePacket({ fixtures }));
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.fixtures).toHaveLength(4);
      expect(parsed.fixtures).toEqual(fixtures);
    }
  });
});

describe("isParseError", () => {
  it("returns true for error objects", () => {
    expect(isParseError({ error: "bad" })).toBe(true);
  });

  it("returns false for valid packets", () => {
    expect(isParseError(makePacket())).toBe(false);
  });
});

function makeMovementPacket(overrides: Partial<MovementPacket> = {}): MovementPacket {
  return {
    version: 1,
    flags: FLAG_HAS_MOVEMENT,
    sequence: 100,
    timestamp: 1709400000000,
    fixtures: [
      { index: 0, r: 255, g: 128, b: 64, brightness: 200 },
    ],
    movements: [
      { index: 0, panTarget: 32768, tiltTarget: 16384 },
    ],
    ...overrides,
  };
}

describe("encodeMovementPacket / parseColorPacket with movement", () => {
  it("round-trips a movement packet", () => {
    const original = makeMovementPacket();
    const buf = encodeMovementPacket(original);
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    expect(isMovementPacket(parsed)).toBe(true);
    if (isMovementPacket(parsed)) {
      expect(parsed.version).toBe(original.version);
      expect(parsed.flags).toBe(original.flags);
      expect(parsed.sequence).toBe(original.sequence);
      expect(parsed.timestamp).toBe(original.timestamp);
      expect(parsed.fixtures).toEqual(original.fixtures);
      expect(parsed.movements).toEqual(original.movements);
    }
  });

  it("backward compatibility: old packet without FLAG_HAS_MOVEMENT parses as ColorPacket", () => {
    const original = makePacket(); // no FLAG_HAS_MOVEMENT
    const buf = encodeColorPacket(original);
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    expect(isMovementPacket(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.fixtures).toEqual(original.fixtures);
    }
  });

  it("encodes correct size with movement entries", () => {
    const pkt = makeMovementPacket({
      movements: [
        { index: 0, panTarget: 1000, tiltTarget: 2000 },
        { index: 1, panTarget: 3000, tiltTarget: 4000 },
      ],
    });
    const buf = encodeMovementPacket(pkt);
    // 15 header + 1*5 color + 1 movement count + 2*5 movement = 31
    expect(buf.length).toBe(31);
  });

  it("preserves 0xFFFF sentinel values", () => {
    const pkt = makeMovementPacket({
      movements: [
        { index: 0, panTarget: 0xFFFF, tiltTarget: 0xFFFF },
      ],
    });
    const buf = encodeMovementPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isMovementPacket(parsed)).toBe(true);
    if (isMovementPacket(parsed)) {
      expect(parsed.movements[0].panTarget).toBe(0xFFFF);
      expect(parsed.movements[0].tiltTarget).toBe(0xFFFF);
    }
  });

  it("handles mixed color and movement data", () => {
    const pkt = makeMovementPacket({
      fixtures: [
        { index: 0, r: 255, g: 0, b: 0, brightness: 255 },
        { index: 1, r: 0, g: 255, b: 0, brightness: 128 },
        { index: 2, r: 0, g: 0, b: 255, brightness: 64 },
      ],
      movements: [
        { index: 0, panTarget: 100, tiltTarget: 200 },
        { index: 2, panTarget: 0xFFFF, tiltTarget: 500 },
      ],
    });
    const buf = encodeMovementPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isMovementPacket(parsed)).toBe(true);
    if (isMovementPacket(parsed)) {
      expect(parsed.fixtures).toHaveLength(3);
      expect(parsed.movements).toHaveLength(2);
      expect(parsed.movements[0]).toEqual({ index: 0, panTarget: 100, tiltTarget: 200 });
      expect(parsed.movements[1]).toEqual({ index: 2, panTarget: 0xFFFF, tiltTarget: 500 });
    }
  });

  it("handles empty movement list with flag set", () => {
    const pkt = makeMovementPacket({ movements: [] });
    const buf = encodeMovementPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isMovementPacket(parsed)).toBe(true);
    if (isMovementPacket(parsed)) {
      expect(parsed.movements).toHaveLength(0);
    }
  });
});

describe("isMovementPacket", () => {
  it("returns true for movement packets", () => {
    const pkt = makeMovementPacket();
    const buf = encodeMovementPacket(pkt);
    const parsed = parseColorPacket(buf);
    expect(isMovementPacket(parsed)).toBe(true);
  });

  it("returns false for plain color packets", () => {
    const pkt = makePacket();
    const buf = encodeColorPacket(pkt);
    const parsed = parseColorPacket(buf);
    expect(isMovementPacket(parsed)).toBe(false);
  });

  it("returns false for parse errors", () => {
    expect(isMovementPacket({ error: "bad" })).toBe(false);
  });
});
