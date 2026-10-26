import { AppError } from "./errors";

/**
 * Fixed-window in-memory rate limiter. Good for a single instance; for multiple
 * instances swap the Map for Redis (same interface).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    b.count += 1;
    if (b.count > limit) {
      const mins = Math.ceil((b.resetAt - now) / 60000);
      throw new AppError(`Too many attempts. Try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
    }
  }
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export const __resetRateLimits = () => buckets.clear();
