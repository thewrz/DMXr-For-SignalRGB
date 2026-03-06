/** Standardized error response shape for all API routes. */
export function errorResponse(error: string, hint?: string) {
  return { success: false as const, error, ...(hint ? { hint } : {}) };
}

/** Standardized success response shape for all API routes. */
export function successResponse<T extends Record<string, unknown>>(data: T) {
  return { success: true as const, ...data };
}
