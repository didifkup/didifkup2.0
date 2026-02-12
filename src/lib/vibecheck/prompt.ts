/**
 * VibeCheck V2 — system prompt. Enforces JSON-only output with exact shape.
 */

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
