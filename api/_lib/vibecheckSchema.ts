/**
 * VibeCheck V2 — server-side zod schemas and prompt. Isolated from src for Vercel serverless.
 */
import { z } from 'zod';

const MAX_LEN = 2000;

export const vibecheckInputSchema = z.object({
  happened: z.string().max(MAX_LEN, `happened must be at most ${MAX_LEN} characters`),
  youDid: z.string().max(MAX_LEN, `youDid must be at most ${MAX_LEN} characters`),
  theyDid: z.string().max(MAX_LEN, `theyDid must be at most ${MAX_LEN} characters`),
});

export const vibecheckRankSchema = z.enum(['Low', 'Medium', 'High']);

export const vibecheckOutputSchema = z.object({
  rank: vibecheckRankSchema,
  score: z.number().int().min(0).max(100),
  validation: z.string(),
  realityCheck: z.string(),
  nextMove: z.string(),
  oneLiner: z.string(),
});

export const VIBECHECK_SYSTEM_PROMPT = `You are a brief vibe checker. Reply with exactly one JSON object and no other text.

Output shape (use these exact keys):
{
  "rank": "Low" | "Medium" | "High",
  "score": <number 0-100>,
  "validation": "<short sentence validating their concern>",
  "realityCheck": "<one sentence reality check>",
  "nextMove": "<one concrete next step>",
  "oneLiner": "<single punchy line summary>"
}

Rules: rank must be exactly "Low", "Medium", or "High". score must be an integer 0-100. All string fields must be non-empty. Output only valid JSON.`;

export function buildVibecheckUserPrompt(happened: string, youDid: string, theyDid: string): string {
  return `What happened: ${happened}\nWhat you did: ${youDid}\nWhat they did: ${theyDid}`;
}
