import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { FixtureGroup, AddGroupRequest, UpdateGroupRequest } from "../types/protocol.js";

export interface GroupStore {
  readonly getAll: () => readonly FixtureGroup[];
  readonly getById: (id: string) => FixtureGroup | undefined;
  readonly add: (request: AddGroupRequest) => FixtureGroup;
  readonly update: (id: string, changes: UpdateGroupRequest) => FixtureGroup | undefined;
  readonly remove: (id: string) => boolean;
  readonly getGroupsForFixture: (fixtureId: string) => readonly FixtureGroup[];
  readonly removeFixtureFromAll: (fixtureId: string) => void;
  readonly save: () => Promise<void>;
  readonly scheduleSave: () => void;
  readonly load: () => Promise<void>;
  readonly dispose: () => void;
}

function isValidGroupArray(data: unknown): data is FixtureGroup[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      Array.isArray(item.fixtureIds),
  );
}

const SAVE_DEBOUNCE_MS = 250;

export function createGroupStore(filePath: string): GroupStore {
  let groups: FixtureGroup[] = [];
  let saveChain: Promise<void> = Promise.resolve();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    getAll(): readonly FixtureGroup[] {
      return groups;
    },

    getById(id: string): FixtureGroup | undefined {
      return groups.find((g) => g.id === id);
    },

    add(request: AddGroupRequest): FixtureGroup {
      const trimmed = request.name.trim();
      if (trimmed.length === 0) {
        throw new Error("Group name must not be empty");
      }
      if (groups.some((g) => g.name === trimmed)) {
        throw new Error(`Group name "${trimmed}" already exists`);
      }

      const group: FixtureGroup = {
        id: randomUUID(),
        name: trimmed,
        fixtureIds: [...request.fixtureIds],
        ...(request.color ? { color: request.color } : {}),
        createdAt: new Date().toISOString(),
      };

      groups = [...groups, group];
      return group;
    },

    update(id: string, changes: UpdateGroupRequest): FixtureGroup | undefined {
      const index = groups.findIndex((g) => g.id === id);
      if (index === -1) return undefined;

      if (changes.name !== undefined) {
        const trimmed = changes.name.trim();
        if (trimmed.length === 0) {
          throw new Error("Group name must not be empty");
        }
        if (groups.some((g) => g.name === trimmed && g.id !== id)) {
          throw new Error(`Group name "${trimmed}" already exists`);
        }
      }

      const updated: FixtureGroup = {
        ...groups[index],
        ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
        ...(changes.fixtureIds !== undefined ? { fixtureIds: [...changes.fixtureIds] } : {}),
        ...(changes.color !== undefined ? { color: changes.color } : {}),
      };

      groups = groups.map((g, i) => (i === index ? updated : g));
      return updated;
    },

    remove(id: string): boolean {
      const before = groups.length;
      groups = groups.filter((g) => g.id !== id);
      return groups.length < before;
    },

    getGroupsForFixture(fixtureId: string): readonly FixtureGroup[] {
      return groups.filter((g) => g.fixtureIds.includes(fixtureId));
    },

    removeFixtureFromAll(fixtureId: string): void {
      groups = groups.map((g) =>
        g.fixtureIds.includes(fixtureId)
          ? { ...g, fixtureIds: g.fixtureIds.filter((fid) => fid !== fixtureId) }
          : g,
      );
    },

    async save(): Promise<void> {
      saveChain = saveChain.then(async () => {
        await mkdir(dirname(filePath), { recursive: true });
        const tmpPath = filePath + ".tmp";
        await writeFile(tmpPath, JSON.stringify(groups, null, 2), "utf-8");
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

        if (isValidGroupArray(parsed)) {
          groups = parsed;
        } else {
          groups = [];
        }
      } catch {
        groups = [];
      }
    },
  };
}
