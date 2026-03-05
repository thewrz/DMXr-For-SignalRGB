import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  UniverseConfig,
  AddUniverseRequest,
  UpdateUniverseRequest,
} from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import type { SerialPortInfo } from "./serial-port-scanner.js";

export interface UniverseRegistry {
  readonly getAll: () => readonly UniverseConfig[];
  readonly getById: (id: string) => UniverseConfig | undefined;
  readonly getByDevicePath: (path: string) => UniverseConfig | undefined;
  readonly getDefault: () => UniverseConfig;
  readonly add: (request: AddUniverseRequest) => UniverseConfig;
  readonly update: (id: string, changes: UpdateUniverseRequest) => UniverseConfig | undefined;
  readonly remove: (id: string) => boolean;
  readonly autoAssignDevices: (devices: readonly SerialPortInfo[]) => readonly UniverseConfig[];
  readonly save: () => Promise<void>;
  readonly load: () => Promise<void>;
}

function isValidUniverseArray(data: unknown): data is UniverseConfig[] {
  if (!Array.isArray(data)) return false;

  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.devicePath === "string" &&
      typeof item.driverType === "string",
  );
}

function makeDefaultUniverse(): UniverseConfig {
  return {
    id: DEFAULT_UNIVERSE_ID,
    name: "Default",
    devicePath: "auto",
    driverType: "enttec-usb-dmx-pro",
  };
}

export function createUniverseRegistry(filePath: string): UniverseRegistry {
  let universes: UniverseConfig[] = [];
  let saveChain: Promise<void> = Promise.resolve();

  return {
    getAll(): readonly UniverseConfig[] {
      return universes;
    },

    getById(id: string): UniverseConfig | undefined {
      return universes.find((u) => u.id === id);
    },

    getByDevicePath(path: string): UniverseConfig | undefined {
      return universes.find((u) => u.devicePath === path);
    },

    getDefault(): UniverseConfig {
      const found = universes.find((u) => u.id === DEFAULT_UNIVERSE_ID);
      if (!found) {
        throw new Error("Default universe not found — call load() first");
      }
      return found;
    },

    add(request: AddUniverseRequest): UniverseConfig {
      const nameTaken = universes.some((u) => u.name === request.name);
      if (nameTaken) {
        throw new Error(`Universe name "${request.name}" already exists`);
      }

      if (request.devicePath !== "null") {
        const deviceTaken = universes.some((u) => u.devicePath === request.devicePath);
        if (deviceTaken) {
          throw new Error(
            `Device "${request.devicePath}" is already assigned to another universe`,
          );
        }
      }

      const universe: UniverseConfig = {
        id: randomUUID(),
        name: request.name,
        devicePath: request.devicePath,
        driverType: request.driverType,
        ...(request.serialNumber ? { serialNumber: request.serialNumber } : {}),
      };

      universes = [...universes, universe];
      return universe;
    },

    update(id: string, changes: UpdateUniverseRequest): UniverseConfig | undefined {
      const index = universes.findIndex((u) => u.id === id);
      if (index === -1) return undefined;

      if (changes.name !== undefined) {
        const nameTaken = universes.some(
          (u) => u.name === changes.name && u.id !== id,
        );
        if (nameTaken) {
          throw new Error(`Universe name "${changes.name}" already exists`);
        }
      }

      if (changes.devicePath !== undefined && changes.devicePath !== "null") {
        const deviceTaken = universes.some(
          (u) => u.devicePath === changes.devicePath && u.id !== id,
        );
        if (deviceTaken) {
          throw new Error(
            `Device "${changes.devicePath}" is already assigned to another universe`,
          );
        }
      }

      const updated: UniverseConfig = {
        ...universes[index],
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.devicePath !== undefined ? { devicePath: changes.devicePath } : {}),
        ...(changes.driverType !== undefined ? { driverType: changes.driverType } : {}),
        ...(changes.serialNumber !== undefined ? { serialNumber: changes.serialNumber } : {}),
      };

      universes = universes.map((u, i) => (i === index ? updated : u));
      return updated;
    },

    remove(id: string): boolean {
      if (id === DEFAULT_UNIVERSE_ID) {
        throw new Error("Cannot remove the default universe");
      }

      const before = universes.length;
      universes = universes.filter((u) => u.id !== id);
      return universes.length < before;
    },

    autoAssignDevices(devices: readonly SerialPortInfo[]): readonly UniverseConfig[] {
      const created: UniverseConfig[] = [];
      let nextIndex = universes.filter((u) => u.id !== DEFAULT_UNIVERSE_ID).length + 1;

      for (const device of devices) {
        if (!device.serialNumber) continue;

        // Check if device already assigned by serial number
        const existing = universes.find((u) => u.serialNumber === device.serialNumber);
        if (existing) {
          // Update device path if it changed (re-plug to different port)
          if (existing.devicePath !== device.path) {
            this.update(existing.id, { devicePath: device.path });
          }
          continue;
        }

        // Skip past any user-created names to avoid collision
        while (universes.some((u) => u.name === `Universe ${nextIndex}`)) {
          nextIndex++;
        }

        const universe = this.add({
          name: `Universe ${nextIndex}`,
          devicePath: device.path,
          driverType: "enttec-usb-dmx-pro",
          serialNumber: device.serialNumber,
        });

        created.push(universe);
        nextIndex++;
      }

      return created;
    },

    async save(): Promise<void> {
      saveChain = saveChain.then(async () => {
        await mkdir(dirname(filePath), { recursive: true });
        const tmpPath = filePath + ".tmp";
        await writeFile(tmpPath, JSON.stringify(universes, null, 2), "utf-8");
        await rename(tmpPath, filePath);
      });
      return saveChain;
    },

    async load(): Promise<void> {
      try {
        const data = await readFile(filePath, "utf-8");
        const parsed: unknown = JSON.parse(data);

        if (isValidUniverseArray(parsed)) {
          universes = parsed;
        } else {
          universes = [makeDefaultUniverse()];
        }
      } catch {
        universes = [makeDefaultUniverse()];
      }

      // Ensure default universe always exists
      if (!universes.some((u) => u.id === DEFAULT_UNIVERSE_ID)) {
        universes = [makeDefaultUniverse(), ...universes];
      }
    },
  };
}
