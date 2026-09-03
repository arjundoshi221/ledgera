// ============================================================
// errors.ts - Runtime narrowing helpers for `catch (err: unknown)`
// ============================================================

/**
 * Extract a human-readable message from an unknown thrown value.
 * Handles our `ApiError`, standard `Error`, Firebase-style `{code, message}`,
 * plain strings, and everything else falls back to a caller-supplied default.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message || fallback
  if (typeof err === "object" && err !== null) {
    const maybe = err as { message?: unknown }
    if (typeof maybe.message === "string" && maybe.message) return maybe.message
  }
  return fallback
}

/**
 * Extract a Firebase-style error code (e.g. "auth/email-already-in-use").
 * Returns `undefined` for non-Firebase errors so callers can chain fallbacks.
 */
export function errorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null) {
    const maybe = err as { code?: unknown }
    if (typeof maybe.code === "string") return maybe.code
  }
  return undefined
}

/**
 * Extract an HTTP status if the error is an `ApiError`. Callers that need the
 * status specifically should `instanceof ApiError`; this is a convenience for
 * loggers that want it without an extra import cycle.
 */
export function errorStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null) {
    const maybe = err as { status?: unknown }
    if (typeof maybe.status === "number") return maybe.status
  }
  return undefined
}
