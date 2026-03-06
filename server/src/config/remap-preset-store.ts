import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

export interface RemapPreset {
  readonly channelCount: number;
  readonly remap: Readonly<Record<number, number>>;
}

export interface RemapPresetStore {
  readonly load: () => Promise<void>;
  readonly getAll: () => Readonly<Record<string, RemapPreset>>;
  readonly get: (key: string) => RemapPreset | undefined;
  readonly upsert: (key: string, preset: RemapPreset) => void;
  readonly remove: (key: string) => boolean;
  readonly save: () => Promise<void>;
}

export function createRemapPresetStore(filePath: string): RemapPresetStore {
  let presets: Record<string, RemapPreset> = {};

  async function saveToDisk(): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const tmpPath = filePath + ".tmp";
    await writeFile(tmpPath, JSON.stringify(presets, null, 2), "utf-8");
    await rename(tmpPath, filePath);
  }

  return {
    async load(): Promise<void> {
      try {
        const data = await readFile(filePath, "utf-8");
        const parsed: unknown = JSON.parse(data);

        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          presets = parsed as Record<string, RemapPreset>;
        } else {
          presets = {};
        }
      } catch {
        presets = {};
      }
    },

    getAll(): Readonly<Record<string, RemapPreset>> {
      return { ...presets };
    },

    get(key: string): RemapPreset | undefined {
      return presets[key];
    },

    upsert(key: string, preset: RemapPreset): void {
      presets = { ...presets, [key]: preset };
    },

    remove(key: string): boolean {
      if (!(key in presets)) return false;
      const { [key]: _, ...rest } = presets;
      presets = rest;
      return true;
    },

    save: saveToDisk,
  };
}
