import { checkRateLimit } from "@/lib/rate-limit";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
};

let warnedAboutInMemoryRateLimit = false;

function warnInMemoryRateLimitFallback() {
  if (warnedAboutInMemoryRateLimit || process.env.NODE_ENV !== "production") return;
  warnedAboutInMemoryRateLimit = true;
  console.warn(
    "[mithron] Distributed rate limiting unavailable — falling back to in-memory counters (not shared across instances)."
  );
}

function applyInMemoryFallback(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  warnInMemoryRateLimitFallback();
  return checkRateLimit(key, maxRequests, windowMs);
}

export async function checkDistributedRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.");
    }
    return applyInMemoryFallback(key, maxRequests, windowMs);
  }

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `ratelimit:${key}`;

  try {
    const incrResponse = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (!incrResponse.ok) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Rate limit service unavailable.");
      }
      return applyInMemoryFallback(key, maxRequests, windowMs);
    }
    const count = Number(await incrResponse.text());
    if (count === 1) {
      await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/${windowSec}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
    }
    if (count > maxRequests) {
      return { allowed: false, remaining: 0, retryAfterMs: windowMs };
    }
    return { allowed: true, remaining: Math.max(0, maxRequests - count) };
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error instanceof Error ? error : new Error("Rate limit service unavailable.");
    }
    return applyInMemoryFallback(key, maxRequests, windowMs);
  }
}
