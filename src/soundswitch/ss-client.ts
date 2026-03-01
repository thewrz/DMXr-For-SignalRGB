import Database from "better-sqlite3";
import type { FixtureChannel } from "../types/protocol.js";
import {
  analyzeFixture,
  defaultValueForChannel,
} from "../fixtures/fixture-capabilities.js";
import { classifyFixture } from "./classify-fixture.js";

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

export interface SsSearchResult {
  readonly fixtureId: number;
  readonly fixtureName: string;
  readonly mfrId: number;
  readonly mfrName: string;
  readonly modeCount: number;
  readonly category: string;
}

export interface SsClient {
  readonly getManufacturers: () => readonly SsManufacturer[];
  readonly getFixtures: (manufacturerId: number) => readonly SsFixture[];
  readonly getFixtureModes: (fixtureId: number) => readonly SsMode[];
  readonly getModeChannels: (modeId: number) => readonly SsAttrRow[];
  readonly mapToFixtureChannels: (modeId: number) => readonly FixtureChannel[];
  readonly searchFixtures: (query: string, limit?: number) => readonly SsSearchResult[];
  readonly close: () => void;
}

/** Map SoundSwitch attr type code to DMXr channel type and optional color */
export function mapSsType(typeCode: number): { type: string; color?: string } {
  switch (typeCode) {
    case 1:
      return { type: "Intensity" };
    case 2:
      return { type: "ColorWheel" };
    case 3:
      return { type: "Pan" };
    case 4:
      return { type: "Tilt" };
    case 5:
      return { type: "Iris" };
    case 6:
      return { type: "Focus" };
    case 7:
      return { type: "Prism" };
    case 8:  // Static Gobo
    case 9:  // Rotating Gobo
      return { type: "Gobo" };
    case 11:
      return { type: "ColorIntensity", color: "Cyan" };
    case 12:
      return { type: "ColorIntensity", color: "Magenta" };
    case 13:
      return { type: "ColorIntensity", color: "Yellow" };
    case 14:
      return { type: "ColorIntensity", color: "Red" };
    case 15:
      return { type: "ColorIntensity", color: "Green" };
    case 16:
      return { type: "ColorIntensity", color: "Blue" };
    case 17: // Pan/Tilt Speed
    case 20: // Lamp Control
    case 21: // Reset
    case 82: // Macro
    case 83: // Effect
    case 84: // Effect Speed
    case 85: // Effect Rate
    case 88: // Mode/Effect Select
      return { type: "Generic" };
    case 41:
      return { type: "Strobe" };
    case 53:
      return { type: "Zoom" };
    case 64:
      return { type: "ShutterStrobe" };
    case 87:
      return { type: "ColorIntensity", color: "White" };
    case 105:
      return { type: "ColorIntensity", color: "Amber" };
    case 106:
      return { type: "ColorIntensity", color: "UV" };
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

    searchFixtures(query: string, limit = 50): readonly SsSearchResult[] {
      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);
      if (tokens.length === 0) return [];

      const whereClauses = tokens.map(
        () => "(INSTR(LOWER(f.name), ?) > 0 OR INSTR(LOWER(m.name), ?) > 0)",
      );
      const params = tokens.flatMap((t) => [t, t]);

      const sql = `
        SELECT f.id AS fixtureId, f.name AS fixtureName,
               m.id AS mfrId, m.name AS mfrName,
               COUNT(mo.id) AS modeCount
        FROM fixture f
        JOIN manufacturer m ON f.manufacturer_id = m.id
        LEFT JOIN modes mo ON mo.fixture_id = f.id
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY f.id
        LIMIT ?`;

      const rows = getDb()
        .prepare(sql)
        .all(...params, limit) as Array<Omit<SsSearchResult, "category">>;

      if (rows.length === 0) return [];

      // Batch-fetch distinct attr types for all result fixture IDs
      const ids = rows.map((r) => r.fixtureId);
      const placeholders = ids.map(() => "?").join(",");
      const attrRows = getDb()
        .prepare(
          `SELECT DISTINCT f.id AS fixtureId, a.type
           FROM fixture f
           JOIN modes m ON m.fixture_id = f.id
           JOIN attr a ON a.mode_id = m.id
           WHERE f.id IN (${placeholders})`,
        )
        .all(...ids) as Array<{ fixtureId: number; type: number }>;

      const typesByFixture = new Map<number, number[]>();
      for (const row of attrRows) {
        const existing = typesByFixture.get(row.fixtureId);
        if (existing) {
          existing.push(row.type);
        } else {
          typesByFixture.set(row.fixtureId, [row.type]);
        }
      }

      return rows.map((r) => ({
        ...r,
        category: classifyFixture(typesByFixture.get(r.fixtureId) ?? []),
      }));
    },

    mapToFixtureChannels(modeId: number): readonly FixtureChannel[] {
      const attrs = this.getModeChannels(modeId);

      // Pass 1: build raw channels with placeholder defaultValue
      const rawChannels: FixtureChannel[] = [];

      for (const attr of attrs) {
        const mapped = mapSsType(attr.type);
        rawChannels.push({
          offset: attr.coarse_chan,
          name: attr.name,
          type: mapped.type,
          ...(mapped.color ? { color: mapped.color } : {}),
          defaultValue: 0,
        });

        if (
          attr.fine_chan !== null &&
          attr.fine_chan >= 0 &&
          attr.fine_chan !== attr.coarse_chan
        ) {
          rawChannels.push({
            offset: attr.fine_chan,
            name: attr.name + " Fine",
            type: mapped.type,
            ...(mapped.color ? { color: mapped.color } : {}),
            defaultValue: 0,
          });
        }
      }

      // Pass 2: analyze capabilities to determine strobe mode
      const caps = analyzeFixture(rawChannels);

      // Pass 3: apply correct defaults based on fixture capabilities
      const channels = rawChannels.map((ch) => ({
        ...ch,
        defaultValue: defaultValueForChannel(ch.type, caps.strobeMode, ch.name),
      }));

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

export interface SsStatus {
  readonly available: boolean;
  readonly state: "connected" | "not_configured" | "not_found" | "permission_denied" | "corrupt" | "error";
  readonly path?: string;
  readonly error?: string;
  readonly fixtureCount?: number;
}

export interface SsClientResult {
  readonly client: SsClient | null;
  readonly status: SsStatus;
}

/** Attempt to create an SsClient, returning status regardless of success */
export function createSsClientIfConfigured(
  dbPath: string | undefined,
): SsClientResult {
  if (!dbPath) {
    return {
      client: null,
      status: { available: false, state: "not_configured" },
    };
  }

  try {
    const client = createSsClient(dbPath);
    // Probe the DB to ensure it's readable
    const manufacturers = client.getManufacturers();
    const fixtureCount = manufacturers.reduce((sum, m) => sum + m.fixtureCount, 0);
    return {
      client,
      status: {
        available: true,
        state: "connected",
        path: dbPath,
        fixtureCount,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const state = classifySsError(message);
    return {
      client: null,
      status: {
        available: false,
        state,
        path: dbPath,
        error: message,
      },
    };
  }
}

function classifySsError(message: string): SsStatus["state"] {
  const lower = message.toLowerCase();
  if (lower.includes("enoent") || lower.includes("no such file")) return "not_found";
  if (lower.includes("eacces") || lower.includes("permission denied")) return "permission_denied";
  if (lower.includes("malformed") || lower.includes("corrupt") || lower.includes("not a database")) return "corrupt";
  return "error";
}
