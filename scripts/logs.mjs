// Prints the most recent logged claims from Redis (key she-knows:logs).
// Usage: npm run logs              (newest 20)
//        npm run logs -- 100       (newest 100)
//        npm run logs -- --errors  (only failed requests among the newest 20)
//        npm run logs -- --json    (raw JSON entries)
// Needs REDIS_URL in the environment or in .env (same value as in Vercel). See docs/LOGS.md.
import { readFileSync } from 'node:fs';
import { createClient } from 'redis';

const LOG_KEY = 'she-knows:logs'; // same as src/lib/log.ts

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);
const errorsOnly = args.includes('--errors');
const asJson = args.includes('--json');

// Read only REDIS_URL from .env. The file also holds a multi-line prompt, so we
// don't hand the whole thing to a .env parser.
function redisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split('\n')
      .find((l) => l.startsWith('REDIS_URL='));
    return line?.slice('REDIS_URL='.length).trim().replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}

const url = redisUrl();
if (!url) {
  console.error('Set REDIS_URL (copy it from Vercel → SheKnows → Settings → Environment Variables into .env).');
  process.exit(1);
}

const client = createClient({ url, socket: { connectTimeout: 5000, reconnectStrategy: false } });
client.on('error', () => {}); // connect() rejects with the real error
await client.connect();
const raw = await client.lRange(LOG_KEY, 0, count - 1);
const total = await client.lLen(LOG_KEY);
await client.quit();

let entries = raw.map((e) => JSON.parse(e));
if (errorsOnly) entries = entries.filter((e) => e.result === 'error');

if (asJson) {
  console.log(JSON.stringify(entries, null, 2));
  process.exit(0);
}

console.log(`${entries.length} shown · ${total} in the log (newest first)\n`);
for (const e of entries) {
  const when = e.timestamp ? new Date(e.timestamp).toLocaleString() : '?';
  console.log(`— ${when}`);
  console.log(`  Q: ${e.claim}`);
  const r = e.result;
  if (r === 'off_topic') {
    console.log('  A: (off topic, not about women\'s sports)');
  } else if (r === 'error') {
    console.log(`  A: ERROR ${e.reason ?? ''}`);
  } else if (r && typeof r === 'object') {
    const verdict = r.truthPct == null ? 'opinion, no score' : `${r.truthPct}% true`;
    console.log(`  A: ${verdict} (${r.claim_type ?? 'factual'}, confidence ${r.confidence ?? '?'})`);
    if (r.explanation) console.log(`     ${r.explanation}`);
    for (const s of r.sources ?? []) console.log(`     · ${s.title} — ${s.url}`);
  }
  console.log();
}
