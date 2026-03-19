import { describe, it, expect } from "vitest";
import {
  addFixtureSchema,
  updateFixtureSchema,
  duplicateFixtureSchema,
} from "./fixture-schemas.js";

describe("addFixtureSchema", () => {
  it("requires name, mode, dmxStartAddress, channelCount, channels", () => {
    expect(addFixtureSchema.body.required).toEqual([
      "name",
      "mode",
      "dmxStartAddress",
      "channelCount",
      "channels",
    ]);
  });

  it("dmxStartAddress has minimum 1", () => {
    expect(addFixtureSchema.body.properties.dmxStartAddress.minimum).toBe(1);
  });

  it("dmxStartAddress has maximum 512", () => {
    expect(addFixtureSchema.body.properties.dmxStartAddress.maximum).toBe(512);
  });
});

describe("updateFixtureSchema", () => {
  it("includes channelOverrides property", () => {
    expect(updateFixtureSchema.body.properties).toHaveProperty(
      "channelOverrides",
    );
  });

  it("includes channelRemap property", () => {
    expect(updateFixtureSchema.body.properties).toHaveProperty("channelRemap");
  });

  it("includes colorCalibration property", () => {
    expect(updateFixtureSchema.body.properties).toHaveProperty(
      "colorCalibration",
    );
  });
});

describe("duplicateFixtureSchema", () => {
  it("has dmxStartAddress property", () => {
    expect(duplicateFixtureSchema.body.properties).toHaveProperty(
      "dmxStartAddress",
    );
  });

  it("has name property", () => {
    expect(duplicateFixtureSchema.body.properties).toHaveProperty("name");
  });

  it("has universeId property", () => {
    expect(duplicateFixtureSchema.body.properties).toHaveProperty(
      "universeId",
    );
  });
});
