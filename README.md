# She Knows

An AI fact-checker for women's sports claims. Drop a claim — She'll check her receipts.

Live at [she-knows.olliesworld.xyz](https://she-knows.olliesworld.xyz)

---

## What it does

Users submit a claim about women's sports ("The WNBA rim is lower than the NBA rim"). The app scores it across four dimensions using GPT-6 Luna with live Perplexity web search (both through OpenRouter), then returns a verdict (Busted → Confirmed), a score breakdown, an analysis, and sources.

**Rate limit**: 2 fact-checks per user per day (IP-based).

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Astro 5 (SSR) |
| UI | React 19 island (`client:load`) |
| Styling | Tailwind CSS v4 |
| AI | GPT-6 Luna + Perplexity web search, through OpenRouter |
| Deployment | Vercel (`@astrojs/vercel` adapter) |

---

## Local dev

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

**Skip the API call in dev** — set `MOCK_SHE_KNOWS=true` in `.env` to return a hardcoded mock response without calling OpenRouter.

---

## Project structure

```
src/
├── components/
│   └── SheKnows.tsx        # React island — all UI and state
├── pages/
│   ├── index.astro          # Single page, loads the island
│   └── api/
│       └── she-knows.ts     # POST endpoint — OpenRouter call + rate limiting
└── styles/
    └── global.css           # Tailwind import + verdict badge colors
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

Verdicts: **Busted** (0–20) · **Mostly False** (21–45) · **Mixed** (46–70) · **Mostly True** (71–85) · **Confirmed** (86–100)

---

## Deploying to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Add environment variables: `OPENROUTER_API_KEY` and `SHE_KNOWS_PROMPT`
4. Deploy — the Vercel adapter is already configured

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key. Set a monthly credit limit on it. |
| `SHE_KNOWS_PROMPT` | Yes | The system prompt. Kept out of the repo on purpose. It must tell the model to return the JSON shape the API route validates (four 0–100 scores, `explanation`, `confidence`) or `{"error":"off_topic"}`. In `.env`, wrap the multi-line value in backticks. |
| `SHE_KNOWS_MODEL` | No | OpenRouter model ID. Default `openai/gpt-6-luna`. Run the evals before changing it. |
| `SHE_KNOWS_SEARCH_ENGINE` | No | OpenRouter web search engine. Default `perplexity` (`exa` also works). |
| `MOCK_SHE_KNOWS` | No | Set `true` to skip the API call in dev |
