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

    // Flush all channels to zero immediately — ensures the ENTTEC hardware
    // starts clean before the 25ms send interval delivers the first frame.
    dmx.updateAll(UNIVERSE_NAME, 0);

    return {
      universe: {
        update: (channels) => dmx.update(UNIVERSE_NAME, channels),
        updateAll: (value) => dmx.updateAll(UNIVERSE_NAME, value),
      },
      driver: config.dmxDriver,
      close: () => flushAndClose(dmx, driver),
      onDisconnect: (callback) => {
        // Absorb serial port errors from dmx-ts's internal 25ms send loop
        // so they don't become uncaughtExceptions (e.g. COM error 31 on
        // Windows when USB is yanked mid-write).
        driver.serialPort.on("error", (err?: Error) => {
          callback(err ?? new Error("Serial port error"));
        });
        driver.serialPort.on("close", (err?: Error) => {
          // On Linux, err.disconnected === true signals USB removal.
          // On Windows, err is often null for the same event.
          // Either way, treat any close as a disconnect — the resilient
          // connection's `closed` guard prevents false triggers during
          // intentional shutdown.
          callback(err ?? new Error("Serial port closed"));
        });
      },
    };
  }

  if (config.dmxDriver === "enttec-open-usb-dmx") {
    const { EnttecOpenUSBDMXDriver } = (await import(
      "dmx-ts/dist/src/drivers/enttec-open-usb-dmx.js"
    )) as unknown as {
      EnttecOpenUSBDMXDriver: new (port: string, options?: object) => SerialDriver;
    };
    const driver = new EnttecOpenUSBDMXDriver(config.dmxDevicePath);
    await dmx.addUniverse(UNIVERSE_NAME, driver);

    // Flush all channels to zero immediately
    dmx.updateAll(UNIVERSE_NAME, 0);

    return {
      universe: {
        update: (channels) => dmx.update(UNIVERSE_NAME, channels),
        updateAll: (value) => dmx.updateAll(UNIVERSE_NAME, value),
      },
      driver: config.dmxDriver,
      close: () => flushAndClose(dmx, driver),
      onDisconnect: (callback) => {
        driver.serialPort.on("error", (err?: Error) => {
          callback(err ?? new Error("Serial port error"));
        });
        driver.serialPort.on("close", (err?: Error) => {
          callback(err ?? new Error("Serial port closed"));
        });
      },
    };
  }

  // ArtNet — UDP unicast/broadcast, connectionless.
  // No onDisconnect: UDP is fire-and-forget. If the network path fails,
  // packets simply don't arrive; when it recovers, the next update() resumes.
  if (config.dmxDriver === "artnet") {
    const { ArtnetDriver } = (await import(
      "dmx-ts/dist/src/drivers/artnet.js"
    )) as unknown as {
      ArtnetDriver: new (
        host: string,
        options?: {
          universe?: number;
          port?: number;
          net?: number;
          subnet?: number;
          subuni?: number;
        },
      ) => unknown;
    };
    const driver = new ArtnetDriver(
      config.dmxDevicePath || "255.255.255.255",
      {
        universe: config.driverOptions?.universe ?? 0,
        port: config.driverOptions?.port ?? 0,
      },
    );
    // DMX.addUniverse calls driver.init() which creates the dmxnet sender
    await dmx.addUniverse(UNIVERSE_NAME, driver);

    return {
      universe: {
        update: (channels) => dmx.update(UNIVERSE_NAME, channels),
        updateAll: (value) => dmx.updateAll(UNIVERSE_NAME, value),
      },
      driver: "artnet",
      close: () => dmx.close(),
    };
  }

  // sACN (E1.31) — multicast UDP, connectionless.
  // SACNDriver converts 0–255 → 0–100% internally — transparent to callers.
  if (config.dmxDriver === "sacn") {
    const { SACNDriver } = (await import(
      "dmx-ts/dist/src/drivers/sacn.js"
    )) as unknown as {
      SACNDriver: new (
        universe: number,
        options?: {
          sourceName?: string;
          priority?: number;
          reuseAddr?: boolean;
          ip?: string;
        },
      ) => unknown;
    };
    const driver = new SACNDriver(
      config.driverOptions?.universe ?? 1,
      {
        sourceName: config.driverOptions?.sourceName ?? "DMXr",
        priority: config.driverOptions?.priority ?? 100,
      },
    );
    // SACNDriver.init() is a no-op — sender created in constructor
    await dmx.addUniverse(UNIVERSE_NAME, driver);

    return {
      universe: {
        update: (channels) => dmx.update(UNIVERSE_NAME, channels),
        updateAll: (value) => dmx.updateAll(UNIVERSE_NAME, value),
      },
      driver: "sacn",
      close: () => dmx.close(),
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
