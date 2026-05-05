import { useState } from 'react';

const EXAMPLES = [
  "Nobody watches women's sports",
  "The WNBA rim is lower than the NBA rim",
  "Women soccer players aren't as athletic as men",
];

function getVerdict(pct: number): { label: string; bg: string; text: string } {
  if (pct <= 20) return { label: 'Busted', bg: 'bg-error', text: 'text-error-content' };
  if (pct <= 45) return { label: 'Mostly False', bg: 'bg-warning', text: 'text-warning-content' };
  if (pct <= 70) return { label: 'Mixed', bg: 'bg-info', text: 'text-info-content' };
  if (pct <= 85) return { label: 'Mostly True', bg: 'bg-success', text: 'text-success-content' };
  return { label: 'Confirmed', bg: 'bg-success', text: 'text-success-content' };
}

function getBarColor(score: number): string {
  if (score <= 30) return 'bg-error';
  if (score <= 55) return 'bg-warning';
  if (score <= 75) return 'bg-info';
  return 'bg-success';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence <= 40) return 'Low confidence — limited data found';
  if (confidence <= 70) return 'Moderate confidence';
  return 'High confidence — strong data found';
}

interface Source {
  url: string;
  title: string;
}

interface Result {
  truthPct: number;
  factual_accuracy: number;
  context_score: number;
  exaggeration_score: number;
  representation_score: number;
  explanation: string;
  confidence: number;
  sources: Source[];
}

function ScoreBar({ score, height = 'h-3' }: { score: number; height?: string }) {
  return (
    <div className={`w-full bg-base-300 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${height} rounded-full transition-all duration-700 ease-out ${getBarColor(score)}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export default function MythBuster() {
  const [myth, setMyth] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!myth.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/mythbuster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ myth }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const verdict = result ? getVerdict(result.truthPct) : null;

  const rubricItems = result
    ? [
        { label: 'Factual Accuracy', score: result.factual_accuracy, weight: '40%' },
        { label: 'Context', score: result.context_score, weight: '25%' },
        { label: 'Exaggeration', score: result.exaggeration_score, weight: '25%' },
        { label: 'Representation', score: result.representation_score, weight: '10%' },
      ]
    : [];

  return (
    <div className="max-w-4xl mx-auto px-2 py-6">

      {/* Header */}
      <div className="mb-5 border-l-4 border-primary pl-4">
        <h2 className="text-xl font-black tracking-wide text-primary uppercase">Myth Buster</h2>
        <p className="text-base-content/70 text-base mt-1 font-normal" style={{ fontFamily: 'sans-serif' }}>
          Submit a claim about women's sports and get an AI fact-check score.
        </p>
      </div>

      {/* Input card */}
      <div className="rounded-lg bg-base-200 border border-base-300 p-5 mb-5">

        {/* Example chips */}
        <p className="text-xs text-base-content/50 uppercase tracking-widest mb-2" style={{ fontFamily: 'sans-serif' }}>Try an example</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              style={{ fontFamily: 'sans-serif' }}
              className="px-3 py-1.5 rounded-full text-xs border border-base-content/20 text-base-content/70 hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent"
              onClick={() => {
                setMyth(example);
                setResult(null);
                setError(null);
              }}
            >
              {example}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          className="w-full rounded-md bg-base-300 border border-base-content/10 text-base-content placeholder-base-content/30 p-4 text-base resize-none focus:outline-none focus:border-primary transition-colors mb-4"
          style={{ fontFamily: 'sans-serif', minHeight: '110px' }}
          placeholder="Type a myth or headline about women's sports…"
          value={myth}
          onChange={(e) => setMyth(e.target.value)}
          disabled={loading}
        />

        {/* Submit */}
        <button
          className="btn btn-primary w-full text-sm tracking-widest uppercase"
          onClick={handleSubmit}
          disabled={loading || !myth.trim()}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />
              <span style={{ fontFamily: 'sans-serif' }}>Analyzing…</span>
            </span>
          ) : (
            'Fact-check this'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-error/30 bg-error/10 text-error px-4 py-3 text-sm mb-5" style={{ fontFamily: 'sans-serif' }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && verdict && (
        <div className="rounded-lg bg-base-200 border border-base-300 overflow-hidden">

          {/* Verdict banner */}
          <div className={`${verdict.bg} ${verdict.text} px-5 py-4 flex items-center justify-between`}>
            <span className="text-lg font-black tracking-widest uppercase">{verdict.label}</span>
            <span className="text-4xl font-black tabular-nums leading-none">{result.truthPct}<span className="text-lg font-normal opacity-70"> / 100</span></span>
          </div>

          {/* Main score bar */}
          <div className="px-5 pt-4 pb-2">
            <ScoreBar score={result.truthPct} height="h-4" />
          </div>

          <div className="px-5 pb-5 space-y-5 pt-3">

            {/* Rubric breakdown */}
            <div>
              <p className="text-xs uppercase tracking-widest text-base-content/40 mb-3">Score Breakdown</p>
              <div className="space-y-3">
                {rubricItems.map(({ label, score, weight }) => (
                  <div key={label}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-base text-base-content/80" style={{ fontFamily: 'sans-serif' }}>
                        {label}
                        <span className="text-xs text-base-content/40 ml-1.5">({weight})</span>
                      </span>
                      <span className="text-base font-bold text-base-content tabular-nums">{score}</span>
                    </div>
                    <ScoreBar score={score} height="h-2.5" />
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-base-content/10" />

            {/* Explanation */}
            <div>
              <p className="text-xs uppercase tracking-widest text-base-content/40 mb-2">Analysis</p>
              <p className="text-base leading-relaxed text-base-content/90" style={{ fontFamily: 'sans-serif' }}>
                {result.explanation}
              </p>
              <p className="text-xs text-base-content/40 mt-3" style={{ fontFamily: 'sans-serif' }}>
                {getConfidenceLabel(result.confidence)}
              </p>
            </div>

            {/* Sources */}
            {result.sources?.length > 0 && (
              <>
                <div className="border-t border-base-content/10" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-base-content/40 mb-3">Sources</p>
                  <ul className="space-y-2">
                    {result.sources.map((source) => (
                      <li key={source.url}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 group"
                          style={{ fontFamily: 'sans-serif' }}
                        >
                          <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                          <span className="text-sm text-base-content/60 group-hover:text-primary transition-colors leading-snug">
                            {source.title}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
