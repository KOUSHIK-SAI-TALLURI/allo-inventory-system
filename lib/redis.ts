// lib/redis.ts
import { createClient } from "redis";

const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient> | undefined;
};

export const redis =
  globalForRedis.redis ??
  createClient({
    url: process.env.REDIS_URL,
  });

if (!globalForRedis.redis) {
  globalForRedis.redis = redis;
  redis.on("error", (err) => console.error("[Redis] Client error:", err));
  redis.connect().catch(console.error);
}

export async function acquireLock(
  key: string,
  ttlMs: number = 5000
): Promise<string | null> {
  const lockKey = `lock:${key}`;
  const token = crypto.randomUUID();
  const result = await redis.set(lockKey, token, {
    NX: true,
    PX: ttlMs,
  });
  return result === "OK" ? token : null;
}

export async function releaseLock(key: string, token: string): Promise<void> {
  const lockKey = `lock:${key}`;
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, { keys: [lockKey], arguments: [token] });
}

export async function getIdempotencyResult(key: string): Promise<string | null> {
  return redis.get(`idempotency:${key}`);
}

export async function setIdempotencyResult(
  key: string,
  result: string,
  ttlSeconds: number = 86400
): Promise<void> {
  await redis.set(`idempotency:${key}`, result, { EX: ttlSeconds });
}
