import type { AnalyzeResult } from '@/lib/analyzeTypes';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type InterpretationLabel = 'most_likely' | 'also_possible' | 'less_likely';

/** Stable shape for UI rendering. Never undefined; always safe to render. */
export interface AdaptedAnalysis {
  verdict: RiskLevel;
  confidenceNumber: number;
  summary: string;
  /** Emotional stabilizer hero line; prefer over summary when present. */
  stabilization?: string;
  /** Single grounded interpretation; optional. */
  interpretation?: string;
  /** Raw risk from API when available. */
  risk?: { label: string; score: number };
  interpretations: Array<{ label: InterpretationLabel; text: string }>;
  reasons: string[];
  nextMove: string;
  followUpTabs: { soft: string; neutral: string; firm: string };
}

function toRiskLevelFromLabel(label: string | undefined | null): RiskLevel {
  const u = (label ?? '').toUpperCase().replace(/\s*RISK\s*$/, '');
  if (u === 'LOW') return 'LOW';
  if (u === 'MEDIUM') return 'MEDIUM';
  if (u === 'HIGH') return 'HIGH';
  return 'MEDIUM';
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

const FALLBACK_INTERPRETATIONS: Array<{ label: InterpretationLabel; text: string }> = [
  { label: 'most_likely', text: 'You\'re probably overthinking it. Most of the time it\'s not that deep.' },
  { label: 'also_possible', text: 'Could be some awkward vibes, but usually it sorts itself out.' },
  { label: 'less_likely', text: 'Worst case, a quick check-in never hurt anyone.' },
];

/**
 * Adapts server AnalyzeResult (Emotional Stabilizer: risk, stabilization, interpretation, nextMove) to stable UI shape.
 * Handles partial/undefined fields gracefully; output is always safe to render.
 */
export function adaptAnalysisResult(api: Partial<AnalyzeResult> | null | undefined): AdaptedAnalysis {
  if (!api || typeof api !== 'object') {
    return {
      verdict: 'MEDIUM',
      confidenceNumber: 0.65,
      summary: 'Unable to load analysis. Please try again.',
      stabilization: 'Unable to load analysis. Please try again.',
      interpretations: FALLBACK_INTERPRETATIONS,
      reasons: FALLBACK_REASONS,
      nextMove: 'Give it a moment and try again.',
      followUpTabs: FALLBACK_FOLLOW_UP,
    };
  }

  const verdict = toRiskLevelFromLabel(api.risk?.label);
  const confidenceNumber = typeof api.risk?.score === 'number' ? api.risk.score : 0.65;

  const stabilizationFromApi = typeof api.stabilization === 'string' && api.stabilization.trim()
    ? api.stabilization.trim()
    : '';
  const interpretationFromApi = typeof api.interpretation === 'string' && api.interpretation.trim()
    ? api.interpretation.trim()
    : '';
  const summary = stabilizationFromApi || 'We couldn\'t parse a clear read. It\'s probably not as bad as you think.';
  const stabilization = stabilizationFromApi || summary;
  const interpretation = interpretationFromApi;

  const interpretations: Array<{ label: InterpretationLabel; text: string }> = interpretation
    ? [
        { label: 'most_likely', text: interpretation },
        { label: 'also_possible', text: 'Things often look clearer after a bit of time.' },
        { label: 'less_likely', text: 'Worst case, a brief check-in can help.' },
      ]
    : FALLBACK_INTERPRETATIONS;

  const reasons = interpretation ? [interpretation] : FALLBACK_REASONS;

  const nextMove = typeof api.nextMove === 'string' && api.nextMove.trim()
    ? api.nextMove.trim()
    : 'Give it a day. If they don\'t bring it up, you\'re probably fine.';

  const risk = api.risk != null && typeof api.risk === 'object'
    ? { label: String(api.risk.label ?? ''), score: typeof api.risk.score === 'number' ? api.risk.score : 0.65 }
    : undefined;

  return {
    verdict,
    confidenceNumber,
    summary,
    stabilization,
    interpretation: interpretation || undefined,
    risk,
    interpretations,
    reasons,
    nextMove,
    followUpTabs: FALLBACK_FOLLOW_UP,
  };
}
