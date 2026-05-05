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
    <div className={`w-full rounded-full ${height} overflow-hidden`} style={{ background: '#e8e0d6' }}>
      <div
        className={`${height} rounded-full transition-all duration-700 ease-out ${getBarColor(score)}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export default function SheKnows() {
  const [claim, setClaim] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!claim.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/she-knows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ myth: claim }),
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
        { label: 'Factual Accuracy', score: result.factual_accuracy },
        { label: 'Context', score: result.context_score },
        { label: 'Exaggeration', score: result.exaggeration_score },
        { label: 'Representation', score: result.representation_score },
      ]
    : [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-6 border-l-4 pl-4" style={{ borderColor: '#6B2737' }}>
        <h2
          className="text-2xl font-black tracking-wide uppercase"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#6B2737' }}
        >
          She Knows <span aria-hidden="true">🧾</span>
        </h2>
        <p className="text-sm mt-1" style={{ fontFamily: 'sans-serif', color: '#7a6a5a' }}>
          Drop a claim. She'll check her receipts.
        </p>
      </div>

      {/* Input card */}
      <div className="rounded-xl p-5 mb-5" style={{ background: '#fff', border: '1px solid #e0d8cf' }}>

        {/* Example chips */}
        <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: 'sans-serif', color: '#a89880' }}>
          Try an example
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              style={{ fontFamily: 'sans-serif', color: '#6B2737', borderColor: '#c8a4ac' }}
              className="px-3 py-1.5 rounded-full text-xs border cursor-pointer bg-transparent transition-opacity hover:opacity-70"
              onClick={() => {
                setClaim(example);
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
          className="w-full rounded-lg p-4 text-sm resize-none focus:outline-none transition-colors mb-4"
          style={{
            fontFamily: 'sans-serif',
            minHeight: '110px',
            background: '#FAF7F2',
            border: '1px solid #d8cfc5',
            color: '#3a2a1a',
          }}
          placeholder="Drop a claim. She'll fact-check it."
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          disabled={loading}
        />

        {/* Submit */}
        <button
          className="w-full rounded-lg py-3 text-sm font-bold tracking-widest uppercase transition-opacity disabled:opacity-40"
          style={{ background: '#6B2737', color: '#FAF7F2', fontFamily: 'sans-serif' }}
          onClick={handleSubmit}
          disabled={loading || !claim.trim()}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
              </svg>
              Checking receipts…
            </span>
          ) : (
            'She knows this'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm mb-5"
          style={{ fontFamily: 'sans-serif', background: '#fde8ec', color: '#8b2020', border: '1px solid #f5c6cb' }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result && verdict && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e0d8cf' }}>

          {/* Verdict banner */}
          <div className={`${verdict.bg} ${verdict.text} px-5 py-4 flex items-center justify-between`}>
            <span className="text-lg font-black tracking-widest uppercase">{verdict.label}</span>
            <span className="text-4xl font-black tabular-nums leading-none">
              {result.truthPct}
              <span className="text-lg font-normal opacity-70"> / 100</span>
            </span>
          </div>

          {/* Main score bar */}
          <div className="px-5 pt-4 pb-2" style={{ background: '#FAF7F2' }}>
            <ScoreBar score={result.truthPct} height="h-4" />
          </div>

          <div className="px-5 pb-5 space-y-5 pt-3" style={{ background: '#FAF7F2' }}>

            {/* Rubric breakdown */}
            <div>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#a89880', fontFamily: 'sans-serif' }}>
                Score Breakdown
              </p>
              <div className="space-y-3">
                {rubricItems.map(({ label, score }) => (
                  <div key={label}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-sm" style={{ fontFamily: 'sans-serif', color: '#4a3728' }}>
                        {label}
                      </span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#3a2a1a' }}>{score}</span>
                    </div>
                    <ScoreBar score={score} height="h-2.5" />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e0d8cf' }} />

            {/* Explanation */}
            <div>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#a89880', fontFamily: 'sans-serif' }}>
                Analysis
              </p>
              <p className="text-sm leading-relaxed" style={{ fontFamily: 'sans-serif', color: '#3a2a1a' }}>
                {result.explanation}
              </p>
              <p className="text-xs mt-3" style={{ fontFamily: 'sans-serif', color: '#a89880' }}>
                {getConfidenceLabel(result.confidence)}
              </p>
            </div>

            {/* Sources */}
            {result.sources?.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid #e0d8cf' }} />
                <div>
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#a89880', fontFamily: 'sans-serif' }}>
                    Sources
                  </p>
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
                          <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#6B2737', opacity: 0.7 }} />
                          <span className="text-sm leading-snug transition-opacity group-hover:opacity-100" style={{ color: '#7a5a4a', opacity: 0.8 }}>
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
