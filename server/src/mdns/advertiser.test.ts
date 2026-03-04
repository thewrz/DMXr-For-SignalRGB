import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock bonjour-service before importing advertiser
const publishMock = vi.fn();
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

describe("createMdnsAdvertiser", () => {
  beforeEach(() => {
    publishMock.mockClear();
    unpublishAllMock.mockClear();
    destroyMock.mockClear();
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
});
