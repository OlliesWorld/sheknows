# She Knows

An AI fact-checker for women's sports claims. Drop a claim — She'll check her receipts.

Live at [sheknows.olliesworld.xyz](https://sheknows.olliesworld.xyz)

---

## What it does

Users submit a claim about women's sports ("The WNBA rim is lower than the NBA rim"). The app scores it across four dimensions using GPT-6 Luna with live Perplexity web search (both through OpenRouter), then returns a verdict (Busted → Confirmed), a score breakdown, an analysis, and sources.

**Rate limit**: 2 fact-checks per visitor per day, counted by IP in each server instance's memory. On Vercel that's approximate (separate instances keep separate counts).

The model, search engine and prompt were chosen with an eval suite: [sheknows-evals](https://github.com/OlliesWorld/sheknows-evals).

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Astro 7 (SSR), Node 24 |
| UI | React 19 island (`client:load`) |
| Styling | Tailwind CSS v4 |
| AI | GPT-6 Luna + Perplexity web search, through OpenRouter |
| Claim log | Redis (Redis Cloud via the Vercel integration, shared with SheRules) |
| Tracing | Arize Phoenix (Phoenix Cloud in production, optional local Phoenix in dev) |
| Deployment | Vercel (`@astrojs/vercel` adapter) |

---

## Local dev

Needs Node 24 (`nvm use` reads `.nvmrc`).

```bash
# 1. Install
npm install

# 2. Add your OpenRouter API key and a system prompt (see Environment variables)
echo "OPENROUTER_API_KEY=your_key_here" > .env
echo 'SHE_KNOWS_PROMPT=`your system prompt here`' >> .env

# 3. Start
npm run dev
```

Open [localhost:4321](http://localhost:4321).

**Skip the API call in dev**: set `MOCK_SHE_KNOWS=true` to return a hardcoded answer without calling OpenRouter. Add `MOCK_DELAY_MS=9000` to slow it down and preview the loading state:

```bash
MOCK_SHE_KNOWS=true MOCK_DELAY_MS=9000 npm run dev
```

**`.env` gotcha**: the prompt is a multi-line value wrapped in backticks. Put every other variable on its own line *outside* the backticks; anything between them becomes part of the prompt.

---

## Claim log

Every claim is saved to Redis under the key `she-knows:logs` (newest 1,000): the claim, the full answer (scores, explanation, sources), or `off_topic` / `error` with a reason. No IP addresses or visitor details.

```bash
npm run logs              # newest 20
npm run logs -- 100       # newest 100
npm run logs -- --errors  # failed requests only
npm run logs -- --json    # raw entries
```

Needs `REDIS_URL` in `.env`. You can also browse the list in Redis Insight (Redis Cloud → the database → Launch).

---

## Tracing (Phoenix)

Each request is traced with OpenInference spans: `evaluate-claim` → `openrouter.chat` (messages, model, token counts, reasoning tokens, citations) → `redis.log-claim`.

- **Production** sends to Phoenix Cloud, project `she-knows`. Spans are flushed with Vercel's `waitUntil` after the response, so users don't wait on them.
- **Local dev** sends to project `she-knows-dev`. To use a local Phoenix instead:
  ```bash
  pip install arize-phoenix && phoenix serve       # UI at http://localhost:6006
  PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006 npm run dev
  ```
- **The system prompt is redacted** from every trace unless traces go to a Phoenix on your own machine. Each LLM span carries `llm.prompt_template.version`, a short SHA-256 fingerprint of the prompt, so you can tell which prompt version produced an answer.

Tracing is off when `PHOENIX_COLLECTOR_ENDPOINT` isn't set.

---

## Project structure

```
src/
├── components/
│   └── SheKnows.tsx         # React island — all UI and state
├── lib/
│   ├── log.ts               # Claim log (Redis), traced
│   ├── redis.ts             # Redis client: REDIS_URL, fail-fast retries (ported from SheRules)
│   └── tracing.ts           # Phoenix registration and flush
├── pages/
│   ├── index.astro          # Single page, loads the island
│   └── api/
│       └── she-knows.ts     # POST endpoint — OpenRouter call, validation, rate limit, tracing
└── styles/
    └── global.css           # Tailwind import, design tokens, keyframes
scripts/
└── logs.mjs                 # npm run logs
```

---

## Scoring rubric

Each claim is scored 0–100 across four dimensions, then weighted into a final `truthPct`:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Factual Accuracy | 40% | Is the core claim correct? |
| Context | 25% | Is necessary context present? |
| Exaggeration | 25% | Does the language reflect reality (not just hyperbole)? |
| Representation | 10% | Is it representative, not cherry-picked? |

The total is capped at Factual Accuracy + 20, so a false claim always reads Busted. Pure-taste opinions get no score.

Verdicts: **Busted** (0–20) · **Mostly False** (21–45) · **Mixed** (46–70) · **Mostly True** (71–85) · **Confirmed** (86–100)

---

## Deploying to Vercel

1. Push to GitHub; Vercel deploys `main`.
2. Set the environment variables below (Production).
3. **Set the prompt with the CLI**, not the dashboard. The dashboard editor turns line breaks into spaces:
   ```bash
   vercel env add SHE_KNOWS_PROMPT production --force --sensitive < path/to/prompt.txt
   ```
4. Redeploy after changing any variable. Astro inlines server env vars at build time, so changes only apply to the next build.

Check which prompt is live: the `llm.prompt_template.version` fingerprint in Phoenix should match `sha256(prompt).slice(0, 8)`.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key. Set a monthly credit limit on it. |
| `SHE_KNOWS_PROMPT` | Yes | The system prompt. Kept out of the repo on purpose. It must tell the model to return the JSON shape the API route validates (four 0–100 scores, `explanation`, `confidence`) or `{"error":"off_topic"}`. In `.env`, wrap the multi-line value in backticks. |
| `REDIS_URL` | Production | Redis connection string for the claim log (`redis://` or `rediss://`). Without it, logging is skipped with a warning. |
| `PHOENIX_COLLECTOR_ENDPOINT` | No | Phoenix URL. Phoenix Cloud hostname in production, or `http://localhost:6006` locally. Tracing is off without it. |
| `PHOENIX_API_KEY` | With Phoenix Cloud | Phoenix Cloud API key (from Phoenix Settings, not an Arize AX `ak-` key). |
| `SHE_KNOWS_MODEL` | No | OpenRouter model ID. Default `openai/gpt-6-luna`. Run the evals before changing it. |
| `SHE_KNOWS_SEARCH_ENGINE` | No | OpenRouter web search engine. Default `perplexity` (`exa` also works). |
| `MOCK_SHE_KNOWS` | No | `true` returns a hardcoded answer without calling OpenRouter (dev). |
| `MOCK_DELAY_MS` | No | Delay for the mock answer, to preview the loader (max 30000). |
