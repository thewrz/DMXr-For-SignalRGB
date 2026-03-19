import { z } from "zod";

/**
 * Zod schemas mirroring ofl-types.ts for contract testing against the live OFL API.
 * All object schemas use .passthrough() so new fields added by OFL don't cause
 * false positives — we only verify the fields DMXr actually depends on.
 */

export const OflManufacturerSummarySchema = z
  .object({
    name: z.string(),
    fixtureCount: z.number(),
    color: z.string().optional(),
  })
  .passthrough();

/** GET /api/v1/manufacturers — record of manufacturer key → summary */
export const OflManufacturersResponseSchema = z.record(
  z.string(),
  OflManufacturerSummarySchema,
);

export const OflFixtureSummarySchema = z
  .object({
    key: z.string(),
    name: z.string(),
    categories: z.array(z.string()),
  })
  .passthrough();

/**
 * GET /api/v1/manufacturers/:key — fixtures may be an array OR an object
 * depending on OFL version. ofl-client.ts:97-117 handles both shapes.
 */
export const OflManufacturerDetailSchema = z
  .object({
    fixtures: z.union([
      z.array(OflFixtureSummarySchema),
      z.record(
        z.string(),
        z
          .object({
            name: z.string(),
            categories: z.array(z.string()),
          })
          .passthrough(),
      ),
    ]),
  })
  .passthrough();

export const OflCapabilitySchema = z
  .object({
    type: z.string().optional(),
    color: z.string().optional(),
  })
  .passthrough();

export const OflChannelDefinitionSchema = z
  .object({
    type: z.string().optional(),
    color: z.string().optional(),
    defaultValue: z.union([z.number(), z.string()]).optional(),
    capability: OflCapabilitySchema.optional(),
    capabilities: z.array(OflCapabilitySchema).optional(),
  })
  .passthrough();

export const OflModeSchema = z
  .object({
    name: z.string(),
    shortName: z.string().optional(),
    channels: z.array(z.union([z.string(), z.null(), z.record(z.string(), z.unknown())])),
  })
  .passthrough();

/** GET /:manufacturer/:fixture.json */
export const OflFixtureDefinitionSchema = z
  .object({
    name: z.string(),
    categories: z.array(z.string()),
    availableChannels: z.record(z.string(), OflChannelDefinitionSchema),
    modes: z.array(OflModeSchema),
  })
  .passthrough();
