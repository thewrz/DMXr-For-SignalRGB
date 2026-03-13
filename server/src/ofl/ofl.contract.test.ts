import { describe, it, expect } from "vitest";
import {
  OflManufacturersResponseSchema,
  OflManufacturerDetailSchema,
  OflFixtureDefinitionSchema,
} from "./ofl-schemas.js";

const OFL_BASE = "https://open-fixture-library.org";

function formatZodError(error: { issues: readonly { path: readonly (string | number)[]; message: string }[] }): string {
  return error.issues
    .map((issue) => `  ${issue.path.join(".")} — ${issue.message}`)
    .join("\n");
}

describe("OFL API contract", () => {
  it("GET /api/v1/manufacturers returns valid schema with >100 manufacturers", async () => {
    const response = await fetch(`${OFL_BASE}/api/v1/manufacturers`);
    expect(response.ok).toBe(true);

    const data: unknown = await response.json();
    const result = OflManufacturersResponseSchema.safeParse(data);

    if (!result.success) {
      expect.fail(
        `Manufacturers response schema mismatch:\n${formatZodError(result.error)}`,
      );
    }

    const keys = Object.keys(result.data);
    expect(keys.length).toBeGreaterThan(100);

    // Spot-check a well-known manufacturer
    expect(result.data["cameo"]).toBeDefined();
    expect(result.data["cameo"].name).toBeTruthy();
  }, 15_000);

  it("GET /api/v1/manufacturers/cameo returns valid manufacturer detail", async () => {
    const response = await fetch(`${OFL_BASE}/api/v1/manufacturers/cameo`);
    expect(response.ok).toBe(true);

    const data: unknown = await response.json();
    const result = OflManufacturerDetailSchema.safeParse(data);

    if (!result.success) {
      expect.fail(
        `Manufacturer detail schema mismatch:\n${formatZodError(result.error)}`,
      );
    }

    const fixtures = Array.isArray(result.data.fixtures)
      ? result.data.fixtures
      : Object.entries(result.data.fixtures).map(([key, val]) => ({
          key,
          ...val,
        }));

    expect(fixtures.length).toBeGreaterThan(0);
  }, 15_000);

  it("GET /:manufacturer/:fixture.json returns valid fixture definition", async () => {
    // First, get a real fixture key from cameo
    const mfrResponse = await fetch(`${OFL_BASE}/api/v1/manufacturers/cameo`);
    const mfrData: unknown = await mfrResponse.json();
    const mfrResult = OflManufacturerDetailSchema.safeParse(mfrData);

    if (!mfrResult.success) {
      expect.fail("Could not parse manufacturer detail to find a fixture key");
    }

    const fixtures = Array.isArray(mfrResult.data.fixtures)
      ? mfrResult.data.fixtures
      : Object.entries(mfrResult.data.fixtures).map(([key, val]) => ({
          key,
          ...val,
        }));

    expect(fixtures.length).toBeGreaterThan(0);
    const fixtureKey = fixtures[0].key;

    // Fetch the actual fixture definition
    const response = await fetch(`${OFL_BASE}/cameo/${fixtureKey}.json`);
    expect(response.ok).toBe(true);

    const data: unknown = await response.json();
    const result = OflFixtureDefinitionSchema.safeParse(data);

    if (!result.success) {
      expect.fail(
        `Fixture definition schema mismatch for cameo/${fixtureKey}:\n${formatZodError(result.error)}`,
      );
    }

    expect(result.data.name).toBeTruthy();
    expect(result.data.modes.length).toBeGreaterThan(0);
    expect(Object.keys(result.data.availableChannels).length).toBeGreaterThan(0);
  }, 15_000);
});
