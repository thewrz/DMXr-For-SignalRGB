import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { FixtureConfig, AddFixtureRequest } from "../types/protocol.js";

export interface FixtureStore {
  readonly getAll: () => readonly FixtureConfig[];
  readonly getById: (id: string) => FixtureConfig | undefined;
  readonly add: (request: AddFixtureRequest) => FixtureConfig;
  readonly remove: (id: string) => boolean;
  readonly save: () => Promise<void>;
  readonly load: () => Promise<void>;
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

export function createFixtureStore(filePath: string): FixtureStore {
  let fixtures: FixtureConfig[] = [];
  let saveChain: Promise<void> = Promise.resolve();

  return {
    getAll(): readonly FixtureConfig[] {
      return fixtures;
    },

    getById(id: string): FixtureConfig | undefined {
      return fixtures.find((f) => f.id === id);
    },

    add(request: AddFixtureRequest): FixtureConfig {
      const fixture: FixtureConfig = {
        id: randomUUID(),
        name: request.name,
        ...(request.oflKey ? { oflKey: request.oflKey } : {}),
        ...(request.oflFixtureName ? { oflFixtureName: request.oflFixtureName } : {}),
        ...(request.source ? { source: request.source } : {}),
        mode: request.mode,
        dmxStartAddress: request.dmxStartAddress,
        channelCount: request.channels.length,
        channels: request.channels,
      };

      fixtures = [...fixtures, fixture];
      return fixture;
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

    async load(): Promise<void> {
      try {
        const data = await readFile(filePath, "utf-8");
        const parsed: unknown = JSON.parse(data);

        if (isValidFixtureArray(parsed)) {
          fixtures = parsed;
        } else {
          fixtures = [];
        }
      } catch {
        fixtures = [];
      }
    },
  };
}
