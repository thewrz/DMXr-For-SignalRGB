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

describe("parseColorPacket edge cases", () => {
  it("rejects truncated movement data (count byte present but entries missing)", () => {
    const pkt = makeMovementPacket({
      movements: [
        { index: 0, panTarget: 1000, tiltTarget: 2000 },
        { index: 1, panTarget: 3000, tiltTarget: 4000 },
      ],
    });
    const buf = encodeMovementPacket(pkt);
    // Truncate: keep header + color data + movement count byte but cut movement entries
    const colorEnd = 15 + pkt.fixtures.length * 5;
    const truncated = buf.subarray(0, colorEnd + 1); // just the movement count byte
    const result = parseColorPacket(truncated);

    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("truncated");
    }
  });

  it("rejects buffer with FLAG_HAS_MOVEMENT but missing movement count byte", () => {
    // Build a packet with FLAG_HAS_MOVEMENT but exactly at the end of color data
    const pkt = makePacket({ flags: FLAG_HAS_MOVEMENT, fixtures: [] });
    const buf = encodeColorPacket(pkt);
    // buf is exactly 15 bytes (header only, 0 fixtures), and has FLAG_HAS_MOVEMENT
    // but no room for movement count byte
    buf[3] = FLAG_HAS_MOVEMENT;

    const result = parseColorPacket(buf);

    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("missing movement count byte");
    }
  });

  it("handles exactly 15 bytes (minimum valid header, 0 fixtures)", () => {
    const pkt = makePacket({ fixtures: [] });
    const buf = encodeColorPacket(pkt);
    const result = parseColorPacket(buf);

    expect(isParseError(result)).toBe(false);
    if (!isParseError(result)) {
      expect(result.fixtures).toHaveLength(0);
    }
  });

  it("parses combined PING + BLACKOUT flags", () => {
    const buf = encodeColorPacket(makePacket({ flags: FLAG_PING | FLAG_BLACKOUT }));
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.flags & FLAG_PING).toBe(FLAG_PING);
      expect(parsed.flags & FLAG_BLACKOUT).toBe(FLAG_BLACKOUT);
    }
  });

  it("handles sequence 0 (minimum)", () => {
    const buf = encodeColorPacket(makePacket({ sequence: 0 }));
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.sequence).toBe(0);
    }
  });

  it("handles timestamp 0", () => {
    const buf = encodeColorPacket(makePacket({ timestamp: 0 }));
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.timestamp).toBe(0);
    }
  });

  it("handles large timestamp near Number.MAX_SAFE_INTEGER region", () => {
    const largeTs = 2_000_000_000_000; // 2033 era
    const buf = encodeColorPacket(makePacket({ timestamp: largeTs }));
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.timestamp).toBe(largeTs);
    }
  });

  it("handles fixture with index 255 (max)", () => {
    const pkt = makePacket({
      fixtures: [{ index: 255, r: 0, g: 0, b: 0, brightness: 0 }],
    });
    const buf = encodeColorPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.fixtures[0].index).toBe(255);
    }
  });

  it("handles fixture with all zero color values", () => {
    const pkt = makePacket({
      fixtures: [{ index: 0, r: 0, g: 0, b: 0, brightness: 0 }],
    });
    const buf = encodeColorPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.fixtures[0]).toEqual({ index: 0, r: 0, g: 0, b: 0, brightness: 0 });
    }
  });

  it("handles fixture with all max color values", () => {
    const pkt = makePacket({
      fixtures: [{ index: 0, r: 255, g: 255, b: 255, brightness: 255 }],
    });
    const buf = encodeColorPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.fixtures[0]).toEqual({ index: 0, r: 255, g: 255, b: 255, brightness: 255 });
    }
  });

  it("rejects buffer that is exactly 14 bytes (one short of header)", () => {
    const result = parseColorPacket(Buffer.alloc(14));
    expect(isParseError(result)).toBe(true);
  });

  it("rejects empty buffer", () => {
    const result = parseColorPacket(Buffer.alloc(0));
    expect(isParseError(result)).toBe(true);
    if (isParseError(result)) {
      expect(result.error).toContain("too short");
    }
  });

  it("tolerates extra bytes after valid color packet (no movement flag)", () => {
    const pkt = makePacket();
    const buf = encodeColorPacket(pkt);
    // Append garbage bytes
    const extended = Buffer.concat([buf, Buffer.from([0xFF, 0xFF, 0xFF])]);
    const parsed = parseColorPacket(extended);

    expect(isParseError(parsed)).toBe(false);
    if (!isParseError(parsed)) {
      expect(parsed.fixtures).toHaveLength(1);
    }
  });
});

describe("encodeMovementPacket edge cases", () => {
  it("encodes movement with panTarget and tiltTarget of 0", () => {
    const pkt = makeMovementPacket({
      movements: [{ index: 0, panTarget: 0, tiltTarget: 0 }],
    });
    const buf = encodeMovementPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isMovementPacket(parsed)).toBe(true);
    if (isMovementPacket(parsed)) {
      expect(parsed.movements[0].panTarget).toBe(0);
      expect(parsed.movements[0].tiltTarget).toBe(0);
    }
  });

  it("round-trips many movement entries", () => {
    const movements = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      panTarget: i * 100,
      tiltTarget: 65535 - i * 100,
    }));
    const pkt = makeMovementPacket({ movements });
    const buf = encodeMovementPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isMovementPacket(parsed)).toBe(true);
    if (isMovementPacket(parsed)) {
      expect(parsed.movements).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(parsed.movements[i].index).toBe(i);
        expect(parsed.movements[i].panTarget).toBe(i * 100);
        expect(parsed.movements[i].tiltTarget).toBe(65535 - i * 100);
      }
    }
  });

  it("handles zero color fixtures with movement entries", () => {
    const pkt: MovementPacket = {
      version: 1,
      flags: FLAG_HAS_MOVEMENT,
      sequence: 1,
      timestamp: 1000,
      fixtures: [],
      movements: [{ index: 0, panTarget: 500, tiltTarget: 600 }],
    };
    const buf = encodeMovementPacket(pkt);
    const parsed = parseColorPacket(buf);

    expect(isMovementPacket(parsed)).toBe(true);
    if (isMovementPacket(parsed)) {
      expect(parsed.fixtures).toHaveLength(0);
      expect(parsed.movements).toHaveLength(1);
      expect(parsed.movements[0].panTarget).toBe(500);
    }
  });
});

describe("isMovementPacket / isParseError type guards", () => {
  it("isMovementPacket returns false for objects without movements key", () => {
    const plain: ColorPacket = makePacket();
    expect(isMovementPacket(plain)).toBe(false);
  });

  it("isParseError returns false for movement packets", () => {
    const pkt = makeMovementPacket();
    expect(isParseError(pkt)).toBe(false);
  });
});
