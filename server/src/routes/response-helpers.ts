import type { DmxWriteResult } from "../dmx/universe-manager.js";

/** Standardized error response shape for all API routes. */
export function errorResponse(error: string, hint?: string) {
  return { success: false as const, error, ...(hint ? { hint } : {}) };
}

/** Standardized success response shape for all API routes. */
export function successResponse<T extends Record<string, unknown>>(data: T) {
  return { success: true as const, ...data };
}

/** Attach DMX write result to a success response. */
export function withDmxStatus<T extends Record<string, unknown>>(
  data: T,
  dmxResult?: DmxWriteResult,
) {
  if (!dmxResult) return successResponse(data);
  return successResponse({
    ...data,
    dmxStatus: dmxResult.ok ? ("ok" as const) : ("error" as const),
    ...(dmxResult.error ? { dmxError: dmxResult.error } : {}),
  });
}
