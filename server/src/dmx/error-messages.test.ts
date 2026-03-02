import { describe, it, expect } from "vitest";
import { translateDmxError } from "./error-messages.js";

describe("translateDmxError", () => {
  it("translates ENOENT to adapter-not-found message", () => {
    const error = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });

    const result = translateDmxError(error);

    expect(result.title).toBe("DMX adapter not found");
    expect(result.suggestion).toContain("USB adapter");
  });

  it("translates EACCES to permission-denied message", () => {
    const error = Object.assign(new Error("EACCES"), { code: "EACCES" });

    const result = translateDmxError(error);

    expect(result.title).toBe("Permission denied");
    expect(result.suggestion).toContain("Another app");
  });

  it("translates EPERM to permission-denied message", () => {
    const error = Object.assign(new Error("EPERM"), { code: "EPERM" });

    const result = translateDmxError(error);

    expect(result.title).toBe("Permission denied");
  });

  it("translates EBUSY to port-busy message", () => {
    const error = Object.assign(new Error("EBUSY"), { code: "EBUSY" });

    const result = translateDmxError(error);

    expect(result.title).toBe("Port busy");
    expect(result.suggestion).toContain("QLC+");
  });

  it("falls back to default for unknown error codes", () => {
    const error = Object.assign(new Error("ESOMETHING"), { code: "ESOMETHING" });

    const result = translateDmxError(error);

    expect(result.title).toBe("DMX connection error");
    expect(result.suggestion).toContain("restarting");
  });

  it("detects 'No such file' in message when no code", () => {
    const error = new Error("No such file or directory");

    const result = translateDmxError(error);

    expect(result.title).toBe("DMX adapter not found");
  });

  it("detects 'Access denied' in message when no code", () => {
    const error = new Error("Access denied to COM3");

    const result = translateDmxError(error);

    expect(result.title).toBe("Permission denied");
  });

  it("handles string errors", () => {
    const result = translateDmxError("something went wrong");

    expect(result.title).toBe("DMX connection error");
  });

  it("handles null/undefined errors", () => {
    const result = translateDmxError(null);

    expect(result.title).toBe("DMX connection error");
  });

  it("returns a copy of default (not shared reference)", () => {
    const a = translateDmxError("x");
    const b = translateDmxError("y");

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
