import { describe, it, expect } from "vitest";
import { matchCidr } from "./cidr.js";

describe("matchCidr", () => {
  it("matches loopback /8", () => {
    expect(matchCidr("127.0.0.1", ["127.0.0.0/8"])).toBe(true);
    expect(matchCidr("127.255.255.255", ["127.0.0.0/8"])).toBe(true);
  });

  it("matches Class C /16", () => {
    expect(matchCidr("192.168.1.5", ["192.168.0.0/16"])).toBe(true);
    expect(matchCidr("192.168.255.255", ["192.168.0.0/16"])).toBe(true);
  });

  it("rejects public IP against RFC1918 list", () => {
    expect(
      matchCidr("1.2.3.4", [
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
      ]),
    ).toBe(false);
  });

  it("matches 10.x.x.x /8", () => {
    expect(matchCidr("10.0.0.1", ["10.0.0.0/8"])).toBe(true);
    expect(matchCidr("10.255.255.254", ["10.0.0.0/8"])).toBe(true);
  });

  it("matches 172.16-31.x.x /12", () => {
    expect(matchCidr("172.16.0.1", ["172.16.0.0/12"])).toBe(true);
    expect(matchCidr("172.31.255.255", ["172.16.0.0/12"])).toBe(true);
    expect(matchCidr("172.32.0.1", ["172.16.0.0/12"])).toBe(false);
  });

  it("matches exact host /32", () => {
    expect(matchCidr("1.2.3.4", ["1.2.3.4/32"])).toBe(true);
    expect(matchCidr("1.2.3.5", ["1.2.3.4/32"])).toBe(false);
  });

  it("matches /0 (everything)", () => {
    expect(matchCidr("8.8.8.8", ["0.0.0.0/0"])).toBe(true);
  });

  it("returns false for empty allow list", () => {
    expect(matchCidr("192.168.1.1", [])).toBe(false);
  });

  it("handles malformed CIDR gracefully (returns false)", () => {
    expect(matchCidr("192.168.1.1", ["garbage"])).toBe(false);
    expect(matchCidr("192.168.1.1", ["not/a/cidr"])).toBe(false);
  });

  it("handles IPv6 addresses (returns false — not supported)", () => {
    expect(matchCidr("::1", ["127.0.0.0/8"])).toBe(false);
  });
});
