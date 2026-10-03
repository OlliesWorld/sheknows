import { Redis } from '@upstash/redis';

const LOG_KEY = 'she-knows:logs';
const MAX_LOGS = 1000;

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const url = import.meta.env.KV_REST_API_URL ?? import.meta.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.KV_REST_API_TOKEN ?? import.meta.env.UPSTASH_REDIS_REST_TOKEN;

  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export async function logClaim(entry: Record<string, unknown>): Promise<void> {
  const client = getRedis();
  if (!client) {
    console.warn('[she-knows] Redis not configured, skipping persisted log');
    return;
  }

  try {
    await client.lpush(LOG_KEY, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }));
    await client.ltrim(LOG_KEY, 0, MAX_LOGS - 1);
  } catch (err) {
    console.error('[she-knows] Failed to write log to Redis:', err);
  }
}
