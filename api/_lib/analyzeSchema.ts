import { z } from 'zod';

const MAX_FIELD_LEN = 2000;

/** Input schema for POST /api/analyze */
export const analyzeInputSchema = z.object({
  happened: z.string().min(1, 'happened is required').max(MAX_FIELD_LEN),
  youDid: z.string().min(1, 'youDid is required').max(MAX_FIELD_LEN),
  theyDid: z.string().min(1, 'theyDid is required').max(MAX_FIELD_LEN),
  relationship: z.string().nullable().optional(),
  context: z.string().nullable().optional(),
  tone: z.enum(['soft', 'neutral', 'firm']),
}).refine(
  (data) => {
    if (data.relationship != null) return data.relationship.length <= MAX_FIELD_LEN;
    return true;
  },
  { message: `relationship must be at most ${MAX_FIELD_LEN} characters` }
).refine(
  (data) => {
    if (data.context != null) return data.context.length <= MAX_FIELD_LEN;
    return true;
  },
  { message: `context must be at most ${MAX_FIELD_LEN} characters` }
);

export type AnalyzeInput = z.infer<typeof analyzeInputSchema>;

/** Emotional Stabilizer output — risk, stabilization, interpretation, nextMove; optional followUpTexts. Extra keys allowed via passthrough. */
const riskLabelSchema = z.enum(['LOW RISK', 'MEDIUM RISK', 'HIGH RISK']);
const riskSchema = z.object({
  label: riskLabelSchema,
  score: z.number().min(0).max(1),
});

const followUpTextsSchema = z.object({
  soft: z.string(),
  neutral: z.string(),
  firm: z.string(),
});

export const analyzeOutputSchema = z
  .object({
    risk: riskSchema,
    stabilization: z.string(),
    interpretation: z.string(),
    nextMove: z.string(),
    followUpTexts: followUpTextsSchema.optional(),
  })
  .passthrough();

export type AnalyzeOutput = z.infer<typeof analyzeOutputSchema>;

/** Safe fallback when OpenAI output fails validation. Still counts usage. */
export const FALLBACK_OUTPUT: AnalyzeOutput = {
  risk: { label: 'MEDIUM RISK', score: 0.5 },
  stabilization: "I know this feels huge. You didn't ruin everything. It's rarely as bad as it feels in the moment.",
  interpretation: 'Uncertainty amplifies fear. One grounded read: the situation is probably okay, and the other person may not have interpreted it the way you fear.',
  nextMove: 'Do nothing for 24 hours. If they don\'t bring it up, you\'re probably fine. No double texting.',
};
