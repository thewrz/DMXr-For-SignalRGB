import { describe, it, expect } from "vitest";
import { shortId } from "./format.js";

describe("shortId", () => {
  it("returns first 8 chars of a UUID", () => {
    const result = shortId("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result).toBe("a1b2c3d4");
  });

  it("returns empty string for empty input", () => {
    expect(shortId("")).toBe("");
  });

  it("returns full string when shorter than 8 chars", () => {
    expect(shortId("abc")).toBe("abc");
  });

  it("handles typical UUID", () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

    const result = shortId(uuid);

    expect(result).toBe("a1b2c3d4");
    expect(result).toHaveLength(8);
  });
});
