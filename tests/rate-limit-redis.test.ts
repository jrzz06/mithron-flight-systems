import { describe, expect, it, vi } from "vitest";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { checkRateLimit } from "@/lib/rate-limit";

describe("distributed rate limiting", () => {
  it("falls back to in-memory limiter when Upstash is not configured in non-production", async () => {
    const key = `test-${Date.now()}`;
    const first = await checkDistributedRateLimit(key, 2, 60_000);
    const second = await checkDistributedRateLimit(key, 2, 60_000);
    const third = await checkDistributedRateLimit(key, 2, 60_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  it("throws in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(checkDistributedRateLimit("prod-missing-upstash", 1, 60_000)).rejects.toThrow(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production."
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps the in-memory limiter available for dev", () => {
    const key = `memory-${Date.now()}`;
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(false);
  });
});
