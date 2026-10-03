import { logClaim } from '../../lib/log';

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

export async function POST({ request }: { request: Request }) {
  const apiKey = import.meta.env.GEMINI_API_KEY;
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `Evaluate this claim:\n<claim>${claim}</claim>` }] }],
        tools: [{ google_search: {} }],
        // Headroom for the prose Gemini sometimes writes before the JSON when search is on.
        generationConfig: { maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[she-knows] Gemini error:', upstream.status, text);
      return new Response(JSON.stringify({ error: 'Failed to evaluate claim. Try again.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await upstream.json();

    const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
    const raw = parts.filter(p => p.text).map(p => p.text).join('');
    if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      console.error('[she-knows] Gemini hit maxOutputTokens; JSON may be cut off. Output length:', raw.length);
    }
    const clean = raw.replace(/```json|```/g, '').trim();
    // With search grounding on, Gemini sometimes wraps the JSON in prose. Fall back to the outermost {...}.
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
      return new Response(
        JSON.stringify({ error: "That claim doesn't appear to be about women's sports." }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { factual_accuracy, context_score, exaggeration_score, representation_score, explanation, confidence } = parsed;
    // Only pass through the two values the UI understands; anything else is treated as factual.
    const claim_type = parsed.claim_type === 'opinion' ? 'opinion' : 'factual';

    // Validate all numeric fields are integers in 0–100 range
    const scores = { factual_accuracy, context_score, exaggeration_score, representation_score, confidence };
    for (const [key, val] of Object.entries(scores)) {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 100) {
        console.error(`[she-knows] Invalid score field "${key}":`, val);
        return new Response(JSON.stringify({ error: 'Failed to evaluate claim. Try again.' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    if (typeof explanation !== 'string' || !explanation.trim()) {
      return new Response(JSON.stringify({ error: 'Failed to evaluate claim. Try again.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // A false claim can't be rescued by high context/representation scores:
    // cap the total at factual_accuracy + 20, so 0% accurate is always Busted.
    // Keep in sync with assertions/verdict.js in sheknows-evals.
    const truthPct = Math.min(
      Math.round(
        factual_accuracy * 0.40 +
        context_score * 0.25 +
        exaggeration_score * 0.25 +
        representation_score * 0.10
      ),
      factual_accuracy + 20
    );

    const chunks: { web?: { uri?: string; title?: string } }[] =
      data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .filter(c => c.web?.uri && /^https?:\/\//i.test(c.web.uri))
      .map(c => ({ url: c.web!.uri!, title: c.web!.title || c.web!.uri! }))
      .filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i)
      .slice(0, 5);

    await logClaim({
      claim,
      result: { truthPct, factual_accuracy, context_score, exaggeration_score, representation_score, confidence, claim_type },
    });

    return new Response(
      JSON.stringify({ truthPct, factual_accuracy, context_score, exaggeration_score, representation_score, explanation, confidence, sources, claim_type }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie } }
    );
  } catch (err) {
    console.error('[she-knows] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to evaluate claim. Try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
