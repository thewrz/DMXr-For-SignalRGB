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

export async function listSerialPorts(): Promise<readonly SerialPortInfo[]> {
  try {
    const { SerialPort } = await import("serialport");
    const ports = await SerialPort.list();

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

export async function autoDetectDmxPort(): Promise<string | null> {
  const ports = await listSerialPorts();
  const enttec = ports.find((p) => p.isEnttec);
  return enttec?.path ?? null;
}
