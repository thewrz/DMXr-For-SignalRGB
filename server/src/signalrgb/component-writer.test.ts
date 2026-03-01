import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  buildComponent,
  writeComponentFile,
  syncAllComponents,
} from "./component-writer.js";
import type { FixtureConfig } from "../types/protocol.js";

function makeFixture(overrides: Partial<FixtureConfig> = {}): FixtureConfig {
  return {
    id: "test-fixture-1",
    name: "36 LED Stage Light",
    oflKey: "missyee/36-led-stage-light",
    oflFixtureName: "36 LED Stage Light",
    mode: "7-channel",
    dmxStartAddress: 29,
    channelCount: 7,
    channels: [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
    ...overrides,
  };
}

describe("buildComponent", () => {
  it("generates correct DisplayName with fixture name and DMX address", () => {
    const component = buildComponent(makeFixture());

    expect(component.DisplayName).toBe("36 LED Stage Light (DMX 29)");
  });

  it("generates correct ProductName", () => {
    const component = buildComponent(makeFixture());

    expect(component.ProductName).toBe("DMXr 36 LED Stage Light");
  });

  it("sets Brand to DMXr", () => {
    const component = buildComponent(makeFixture());

    expect(component.Brand).toBe("DMXr");
  });

  it("sets 1x1 single-LED grid", () => {
    const component = buildComponent(makeFixture());

    expect(component.LedCount).toBe(1);
    expect(component.Width).toBe(1);
    expect(component.Height).toBe(1);
    expect(component.LedMapping).toEqual([0]);
    expect(component.LedCoordinates).toEqual([[0, 0]]);
  });

  it("includes fixture name in LedNames", () => {
    const component = buildComponent(makeFixture());

    expect(component.LedNames).toEqual(["36 LED Stage Light 0"]);
  });

  it("handles different DMX addresses", () => {
    const component = buildComponent(makeFixture({ dmxStartAddress: 1 }));

    expect(component.DisplayName).toBe("36 LED Stage Light (DMX 1)");
  });

  it("handles special characters in fixture name", () => {
    const component = buildComponent(makeFixture({ name: "SLM70S Moving Head #2" }));

    expect(component.DisplayName).toBe("SLM70S Moving Head #2 (DMX 29)");
    expect(component.ProductName).toBe("DMXr SLM70S Moving Head #2");
  });
});

describe("writeComponentFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "dmxr-comp-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes valid JSON to the target directory", async () => {
    const fixture = makeFixture();
    const filePath = await writeComponentFile(fixture, tmpDir);

    const content = JSON.parse(await readFile(filePath, "utf-8"));

    expect(content.DisplayName).toBe("36 LED Stage Light (DMX 29)");
    expect(content.Brand).toBe("DMXr");
  });

  it("uses sanitized fixture name as file name", async () => {
    const fixture = makeFixture({ name: "SLM70S Moving Head" });
    const filePath = await writeComponentFile(fixture, tmpDir);

    expect(filePath).toContain("DMXr_SLM70S Moving Head.json");
  });

  it("strips special characters from file name", async () => {
    const fixture = makeFixture({ name: "Fixture/With:Bad*Chars" });
    const filePath = await writeComponentFile(fixture, tmpDir);

    expect(filePath).toContain("DMXr_FixtureWithBadChars.json");
  });

  it("creates directory if it does not exist", async () => {
    const nested = join(tmpDir, "nested", "deep");
    const fixture = makeFixture();

    const filePath = await writeComponentFile(fixture, nested);

    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.Brand).toBe("DMXr");
  });
});

describe("syncAllComponents", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "dmxr-comp-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes a file for each fixture", async () => {
    const fixtures = [
      makeFixture({ id: "f1", name: "PAR Light", dmxStartAddress: 1 }),
      makeFixture({ id: "f2", name: "Moving Head", dmxStartAddress: 14 }),
    ];

    const paths = await syncAllComponents(fixtures, tmpDir);

    expect(paths).toHaveLength(2);
    const files = await readdir(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.sort()).toEqual([
      "DMXr_Moving Head.json",
      "DMXr_PAR Light.json",
    ]);
  });

  it("returns empty array for no fixtures", async () => {
    const paths = await syncAllComponents([], tmpDir);

    expect(paths).toHaveLength(0);
  });

  it("each file has correct DisplayName", async () => {
    const fixtures = [
      makeFixture({ id: "f1", name: "Fixture A", dmxStartAddress: 1 }),
      makeFixture({ id: "f2", name: "Fixture B", dmxStartAddress: 10 }),
    ];

    const paths = await syncAllComponents(fixtures, tmpDir);

    for (let i = 0; i < paths.length; i++) {
      const content = JSON.parse(await readFile(paths[i], "utf-8"));
      expect(content.DisplayName).toBe(
        `${fixtures[i].name} (DMX ${fixtures[i].dmxStartAddress})`,
      );
    }
  });
});
