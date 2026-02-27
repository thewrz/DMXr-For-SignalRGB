/** Channel number (1-512) mapped to value (0-255) */
export interface ChannelMap {
  readonly [channel: string]: number;
}

/** POST /update request body */
export interface FixtureUpdatePayload {
  readonly fixture: string;
  readonly channels: ChannelMap;
}

/** POST /update response */
export interface FixtureUpdateResponse {
  readonly success: boolean;
  readonly fixture: string;
  readonly channelsUpdated: number;
}

/** GET /health response */
export interface HealthResponse {
  readonly status: "ok";
  readonly driver: string;
  readonly activeChannels: number;
  readonly uptime: number;
}

/** A single DMX channel within a fixture (derived from OFL definition) */
export interface FixtureChannel {
  readonly offset: number;
  readonly name: string;
  readonly type: string;
  readonly color?: string;
  readonly defaultValue: number;
}

/** Fixture data source */
export type FixtureSource = "ofl" | "soundswitch" | "custom";

/** Stored fixture configuration */
export interface FixtureConfig {
  readonly id: string;
  readonly name: string;
  readonly oflKey?: string;
  readonly oflFixtureName?: string;
  readonly source?: FixtureSource;
  readonly mode: string;
  readonly dmxStartAddress: number;
  readonly channelCount: number;
  readonly channels: readonly FixtureChannel[];
}

/** POST /fixtures request body */
export interface AddFixtureRequest {
  readonly name: string;
  readonly oflKey?: string;
  readonly oflFixtureName?: string;
  readonly source?: FixtureSource;
  readonly mode: string;
  readonly dmxStartAddress: number;
  readonly channelCount: number;
  readonly channels: readonly FixtureChannel[];
}

/** POST /update/colors request body */
export interface ColorUpdatePayload {
  readonly fixtures: readonly {
    readonly id: string;
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly brightness: number;
  }[];
}
