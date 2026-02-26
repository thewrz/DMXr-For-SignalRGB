/** GET /api/v1/manufacturers response */
export interface OflManufacturersResponse {
  readonly [key: string]: OflManufacturerSummary;
}

export interface OflManufacturerSummary {
  readonly name: string;
  readonly fixtureCount: number;
  readonly color?: string;
}

/** GET /api/v1/manufacturers/:key response */
export interface OflManufacturerDetail {
  readonly name: string;
  readonly website?: string;
  readonly fixtures: readonly OflFixtureSummary[];
}

export interface OflFixtureSummary {
  readonly key: string;
  readonly name: string;
  readonly categories: readonly string[];
}

/** GET /:manufacturer/:fixture.json response (subset we care about) */
export interface OflFixtureDefinition {
  readonly name: string;
  readonly categories: readonly string[];
  readonly availableChannels: Readonly<Record<string, OflChannelDefinition>>;
  readonly modes: readonly OflMode[];
}

export interface OflChannelDefinition {
  readonly type?: string;
  readonly color?: string;
  readonly defaultValue?: number | string;
  readonly capability?: OflCapability;
  readonly capabilities?: readonly OflCapability[];
}

export interface OflCapability {
  readonly type?: string;
  readonly color?: string;
}

export interface OflMode {
  readonly name: string;
  readonly shortName?: string;
  readonly channels: readonly (string | null)[];
}
