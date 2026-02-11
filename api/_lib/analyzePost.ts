import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getAnalyzeEnv } from './env.js';
import { buildAnalyzePrompt } from './analyzePrompt.js';
import {
  analyzeInputSchema,
  analyzeOutputSchema,
  FALLBACK_OUTPUT,
  type AnalyzeInput,
  type AnalyzeOutput,
} from './analyzeSchema.js';
import {
  computeInputHash,
  checkScenarioCooldown,
  recordScenarioSeen,
} from './scenarioCooldown.js';
import { recordScenarioAndStreak } from './scenarioPersistence.js';

const FREE_DAILY_LIMIT = 2;

async function verifySupabaseUser(
  accessToken: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ id: string } | null> {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseKey,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? { id: user.id } : null;
}

function isBeforeTodayUtc(iso: string): boolean {
  const d = new Date(iso);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

async function enforceFreeLimit(supabase: any, userId: string): Promise<{ ok: true } | { ok: false; status: 402 }> {
  const usage = supabase.from('user_usage') as any;
  const { data: row, error: fetchError } = await usage
    .select('user_id, analyses_used, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('[analyze] user_usage fetch error:', fetchError.message);
    throw new Error('Failed to check usage');
  }

  const now = new Date().toISOString();
  let analysesUsed = row?.analyses_used ?? 0;
  const updatedAt = row?.updated_at ?? null;

  if (updatedAt && isBeforeTodayUtc(updatedAt)) {
    analysesUsed = 0;
  }

  if (analysesUsed >= FREE_DAILY_LIMIT) {
    return { ok: false, status: 402 };
  }

  const nextCount = analysesUsed + 1;

  if (row) {
    const { error: updateError } = await usage
      .update({ analyses_used: nextCount, updated_at: now })
      .eq('user_id', userId);
    if (updateError) throw new Error('Failed to update usage');
  } else {
    const { error: insertError } = await usage.insert({ user_id: userId, analyses_used: nextCount, updated_at: now });
    if (insertError) throw new Error('Failed to create usage');
  }

  return { ok: true };
}

async function callOpenAI(
  system: string,
  user: string,
  openaiApiKey: string
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI returned empty or invalid response');
  }

  return content;
}

function parseOutput(raw: string): AnalyzeOutput | null {
  try {
    const json = JSON.parse(raw) as unknown;
    const result = analyzeOutputSchema.safeParse(json);
    if (result.success) return result.data;
  } catch {
    // ignore
  }
  return null;
}

export async function handleAnalyzePost(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const env = getAnalyzeEnv();

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
  }
  const accessToken = auth.slice(7).trim();
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing Bearer token' });
  }

  const user = await verifySupabaseUser(
    accessToken,
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }

  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const inputResult = analyzeInputSchema.safeParse(body);
  if (!inputResult.success) {
    const msg = inputResult.error.issues?.[0]?.message ?? 'Validation failed';
    return res.status(400).json({ error: 'Validation failed', message: msg });
  }
  const input: AnalyzeInput = inputResult.data;

  const supabase: any = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const profiles = supabase.from('profiles') as any;
  const { data: profile } = await profiles
    .select('subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  const subStatus = profile?.subscription_status ?? null;
  const isPro = subStatus === 'active' || subStatus === 'trialing';

  const inputHash = computeInputHash(input);

  if (!isPro) {
    const limitResult = await enforceFreeLimit(supabase, user.id);
    if (!limitResult.ok) {
      return res.status(402).json({ error: 'LIMIT', message: 'Free limit reached' });
    }
    const cooldownResult = await checkScenarioCooldown(supabase, user.id, inputHash);
    const cooldownAny = cooldownResult as { ok?: boolean; allowed?: boolean };
    const allowed =
      cooldownAny.ok !== undefined ? cooldownAny.ok :
      cooldownAny.allowed !== undefined ? cooldownAny.allowed :
      true;
    const retryAfterHours =
      (cooldownResult as any).retryAfterHours ??
      (cooldownResult as any).retry_after_hours ??
      (cooldownResult as any).retryAfterHoursRemaining ??
      (cooldownResult as any).retry_after_hours_remaining ??
      6;
    if (!allowed) {
      return res.status(429).json({
        error: 'COOLDOWN',
        message: 'You already checked this recently.',
        retry_after_hours: retryAfterHours,
      });
    }
  }

  const { system, user: userPrompt } = buildAnalyzePrompt(input);

  let output: AnalyzeOutput;
  try {
    const raw = await callOpenAI(system, userPrompt, env.OPENAI_API_KEY);
    const parsed = parseOutput(raw);
    output = parsed ?? FALLBACK_OUTPUT;
    if (!parsed) {
      console.warn('[analyze] OpenAI output failed validation, using fallback');
    }
  } catch (err) {
    console.error('[analyze] OpenAI error:', err instanceof Error ? err.message : err);
    output = FALLBACK_OUTPUT;
  }

  try {
    await recordScenarioSeen(supabase, user.id, inputHash);
  } catch {
    /* non-blocking */
  }

  try {
    await recordScenarioAndStreak(supabase, user.id, input, inputHash, output);
  } catch {
    /* non-blocking */
  }

  return res.status(200).json(output);
}
