import { describe, it, expect } from "vitest";
import {
  errorResponse,
  successResponse,
  withDmxStatus,
} from "./response-helpers.js";

describe("errorResponse", () => {
  it("returns success false with error message", () => {
    const result = errorResponse("something went wrong");

    expect(result).toEqual({ success: false, error: "something went wrong" });
  });

  it("includes hint when provided", () => {
    const result = errorResponse("not found", "check the fixture ID");

    expect(result).toEqual({
      success: false,
      error: "not found",
      hint: "check the fixture ID",
    });
  });

  it("omits hint when not provided", () => {
    const result = errorResponse("bad request");

    expect(result).not.toHaveProperty("hint");
  });
});

describe("successResponse", () => {
  it("returns success true with spread data", () => {
    const result = successResponse({ fixtures: [], count: 0 });

    expect(result).toEqual({ success: true, fixtures: [], count: 0 });
  });
});

describe("withDmxStatus", () => {
  it("returns plain success when dmxResult is undefined", () => {
    const result = withDmxStatus({ id: "abc" });

    expect(result).toEqual({ success: true, id: "abc" });
    expect(result).not.toHaveProperty("dmxStatus");
  });

  it("includes dmxStatus ok when write succeeded", () => {
    const result = withDmxStatus({ id: "abc" }, { ok: true });

    expect(result).toEqual({
      success: true,
      id: "abc",
      dmxStatus: "ok",
    });
  });

  it("includes dmxStatus error and dmxError when write failed", () => {
    const result = withDmxStatus(
      { id: "abc" },
      { ok: false, error: "port closed" },
    );

    expect(result).toEqual({
      success: true,
      id: "abc",
      dmxStatus: "error",
      dmxError: "port closed",
    });
  });

  it("omits dmxError when error string is absent on failure", () => {
    const result = withDmxStatus({ id: "abc" }, { ok: false });

    expect(result).toEqual({
      success: true,
      id: "abc",
      dmxStatus: "error",
    });
    expect(result).not.toHaveProperty("dmxError");
  });
});
