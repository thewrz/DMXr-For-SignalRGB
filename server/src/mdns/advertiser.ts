import { Bonjour } from "bonjour-service";

export interface MdnsAdvertiserOptions {
  readonly port: number;
  readonly udpPort?: number;
  readonly serverId: string;
  readonly serverName?: string;
}

export interface MdnsAdvertiser {
  readonly unpublishAll: () => void;
}

export function createMdnsAdvertiser(options: MdnsAdvertiserOptions): MdnsAdvertiser {
  const { port, udpPort, serverId, serverName } = options;
  const bonjour = new Bonjour();

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

  return {
    unpublishAll: () => {
      bonjour.unpublishAll();
      bonjour.destroy();
    },
  };
}
