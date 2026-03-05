import type { UniverseConfig } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import type { DmxUniverse } from "./driver-factory.js";
import type { UniverseManager } from "./universe-manager.js";
import type { ResilientConnection } from "./resilient-connection.js";
import type { ConnectionStatus } from "./connection-state.js";

export interface ConnectionFactory {
  readonly createConnection: (config: UniverseConfig) => Promise<ResilientConnection>;
  readonly createManager: (universe: DmxUniverse) => UniverseManager;
}

interface PoolEntry {
  readonly connection: ResilientConnection;
  readonly manager: UniverseManager;
}

export interface ConnectionPool {
  readonly create: (config: UniverseConfig) => Promise<void>;
  readonly getManager: (universeId: string) => UniverseManager | undefined;
  readonly getManagerOrDefault: (universeId?: string) => UniverseManager | undefined;
  readonly getConnection: (universeId: string) => ResilientConnection | undefined;
  readonly getStatus: () => ReadonlyMap<string, ConnectionStatus>;
  readonly remove: (universeId: string) => Promise<void>;
  readonly closeAll: () => Promise<void>;
  readonly getAllManagers: () => ReadonlyMap<string, UniverseManager>;
}

export function createConnectionPool(factory: ConnectionFactory): ConnectionPool {
  const entries = new Map<string, PoolEntry>();

  return {
    async create(config: UniverseConfig): Promise<void> {
      if (entries.has(config.id)) {
        throw new Error(`Connection for universe "${config.id}" already exists`);
      }

      const connection = await factory.createConnection(config);
      try {
        const manager = factory.createManager(connection.universe);
        entries.set(config.id, { connection, manager });
      } catch (err) {
        await connection.close();
        throw err;
      }
    },

    getManager(universeId: string): UniverseManager | undefined {
      return entries.get(universeId)?.manager;
    },

    getManagerOrDefault(universeId?: string): UniverseManager | undefined {
      const id = universeId ?? DEFAULT_UNIVERSE_ID;
      return entries.get(id)?.manager;
    },

    getConnection(universeId: string): ResilientConnection | undefined {
      return entries.get(universeId)?.connection;
    },

    getStatus(): ReadonlyMap<string, ConnectionStatus> {
      const result = new Map<string, ConnectionStatus>();
      for (const [id, entry] of entries) {
        result.set(id, entry.connection.getStatus());
      }
      return result;
    },

    async remove(universeId: string): Promise<void> {
      const entry = entries.get(universeId);
      if (!entry) return;

      await entry.connection.close();
      entries.delete(universeId);
    },

    async closeAll(): Promise<void> {
      const closePromises = [...entries.values()].map((e) => e.connection.close());
      await Promise.all(closePromises);
      entries.clear();
    },

    getAllManagers(): ReadonlyMap<string, UniverseManager> {
      const result = new Map<string, UniverseManager>();
      for (const [id, entry] of entries) {
        result.set(id, entry.manager);
      }
      return result;
    },
  };
}
