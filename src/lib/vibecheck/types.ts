import { z } from 'zod';

const MAX_LEN = 2000;

/** Input for POST /api/vibecheck */
export const vibecheckInputSchema = z.object({
  happened: z.string().max(MAX_LEN, `happened must be at most ${MAX_LEN} characters`),
  youDid: z.string().max(MAX_LEN, `youDid must be at most ${MAX_LEN} characters`),
  theyDid: z.string().max(MAX_LEN, `theyDid must be at most ${MAX_LEN} characters`),
});

export type VibecheckInput = z.infer<typeof vibecheckInputSchema>;

/** Rank for vibe check result */
export const vibecheckRankSchema = z.enum(['Low', 'Medium', 'High']);
export type VibecheckRank = z.infer<typeof vibecheckRankSchema>;

/** Raw model output (before adding requestId) */
export const vibecheckOutputSchema = z.object({
  rank: vibecheckRankSchema,
  score: z.number().int().min(0).max(100),
  validation: z.string(),
  realityCheck: z.string(),
  nextMove: z.string(),
  oneLiner: z.string(),
});

export type VibecheckOutput = z.infer<typeof vibecheckOutputSchema>;

/** Response shape: validated output + requestId */
export const vibecheckResponseSchema = vibecheckOutputSchema.extend({
  requestId: z.string(),
});

export type VibecheckResponse = z.infer<typeof vibecheckResponseSchema>;
