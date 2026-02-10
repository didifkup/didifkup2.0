import type { AnalyzeResult } from '@/lib/analyzeTypes';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type InterpretationLabel = 'most_likely' | 'also_possible' | 'less_likely';

/** Stable shape for UI rendering. Never undefined; always safe to render. */
export interface AdaptedAnalysis {
  verdict: RiskLevel;
  confidenceNumber: number;
  summary: string;
  interpretations: Array<{ label: InterpretationLabel; text: string }>;
  reasons: string[];
  nextMove: string;
  followUpTabs: { soft: string; neutral: string; firm: string };
}

const CONFIDENCE_MAP: Record<string, number> = {
  low: 0.35,
  medium: 0.65,
  high: 0.85,
};

function toRiskLevel(s: string | undefined | null): RiskLevel {
  const u = (s ?? '').toLowerCase();
  if (u === 'low') return 'LOW';
  if (u === 'medium') return 'MEDIUM';
  if (u === 'high') return 'HIGH';
  return 'MEDIUM';
}

function toConfidenceNumber(s: string | undefined | null): number {
  const u = (s ?? '').toLowerCase();
  return CONFIDENCE_MAP[u] ?? 0.65;
}

function ensureStrings(arr: unknown, fallback: string[]): string[] {
  if (!Array.isArray(arr)) return [...fallback];
  const out = arr
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim());
  return out.length > 0 ? out : [...fallback];
}

const FALLBACK_REASONS = [
  'The situation is likely not as bad as you think.',
  'Most people don\'t analyze every interaction this closely.',
  'Time often provides perspective.',
];

const FALLBACK_FOLLOW_UP = {
  soft: 'Hey, just wanted to check in 😊',
  neutral: 'Hey, how\'s it going?',
  firm: 'Can we chat when you have a moment?',
};

const INTERPRETATION_ORDER: InterpretationLabel[] = ['most_likely', 'also_possible', 'less_likely'];

const FALLBACK_INTERPRETATIONS: Array<{ label: InterpretationLabel; text: string }> = [
  { label: 'most_likely', text: 'You\'re probably overthinking it. Most of the time it\'s not that deep.' },
  { label: 'also_possible', text: 'Could be some awkward vibes, but usually it sorts itself out.' },
  { label: 'less_likely', text: 'Worst case, a quick check-in never hurt anyone.' },
];

/** Type guard: validates label is one of the three allowed values. */
function isInterpretationLabel(v: unknown): v is InterpretationLabel {
  return typeof v === 'string' && (v === 'most_likely' || v === 'also_possible' || v === 'less_likely');
}

function ensureInterpretations(arr: unknown): Array<{ label: InterpretationLabel; text: string }> {
  if (!Array.isArray(arr) || arr.length === 0) return [...FALLBACK_INTERPRETATIONS];

  const byLabel = new Map<InterpretationLabel, string>();
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as { label?: unknown; text?: unknown };
    const label = obj.label;
    if (!isInterpretationLabel(label)) continue;
    const textRaw = obj.text;
    const trimmed = typeof textRaw === 'string' ? textRaw.trim() : '';
    if (!trimmed) continue;
    byLabel.set(label, trimmed);
  }

  const result: Array<{ label: InterpretationLabel; text: string }> = [];
  for (const label of INTERPRETATION_ORDER) {
    const text = byLabel.get(label) ?? FALLBACK_INTERPRETATIONS.find((i) => i.label === label)?.text ?? '';
    result.push({ label, text });
  }
  return result;
}

/**
 * Adapts server AnalyzeResult to a stable UI shape.
 * Handles partial/undefined fields gracefully; output is always safe to render.
 */
export function adaptAnalysisResult(api: Partial<AnalyzeResult> | null | undefined): AdaptedAnalysis {
  if (!api || typeof api !== 'object') {
    return {
      verdict: 'MEDIUM',
      confidenceNumber: 0.65,
      summary: 'Unable to load analysis. Please try again.',
      interpretations: FALLBACK_INTERPRETATIONS,
      reasons: FALLBACK_REASONS,
      nextMove: 'Give it a moment and try again.',
      followUpTabs: FALLBACK_FOLLOW_UP,
    };
  }

  const verdict = toRiskLevel(api.verdict);
  const confidenceNumber = toConfidenceNumber(api.confidence);

  const summary = typeof api.summary === 'string' && api.summary.trim()
    ? api.summary.trim()
    : 'We couldn\'t parse a clear read. It\'s probably not as bad as you think.';

  const interpretations = ensureInterpretations(api.interpretations);
  const reasons = ensureStrings(api.support_points, FALLBACK_REASONS);

  let nextMove: string;
  const nm = api.next_moves;
  if (nm?.recommended === 'do_nothing' && nm?.do_nothing) {
    const wait = nm.do_nothing.wait_hours ?? 24;
    const why = nm.do_nothing.why?.trim() ?? 'Give it time.';
    nextMove = `Do nothing — wait ${wait}h. ${why}`;
  } else if (nm?.recommended === 'follow_up') {
    const opts = nm.follow_up?.options;
    const first = Array.isArray(opts) ? opts[0] : null;
    const why = first?.why?.trim() ?? 'Pick a tone below for suggested texts.';
    nextMove = `Send a follow-up. ${why}`;
  } else if (nm?.recommended === 'repair' && nm?.repair?.why) {
    nextMove = `Repair: ${nm.repair.why.trim()}`;
  } else {
    nextMove = 'Give it a day. If they don\'t bring it up, you\'re probably fine.';
  }

  const opts = nm?.follow_up?.options;
  const getText = (tone: 'soft' | 'neutral' | 'firm'): string => {
    if (!Array.isArray(opts)) return FALLBACK_FOLLOW_UP[tone];
    const opt = opts.find((o) => o?.tone === tone);
    const texts = opt?.texts;
    if (Array.isArray(texts) && typeof texts[0] === 'string') return texts[0].trim() || FALLBACK_FOLLOW_UP[tone];
    return FALLBACK_FOLLOW_UP[tone];
  };

  return {
    verdict,
    confidenceNumber,
    summary,
    interpretations,
    reasons,
    nextMove,
    followUpTabs: {
      soft: getText('soft'),
      neutral: getText('neutral'),
      firm: getText('firm'),
    },
  };
}
