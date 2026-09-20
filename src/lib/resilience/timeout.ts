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
import { ResilienceError } from "./errors";

export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label = "operation",
): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve(promise);
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new ResilienceError(
          "timeout",
          `${label} timed out after ${ms}ms`,
          { attempts: 1 },
        ),
      );
    }, ms);

    // Do not let the timer hold the process open in Node.
    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      (timer as { unref: () => void }).unref();
    }

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
