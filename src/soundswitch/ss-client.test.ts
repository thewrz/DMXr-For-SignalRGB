import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mapSsType, createSsClientIfConfigured, createSsClient } from "./ss-client.js";
import type { SsClient } from "./ss-client.js";

describe("mapSsType", () => {
  it("maps type 1 to Intensity", () => {
    expect(mapSsType(1)).toEqual({ type: "Intensity" });
  });

  it("maps type 2 to ColorWheel", () => {
    expect(mapSsType(2)).toEqual({ type: "ColorWheel" });
  });

  it("maps type 3 to Pan", () => {
    expect(mapSsType(3)).toEqual({ type: "Pan" });
  });

  it("maps type 4 to Tilt", () => {
    expect(mapSsType(4)).toEqual({ type: "Tilt" });
  });

  it("maps type 5 to Iris", () => {
    expect(mapSsType(5)).toEqual({ type: "Iris" });
  });

  it("maps type 6 to Focus", () => {
    expect(mapSsType(6)).toEqual({ type: "Focus" });
  });

  it("maps type 7 to Prism", () => {
    expect(mapSsType(7)).toEqual({ type: "Prism" });
  });

  it("maps type 8 (static gobo) to Gobo", () => {
    expect(mapSsType(8)).toEqual({ type: "Gobo" });
  });

  it("maps type 9 (rotating gobo) to Gobo", () => {
    expect(mapSsType(9)).toEqual({ type: "Gobo" });
  });

  it("maps type 11 to Cyan", () => {
    expect(mapSsType(11)).toEqual({ type: "ColorIntensity", color: "Cyan" });
  });

  it("maps type 12 to Magenta", () => {
    expect(mapSsType(12)).toEqual({ type: "ColorIntensity", color: "Magenta" });
  });

  it("maps type 13 to Yellow", () => {
    expect(mapSsType(13)).toEqual({ type: "ColorIntensity", color: "Yellow" });
  });

  it("maps type 14 to Red", () => {
    expect(mapSsType(14)).toEqual({ type: "ColorIntensity", color: "Red" });
  });

  it("maps type 15 to Green", () => {
    expect(mapSsType(15)).toEqual({ type: "ColorIntensity", color: "Green" });
  });

  it("maps type 16 to Blue", () => {
    expect(mapSsType(16)).toEqual({ type: "ColorIntensity", color: "Blue" });
  });

  it("maps type 41 to Strobe", () => {
    expect(mapSsType(41)).toEqual({ type: "Strobe" });
  });

  it("maps type 53 to Zoom", () => {
    expect(mapSsType(53)).toEqual({ type: "Zoom" });
  });

  it("maps type 64 to ShutterStrobe", () => {
    expect(mapSsType(64)).toEqual({ type: "ShutterStrobe" });
  });

  it("maps type 87 to White", () => {
    expect(mapSsType(87)).toEqual({ type: "ColorIntensity", color: "White" });
  });

  it("maps type 105 to Amber", () => {
    expect(mapSsType(105)).toEqual({ type: "ColorIntensity", color: "Amber" });
  });

  it("maps type 106 to UV", () => {
    expect(mapSsType(106)).toEqual({ type: "ColorIntensity", color: "UV" });
  });

  it("maps explicit Generic codes to Generic", () => {
    expect(mapSsType(17)).toEqual({ type: "Generic" }); // Pan/Tilt Speed
    expect(mapSsType(20)).toEqual({ type: "Generic" }); // Lamp Control
    expect(mapSsType(21)).toEqual({ type: "Generic" }); // Reset
    expect(mapSsType(82)).toEqual({ type: "Generic" });
    expect(mapSsType(83)).toEqual({ type: "Generic" });
    expect(mapSsType(84)).toEqual({ type: "Generic" });
    expect(mapSsType(85)).toEqual({ type: "Generic" });
    expect(mapSsType(88)).toEqual({ type: "Generic" }); // Mode/Effect
  });

  it("maps unknown types to Generic", () => {
    expect(mapSsType(999)).toEqual({ type: "Generic" });
    expect(mapSsType(0)).toEqual({ type: "Generic" });
  });
});

const SS_DB_PATH = "sscloud.db";
const hasDb = existsSync(SS_DB_PATH);

describe.skipIf(!hasDb)("searchFixtures (integration)", () => {
  let client: SsClient;

  beforeEach(() => {
    client = createSsClient(SS_DB_PATH);
  });

  afterEach(() => {
    client.close();
  });

  it("returns matching fixtures for a model query", () => {
    const results = client.searchFixtures("SLM70");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].fixtureName.toLowerCase()).toContain("slm70");
    expect(results[0].mfrName).toBeDefined();
    expect(results[0].modeCount).toBeGreaterThanOrEqual(0);
  });

  it("multi-token search narrows results (AND logic)", () => {
    const broad = client.searchFixtures("LED");
    const narrow = client.searchFixtures("LED Stage");
    expect(broad.length).toBeGreaterThanOrEqual(narrow.length);
  });

  it("returns empty for no matches", () => {
    const results = client.searchFixtures("zzzznonexistentzzzz");
    expect(results).toEqual([]);
  });

  it("returns empty for too-short tokens", () => {
    const results = client.searchFixtures("a b");
    expect(results).toEqual([]);
  });

  it("respects limit parameter", () => {
    const results = client.searchFixtures("LED", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("includes category derived from attr types", () => {
    const results = client.searchFixtures("SLM70");
    expect(results.length).toBeGreaterThan(0);
    // SLM70S has Pan + Tilt attrs → "Moving Head"
    expect(results[0].category).toBe("Moving Head");
  });
});

describe("createSsClientIfConfigured", () => {
  it("returns not_configured status when dbPath is undefined", () => {
    const result = createSsClientIfConfigured(undefined);
    expect(result.client).toBeNull();
    expect(result.status.available).toBe(false);
    expect(result.status.state).toBe("not_configured");
  });

  it("returns not_configured status when dbPath is empty string", () => {
    const result = createSsClientIfConfigured("");
    expect(result.client).toBeNull();
    expect(result.status.available).toBe(false);
    expect(result.status.state).toBe("not_configured");
  });

  it("returns error status when dbPath points to nonexistent file", () => {
    const result = createSsClientIfConfigured("/nonexistent/path/sscloud.db");
    expect(result.client).toBeNull();
    expect(result.status.available).toBe(false);
    expect(result.status.path).toBe("/nonexistent/path/sscloud.db");
    expect(result.status.error).toBeDefined();
  });
});
