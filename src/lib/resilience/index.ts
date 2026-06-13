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
