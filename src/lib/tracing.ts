import { register } from '@arizeai/phoenix-otel';

// Local LLM tracing with Arize Phoenix (https://arize.com/docs/phoenix).
// Off unless PHOENIX_COLLECTOR_ENDPOINT is set (e.g. http://localhost:6006),
// so production is untouched. Without a registered provider the trace*
// wrappers in the API route are no-ops.
const endpoint = import.meta.env.PHOENIX_COLLECTOR_ENDPOINT;

let registered = false;

export function initTracing() {
  if (registered || !endpoint) return;
  registered = true;
  register({
    projectName: 'she-knows',
    url: endpoint,
    // Export each span immediately: dev traffic is tiny and we want traces in
    // the UI the moment a request finishes.
    batch: false,
  });
  console.log(`[she-knows] Phoenix tracing on → ${endpoint}`);
}
