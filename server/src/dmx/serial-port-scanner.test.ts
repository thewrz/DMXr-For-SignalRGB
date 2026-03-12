import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock serialport v10+ style (named export SerialPort with list)
vi.mock("serialport", () => ({
  SerialPort: {
    list: vi.fn(),
  },
}));

describe("serial-port-scanner", () => {
  let listSerialPorts: typeof import("./serial-port-scanner.js").listSerialPorts;
  let autoDetectDmxPort: typeof import("./serial-port-scanner.js").autoDetectDmxPort;
  let listDmxDevices: typeof import("./serial-port-scanner.js").listDmxDevices;
  let autoDetectDmxPorts: typeof import("./serial-port-scanner.js").autoDetectDmxPorts;
  let mockList: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    const serialport = await import("serialport");
    mockList = serialport.SerialPort.list as ReturnType<typeof vi.fn>;

    const scanner = await import("./serial-port-scanner.js");
    listSerialPorts = scanner.listSerialPorts;
    autoDetectDmxPort = scanner.autoDetectDmxPort;
    listDmxDevices = scanner.listDmxDevices;
    autoDetectDmxPorts = scanner.autoDetectDmxPorts;
  });

  describe("listSerialPorts", () => {
    it("returns mapped port info with isEnttec flag", async () => {
      mockList.mockResolvedValue([
        {
          path: "COM3",
          manufacturer: "FTDI",
          vendorId: "0403",
          productId: "6001",
          serialNumber: "EN466833",
        },
        {
          path: "COM4",
          manufacturer: "Prolific",
          vendorId: "067B",
          productId: "2303",
          serialNumber: undefined,
        },
      ]);

      const ports = await listSerialPorts();

      expect(ports).toHaveLength(2);
      expect(ports[0]).toEqual({
        path: "COM3",
        manufacturer: "FTDI",
        vendorId: "0403",
        productId: "6001",
        serialNumber: "EN466833",
        isEnttec: true,
      });
      expect(ports[1].isEnttec).toBe(false);
    });

    it("handles case-insensitive VID/PID matching", async () => {
      mockList.mockResolvedValue([
        {
          path: "/dev/ttyUSB0",
          manufacturer: "FTDI",
          vendorId: "0403",
          productId: "6001",
        },
      ]);

      const ports = await listSerialPorts();

      expect(ports[0].isEnttec).toBe(true);
    });

    it("returns empty array when no ports found", async () => {
      mockList.mockResolvedValue([]);

      const ports = await listSerialPorts();

      expect(ports).toEqual([]);
    });

    it("returns empty array when serialport throws", async () => {
      mockList.mockRejectedValue(new Error("Native binding failed"));

      const ports = await listSerialPorts();

      expect(ports).toEqual([]);
    });

    it("handles ports with null/undefined fields", async () => {
      mockList.mockResolvedValue([
        {
          path: "COM1",
          manufacturer: null,
          vendorId: null,
          productId: null,
          serialNumber: null,
        },
      ]);

      const ports = await listSerialPorts();

      expect(ports).toHaveLength(1);
      expect(ports[0].manufacturer).toBeUndefined();
      expect(ports[0].isEnttec).toBe(false);
    });
  });

  describe("autoDetectDmxPort", () => {
    it("returns result with path and device info for first ENTTEC device", async () => {
      mockList.mockResolvedValue([
        { path: "COM1", vendorId: "067B", productId: "2303" },
        { path: "COM3", vendorId: "0403", productId: "6001", manufacturer: "FTDI" },
        { path: "COM5", vendorId: "0403", productId: "6001", manufacturer: "FTDI" },
      ]);

      const result = await autoDetectDmxPort();

      expect(result).not.toBeNull();
      expect(result!.path).toBe("COM3");
      expect(result!.device.isEnttec).toBe(true);
      expect(result!.device.manufacturer).toBe("FTDI");
      expect(result!.allDevices).toHaveLength(2);
      expect(result!.allDevices[1].path).toBe("COM5");
    });

    it("returns null when no ENTTEC device found", async () => {
      mockList.mockResolvedValue([
        { path: "COM1", vendorId: "067B", productId: "2303" },
      ]);

      const result = await autoDetectDmxPort();

      expect(result).toBeNull();
    });

    it("returns null when serialport fails", async () => {
      mockList.mockRejectedValue(new Error("No native binding"));

      const result = await autoDetectDmxPort();

      expect(result).toBeNull();
    });
  });

  describe("listDmxDevices", () => {
    it("returns only ENTTEC devices", async () => {
      mockList.mockResolvedValue([
        { path: "COM1", vendorId: "067B", productId: "2303" },
        { path: "COM3", vendorId: "0403", productId: "6001", manufacturer: "FTDI", serialNumber: "EN466833" },
        { path: "COM5", vendorId: "0403", productId: "6001", manufacturer: "FTDI", serialNumber: "EN789012" },
      ]);

      const devices = await listDmxDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0].path).toBe("COM3");
      expect(devices[1].path).toBe("COM5");
      expect(devices.every((d) => d.isEnttec)).toBe(true);
    });

    it("returns empty array when no DMX devices found", async () => {
      mockList.mockResolvedValue([
        { path: "COM1", vendorId: "067B", productId: "2303" },
      ]);

      const devices = await listDmxDevices();
      expect(devices).toEqual([]);
    });

    it("includes serialNumber for device identity", async () => {
      mockList.mockResolvedValue([
        { path: "COM3", vendorId: "0403", productId: "6001", serialNumber: "EN466833" },
      ]);

      const devices = await listDmxDevices();
      expect(devices[0].serialNumber).toBe("EN466833");
    });
  });

  describe("autoDetectDmxPorts", () => {
    it("returns all ENTTEC device paths", async () => {
      mockList.mockResolvedValue([
        { path: "COM1", vendorId: "067B", productId: "2303" },
        { path: "COM3", vendorId: "0403", productId: "6001" },
        { path: "COM5", vendorId: "0403", productId: "6001" },
      ]);

      const paths = await autoDetectDmxPorts();

      expect(paths).toEqual(["COM3", "COM5"]);
    });

    it("returns empty array when no ENTTEC devices found", async () => {
      mockList.mockResolvedValue([
        { path: "COM1", vendorId: "067B", productId: "2303" },
      ]);

      const paths = await autoDetectDmxPorts();
      expect(paths).toEqual([]);
    });
  });
});
