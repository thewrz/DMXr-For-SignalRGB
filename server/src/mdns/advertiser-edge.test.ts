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

import { createMdnsAdvertiser } from "./advertiser.js";

describe("mDNS advertiser edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    publishMock.mockClear().mockReturnValue({ stop: stopMock });
    unpublishAllMock.mockClear();
    destroyMock.mockClear();
    stopMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("republish with port change updates port in next publish", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    advertiser.republish({ port: 9090 });
    vi.advanceTimersByTime(2000);

    const opts = publishMock.mock.calls[1][0];
    expect(opts.port).toBe(9090);
  });

  it("republish with udpPort change updates TXT record", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    advertiser.republish({ udpPort: 5555 });
    vi.advanceTimersByTime(2000);

    const opts = publishMock.mock.calls[1][0];
    expect(opts.txt.udpPort).toBe("5555");
  });

  it("multiple republish calls accumulate option changes", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    advertiser.republish({ port: 9090 });
    vi.advanceTimersByTime(500);
    advertiser.republish({ serverName: "New" });
    vi.advanceTimersByTime(2000);

    // Only one debounced publish (plus initial)
    expect(publishMock).toHaveBeenCalledTimes(2);
    const opts = publishMock.mock.calls[1][0];
    expect(opts.port).toBe(9090);
    expect(opts.name).toBe("New");
  });

  it("unpublishAll after multiple republish calls cancels all pending", () => {
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    advertiser.republish({ serverName: "A" });
    advertiser.republish({ serverName: "B" });
    advertiser.republish({ serverName: "C" });
    advertiser.unpublishAll();

    vi.advanceTimersByTime(10000);

    // Only initial publish
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(unpublishAllMock).toHaveBeenCalledOnce();
    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it("handles active service without stop method gracefully", () => {
    publishMock.mockReturnValueOnce({}); // no stop method
    const advertiser = createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    advertiser.republish({ serverName: "New" });
    // Should not throw when trying to call stop?.()
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });

  it("omits udpPort from TXT records when not provided", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.txt.udpPort).toBeUndefined();
  });

  it("includes version in TXT records", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.txt.version).toBe("1.0");
  });

  it("includes path in TXT records", () => {
    createMdnsAdvertiser({
      port: 8080,
      serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    const opts = publishMock.mock.calls[0][0];
    expect(opts.txt.path).toBe("/fixtures");
  });
});
