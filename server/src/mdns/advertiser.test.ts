import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock bonjour-service before importing advertiser
const stopMock = vi.fn();
const publishMock = vi.fn().mockReturnValue({ stop: stopMock });
const unpublishAllMock = vi.fn();
const destroyMock = vi.fn();

vi.mock("bonjour-service", () => {
  const BonjourMock = vi.fn().mockImplementation(function (this: unknown) {
    (this as Record<string, unknown>).publish = publishMock;
    (this as Record<string, unknown>).unpublishAll = unpublishAllMock;
    (this as Record<string, unknown>).destroy = destroyMock;
  });
  return { Bonjour: BonjourMock, default: { Bonjour: BonjourMock } };
});

import { Bonjour } from "bonjour-service";
import { createMdnsAdvertiser } from "./advertiser.js";

describe("createMdnsAdvertiser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    publishMock.mockClear().mockReturnValue({ stop: stopMock });
    unpublishAllMock.mockClear();
    destroyMock.mockClear();
    stopMock.mockClear();
    (Bonjour as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes reuseAddr to Bonjour constructor", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    expect(Bonjour).toHaveBeenCalledWith({ reuseAddr: true });
  });

  it("publishes with probe: false", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    expect(publishMock).toHaveBeenCalledOnce();
    const opts = publishMock.mock.calls[0][0];
    expect(opts.probe).toBe(false);
  });

  it("uses serverName as mDNS name when provided", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      serverName: "Studio A",
    });

    expect(publishMock).toHaveBeenCalledOnce();
    const opts = publishMock.mock.calls[0][0];
    expect(opts.name).toBe("Studio A");
  });

  it("falls back to DMXr-{shortId} when serverName is empty", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      serverName: "",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.name).toBe("DMXr-aaaaaaaa");
  });

  it("falls back to DMXr-{shortId} when serverName is undefined", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "12345678-abcd-efgh-ijkl-mnopqrstuvwx",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.name).toBe("DMXr-12345678");
  });

  it("includes serverId in TXT records", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.txt.serverId).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  it("includes serverName in TXT records when provided", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      serverName: "Garage Rig",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.txt.serverName).toBe("Garage Rig");
  });

  it("omits serverName from TXT records when not provided", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.txt.serverName).toBeUndefined();
  });

  it("includes udpPort in TXT records when provided", () => {
    createMdnsAdvertiser({
      port: 8080,
      udpPort: 8081,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.txt.udpPort).toBe("8081");
  });

  it("publishes on correct port and type", () => {
    createMdnsAdvertiser({
      port: 9090,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.port).toBe(9090);
    expect(opts.type).toBe("dmxr");
    expect(opts.protocol).toBe("tcp");
  });

  it("unpublishAll cleans up bonjour", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    advertiser.unpublishAll();

    expect(unpublishAllMock).toHaveBeenCalledOnce();
    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it("republish reuses the same Bonjour instance", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      serverName: "Old Name",
    });

    expect(Bonjour).toHaveBeenCalledTimes(1);

    advertiser.republish({ serverName: "New Name" });
    vi.advanceTimersByTime(2000);

    // Should NOT have created a new Bonjour instance
    expect(Bonjour).toHaveBeenCalledTimes(1);
    // Should NOT have destroyed the instance
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it("republish stops old service and publishes new one after debounce", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      serverName: "Old Name",
    });

    expect(publishMock).toHaveBeenCalledTimes(1);

    advertiser.republish({ serverName: "New Name" });

    // Should not have republished yet (debounce pending)
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(stopMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);

    // Now it should have stopped old and published new
    expect(stopMock).toHaveBeenCalledOnce();
    expect(publishMock).toHaveBeenCalledTimes(2);

    const secondOpts = publishMock.mock.calls[1][0];
    expect(secondOpts.name).toBe("New Name");
    expect(secondOpts.txt.serverName).toBe("New Name");
    expect(secondOpts.port).toBe(8080);
    expect(secondOpts.txt.serverId).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  it("republish debounces rapid calls into a single publish", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      serverName: "Name 1",
    });

    advertiser.republish({ serverName: "Name 2" });
    vi.advanceTimersByTime(500);
    advertiser.republish({ serverName: "Name 3" });
    vi.advanceTimersByTime(500);
    advertiser.republish({ serverName: "Final Name" });
    vi.advanceTimersByTime(2000);

    // Initial publish + one debounced publish = 2 total
    expect(publishMock).toHaveBeenCalledTimes(2);
    const finalOpts = publishMock.mock.calls[1][0];
    expect(finalOpts.name).toBe("Final Name");
  });

  it("republish preserves existing options when partially updating", () => {
    const advertiser = createMdnsAdvertiser({
      port: 9090,
      udpPort: 9091,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      serverName: "Studio A",
    });

    advertiser.republish({ serverName: "Studio B" });
    vi.advanceTimersByTime(2000);

    const opts = publishMock.mock.calls[1][0];
    expect(opts.name).toBe("Studio B");
    expect(opts.port).toBe(9090);
    expect(opts.txt.udpPort).toBe("9091");
  });

  it("unpublishAll cancels pending republish timer", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    advertiser.republish({ serverName: "Pending" });
    advertiser.unpublishAll();

    // Advance past debounce — should NOT publish again
    vi.advanceTimersByTime(5000);
    expect(publishMock).toHaveBeenCalledTimes(1); // only initial
  });
});
