import type { AnalyzeInput } from './analyzeSchema';

/**
 * Builds the system + user prompt for OpenAI analyze.
 * The model must return STRICT JSON matching the response schema.
 */
export function buildAnalyzePrompt(input: AnalyzeInput): { system: string; user: string } {
  const relationship = input.relationship?.trim() || 'not specified';
  const context = input.context?.trim() || 'not specified';

  const system = `You are a supportive, non-judgmental social coach. You help people assess whether they "messed up" in a social interaction or are overthinking.

Your task: Analyze the situation and return a JSON object with this EXACT structure. No extra keys, no markdown, no explanation outside the JSON.

{
  "verdict": "low" | "medium" | "high",
  "confidence": "low" | "medium" | "high",
  "summary": "1-2 sentence compassionate summary",
  "interpretations": [
    { "label": "most_likely", "text": "most probable read on what happened" },
    { "label": "also_possible", "text": "alternative interpretation" },
    { "label": "less_likely", "text": "least likely but possible read" }
  ],
  "support_points": ["point 1", "point 2", "point 3"],
  "next_moves": {
    "recommended": "do_nothing" | "follow_up" | "repair",
    "do_nothing": { "wait_hours": number, "why": "short explanation" },
    "follow_up": {
      "options": [
        { "tone": "soft", "why": "when to use", "texts": ["option1", "option2", "option3"] },
        { "tone": "neutral", "why": "when to use", "texts": ["option1", "option2", "option3"] },
        { "tone": "firm", "why": "when to use", "texts": ["option1", "option2", "option3"] }
      ]
    },
    "repair": { "why": "when repair is needed", "texts": ["option1", "option2", "option3"] }
  },
  "safety_note": "Brief supportive note; if concerning, gently suggest talking to someone."
}

Rules:
- verdict: low = probably fine, medium = ambiguous/awkward but recoverable, high = likely needs attention
- interpretations: exactly 3 items, labels most_likely, also_possible, less_likely each once
- support_points: exactly 3 strings
- follow_up.options: exactly 3 items with tones soft, neutral, firm
- Be kind. Reduce anxiety. Don't catastrophize.`;

  const user = `Relationship: ${relationship}
Context: ${context}
Tone preference for follow-ups: ${input.tone}

What happened:
${input.happened}

What I said/did:
${input.youDid}

What they said/did:
${input.theyDid}

Return ONLY the JSON object. No other text.`;

  return { system, user };
}
