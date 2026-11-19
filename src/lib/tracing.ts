import { register } from '@arizeai/phoenix-otel';

// LLM tracing with Arize Phoenix (https://arize.com/docs/phoenix).
// Off unless PHOENIX_COLLECTOR_ENDPOINT is set:
// - Production (Vercel): Phoenix Cloud, with PHOENIX_API_KEY.
// - Local: whatever .env or the shell sets, e.g. http://localhost:6006 for a local
//   `phoenix serve`. Local traces go to a separate project, she-knows-dev.
// Without a registered provider the trace* wrappers in the API route are no-ops.
const endpoint = import.meta.env.PHOENIX_COLLECTOR_ENDPOINT;
const apiKey = import.meta.env.PHOENIX_API_KEY;

/** True when traces go to a Phoenix on this machine, so nothing leaves it. */
export const tracingIsLocal = (() => {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint ?? '').hostname);
  } catch {
    return false;
  }
})();

type Provider = ReturnType<typeof register>;
let provider: Provider | undefined;

export function initTracing() {
  if (provider || !endpoint) return;
  provider = register({
    projectName: import.meta.env.DEV ? 'she-knows-dev' : 'she-knows',
    url: endpoint,
    apiKey,
    // Export each span as it ends. Traffic is low, and on Vercel there's no
    // long-lived process to flush a batch later.
    batch: false,
  });
  console.log(`[she-knows] Phoenix tracing on → ${new URL(endpoint).host}`);
}

/**
 * Waits for spans that are still being exported. On Vercel, pass this to
 * waitUntil() so the function isn't frozen before the traces are sent.
 * Never rejects: a tracing problem must not break answering.
 */
export async function flushTraces(): Promise<void> {
  try {
    await provider?.forceFlush();
  } catch (err) {
    console.error('[she-knows] Failed to send traces to Phoenix:', err);
  }
}
