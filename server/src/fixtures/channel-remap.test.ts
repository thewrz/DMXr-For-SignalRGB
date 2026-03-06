import { describe, it, expect } from "vitest";
import { resolveOffset, resolveAddress, validateChannelRemap } from "./channel-remap.js";

describe("resolveOffset", () => {
  it("returns original offset when no remap", () => {
    expect(resolveOffset({}, 1)).toBe(1);
  });

  it("returns original offset when channelRemap is undefined", () => {
    expect(resolveOffset({ channelRemap: undefined }, 1)).toBe(1);
  });

  it("returns original offset when channelRemap is empty", () => {
    expect(resolveOffset({ channelRemap: {} }, 1)).toBe(1);
  });

  it("returns original offset for unmapped channel", () => {
    expect(resolveOffset({ channelRemap: { 0: 1 } }, 3)).toBe(3);
  });

  it("returns remapped offset for mapped channel", () => {
    expect(resolveOffset({ channelRemap: { 1: 2 } }, 1)).toBe(2);
  });

  it("handles bidirectional swap", () => {
    const fixture = { channelRemap: { 1: 2, 2: 1 } };
    expect(resolveOffset(fixture, 1)).toBe(2);
    expect(resolveOffset(fixture, 2)).toBe(1);
    expect(resolveOffset(fixture, 0)).toBe(0); // unmapped stays
  });

  it("handles partial remap (only some channels remapped)", () => {
    const fixture = { channelRemap: { 3: 5 } };
    expect(resolveOffset(fixture, 0)).toBe(0);
    expect(resolveOffset(fixture, 1)).toBe(1);
    expect(resolveOffset(fixture, 3)).toBe(5);
  });
});

describe("resolveAddress", () => {
  it("returns base + offset when no remap", () => {
    expect(resolveAddress({ dmxStartAddress: 10 }, 2)).toBe(12);
  });

  it("returns base + remapped offset", () => {
    const fixture = { dmxStartAddress: 10, channelRemap: { 1: 2, 2: 1 } };
    expect(resolveAddress(fixture, 1)).toBe(12); // 10 + 2
    expect(resolveAddress(fixture, 2)).toBe(11); // 10 + 1
  });

  it("returns base + original offset for unmapped channel", () => {
    const fixture = { dmxStartAddress: 40, channelRemap: { 0: 3 } };
    expect(resolveAddress(fixture, 5)).toBe(45); // 40 + 5 (unmapped)
    expect(resolveAddress(fixture, 0)).toBe(43); // 40 + 3 (remapped)
  });
});

describe("validateChannelRemap", () => {
  it("accepts undefined", () => {
    expect(validateChannelRemap(undefined, 7)).toEqual({ valid: true });
  });

  it("accepts empty object", () => {
    expect(validateChannelRemap({}, 7)).toEqual({ valid: true });
  });

  it("accepts valid identity remap", () => {
    expect(validateChannelRemap({ 0: 0, 1: 1 }, 7)).toEqual({ valid: true });
  });

  it("accepts valid swap", () => {
    expect(validateChannelRemap({ 1: 2, 2: 1 }, 7)).toEqual({ valid: true });
  });

  it("accepts partial remap", () => {
    expect(validateChannelRemap({ 3: 5 }, 7)).toEqual({ valid: true });
  });

  it("rejects source offset out of range (>= channelCount)", () => {
    const result = validateChannelRemap({ 7: 0 }, 7);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Source offset 7");
    expect(result.error).toContain("out of range");
  });

  it("rejects negative source offset", () => {
    const result = validateChannelRemap({ [-1]: 0 }, 7);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("out of range");
  });

  it("rejects target offset out of range", () => {
    const result = validateChannelRemap({ 0: 7 }, 7);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Target offset 7");
    expect(result.error).toContain("out of range");
  });

  it("rejects negative target offset", () => {
    const result = validateChannelRemap({ 0: -1 }, 7);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Target offset -1");
  });

  it("rejects duplicate targets (collision)", () => {
    const result = validateChannelRemap({ 0: 2, 1: 2 }, 7);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Duplicate target offset 2");
  });
});
