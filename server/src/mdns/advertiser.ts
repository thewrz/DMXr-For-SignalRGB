import { Bonjour } from "bonjour-service";

export interface MdnsAdvertiser {
  readonly unpublishAll: () => void;
}

export function createMdnsAdvertiser(port: number, udpPort?: number): MdnsAdvertiser {
  const bonjour = new Bonjour();

  bonjour.publish({
    name: "DMXr",
    type: "dmxr",
    protocol: "tcp",
    port,
    txt: {
      version: "1.0",
      path: "/fixtures",
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
