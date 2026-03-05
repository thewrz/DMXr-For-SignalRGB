import { describe, it, expect } from "vitest";
import { validateUserFixtureTemplate } from "./user-fixture-validator.js";
import type { CreateUserFixtureRequest } from "./user-fixture-types.js";

function makeRequest(
  overrides: Partial<CreateUserFixtureRequest> = {},
): CreateUserFixtureRequest {
  return {
    name: "My PAR",
    manufacturer: "DIY",
    category: "Color Changer",
    modes: [
      {
        name: "3-channel",
        channels: [
          { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
          { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
          { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
        ],
      },
    ],
    ...overrides,
  };
}

describe("validateUserFixtureTemplate", () => {
  it("accepts a valid template", () => {
    const result = validateUserFixtureTemplate(makeRequest());
    expect(result.valid).toBe(true);
  });

  it("accepts a valid multi-mode template", () => {
    const result = validateUserFixtureTemplate(
      makeRequest({
        modes: [
          {
            name: "3ch",
            channels: [
              { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
            ],
          },
          {
            name: "7ch",
            channels: [
              { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
              { offset: 3, name: "Dimmer", type: "Intensity", defaultValue: 255 },
              { offset: 4, name: "Strobe", type: "Strobe", defaultValue: 0 },
              { offset: 5, name: "Color Macro", type: "ColorWheel", defaultValue: 0 },
              { offset: 6, name: "Mode", type: "NoFunction", defaultValue: 0 },
            ],
          },
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateUserFixtureTemplate(makeRequest({ name: "" }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it("rejects whitespace-only name", () => {
    const result = validateUserFixtureTemplate(makeRequest({ name: "   " }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it("rejects empty manufacturer", () => {
    const result = validateUserFixtureTemplate(makeRequest({ manufacturer: "" }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/manufacturer/i);
  });

  it("rejects zero modes", () => {
    const result = validateUserFixtureTemplate(makeRequest({ modes: [] }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/mode/i);
  });

  it("rejects mode with empty name", () => {
    const result = validateUserFixtureTemplate(
      makeRequest({
        modes: [
          {
            name: "",
            channels: [{ offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 }],
          },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/mode.*name/i);
  });

  it("rejects mode with zero channels", () => {
    const result = validateUserFixtureTemplate(
      makeRequest({
        modes: [{ name: "Empty", channels: [] }],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/channel/i);
  });

  it("rejects duplicate channel offsets within a mode", () => {
    const result = validateUserFixtureTemplate(
      makeRequest({
        modes: [
          {
            name: "Bad",
            channels: [
              { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 0, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            ],
          },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/duplicate.*offset/i);
  });

  it("rejects duplicate mode names within template", () => {
    const result = validateUserFixtureTemplate(
      makeRequest({
        modes: [
          {
            name: "3ch",
            channels: [{ offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 }],
          },
          {
            name: "3ch",
            channels: [
              { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
            ],
          },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/duplicate.*mode/i);
  });

  it("delegates channel validation — rejects bad defaultValue", () => {
    const result = validateUserFixtureTemplate(
      makeRequest({
        modes: [
          {
            name: "Bad",
            channels: [
              { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 300 },
            ],
          },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/defaultValue/i);
  });
});
