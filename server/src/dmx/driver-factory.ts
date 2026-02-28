import type { ServerConfig } from "../config/server-config.js";

export interface DmxUniverse {
  readonly update: (channels: Record<number, number>) => void;
  readonly updateAll: (value: number) => void;
}

export interface DmxConnection {
  readonly universe: DmxUniverse;
  readonly driver: string;
  readonly close: () => Promise<void>;
  readonly onDisconnect?: (callback: (err?: Error) => void) => void;
}

const UNIVERSE_NAME = "dmxr-main";

interface DmxInstance {
  addUniverse(name: string, driver: unknown): Promise<unknown>;
  update(name: string, channels: Record<number, number>): void;
  updateAll(name: string, value: number): void;
  close(): Promise<void>;
}

interface SerialDriver {
  stop(): void;
  sendUniverse(): Promise<void>;
  readonly serialPort: {
    drain(callback: () => void): void;
    on(event: string, callback: (err?: Error) => void): void;
  };
}

/**
 * Guarantees the final DMX frame is transmitted before closing the serial port.
 *
 * 1. stop() — clears the 25ms setInterval so we control the final send
 * 2. Reset _readyToWrite — ensures sendUniverse() won't skip
 * 3. sendUniverse() — writes whatever is in the buffer (zeros from blackout)
 * 4. serialPort.drain() — waits for OS serial buffer to flush
 * 5. dmx.close() — closes the serial port
 */
async function flushAndClose(
  dmx: DmxInstance,
  driver: SerialDriver,
): Promise<void> {
  driver.stop();

  const driverRecord = driver as unknown as Record<string, unknown>;
  driverRecord["_readyToWrite"] = true;

  await driver.sendUniverse();
  await new Promise<void>((resolve) => driver.serialPort.drain(resolve));
  await dmx.close();
}

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
  const { DMX } = (await import("dmx-ts/dist/src/DMX.js")) as {
    DMX: new () => DmxInstance;
  };
  const dmx = new DMX();

  if (config.dmxDriver === "enttec-usb-dmx-pro") {
    const { EnttecUSBDMXProDriver } = (await import(
      "dmx-ts/dist/src/drivers/enttec-usb-dmx-pro.js"
    )) as unknown as {
      EnttecUSBDMXProDriver: new (port: string, options?: object) => SerialDriver;
    };
    const driver = new EnttecUSBDMXProDriver(config.dmxDevicePath);
    await dmx.addUniverse(UNIVERSE_NAME, driver);

    return {
      universe: {
        update: (channels) => dmx.update(UNIVERSE_NAME, channels),
        updateAll: (value) => dmx.updateAll(UNIVERSE_NAME, value),
      },
      driver: config.dmxDriver,
      close: () => flushAndClose(dmx, driver),
      onDisconnect: (callback) => {
        driver.serialPort.on("close", (err?: Error) => {
          const disconnected =
            err !== undefined &&
            (err as unknown as Record<string, unknown>)["disconnected"] === true;
          if (disconnected) {
            callback(err);
          }
        });
      },
    };
  }

  if (config.dmxDriver === "null") {
    const { NullDriver } = (await import(
      "dmx-ts/dist/src/drivers/null.js"
    )) as {
      NullDriver: new () => unknown;
    };
    const driver = new NullDriver();
    await dmx.addUniverse(UNIVERSE_NAME, driver);

    return {
      universe: {
        update: (channels) => dmx.update(UNIVERSE_NAME, channels),
        updateAll: (value) => dmx.updateAll(UNIVERSE_NAME, value),
      },
      driver: config.dmxDriver,
      close: () => dmx.close(),
    };
  }

  throw new Error(`Unknown DMX driver: "${config.dmxDriver}"`);
}
