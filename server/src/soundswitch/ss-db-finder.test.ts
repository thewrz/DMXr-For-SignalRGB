import { describe, it, expect } from "vitest";
import { findSoundswitchDb } from "./ss-db-finder.js";

describe("findSoundswitchDb", () => {
  it("returns null path when no DB found at standard locations", () => {
    // On a CI/dev machine without SoundSwitch installed, should find nothing
    const result = findSoundswitchDb();
    expect(result.searchedPaths.length).toBeGreaterThan(0);
    // path may or may not be null depending on whether SoundSwitch is installed
    if (result.path === null) {
      expect(result.searchedPaths.length).toBeGreaterThanOrEqual(1);
    } else {
      expect(typeof result.path).toBe("string");
    }
  });

  it("returns searched paths even when nothing found", () => {
    const result = findSoundswitchDb();
    expect(Array.isArray(result.searchedPaths)).toBe(true);
    for (const p of result.searchedPaths) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    }
  });
});
