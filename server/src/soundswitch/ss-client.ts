import Database from "better-sqlite3";
import type { FixtureChannel } from "../types/protocol.js";

export interface SsManufacturer {
  readonly id: number;
  readonly name: string;
  readonly fixtureCount: number;
}

export interface SsFixture {
  readonly id: number;
  readonly name: string;
  readonly modeCount: number;
}

export interface SsMode {
  readonly id: number;
  readonly name: string;
  readonly channelCount: number;
}

interface SsAttrRow {
  readonly id: number;
  readonly mode_id: number;
  readonly type: number;
  readonly name: string;
  readonly coarse_chan: number;
  readonly fine_chan: number | null;
  readonly num_channels: number;
  readonly value_range_min: number;
  readonly value_range_max: number;
}

export interface SsClient {
  readonly getManufacturers: () => readonly SsManufacturer[];
  readonly getFixtures: (manufacturerId: number) => readonly SsFixture[];
  readonly getFixtureModes: (fixtureId: number) => readonly SsMode[];
  readonly getModeChannels: (modeId: number) => readonly SsAttrRow[];
  readonly mapToFixtureChannels: (modeId: number) => readonly FixtureChannel[];
  readonly close: () => void;
}

/** Map SoundSwitch attr type code to DMXr channel type and optional color */
export function mapSsType(typeCode: number): { type: string; color?: string } {
  switch (typeCode) {
    case 1:
      return { type: "Intensity" };
    case 3:
      return { type: "Pan" };
    case 4:
      return { type: "Tilt" };
    case 14:
      return { type: "ColorIntensity", color: "Red" };
    case 15:
      return { type: "ColorIntensity", color: "Green" };
    case 16:
      return { type: "ColorIntensity", color: "Blue" };
    case 41:
      return { type: "Strobe" };
    case 87:
      return { type: "ColorIntensity", color: "White" };
    default:
      return { type: "Generic" };
  }
}

export function createSsClient(dbPath: string): SsClient {
  let db: Database.Database | null = null;

  function getDb(): Database.Database {
    if (!db) {
      db = new Database(dbPath, { readonly: true });
    }
    return db;
  }

  return {
    getManufacturers(): readonly SsManufacturer[] {
      const rows = getDb()
        .prepare(
          `SELECT m.id, m.name, COUNT(f.id) AS fixtureCount
           FROM manufacturer m
           LEFT JOIN fixture f ON f.manufacturer_id = m.id
           GROUP BY m.id
           ORDER BY m.name`,
        )
        .all() as SsManufacturer[];
      return rows;
    },

    getFixtures(manufacturerId: number): readonly SsFixture[] {
      const rows = getDb()
        .prepare(
          `SELECT f.id, f.name, COUNT(m.id) AS modeCount
           FROM fixture f
           LEFT JOIN modes m ON m.fixture_id = f.id
           WHERE f.manufacturer_id = ?
           GROUP BY f.id
           ORDER BY f.name`,
        )
        .all(manufacturerId) as SsFixture[];
      return rows;
    },

    getFixtureModes(fixtureId: number): readonly SsMode[] {
      const rows = getDb()
        .prepare(
          `SELECT id, name, ndmx AS channelCount
           FROM modes
           WHERE fixture_id = ?
           ORDER BY ndmx`,
        )
        .all(fixtureId) as SsMode[];
      return rows;
    },

    getModeChannels(modeId: number): readonly SsAttrRow[] {
      const rows = getDb()
        .prepare(
          `SELECT id, mode_id, type, name, coarse_chan, fine_chan,
                  num_channels, value_range_min, value_range_max
           FROM attr
           WHERE mode_id = ?
           ORDER BY coarse_chan`,
        )
        .all(modeId) as SsAttrRow[];
      return rows;
    },

    mapToFixtureChannels(modeId: number): readonly FixtureChannel[] {
      const attrs = this.getModeChannels(modeId);
      const channels: FixtureChannel[] = [];

      for (const attr of attrs) {
        const mapped = mapSsType(attr.type);
        const channel: FixtureChannel = {
          offset: attr.coarse_chan,
          name: attr.name,
          type: mapped.type,
          ...(mapped.color ? { color: mapped.color } : {}),
          defaultValue: 0,
        };
        channels.push(channel);

        if (attr.fine_chan !== null && attr.fine_chan >= 0) {
          const fineChannel: FixtureChannel = {
            offset: attr.fine_chan,
            name: attr.name + " Fine",
            type: mapped.type,
            ...(mapped.color ? { color: mapped.color } : {}),
            defaultValue: 0,
          };
          channels.push(fineChannel);
        }
      }

      return channels.sort((a, b) => a.offset - b.offset);
    },

    close(): void {
      if (db) {
        db.close();
        db = null;
      }
    },
  };
}

/** Returns null if dbPath is not provided (feature disabled) */
export function createSsClientIfConfigured(
  dbPath: string | undefined,
): SsClient | null {
  if (!dbPath) return null;
  return createSsClient(dbPath);
}
