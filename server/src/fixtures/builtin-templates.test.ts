import { describe, it, expect } from "vitest";
import { getBuiltinTemplates, getBuiltinTemplateById } from "./builtin-templates.js";
import { validateUserFixtureTemplate } from "./user-fixture-validator.js";

describe("builtin-templates", () => {
  const templates = getBuiltinTemplates();

  it("returns exactly 9 templates", () => {
    expect(templates).toHaveLength(9);
  });

  it("every template has required fields", () => {
    for (const t of templates) {
      expect(t.id).toMatch(/^builtin-/);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.manufacturer).toBe("Generic");
      expect(t.category.length).toBeGreaterThan(0);
      expect(t.modes.length).toBeGreaterThanOrEqual(1);
      expect(t.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(t.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("all template IDs are unique", () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("template IDs are deterministic (stable across calls)", () => {
    const ids1 = getBuiltinTemplates().map((t) => t.id);
    const ids2 = getBuiltinTemplates().map((t) => t.id);
    expect(ids1).toEqual(ids2);
  });

  it("all mode IDs are unique across all templates", () => {
    const modeIds = templates.flatMap((t) => t.modes.map((m) => m.id));
    expect(new Set(modeIds).size).toBe(modeIds.length);
  });

  it("every template passes validation", () => {
    for (const t of templates) {
      const result = validateUserFixtureTemplate({
        name: t.name,
        manufacturer: t.manufacturer,
        category: t.category,
        modes: t.modes,
      });
      expect(result, `Template "${t.name}" failed validation: ${result.error}`).toEqual({ valid: true });
    }
  });

  it("channel counts match the declared channel layouts", () => {
    const expectedCounts: Record<string, number> = {
      "builtin-rgb-3ch": 3,
      "builtin-rgbw-4ch": 4,
      "builtin-dim-rgb-4ch": 4,
      "builtin-dim-rgb-strobe-5ch": 5,
      "builtin-dim-rgbw-strobe-6ch": 6,
      "builtin-rgb-dim-strobe-mode-speed-7ch": 7,
      "builtin-rgbw-dim-strobe-mode-speed-8ch": 8,
      "builtin-dimmer-1ch": 1,
      "builtin-uv-blacklight-7ch": 7,
    };

    for (const t of templates) {
      const mode = t.modes[0];
      const expected = expectedCounts[t.id];
      expect(expected, `No expected count for "${t.id}"`).toBeDefined();
      expect(mode.channels.length, `Channel count mismatch for "${t.id}"`).toBe(expected);
    }
  });

  it("channel offsets are sequential starting from 0", () => {
    for (const t of templates) {
      for (const mode of t.modes) {
        const offsets = mode.channels.map((ch) => ch.offset);
        const expected = Array.from({ length: offsets.length }, (_, i) => i);
        expect(offsets, `Non-sequential offsets in "${t.name}" / "${mode.name}"`).toEqual(expected);
      }
    }
  });

  it("color channels have the correct color attribute", () => {
    for (const t of templates) {
      for (const mode of t.modes) {
        for (const ch of mode.channels) {
          if (ch.type === "ColorIntensity") {
            expect(ch.color, `Missing color on "${ch.name}" in "${t.name}"`).toBeDefined();
            expect(["Red", "Green", "Blue", "White", "UV"]).toContain(ch.color);
          }
        }
      }
    }
  });

  it("non-color channels have defaultValue 0", () => {
    for (const t of templates) {
      for (const mode of t.modes) {
        for (const ch of mode.channels) {
          if (ch.type !== "ColorIntensity") {
            expect(ch.defaultValue, `Non-zero default on "${ch.name}" in "${t.name}"`).toBe(0);
          }
        }
      }
    }
  });

  describe("specific template contents", () => {
    it("RGB (3ch) has R, G, B channels", () => {
      const t = getBuiltinTemplateById("builtin-rgb-3ch");
      expect(t).toBeDefined();
      const names = t!.modes[0].channels.map((ch) => ch.name);
      expect(names).toEqual(["Red", "Green", "Blue"]);
    });

    it("RGBW (4ch) has R, G, B, W channels", () => {
      const t = getBuiltinTemplateById("builtin-rgbw-4ch");
      expect(t).toBeDefined();
      const names = t!.modes[0].channels.map((ch) => ch.name);
      expect(names).toEqual(["Red", "Green", "Blue", "White"]);
    });

    it("Single Channel Dimmer (1ch) has one Intensity channel", () => {
      const t = getBuiltinTemplateById("builtin-dimmer-1ch");
      expect(t).toBeDefined();
      const ch = t!.modes[0].channels[0];
      expect(ch.type).toBe("Intensity");
      expect(ch.name).toBe("Dimmer");
    });

    it("UV Blacklight (7ch) has a UV-only mode", () => {
      const t = getBuiltinTemplateById("builtin-uv-blacklight-7ch");
      expect(t).toBeDefined();
      expect(t!.modes.length).toBeGreaterThanOrEqual(2);
      const uvMode = t!.modes.find((m) => m.channels.some((ch) => ch.color === "UV"));
      expect(uvMode).toBeDefined();
      expect(uvMode!.channels).toHaveLength(1);
      expect(uvMode!.channels[0].color).toBe("UV");
    });
  });

  describe("getBuiltinTemplateById", () => {
    it("returns correct template for valid ID", () => {
      const t = getBuiltinTemplateById("builtin-rgb-3ch");
      expect(t).toBeDefined();
      expect(t!.name).toContain("RGB");
    });

    it("returns undefined for unknown ID", () => {
      expect(getBuiltinTemplateById("nonexistent")).toBeUndefined();
    });

    it("returns undefined for user fixture UUID format", () => {
      expect(getBuiltinTemplateById("550e8400-e29b-41d4-a716-446655440000")).toBeUndefined();
    });
  });
});
