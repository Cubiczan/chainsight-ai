/**
 * VENDORED COPY — keep in sync with the canonical package.
 *
 * Vendored from @cubiczan/resilience (icohangar-ops/cubiczan-resilience,
 * typescript/src) at typescript-v0.2.0
 * (commit 60dc5f4b7030bef492fe5df0d432ae49fd612f37).
 * Check the canonical package for updates before modifying locally; this
 * copy's scope and intentional local deltas are recorded in VENDOR_COMMIT.txt
 * beside this file.
 */

/**
 * Vendored subset of cubiczan-resilience (typescript/src).
 * No npm registry is available in this environment, so the primitives are
 * copied in-tree. Source of truth:
 * ~/Desktop/icohangar-repos/cubiczan-resilience/typescript/src
 */
export { ResilienceError, isResilienceError } from "./errors";
export type {
  ResilienceErrorKind,
  ResilienceErrorOptions,
} from "./errors";
export { withTimeout } from "./timeout";
export { retry, computeBackoff } from "./retry";
export type { RetryOptions } from "./retry";
export { safeFetch } from "./safeFetch";
export type { SafeFetchOptions, AllowlistHook } from "./safeFetch";
export {
  SlidingWindowRateLimiter,
} from "./rateLimit";
export type { RateLimitOptions, RateLimitResult } from "./rateLimit";
export { requireAuth, requireAuthResponse } from "./auth";
export type { AuthResult, RequireAuthOptions } from "./auth";
