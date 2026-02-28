import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { FixtureConfig } from "../types/protocol.js";

const GRID_SIZE = 1;
const LED_COUNT = GRID_SIZE * GRID_SIZE;

interface SignalRgbComponent {
  readonly ProductName: string;
  readonly DisplayName: string;
  readonly Brand: string;
  readonly Type: string;
  readonly LedCount: number;
  readonly Width: number;
  readonly Height: number;
  readonly LedMapping: readonly number[];
  readonly LedCoordinates: readonly [number, number][];
  readonly LedNames: readonly string[];
}

function buildLedGrid(): {
  mapping: number[];
  coordinates: [number, number][];
} {
  const mapping: number[] = [];
  const coordinates: [number, number][] = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const idx = y * GRID_SIZE + x;
      mapping.push(idx);
      coordinates.push([x, y]);
    }
  }

  return { mapping, coordinates };
}

/** Sanitize a string for use as a file name (ANSI alphanumeric + spaces) */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
}

/** Build a SignalRGB component JSON object from a fixture config */
export function buildComponent(fixture: FixtureConfig): SignalRgbComponent {
  const { mapping, coordinates } = buildLedGrid();
  const productName = `DMXr ${fixture.name}`;

  const ledNames: string[] = [];
  for (let i = 0; i < LED_COUNT; i++) {
    ledNames.push(`${fixture.name} ${i}`);
  }

  return {
    ProductName: productName,
    DisplayName: `${fixture.name} (DMX ${fixture.dmxStartAddress})`,
    Brand: "DMXr",
    Type: "DMX Fixture",
    LedCount: LED_COUNT,
    Width: GRID_SIZE,
    Height: GRID_SIZE,
    LedMapping: mapping,
    LedCoordinates: coordinates,
    LedNames: ledNames,
  };
}

/** Get the SignalRGB Components directory path */
export function getComponentsDir(): string {
  return join(homedir(), "Documents", "WhirlwindFX", "Components");
}

/** Write a component JSON file for a single fixture */
export async function writeComponentFile(
  fixture: FixtureConfig,
  componentsDir?: string,
): Promise<string> {
  const dir = componentsDir ?? getComponentsDir();
  await mkdir(dir, { recursive: true });

  const component = buildComponent(fixture);
  const fileName = `DMXr_${sanitizeFileName(fixture.name)}.json`;
  const filePath = join(dir, fileName);

  await writeFile(filePath, JSON.stringify(component, null, 2), "utf-8");
  return filePath;
}

/** Write component JSON files for all fixtures */
export async function syncAllComponents(
  fixtures: readonly FixtureConfig[],
  componentsDir?: string,
): Promise<readonly string[]> {
  const paths: string[] = [];

  for (const fixture of fixtures) {
    const path = await writeComponentFile(fixture, componentsDir);
    paths.push(path);
  }

  return paths;
}
