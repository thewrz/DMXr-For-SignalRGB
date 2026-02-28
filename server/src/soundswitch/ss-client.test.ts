import { describe, it, expect } from "vitest";
import { mapSsType, createSsClientIfConfigured } from "./ss-client.js";

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
