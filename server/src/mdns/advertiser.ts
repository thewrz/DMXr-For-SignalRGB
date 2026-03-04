import { Bonjour } from "bonjour-service";

export interface MdnsAdvertiserOptions {
  readonly port: number;
  readonly udpPort?: number;
  readonly serverId: string;
  readonly serverName?: string;
}

export interface MdnsAdvertiser {
  readonly unpublishAll: () => void;
  readonly republish: (updates: Partial<MdnsAdvertiserOptions>) => void;
}

export function createMdnsAdvertiser(options: MdnsAdvertiserOptions): MdnsAdvertiser {
  let current = { ...options };
  let bonjour = new Bonjour();

  function publish(): void {
    const { port, udpPort, serverId, serverName } = current;
    const name = serverName || "DMXr-" + serverId.slice(0, 8);

    bonjour.publish({
      name,
      type: "dmxr",
      protocol: "tcp",
      port,
      txt: {
        version: "1.0",
        path: "/fixtures",
        serverId,
        ...(serverName ? { serverName } : {}),
        ...(udpPort !== undefined ? { udpPort: String(udpPort) } : {}),
      },
    });
  }

  publish();

  return {
    unpublishAll: () => {
      bonjour.unpublishAll();
      bonjour.destroy();
    },

    republish: (updates: Partial<MdnsAdvertiserOptions>) => {
      current = { ...current, ...updates };
      bonjour.unpublishAll();
      bonjour.destroy();
      bonjour = new Bonjour();
      publish();
    },
  };
}
