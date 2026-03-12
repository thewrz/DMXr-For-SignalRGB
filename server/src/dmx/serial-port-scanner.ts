export interface SerialPortInfo {
  readonly path: string;
  readonly manufacturer?: string;
  readonly vendorId?: string;
  readonly productId?: string;
  readonly serialNumber?: string;
  readonly isEnttec: boolean;
}

const ENTTEC_VENDOR_ID = "0403";
const ENTTEC_PRODUCT_ID = "6001";

function isEnttecDevice(vendorId?: string, productId?: string): boolean {
  return (
    vendorId?.toLowerCase() === ENTTEC_VENDOR_ID &&
    productId?.toLowerCase() === ENTTEC_PRODUCT_ID
  );
}

interface PortInfo {
  path: string;
  manufacturer?: string | null;
  vendorId?: string | null;
  productId?: string | null;
  serialNumber?: string | null;
}

/**
 * Resolves the `list()` function from the serialport package.
 *
 * serialport v9 (used by dmx-ts) exports `list` on the default/CJS export,
 * while serialport v10+ exports `SerialPort.list()` as a named export.
 * We handle both so the scanner works regardless of which version is installed.
 */
async function resolveListFn(): Promise<() => Promise<PortInfo[]>> {
  const mod = await import("serialport") as Record<string, unknown>;

  // v10+: named export SerialPort with static list()
  if (mod["SerialPort"] && typeof (mod["SerialPort"] as Record<string, unknown>)["list"] === "function") {
    return (mod["SerialPort"] as { list: () => Promise<PortInfo[]> }).list;
  }

  // v9: default export with list() directly
  const defaultExport = (mod["default"] ?? mod) as Record<string, unknown>;
  if (typeof defaultExport["list"] === "function") {
    return defaultExport["list"] as () => Promise<PortInfo[]>;
  }

  throw new Error("serialport: could not find list() function");
}

export async function listSerialPorts(): Promise<readonly SerialPortInfo[]> {
  try {
    const listFn = await resolveListFn();
    const ports = await listFn();

    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer ?? undefined,
      vendorId: port.vendorId ?? undefined,
      productId: port.productId ?? undefined,
      serialNumber: port.serialNumber ?? undefined,
      isEnttec: isEnttecDevice(port.vendorId ?? undefined, port.productId ?? undefined),
    }));
  } catch {
    return [];
  }
}

export async function listDmxDevices(): Promise<readonly SerialPortInfo[]> {
  const ports = await listSerialPorts();
  return ports.filter((p) => p.isEnttec);
}

export interface AutoDetectResult {
  readonly path: string;
  readonly device: SerialPortInfo;
  readonly allDevices: readonly SerialPortInfo[];
}

export async function autoDetectDmxPort(): Promise<AutoDetectResult | null> {
  const devices = await listDmxDevices();
  if (devices.length === 0) return null;
  return {
    path: devices[0].path,
    device: devices[0],
    allDevices: devices,
  };
}

export async function autoDetectDmxPorts(): Promise<readonly string[]> {
  const devices = await listDmxDevices();
  return devices.map((d) => d.path);
}
