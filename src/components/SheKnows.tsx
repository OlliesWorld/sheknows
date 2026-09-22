import { useState, useEffect } from 'react';

function useIsMobile(bp = 768) {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < bp);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return mobile;
}

const MAX_QUESTIONS = 2;

const EXAMPLES = [
  { category: 'Viewership', claim: "Nobody actually watches women's sports." },
  { category: 'Equipment',  claim: "The WNBA rim is lower than the NBA rim." },
  { category: 'Athletics',  claim: "Women soccer players aren't as athletic as men." },
];

interface Source { url: string; title: string; }

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

interface Question {
  claim: string;
  result: Result;
  filedAt: string;
}

function getVerdict(pct: number) {
  if (pct <= 20) return { label: 'Busted',       bg: '#4A1A26' };
  if (pct <= 45) return { label: 'Mostly False', bg: '#6B2737' };
  if (pct <= 70) return { label: 'Mixed',        bg: '#8A6A2A' };
  if (pct <= 85) return { label: 'Mostly True',  bg: '#2D5A3D' };
  return              { label: 'Confirmed',      bg: '#1A3D2A' };
}

function getBarColor(score: number): string {
  if (score <= 30) return '#A85064';
  if (score <= 55) return '#B8964A';
  if (score <= 75) return '#4A8A5C';
  return '#2D5A3D';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence <= 40) return 'Low confidence — limited data found';
  if (confidence <= 70) return 'Moderate confidence';
  return 'High confidence — strong data found';
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ width: '100%', height: '3px', background: 'var(--cream-deep)' }}>
      <div style={{
        height: '100%',
        width: `${score}%`,
        background: getBarColor(score),
        transition: 'width 0.75s cubic-bezier(0.22, 0.61, 0.36, 1)',
      }} />
    </div>
  );
}

// ─── Landing ────────────────────────────────────────────────────────────────

function Landing({ onSubmit, loading }: { onSubmit: (c: string) => void; loading: boolean }) {
  const [claim, setClaim] = useState('');
  const mobile = useIsMobile();

  function submit(override?: string) {
    const val = override ?? claim;
    if (!val.trim() || loading) return;
    onSubmit(val);
  }

  const now   = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  const year  = now.getFullYear();

  const hPad = mobile ? '16px' : '40px';

  return (
    <div className="paper-bg" style={{ minHeight: '100vh' }}>

      {/* Masthead bar */}
      <div style={{ padding: `14px ${hPad}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', gap: mobile ? '10px' : '18px', flexWrap: 'wrap' }}>
          {!mobile && <span className="eyebrow" style={{ fontWeight: 700 }}>Vol. I · No. 04</span>}
          <span className="eyebrow" style={{ fontWeight: mobile ? 700 : 400 }}>{month} · {year}</span>
        </div>
        <span className="eyebrow">{mobile ? `${MAX_QUESTIONS} sessions left` : `Sessions Remaining · ${String(MAX_QUESTIONS).padStart(2, '0')}`}</span>
      </div>
      <div style={{ height: '1px', background: 'var(--ink)', margin: `0 ${hPad}` }} />

      {/* Content */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: mobile ? '36px 20px 60px' : '56px 24px 80px' }}>

        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: mobile ? '24px' : '32px' }}>
          {!mobile && <div style={{ flex: 1, height: '1px', background: 'var(--rule)' }} />}
          <span className="eyebrow">— A Column for the Record —</span>
          {!mobile && <div style={{ flex: 1, height: '1px', background: 'var(--rule)' }} />}
        </div>

        {/* Giant title */}
        <h1 className="serif" style={{
          fontSize: mobile ? 'clamp(3.8rem, 18vw, 5.5rem)' : 'clamp(4.5rem, 15vw, 8rem)',
          fontWeight: 900,
          lineHeight: 0.95,
          margin: '0 0 24px',
          letterSpacing: '-0.02em',
        }}>
          <span style={{ color: 'var(--ink)', fontStyle: 'normal' }}>She </span>
          <span style={{ color: 'var(--burgundy)', fontStyle: 'italic' }}>Knows.</span>
        </h1>

        {/* Tagline */}
        {mobile ? (
          <p className="serif" style={{ fontSize: '15px', fontStyle: 'italic', color: 'var(--ink-soft)', margin: '0 0 36px', lineHeight: 1.5 }}>
            Women's sports, no mansplaining required.
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '52px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--rule)' }} />
            <p className="serif" style={{ fontSize: '16px', fontStyle: 'italic', color: 'var(--ink-soft)', margin: 0, whiteSpace: 'nowrap' }}>
              Women's sports, no mansplaining required.
            </p>
            <div style={{ flex: 1, height: '1px', background: 'var(--rule)' }} />
          </div>
        )}

        {/* Drop cap intro */}
        <p className={mobile ? 'sans' : 'sans dropcap'} style={{ fontSize: mobile ? '15px' : '16px', lineHeight: 1.8, color: 'var(--ink-soft)', margin: `0 0 ${mobile ? '36px' : '52px'}` }}>
          {mobile ? 'A' : ''}Ask her anything about women's sports — the leagues, the legends, the receipts. She doesn't argue, she doesn't perform. She reads the room, checks the tape, and tells you what's true. Two questions per session. Make them count.
        </p>

        {/* Input */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <span className="eyebrow" style={{ color: 'var(--ink)' }}>· Submit a Claim</span>
            <span className="eyebrow">{MAX_QUESTIONS} / {MAX_QUESTIONS} Questions Left</span>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: '3px' }}>
            <textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              disabled={loading}
              placeholder="e.g. The WNBA rim is lower than the NBA rim…"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
              style={{
                width: '100%',
                minHeight: mobile ? '100px' : '120px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: mobile ? '16px' : '17px',
                fontStyle: 'italic',
                color: claim ? 'var(--ink)' : 'var(--ink-faint)',
                lineHeight: 1.6,
                fontFamily: "'Playfair Display', Georgia, serif",
                boxSizing: 'border-box',
                padding: '18px 18px 12px',
              }}
            />
            <div style={{ height: '1px', background: 'var(--rule-soft)' }} />
            <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              {!mobile && <span className="eyebrow">⌘ + ↵ to ask · plain text only</span>}
              <button
                onClick={() => submit()}
                disabled={loading || !claim.trim()}
                style={{
                  background: loading || !claim.trim() ? 'var(--ink-faint)' : 'var(--burgundy)',
                  color: 'var(--cream)',
                  border: 'none',
                  borderRadius: '2px',
                  padding: '10px 20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: loading || !claim.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter Tight, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s',
                  marginLeft: mobile ? 'auto' : undefined,
                }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none">
                      <circle opacity={0.3} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path opacity={0.8} fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 00-6 6H4z" />
                    </svg>
                    Asking…
                  </>
                ) : 'Ask Her →'}
              </button>
            </div>
          </div>
        </div>

        {/* Example chips */}
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '12px' }}>· Or try one of these</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {EXAMPLES.map(({ category, claim: ex }) => (
              <button
                key={ex}
                onClick={() => submit(ex)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: mobile ? '10px' : '14px',
                  padding: mobile ? '11px 16px' : '12px 20px',
                  border: '1px solid var(--rule)',
                  borderRadius: '100px',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.12s, background 0.12s',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--burgundy-50)';
                  e.currentTarget.style.borderColor = 'var(--burgundy-100)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--rule)';
                }}
              >
                <span className="eyebrow" style={{ color: 'var(--burgundy)', flexShrink: 0 }}>{category}</span>
                <span className="serif" style={{ fontSize: mobile ? '14px' : '15px', fontStyle: 'italic', color: 'var(--ink-soft)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: mobile ? 'nowrap' : 'normal' }}>
                  "{ex}"
                </span>
                <span style={{ color: 'var(--ink-faint)', fontSize: '15px', flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Session ────────────────────────────────────────────────────────────────

const ORDINALS = ['ONE', 'TWO', 'THREE'];

function Session({
  questions,
  loading,
  onSubmit,
  sessionClosed,
}: {
  questions: Question[];
  loading: boolean;
  onSubmit: (c: string) => void;
  sessionClosed: boolean;
}) {
  const [claim, setClaim] = useState('');
  const mobile = useIsMobile();
  const hPad = mobile ? '16px' : '44px';

  function submit() {
    if (!claim.trim() || loading || sessionClosed) return;
    onSubmit(claim);
    setClaim('');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--paper)',
        borderBottom: '1px solid var(--rule)',
        padding: mobile ? '10px 16px' : '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '50px',
        flexShrink: 0,
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', minWidth: 0 }}>
          <span className="serif" style={{ fontSize: mobile ? '18px' : '20px', fontWeight: 900, flexShrink: 0 }}>
            <span style={{ fontStyle: 'normal', color: 'var(--ink)' }}>She </span>
            <span style={{ fontStyle: 'italic', color: 'var(--burgundy)' }}>Knows.</span>
          </span>
          {!mobile && <span className="eyebrow" style={{ color: 'var(--burgundy)' }}>In Session</span>}
        </div>
        <span className="eyebrow" style={{ flexShrink: 0, fontSize: mobile ? '10px' : '11px' }}>
          {mobile
            ? `${questions.length} / ${MAX_QUESTIONS}`
            : `${questions.length} of ${MAX_QUESTIONS} Questions Filed${sessionClosed ? ' · Session Closes After This' : ''}`}
        </span>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* Sidebar — desktop only */}
        {!mobile && (
          <aside style={{
            width: '192px',
            flexShrink: 0,
            borderRight: '1px solid var(--rule)',
            padding: '24px 16px',
            position: 'sticky',
            top: '50px',
            height: 'calc(100vh - 50px)',
            overflowY: 'auto',
            background: 'var(--paper)',
          }}>
            <p className="eyebrow" style={{ marginBottom: '16px' }}>· This Session</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {questions.map((q, i) => {
                const v = getVerdict(q.result.truthPct);
                const isCurrent = i === questions.length - 1 && !loading;
                return (
                  <div key={i}>
                    <div className="eyebrow" style={{ color: isCurrent ? 'var(--burgundy)' : 'var(--ink-faint)', marginBottom: '4px' }}>
                      Q. {String(i + 1).padStart(2, '0')}{isCurrent ? ' — Current' : ''}
                    </div>
                    <p className="sans" style={{ fontSize: '12px', color: 'var(--ink-soft)', margin: '0 0 4px', lineHeight: 1.45 }}>
                      "{q.claim}"
                    </p>
                    <span className="sans" style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>
                      Verdict · {v.label} · {q.result.truthPct}/100
                    </span>
                  </div>
                );
              })}

              {loading && (
                <div>
                  <div className="eyebrow" style={{ color: 'var(--burgundy)', marginBottom: '6px' }}>
                    Q. {String(questions.length + 1).padStart(2, '0')} — Checking…
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{
                        width: '4px', height: '4px', borderRadius: '50%',
                        background: 'var(--burgundy)',
                        animation: `pulse-soft 1.2s ${i * 0.2}s ease-in-out infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--rule)' }}>
              <p className="eyebrow" style={{ marginBottom: '8px' }}>House Style</p>
              <p className="serif" style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--ink-mute)', lineHeight: 1.6, margin: 0 }}>
                She prefers receipts over rhetoric. Numbers cited reflect publicly available league data through May 2026.
              </p>
            </div>
          </aside>
        )}

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, paddingBottom: '80px' }}>

          {questions.map((q, i) => {
            const v = getVerdict(q.result.truthPct);
            return (
              <article key={i} style={{
                borderBottom: '1px solid var(--rule)',
                padding: `${mobile ? '28px' : '40px'} ${hPad} ${mobile ? '36px' : '48px'}`,
                animation: 'fade-up 0.4s ease-out',
              }}>
                <p className="eyebrow" style={{ marginBottom: '12px' }}>
                  Question {ORDINALS[i]} — Filed {q.filedAt}
                </p>

                <h2 className="serif" style={{
                  fontSize: mobile ? 'clamp(1.5rem, 6vw, 2rem)' : 'clamp(1.7rem, 3.5vw, 2.3rem)',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  margin: '0 0 18px',
                  lineHeight: 1.15,
                  letterSpacing: '-0.01em',
                }}>
                  {q.claim}
                </h2>

                <div style={{ height: '1px', background: 'var(--rule)', marginBottom: '22px' }} />

                {/* Explanation — two columns on desktop */}
                <div className="sans" style={{
                  columns: mobile ? 1 : 2,
                  columnGap: '36px',
                  fontSize: '15px',
                  lineHeight: 1.75,
                  color: 'var(--ink-soft)',
                  marginBottom: '28px',
                }}>
                  {q.result.explanation}
                </div>

                {/* Verdict banner */}
                <div style={{
                  background: v.bg,
                  color: '#FAF7F2',
                  padding: mobile ? '14px 16px' : '16px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span className="eyebrow" style={{ color: '#FAF7F2', fontSize: mobile ? '12px' : '13px', letterSpacing: '0.22em' }}>
                    {v.label}
                  </span>
                  <span className="mono" style={{ fontSize: mobile ? '1.6rem' : '2rem', fontWeight: 700, lineHeight: 1 }}>
                    {q.result.truthPct}
                    <span style={{ fontSize: '13px', fontWeight: 400, opacity: 0.6, marginLeft: '4px' }}>/ 100</span>
                  </span>
                </div>

                {/* Breakdown + analysis */}
                <div style={{
                  border: '1px solid var(--rule)',
                  borderTop: 'none',
                  padding: mobile ? '18px 16px 22px' : '22px 22px 26px',
                  background: 'var(--paper)',
                }}>
                  <p className="eyebrow" style={{ marginBottom: '16px' }}>Score Breakdown</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '22px' }}>
                    {([
                      { label: 'Factual Accuracy', score: q.result.factual_accuracy },
                      { label: 'Context',          score: q.result.context_score },
                      { label: 'Exaggeration',     score: q.result.exaggeration_score },
                      { label: 'Representation',   score: q.result.representation_score },
                    ] as const).map(({ label, score }) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                          <span className="sans" style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>{label}</span>
                          <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                            {score}<span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}> /100</span>
                          </span>
                        </div>
                        <ScoreBar score={score} />
                      </div>
                    ))}
                  </div>

                  <div style={{ height: '1px', background: 'var(--rule)', margin: '20px 0' }} />

                  <p className="eyebrow" style={{ marginBottom: '10px' }}>Analysis</p>
                  <p className="sans" style={{ fontSize: '14px', lineHeight: 1.75, color: 'var(--ink-soft)', margin: '0 0 8px' }}>
                    {q.result.explanation}
                  </p>
                  <p className="sans" style={{ fontSize: '12px', color: 'var(--burgundy)', fontStyle: 'italic' }}>
                    {getConfidenceLabel(q.result.confidence)}
                  </p>

                  {q.result.sources?.length > 0 && (
                    <>
                      <div style={{ height: '1px', background: 'var(--rule)', margin: '20px 0' }} />
                      <p className="eyebrow" style={{ marginBottom: '12px' }}>Sources</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.result.sources.filter(s => /^https?:\/\//i.test(s.url)).map((s) => (
                          <li key={s.url}>
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="sans"
                              style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', textDecoration: 'none', color: 'var(--burgundy)', fontSize: '13px', lineHeight: 1.5 }}>
                              <span style={{ flexShrink: 0 }}>•</span>
                              {s.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </article>
            );
          })}

          {/* Loading indicator */}
          {loading && (
            <div style={{ padding: `36px ${hPad}`, animation: 'fade-up 0.3s ease-out' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--burgundy)',
                    animation: `pulse-soft 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
                <span className="sans" style={{ fontSize: '13px', color: 'var(--ink-faint)', marginLeft: '8px' }}>
                  Checking receipts…
                </span>
              </div>
            </div>
          )}

          {/* Q2 input */}
          {!sessionClosed && !loading && questions.length > 0 && (
            <div style={{ padding: `${mobile ? '28px' : '40px'} ${hPad}`, borderTop: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="eyebrow" style={{ color: 'var(--ink)' }}>
                  · Question {ORDINALS[questions.length]} — Last One
                </span>
                <span className="eyebrow">{MAX_QUESTIONS - questions.length} remaining</span>
              </div>
              <div style={{ background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: '3px' }}>
                <textarea
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  placeholder="Ask one more…"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
                  style={{
                    width: '100%',
                    minHeight: '90px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontSize: '16px',
                    fontStyle: 'italic',
                    color: claim ? 'var(--ink)' : 'var(--ink-faint)',
                    lineHeight: 1.6,
                    fontFamily: "'Playfair Display', Georgia, serif",
                    boxSizing: 'border-box',
                    padding: '18px 18px 10px',
                  }}
                />
                <div style={{ height: '1px', background: 'var(--rule-soft)' }} />
                <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  {!mobile && <span className="eyebrow">⌘ + ↵ to ask</span>}
                  <button
                    onClick={submit}
                    disabled={!claim.trim()}
                    style={{
                      background: !claim.trim() ? 'var(--ink-faint)' : 'var(--burgundy)',
                      color: 'var(--cream)',
                      border: 'none',
                      borderRadius: '2px',
                      padding: '8px 18px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      cursor: !claim.trim() ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter Tight, sans-serif',
                      marginLeft: mobile ? 'auto' : undefined,
                    }}
                  >
                    Ask Her →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Session closed */}
          {sessionClosed && !loading && (
            <div style={{ padding: `${mobile ? '28px' : '32px'} ${hPad}`, borderTop: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--rule)' }} />
                <span className="eyebrow">Session Closed</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--rule)' }} />
              </div>
              <p className="serif" style={{ marginTop: '20px', fontSize: '14px', fontStyle: 'italic', color: 'var(--ink-mute)', textAlign: 'center' }}>
                Two questions filed. She's done her job.
              </p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────

export default function SheKnows() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const sessionClosed = questions.length >= MAX_QUESTIONS;

  async function handleSubmit(claim: string) {
    if (!claim.trim() || loading || sessionClosed) return;
    setLoading(true);
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
      const result = await res.json();
      const filedAt = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      setQuestions((prev) => [...prev, { claim, result, filedAt }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const showLanding = questions.length === 0 && !loading;

  return (
    <>
      {error && (
        <div className="sans" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          background: 'var(--burgundy-50)',
          borderBottom: '1px solid var(--burgundy-100)',
          padding: '12px 24px',
          fontSize: '13px',
          color: 'var(--burgundy-800)',
        }}>
          {error}
        </div>
      )}
      {showLanding
        ? <Landing onSubmit={handleSubmit} loading={loading} />
        : <Session questions={questions} loading={loading} onSubmit={handleSubmit} sessionClosed={sessionClosed} />
      }
    </>
  );
}
