import { z } from 'zod';
import OpenAI from 'openai';
import { applyCors } from './_lib/cors';
import { json, badRequest, methodNotAllowed, paywall, serverError } from './_lib/http';
import { requireUser } from './_lib/requireUser';
import { supabaseAdmin } from './_lib/supabaseAdmin';
import { config } from './_lib/config';
import { env } from './_lib/env';

const AnalyzeBodySchema = z.object({
  happened: z.string(),
  youDid: z.string(),
  theyDid: z.string(),
  relationship: z.string(),
  context: z.string(),
  tone: z.enum(['nice', 'real', 'savage']),
});

const AnalysisOutputSchema = z.object({
  verdict: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  summary: z.string(),
  reasons: z.array(z.string()),
  nextMove: z.string(),
  followUpTexts: z.object({
    soft: z.string(),
    neutral: z.string(),
    firm: z.string(),
  }),
});

type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are a helpful analyst for social situations. The user shares what happened, what they said/did, what the other person said/did, the relationship type, and context.

Analyze the situation and assess the social risk. Return ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "verdict": "LOW" | "MEDIUM" | "HIGH",
  "summary": "one sentence verdict summary",
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "nextMove": "concrete next step advice",
  "followUpTexts": {
    "soft": "gentle follow-up message they could send",
    "neutral": "neutral follow-up message",
    "firm": "direct follow-up message"
  }
}

Rules:
- LOW = overthinking, no real issue
- MEDIUM = awkward but recoverable
- HIGH = real damage, needs direct action
- Be empathetic but honest
- followUpTexts should be realistic text messages (short, human)
- Output ONLY the JSON object, nothing else`;

function buildUserPrompt(body: z.infer<typeof AnalyzeBodySchema>): string {
  return [
    `What happened: ${body.happened}`,
    `What I said/did: ${body.youDid}`,
    `What they said/did: ${body.theyDid}`,
    `Relationship: ${body.relationship}`,
    `Context: ${body.context}`,
    `Tone preference: ${body.tone} (nice=reassuring, real=blunt but fair, savage=spicy but not cruel)`,
  ].join('\n\n');
}

function parseAnalysisOutput(raw: string): AnalysisOutput | null {
  // First pass
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    // Repair: try to extract JSON from markdown code block
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  const result = AnalysisOutputSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

async function callOpenAI(body: z.infer<typeof AnalyzeBodySchema>): Promise<AnalysisOutput | null> {
  const openai = new OpenAI({ apiKey: env.openaiApiKey });
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(body) },
    ],
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return null;

  return parseAnalysisOutput(content);
}

async function checkQuota(userId: string): Promise<boolean> {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single();

  if (sub?.status && ['active', 'trialing'].includes(sub.status)) {
    return true; // unlimited
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabaseAdmin
    .from('usage_daily')
    .select('checks_used')
    .eq('user_id', userId)
    .eq('day', today)
    .single();

  const used = usage?.checks_used ?? 0;
  return used < config.FREE_CHECKS_PER_DAY;
}

async function incrementUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabaseAdmin
    .from('usage_daily')
    .select('checks_used')
    .eq('user_id', userId)
    .eq('day', today)
    .single();

  const newCount = (existing?.checks_used ?? 0) + 1;
  await supabaseAdmin.from('usage_daily').upsert(
    { user_id: userId, day: today, checks_used: newCount },
    { onConflict: ['user_id', 'day'] }
  );
}

export default async function handler(req: { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> }, res: { status: (n: number) => { json: (d: unknown) => void }; setHeader: (n: string, v: string | number | string[]) => void; end: (s?: string) => void }) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const parsed = AnalyzeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }
  const body = parsed.data;

  const allowed = await checkQuota(user.id);
  if (!allowed) {
    paywall(res, 'Out of free checks');
    return;
  }

  try {
    const output = await callOpenAI(body);
    if (!output) {
      serverError(res, 'Failed to parse analysis from AI');
      return;
    }

    const inputJson = {
      happened: body.happened,
      youDid: body.youDid,
      theyDid: body.theyDid,
      relationship: body.relationship,
      context: body.context,
      tone: body.tone,
    };

    await incrementUsage(user.id);
    await supabaseAdmin.from('analyses').insert({
      user_id: user.id,
      input: inputJson,
      output: output,
      model: MODEL,
    });

    json(res, 200, output);
  } catch (err) {
    console.error('[analyze]', err);
    serverError(res);
  }
}
