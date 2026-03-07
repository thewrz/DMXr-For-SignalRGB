import { Bonjour, type Service } from "bonjour-service";

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

const REPUBLISH_DEBOUNCE_MS = 2000;

export function createMdnsAdvertiser(options: MdnsAdvertiserOptions): MdnsAdvertiser {
  let current = { ...options };
  // reuseAddr is supported by multicast-dns but not in bonjour-service's types
  const bonjour = new Bonjour({ reuseAddr: true } as Record<string, unknown>);
  let activeService: Service | undefined;
  let republishTimer: ReturnType<typeof setTimeout> | undefined;

  function publish(): void {
    const { port, udpPort, serverId, serverName } = current;
    const name = serverName || "DMXr-" + serverId.slice(0, 8);

    activeService = bonjour.publish({
      name,
      type: "dmxr",
      protocol: "tcp",
      port,
      probe: false,
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
      if (republishTimer !== undefined) {
        clearTimeout(republishTimer);
        republishTimer = undefined;
      }
      bonjour.unpublishAll();
      bonjour.destroy();
    },

    republish: (updates: Partial<MdnsAdvertiserOptions>) => {
      current = { ...current, ...updates };

      if (republishTimer !== undefined) {
        clearTimeout(republishTimer);
      }

      republishTimer = setTimeout(() => {
        republishTimer = undefined;
        if (activeService) {
          activeService.stop?.();
        }
        activeService = undefined;
        publish();
      }, REPUBLISH_DEBOUNCE_MS);
    },
  };
}
