import { describe, it, expect } from "vitest";
import { mapSsType, createSsClientIfConfigured } from "./ss-client.js";

describe("mapSsType", () => {
  it("maps type 1 to Intensity", () => {
    expect(mapSsType(1)).toEqual({ type: "Intensity" });
  });

  it("maps type 3 to Pan", () => {
    expect(mapSsType(3)).toEqual({ type: "Pan" });
  });

  it("maps type 4 to Tilt", () => {
    expect(mapSsType(4)).toEqual({ type: "Tilt" });
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

  it("maps type 87 to White", () => {
    expect(mapSsType(87)).toEqual({ type: "ColorIntensity", color: "White" });
  });

  it("maps type 41 to Strobe", () => {
    expect(mapSsType(41)).toEqual({ type: "Strobe" });
  });

  it("maps unknown types to Generic", () => {
    expect(mapSsType(82)).toEqual({ type: "Generic" });
    expect(mapSsType(83)).toEqual({ type: "Generic" });
    expect(mapSsType(999)).toEqual({ type: "Generic" });
  });
});

describe("createSsClientIfConfigured", () => {
  it("returns null when dbPath is undefined", () => {
    expect(createSsClientIfConfigured(undefined)).toBeNull();
  });

  it("returns null when dbPath is empty string", () => {
    expect(createSsClientIfConfigured("")).toBeNull();
  });
});
