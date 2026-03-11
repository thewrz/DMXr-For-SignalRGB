import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  UserFixtureTemplate,
  UserFixtureMode,
  CreateUserFixtureRequest,
  UpdateUserFixtureRequest,
} from "./user-fixture-types.js";

export interface UserFixtureStore {
  readonly getAll: () => readonly UserFixtureTemplate[];
  readonly getById: (id: string) => UserFixtureTemplate | undefined;
  readonly add: (request: CreateUserFixtureRequest) => UserFixtureTemplate;
  readonly update: (id: string, changes: UpdateUserFixtureRequest) => UserFixtureTemplate | undefined;
  readonly remove: (id: string) => boolean;
  readonly save: () => Promise<void>;
  readonly scheduleSave: () => void;
  readonly load: () => Promise<void>;
  readonly dispose: () => void;
}

function isValidTemplateArray(data: unknown): data is UserFixtureTemplate[] {
  if (!Array.isArray(data)) return false;

  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.manufacturer === "string" &&
      Array.isArray(item.modes),
  );
}

function buildModes(
  rawModes: readonly { readonly name: string; readonly channels: readonly import("../types/protocol.js").FixtureChannel[] }[],
): UserFixtureMode[] {
  return rawModes.map((m) => ({
    id: randomUUID(),
    name: m.name,
    channels: [...m.channels],
  }));
}

const SAVE_DEBOUNCE_MS = 250;

export function createUserFixtureStore(filePath: string): UserFixtureStore {
  let templates: UserFixtureTemplate[] = [];
  let saveChain: Promise<void> = Promise.resolve();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    getAll(): readonly UserFixtureTemplate[] {
      return templates;
    },

    getById(id: string): UserFixtureTemplate | undefined {
      return templates.find((t) => t.id === id);
    },

    add(request: CreateUserFixtureRequest): UserFixtureTemplate {
      const now = new Date().toISOString();
      const template: UserFixtureTemplate = {
        id: randomUUID(),
        name: request.name,
        manufacturer: request.manufacturer,
        category: request.category,
        modes: buildModes(request.modes),
        createdAt: now,
        updatedAt: now,
      };

      templates = [...templates, template];
      return template;
    },

    update(
      id: string,
      changes: UpdateUserFixtureRequest,
    ): UserFixtureTemplate | undefined {
      const index = templates.findIndex((t) => t.id === id);
      if (index === -1) return undefined;

      const existing = templates[index];
      const updated: UserFixtureTemplate = {
        ...existing,
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.manufacturer !== undefined ? { manufacturer: changes.manufacturer } : {}),
        ...(changes.category !== undefined ? { category: changes.category } : {}),
        ...(changes.modes !== undefined ? { modes: buildModes(changes.modes) } : {}),
        updatedAt: new Date().toISOString(),
      };

      templates = templates.map((t, i) => (i === index ? updated : t));
      return updated;
    },

    remove(id: string): boolean {
      const before = templates.length;
      templates = templates.filter((t) => t.id !== id);
      return templates.length < before;
    },

    async save(): Promise<void> {
      saveChain = saveChain.then(async () => {
        await mkdir(dirname(filePath), { recursive: true });
        const tmpPath = filePath + ".tmp";
        await writeFile(tmpPath, JSON.stringify(templates, null, 2), "utf-8");
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
        this.save().catch((err) => {
          process.stderr.write(`[DMXr] WARN: Failed to persist user fixture store: ${err instanceof Error ? err.message : String(err)}\n`);
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

        if (isValidTemplateArray(parsed)) {
          templates = parsed;
        } else {
          templates = [];
        }
      } catch {
        templates = [];
      }
    },
  };
}
