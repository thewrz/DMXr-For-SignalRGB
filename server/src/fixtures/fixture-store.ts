import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { FixtureConfig, AddFixtureRequest, UpdateFixtureRequest } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";

export interface FixtureStore {
  readonly getAll: () => readonly FixtureConfig[];
  readonly getById: (id: string) => FixtureConfig | undefined;
  readonly getByUniverse: (universeId: string) => readonly FixtureConfig[];
  readonly add: (request: AddFixtureRequest) => FixtureConfig;
  readonly addBatch: (requests: readonly AddFixtureRequest[]) => readonly FixtureConfig[];
  readonly update: (id: string, changes: UpdateFixtureRequest) => FixtureConfig | undefined;
  readonly remove: (id: string) => boolean;
  readonly save: () => Promise<void>;
  readonly scheduleSave: () => void;
  readonly load: () => Promise<void>;
  readonly dispose: () => void;
}

function isValidFixtureArray(data: unknown): data is FixtureConfig[] {
  if (!Array.isArray(data)) return false;

  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.dmxStartAddress === "number" &&
      typeof item.channelCount === "number" &&
      Array.isArray(item.channels),
  );
}

const SAVE_DEBOUNCE_MS = 250;

export function createFixtureStore(filePath: string): FixtureStore {
  let fixtures: FixtureConfig[] = [];
  let saveChain: Promise<void> = Promise.resolve();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    getAll(): readonly FixtureConfig[] {
      return fixtures;
    },

    getById(id: string): FixtureConfig | undefined {
      return fixtures.find((f) => f.id === id);
    },

    getByUniverse(universeId: string): readonly FixtureConfig[] {
      return fixtures.filter((f) => (f.universeId ?? DEFAULT_UNIVERSE_ID) === universeId);
    },

    add(request: AddFixtureRequest): FixtureConfig {
      const fixture: FixtureConfig = {
        id: randomUUID(),
        name: request.name,
        universeId: request.universeId ?? DEFAULT_UNIVERSE_ID,
        ...(request.oflKey ? { oflKey: request.oflKey } : {}),
        ...(request.oflFixtureName ? { oflFixtureName: request.oflFixtureName } : {}),
        ...(request.source ? { source: request.source } : {}),
        ...(request.category ? { category: request.category } : {}),
        mode: request.mode,
        dmxStartAddress: request.dmxStartAddress,
        channelCount: request.channels.length,
        channels: request.channels,
        ...(request.channelRemap && Object.keys(request.channelRemap).length > 0
          ? { channelRemap: request.channelRemap }
          : {}),
      };

      fixtures = [...fixtures, fixture];
      return fixture;
    },

    addBatch(requests: readonly AddFixtureRequest[]): readonly FixtureConfig[] {
      const created: FixtureConfig[] = [];

      for (const request of requests) {
        const fixture: FixtureConfig = {
          id: randomUUID(),
          name: request.name,
          universeId: request.universeId ?? DEFAULT_UNIVERSE_ID,
          ...(request.oflKey ? { oflKey: request.oflKey } : {}),
          ...(request.oflFixtureName ? { oflFixtureName: request.oflFixtureName } : {}),
          ...(request.source ? { source: request.source } : {}),
          ...(request.category ? { category: request.category } : {}),
          mode: request.mode,
          dmxStartAddress: request.dmxStartAddress,
          channelCount: request.channels.length,
          channels: request.channels,
          ...(request.channelRemap && Object.keys(request.channelRemap).length > 0
            ? { channelRemap: request.channelRemap }
            : {}),
        };
        created.push(fixture);
      }

      fixtures = [...fixtures, ...created];
      return created;
    },

    update(id: string, changes: UpdateFixtureRequest): FixtureConfig | undefined {
      const index = fixtures.findIndex((f) => f.id === id);
      if (index === -1) return undefined;

      const updated: FixtureConfig = {
        ...fixtures[index],
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.universeId !== undefined ? { universeId: changes.universeId } : {}),
        ...(changes.dmxStartAddress !== undefined ? { dmxStartAddress: changes.dmxStartAddress } : {}),
        ...(changes.channelOverrides !== undefined ? { channelOverrides: changes.channelOverrides } : {}),
        ...(changes.channelRemap !== undefined
          ? (Object.keys(changes.channelRemap).length > 0
            ? { channelRemap: changes.channelRemap }
            : { channelRemap: undefined })
          : {}),
        ...(changes.whiteGateThreshold !== undefined ? { whiteGateThreshold: changes.whiteGateThreshold } : {}),
        ...(changes.motorGuardEnabled !== undefined ? { motorGuardEnabled: changes.motorGuardEnabled } : {}),
        ...(changes.motorGuardBuffer !== undefined ? { motorGuardBuffer: changes.motorGuardBuffer } : {}),
        ...(changes.resetConfig !== undefined ? { resetConfig: changes.resetConfig } : {}),
        ...(changes.colorCalibration !== undefined ? { colorCalibration: changes.colorCalibration } : {}),
      };

      fixtures = fixtures.map((f, i) => (i === index ? updated : f));
      return updated;
    },

    remove(id: string): boolean {
      const before = fixtures.length;
      fixtures = fixtures.filter((f) => f.id !== id);
      return fixtures.length < before;
    },

    async save(): Promise<void> {
      saveChain = saveChain.then(async () => {
        await mkdir(dirname(filePath), { recursive: true });
        const tmpPath = filePath + ".tmp";
        await writeFile(tmpPath, JSON.stringify(fixtures, null, 2), "utf-8");
        await rename(tmpPath, filePath);
      });
      return saveChain;
    },

    scheduleSave(): void {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
      }
      saveTimer = setTimeout(() => {
        saveTimer = null;
        this.save().catch(() => {
          // best-effort persistence — in-memory state is authoritative
        });
      }, SAVE_DEBOUNCE_MS);
    },

    dispose(): void {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
    },

    async load(): Promise<void> {
      try {
        const data = await readFile(filePath, "utf-8");
        const parsed: unknown = JSON.parse(data);

        if (isValidFixtureArray(parsed)) {
          fixtures = parsed.map((f) => {
            const migrated = f.source === ("soundswitch" as string)
              ? { ...f, source: "local-db" as const }
              : f;
            return migrated.universeId === undefined
              ? { ...migrated, universeId: DEFAULT_UNIVERSE_ID }
              : migrated;
          });
        } else {
          fixtures = [];
        }
      } catch {
        fixtures = [];
      }
    },
  };
}
