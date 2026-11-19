import {
  MimeType,
  getInputAttributes,
  getLLMAttributes,
  getMetadataAttributes,
  getOutputAttributes,
  traceChain,
  traceLLM,
} from '@arizeai/phoenix-otel';
import { waitUntil } from '@vercel/functions';
import { createHash } from 'node:crypto';
import { logClaim } from '../../lib/log';
import { flushTraces, initTracing, tracingIsLocal } from '../../lib/tracing';

initTracing();

const DAILY_LIMIT = 2;
const MAX_CLAIM_LENGTH = 500;

const ipUsage = new Map<string, { date: string; count: number }>();

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function rateLimit(request: Request): { allowed: boolean; next: number; setCookie: string } {
  const today = new Date().toISOString().slice(0, 10);
  const ip = getClientIp(request);

  const entry = ipUsage.get(ip);
  const count = entry?.date === today ? entry.count : 0;

  const allowed = count < DAILY_LIMIT;
  const next = allowed ? count + 1 : count;

  if (allowed) {
    ipUsage.set(ip, { date: today, count: next });
  }

  const setCookie = `sk_usage=${today}:${next}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
  return { allowed, next, setCookie };
}

// The model and the search engine are separate settings, so either can be
// swapped without touching the other. Both run through OpenRouter.
// Chosen by the sheknows-evals model comparison (Nov 2026): GPT-6 Luna with
// Perplexity search passed 24/26 claims vs 20/26 for Gemini 2.5 Flash.
const DEFAULT_MODEL = 'openai/gpt-6-luna';
const DEFAULT_SEARCH_ENGINE = 'perplexity';

export async function POST(context: { request: Request }) {
  try {
    return await handlePost(context);
  } finally {
    // Send this request's traces after the response is on its way. On Vercel,
    // waitUntil keeps the function alive until they're sent; elsewhere it's a no-op
    // and the export just finishes in the background.
    waitUntil(flushTraces());
  }
}

async function handlePost({ request }: { request: Request }) {
  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The system prompt lives in an env var so it isn't published with the source.
  const systemPrompt = import.meta.env.SHE_KNOWS_PROMPT;
  if (!systemPrompt) {
    console.error('[she-knows] SHE_KNOWS_PROMPT is not set');
    return new Response(JSON.stringify({ error: 'Failed to evaluate claim. Try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { allowed, next: _next, setCookie } = rateLimit(request);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: `That's your ${DAILY_LIMIT} for today. She'll be here tomorrow.` }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let claim: string;
  try {
    const body = await request.json();
    const raw = body.myth?.trim();
    if (!raw) throw new Error('Missing claim');
    if (raw.length > MAX_CLAIM_LENGTH) throw new Error('Too long');
    // Strip control characters and normalize whitespace to prevent prompt injection
    claim = raw.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!claim) throw new Error('Missing claim');
  } catch (err) {
    const msg = err instanceof Error && err.message === 'Too long'
      ? `Claim must be ${MAX_CLAIM_LENGTH} characters or fewer.`
      : 'Invalid request body';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (import.meta.env.MOCK_SHE_KNOWS === 'true') {
    const mockScores = { factual_accuracy: 15, context_score: 20, exaggeration_score: 30, representation_score: 25 };
    const truthPct = Math.round(mockScores.factual_accuracy * 0.40 + mockScores.context_score * 0.25 + mockScores.exaggeration_score * 0.25 + mockScores.representation_score * 0.10);
    return new Response(JSON.stringify({
      truthPct,
      ...mockScores,
      explanation: 'The 2024 WNBA Finals averaged 1.3 million viewers — a record high and a 101% increase over 2023. Women\'s sports viewership has grown significantly across every major league.',
      confidence: 85,
      sources: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const outcome = await evaluateClaim(claim, systemPrompt);
    if (outcome.kind === 'off_topic') {
      return new Response(
        JSON.stringify({ error: "That claim doesn't appear to be about women's sports." }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify(outcome.verdict),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie } }
    );
  } catch (err) {
    // The user got no answer; log why, so failures show up in `npm run logs`.
    await logClaim({ claim, result: 'error', reason: String(err instanceof Error ? err.message : err).slice(0, 300) });
    if (err instanceof BadUpstreamError) {
      return new Response(JSON.stringify({ error: 'Failed to evaluate claim. Try again.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[she-knows] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to evaluate claim. Try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// OpenRouter failed, or the model's JSON didn't validate. Maps to a 502.
class BadUpstreamError extends Error {}

type ChatMessage = { role: string; content: string };
type ChatRequest = Record<string, unknown> & { model: string; messages: ChatMessage[] };

// One OpenRouter chat completion, traced as an LLM span (messages, model,
// token counts). The API key is read here rather than passed in so it never
// lands in span input.
// The system prompt is kept out of the public source, so keep it out of hosted
// traces too: unless traces go to a Phoenix on this machine, it's replaced by a
// placeholder. The trace still gets a short fingerprint of it, so you can tell
// which prompt version answered.
function promptFingerprint(body: ChatRequest): string {
  const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
  return createHash('sha256').update(system).digest('hex').slice(0, 8);
}

function redactForTrace(body: ChatRequest): ChatRequest {
  if (tracingIsLocal) return body;
  return {
    ...body,
    messages: body.messages.map((m) =>
      m.role === 'system' ? { ...m, content: '[system prompt redacted]' } : m
    ),
  };
}

const callOpenRouter = traceLLM(
  async (body: ChatRequest) => {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.OPENROUTER_API_KEY}` },
      // Searches plus reasoning usually take 5-15s; don't hang the function forever.
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify(body),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[she-knows] OpenRouter error:', upstream.status, text);
      throw new BadUpstreamError(`OpenRouter ${upstream.status}: ${text.slice(0, 500)}`);
    }
    return upstream.json();
  },
  {
    name: 'openrouter.chat',
    processInput: (rawBody: ChatRequest) => {
      const body = redactForTrace(rawBody);
      const { messages, model, ...params } = body;
      return {
        ...getInputAttributes({ value: JSON.stringify(body), mimeType: MimeType.JSON }),
        // Its own attribute: processOutput's metadata would overwrite it otherwise.
        'llm.prompt_template.version': promptFingerprint(rawBody),
        ...getLLMAttributes({
          provider: 'openrouter',
          requestModelName: model,
          invocationParameters: params,
          inputMessages: messages,
        }),
      };
    },
    processOutput: (data: any) => {
      const message = data?.choices?.[0]?.message;
      const usage = data?.usage;
      return {
        ...getOutputAttributes({ value: JSON.stringify(data), mimeType: MimeType.JSON }),
        ...getLLMAttributes({
          provider: 'openrouter',
          responseModelName: data?.model,
          outputMessages: message ? [{ role: message.role ?? 'assistant', content: message.content ?? '' }] : [],
          tokenCount: usage
            ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens }
            : undefined,
        }),
        ...getMetadataAttributes({
          finish_reason: data?.choices?.[0]?.finish_reason,
          reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens,
          citations: (message?.annotations ?? []).length,
        }),
      };
    },
  }
);

type Outcome =
  | { kind: 'off_topic' }
  | { kind: 'verdict'; verdict: Record<string, unknown> };

// The whole claim → verdict pipeline, traced as the root CHAIN span. Only the
// claim is recorded as input; the system prompt shows up on the LLM span.
const evaluateClaim = traceChain(
  async (claim: string, systemPrompt: string): Promise<Outcome> => {
    const data = await callOpenRouter({
      model: import.meta.env.SHE_KNOWS_MODEL || DEFAULT_MODEL,
      temperature: 0,
      // Reasoning tokens count against this, so leave room beyond the ~300-token answer.
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Evaluate this claim:\n<claim>${claim}</claim>` },
      ],
      // The model decides when to search (usually once, at most twice in evals).
      // max_uses is a hint OpenRouter doesn't always enforce.
      tools: [{
        type: 'openrouter:web_search',
        parameters: {
          engine: import.meta.env.SHE_KNOWS_SEARCH_ENGINE || DEFAULT_SEARCH_ENGINE,
          max_uses: 2,
          max_results: 5,
        },
      }],
    });

    const choice = data.choices?.[0];
    const raw: string = typeof choice?.message?.content === 'string' ? choice.message.content : '';
    if (choice?.finish_reason === 'length') {
      console.error('[she-knows] Model hit max_tokens; JSON may be cut off. Output length:', raw.length);
    }
    const clean = raw.replace(/```json|```/g, '').trim();
    // Models sometimes wrap the JSON in prose after searching. Fall back to the outermost {...}.
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start === -1 || end <= start) throw new Error(`No JSON object in model output: ${clean.slice(0, 200)}`);
      parsed = JSON.parse(clean.slice(start, end + 1));
    }

    if (parsed.error === 'off_topic') {
      await logClaim({ claim, result: 'off_topic' });
      return { kind: 'off_topic' };
    }

    const { factual_accuracy, context_score, exaggeration_score, representation_score, explanation, confidence } = parsed;
    // Only pass through the two values the UI understands; anything else is treated as factual.
    const claim_type = parsed.claim_type === 'opinion' ? 'opinion' : 'factual';

    // Validate all score fields: either every one is null (pure-taste opinion,
    // nothing checkable), or every one is a number in 0–100.
    const scores = { factual_accuracy, context_score, exaggeration_score, representation_score, confidence };
    const scoreEntries = Object.entries(scores);
    const allNull = scoreEntries.every(([, val]) => val === null);
    const allValidNumbers = scoreEntries.every(
      ([, val]) => typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 100
    );
    if (!allNull && !allValidNumbers) {
      console.error('[she-knows] Invalid/mixed score fields:', scores);
      throw new BadUpstreamError(`Invalid/mixed score fields: ${JSON.stringify(scores)}`);
    }
    if (typeof explanation !== 'string' || !explanation.trim()) {
      throw new BadUpstreamError('Missing explanation');
    }

    // A false claim can't be rescued by high context/representation scores:
    // cap the total at factual_accuracy + 20, so 0% accurate is always Busted.
    // Pure-taste opinions (all scores null) have no verdict at all.
    // Keep in sync with assertions/verdict.js in sheknows-evals.
    const truthPct = allNull ? null : Math.min(
      Math.round(
        factual_accuracy * 0.40 +
        context_score * 0.25 +
        exaggeration_score * 0.25 +
        representation_score * 0.10
      ),
      factual_accuracy + 20
    );

    // Search results come back as url_citation annotations on the message.
    const annotations: { type?: string; url_citation?: { url?: string; title?: string } }[] =
      choice?.message?.annotations ?? [];
    const sources = annotations
      .map(a => a.url_citation)
      .filter((c): c is { url: string; title?: string } => typeof c?.url === 'string' && /^https?:\/\//i.test(c.url))
      .map(c => ({ url: c.url, title: c.title || c.url }))
      .filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i)
      .slice(0, 5);

    const verdict = { truthPct, factual_accuracy, context_score, exaggeration_score, representation_score, explanation, confidence, sources, claim_type };
    // Log exactly what the user is shown, answer text and sources included.
    await logClaim({ claim, result: verdict });

    return { kind: 'verdict', verdict };
  },
  {
    name: 'evaluate-claim',
    processInput: (claim: string) => getInputAttributes(claim),
    processOutput: (outcome: Outcome) => ({
      ...getOutputAttributes({
        value: JSON.stringify(outcome.kind === 'verdict' ? outcome.verdict : outcome),
        mimeType: MimeType.JSON,
      }),
      ...getMetadataAttributes(
        outcome.kind === 'verdict'
          ? { outcome: 'verdict', truthPct: outcome.verdict.truthPct, claim_type: outcome.verdict.claim_type }
          : { outcome: 'off_topic' }
      ),
    }),
  }
);
