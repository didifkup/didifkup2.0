import type { AnalyzeInput, AnalyzeOutput } from './analyzeSchema.js';

/** Keyword hints for tone inference (not full NLP) */
const ANGRY_KEYWORDS = /\b(mad|angry|yelled|screamed|hate|furious|pissed|upset|argued|fight)\b/i;
const SAD_KEYWORDS = /\b(sad|crying|hurt|ignored|ghosted|rejected|lonely|depressed|sorry|apologize)\b/i;
const HAPPY_KEYWORDS = /\b(happy|great|awesome|lol|laugh|fun|love|excited|thanks|good)\b/i;

function inferTone(text: string): 'angry' | 'sad' | 'happy' | 'neutral' {
  if (ANGRY_KEYWORDS.test(text)) return 'angry';
  if (SAD_KEYWORDS.test(text)) return 'sad';
  if (HAPPY_KEYWORDS.test(text)) return 'happy';
  return 'neutral';
}

/**
 * Deterministic fallback when OpenAI is unavailable (billing, quota, network).
 * Returns Emotional Stabilizer shape: risk, stabilization, interpretation, nextMove.
 */
export function runFallbackAnalyzer(input: AnalyzeInput): AnalyzeOutput {
  const tone = inferTone([input.happened, input.youDid, input.theyDid].join(' '));
  const isNegative = tone === 'angry' || tone === 'sad';

  const riskLabel = tone === 'happy' || tone === 'neutral' ? 'LOW RISK' : isNegative ? 'MEDIUM RISK' : 'MEDIUM RISK';
  const score = riskLabel === 'LOW RISK' ? 0.25 : riskLabel === 'HIGH RISK' ? 0.75 : 0.5;

  const stabilization = "I know this feels huge. You didn't ruin everything. It's rarely as bad as it feels in the moment.";
  const interpretation = 'Uncertainty amplifies fear. One grounded read: the situation is probably okay, and the other person may not have interpreted it the way you fear.';
  const nextMove = 'Do nothing for 24 hours. If they don\'t bring it up, you\'re probably fine. No double texting.';

  return {
    risk: { label: riskLabel, score },
    stabilization,
    interpretation,
    nextMove,
  };
}
