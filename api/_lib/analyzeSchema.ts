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

const interpretationLabelSchema = z.enum(['most_likely', 'also_possible', 'less_likely']);
const toneSchema = z.enum(['soft', 'neutral', 'firm']);

const interpretationSchema = z.object({
  label: interpretationLabelSchema,
  text: z.string(),
});

const doNothingSchema = z.object({
  wait_hours: z.number(),
  why: z.string(),
});

const followUpOptionSchema = z.object({
  tone: toneSchema,
  why: z.string(),
  texts: z.tuple([z.string(), z.string(), z.string()]),
});

const followUpSchema = z.object({
  options: z.tuple([followUpOptionSchema, followUpOptionSchema, followUpOptionSchema]),
});

const repairSchema = z.object({
  why: z.string(),
  texts: z.tuple([z.string(), z.string(), z.string()]),
});

const nextMovesSchema = z.object({
  recommended: z.enum(['do_nothing', 'follow_up', 'repair']),
  do_nothing: doNothingSchema,
  follow_up: followUpSchema,
  repair: repairSchema,
});

/** Output schema for analyze response — strict JSON from OpenAI */
export const analyzeOutputSchema = z.object({
  verdict: z.enum(['low', 'medium', 'high']),
  confidence: z.enum(['low', 'medium', 'high']),
  summary: z.string(),
  interpretations: z.tuple([
    interpretationSchema,
    interpretationSchema,
    interpretationSchema,
  ]).refine(
    (arr) => {
      const labels = arr.map((i) => i.label);
      return new Set(labels).size === 3 &&
        labels.includes('most_likely') &&
        labels.includes('also_possible') &&
        labels.includes('less_likely');
    },
    { message: 'interpretations must contain each label exactly once' }
  ),
  support_points: z.tuple([z.string(), z.string(), z.string()]),
  next_moves: nextMovesSchema,
  safety_note: z.string(),
});

export type AnalyzeOutput = z.infer<typeof analyzeOutputSchema>;

/** Safe fallback when OpenAI output fails validation. Still counts usage. */
export const FALLBACK_OUTPUT: AnalyzeOutput = {
  verdict: 'medium',
  confidence: 'low',
  summary: "We couldn't parse the full analysis, but here's a gentle read: It's likely not as bad as you think. Social situations are often ambiguous.",
  interpretations: [
    { label: 'most_likely', text: 'You may be overthinking. The situation is probably fine.' },
    { label: 'also_possible', text: 'There could be some tension, but it might resolve naturally.' },
    { label: 'less_likely', text: 'Worst case, a brief check-in could help clear the air.' },
  ],
  support_points: [
    'Most people don\'t analyze every interaction as closely as you are.',
    'The other person may not have interpreted it the way you fear.',
    'Time often provides perspective — waiting a bit can help.',
  ],
  next_moves: {
    recommended: 'do_nothing',
    do_nothing: {
      wait_hours: 24,
      why: 'Give it a day. If they don\'t bring it up, you\'re probably fine.',
    },
    follow_up: {
      options: [
        { tone: 'soft', why: 'A gentle check-in if you want reassurance.', texts: ['Hey, just wanted to make sure we\'re good 😊', 'Hope you\'re doing okay!', 'Thinking of you 💛'] },
        { tone: 'neutral', why: 'Casual and low-pressure.', texts: ['Hey, how\'s it going?', 'What\'s up?', 'Wanted to check in.'] },
        { tone: 'firm', why: 'Direct if you need to address something.', texts: ['Can we chat when you have a moment?', 'I\'d like to clear the air.', 'Let\'s talk about earlier.'] },
      ],
    },
    repair: {
      why: 'Use only if you believe you need to apologize or make amends.',
      texts: ['I didn\'t mean for that to come across that way.', 'I\'m sorry if I upset you.', 'I want to make this right.'],
    },
  },
  safety_note: 'If you\'re in distress, consider talking to a friend or professional. You\'re not alone.',
};
