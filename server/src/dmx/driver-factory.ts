import type { ServerConfig } from "../config/server-config.js";

export interface DmxUniverse {
  readonly update: (channels: Record<number, number>) => void;
  readonly updateAll: (value: number) => void;
}

export interface DmxConnection {
  readonly universe: DmxUniverse;
  readonly driver: string;
  readonly close: () => Promise<void>;
}

const UNIVERSE_NAME = "dmxr-main";

/**
 * Creates a DMX universe connection.
 *
 * Imports specific internal dmx-ts modules instead of the barrel export
 * (`dmx-ts/dist/src/index.js`), which eagerly `require()`s every driver
 * — including serial-based ones that need native @serialport bindings.
 * By importing DMX and NullDriver from their individual files, the null
 * driver works on systems without native build tools (e.g. Windows
 * without Python/VS Build Tools). The ENTTEC driver path still loads
 * the serial driver, but only when explicitly selected.
 */
export async function createDmxConnection(
  config: ServerConfig,
): Promise<DmxConnection> {
  // Import DMX class directly — only depends on ./devices (static data)
  const { DMX } = (await import("dmx-ts/dist/src/DMX.js")) as {
    DMX: new () => {
      addUniverse(name: string, driver: unknown): Promise<unknown>;
      update(name: string, channels: Record<number, number>): void;
      updateAll(name: string, value: number): void;
      close(): Promise<void>;
    };
  };
  const dmx = new DMX();

  if (config.dmxDriver === "enttec-usb-dmx-pro") {
    const { EnttecUSBDMXProDriver } = (await import(
      "dmx-ts/dist/src/drivers/enttec-usb-dmx-pro.js"
    )) as {
      EnttecUSBDMXProDriver: new (port: string, options?: object) => unknown;
    };
    const driver = new EnttecUSBDMXProDriver(config.dmxDevicePath);
    await dmx.addUniverse(UNIVERSE_NAME, driver);
  } else if (config.dmxDriver === "null") {
    const { NullDriver } = (await import(
      "dmx-ts/dist/src/drivers/null.js"
    )) as {
      NullDriver: new () => unknown;
    };
    const driver = new NullDriver();
    await dmx.addUniverse(UNIVERSE_NAME, driver);
  } else {
    throw new Error(`Unknown DMX driver: "${config.dmxDriver}"`);
  }

  return {
    universe: {
      update: (channels) => dmx.update(UNIVERSE_NAME, channels),
      updateAll: (value) => dmx.updateAll(UNIVERSE_NAME, value),
    },
    driver: config.dmxDriver,
    close: () => dmx.close(),
  };
}
