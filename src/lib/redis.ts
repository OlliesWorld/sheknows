import { Redis as UpstashRedis } from '@upstash/redis';
import { createClient } from 'redis';

// Ported from SheRules (src/lib/server/redis.ts). Both apps share one Redis
// Cloud database (Vercel Redis integration) and write to separate keys.

/** The Redis commands SheKnows uses (the claim log). */
export interface RedisStore {
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
}

/** A standard Redis database from a redis:// or rediss:// URL. */
function fromRedisUrl(url: string): RedisStore {
  const client = createClient({
    url,
    socket: {
      connectTimeout: 5000,
      // By default the client retries forever, so a request waiting on Redis would hang.
      // Give up after 3 quick retries instead; the next request starts a fresh connection.
      reconnectStrategy: (retries) => (retries >= 3 ? new Error('Redis unreachable') : 200 * (retries + 1)),
    },
  });
  // Without an error listener, a dropped connection would crash the server.
  client.on('error', (err) => console.error('[she-knows] Redis connection error:', err.message));

  // One connection per server instance, opened on first use and reused after that.
  // If connecting fails, the next call tries again.
  let connecting: Promise<unknown> | undefined;
  const connected = async () => {
    if (!client.isOpen) {
      connecting ??= client.connect().finally(() => (connecting = undefined));
    }
    await connecting;
    return client;
  };

  return {
    lpush: async (key, value) => (await connected()).lPush(key, value),
    ltrim: async (key, start, stop) => (await connected()).lTrim(key, start, stop),
  };
}

/** An Upstash database over its REST API. Fallback only. */
function fromUpstash(url: string, token: string): RedisStore {
  // The client's default is 5 retries (~4.3s of backoff) before giving up, which once
  // stalled every request when the database was archived. One retry is plenty.
  const client = new UpstashRedis({ url, token, retry: { retries: 1 } });
  return {
    lpush: (key, value) => client.lpush(key, value),
    ltrim: (key, start, stop) => client.ltrim(key, start, stop),
  };
}

const env = import.meta.env;
const upstashUrl = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
const upstashToken = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;

/** Shared Redis for the claim log, or null when not configured. */
export const redis: RedisStore | null = env.REDIS_URL
  ? fromRedisUrl(env.REDIS_URL)
  : upstashUrl && upstashToken
    ? fromUpstash(upstashUrl, upstashToken)
    : null;
