import { traceChain } from '@arizeai/phoenix-otel';
import { redis, type RedisStore } from './redis';

// Claim log in Redis (shared database with SheRules, separate key). Each claim
// is pushed onto a list as JSON, and the list is trimmed to the newest MAX_LOGS.
// Read it with `npm run logs`, or in Redis Insight. See docs/LOGS.md.
export const LOG_KEY = 'she-knows:logs';
const MAX_LOGS = 1000;

export interface ClaimLogEntry {
  claim: string;
  /** The verdict sent to the user, or why there wasn't one. */
  result: Record<string, unknown> | 'off_topic' | 'error';
  /** Short reason, for result: 'error'. */
  reason?: string;
}

// The Redis write itself, traced so its latency shows in Phoenix. It throws on
// failure so the span is marked as an error (no-op when tracing is off).
const writeLog = traceChain(
  async (client: RedisStore, entry: ClaimLogEntry) => {
    await client.lpush(LOG_KEY, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }));
    await client.ltrim(LOG_KEY, 0, MAX_LOGS - 1);
  },
  { name: 'redis.log-claim', processInput: (_client, entry) => ({ 'input.value': JSON.stringify(entry) }) }
);

/**
 * Saves one claim to the log. Never throws: a logging problem must not break answering.
 * No IP address or other visitor details are logged.
 */
export async function logClaim(entry: ClaimLogEntry): Promise<void> {
  if (!redis) {
    console.warn('[she-knows] Redis not configured, skipping claim log');
    return;
  }
  try {
    await writeLog(redis, entry);
  } catch (err) {
    console.error('[she-knows] Failed to write log to Redis:', err);
  }
}
