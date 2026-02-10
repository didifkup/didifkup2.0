/**
 * POST /api/analyze
 *
 * Analyzes a social situation using OpenAI. Requires auth, enforces free/pro limits.
 *
 * Local test (replace TOKEN and adjust URL):
 *   curl -X POST http://localhost:3000/api/analyze \
 *     -H "Content-Type: application/json" \
 *     -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
 *     -d '{"happened":"I left them on read for 3 days","youDid":"I said sorry I was busy","theyDid":"They replied np","relationship":"friend","context":"texting","tone":"neutral"}'
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY,
} from './_lib/env';
import { buildAnalyzePrompt } from './_lib/analyzePrompt';
import {
  analyzeInputSchema,
  analyzeOutputSchema,
  FALLBACK_OUTPUT,
  type AnalyzeInput,
  type AnalyzeOutput,
} from './_lib/analyzeSchema';
import { setCorsHeaders } from './_lib/cors';

const FREE_DAILY_LIMIT = 2;

/** Verify Supabase user via Auth REST API. Returns user or null. */
async function verifySupabaseUser(
  accessToken: string
): Promise<{ id: string } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? { id: user.id } : null;
}

/** Check if timestamp is before start of today UTC */
function isBeforeTodayUtc(iso: string): boolean {
  const d = new Date(iso);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

/** Enforce free limit: reset if new day, check limit, increment. Returns true if OK to proceed. */
async function enforceFreeLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ ok: true } | { ok: false; status: 402 }> {
  const { data: row, error: fetchError } = await supabase
    .from('user_usage')
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
    const { error: updateError } = await supabase
      .from('user_usage')
      .update({ analyses_used: nextCount, updated_at: now })
      .eq('user_id', userId);
    if (updateError) {
      console.error('[analyze] user_usage update error:', updateError.message);
      throw new Error('Failed to update usage');
    }
  } else {
    const { error: insertError } = await supabase
      .from('user_usage')
      .insert({ user_id: userId, analyses_used: nextCount, updated_at: now });
    if (insertError) {
      console.error('[analyze] user_usage insert error:', insertError.message);
      throw new Error('Failed to create usage');
    }
  }

  return { ok: true };
}

/** Call OpenAI Chat Completions and return raw JSON string. */
async function callOpenAI(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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

/** Parse and validate OpenAI output. Returns parsed result or null. */
function parseOutput(raw: string): AnalyzeOutput | null {
  try {
    const json = JSON.parse(raw) as unknown;
    const result = analyzeOutputSchema.safeParse(json);
    if (result.success) return result.data;
  } catch {
    // JSON parse or schema validation failed
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
    }
    const accessToken = auth.slice(7).trim();
    if (!accessToken) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing Bearer token' });
    }

    const user = await verifySupabaseUser(accessToken);
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
      const msg = inputResult.error.errors?.[0]?.message ?? 'Validation failed';
      return res.status(400).json({ error: 'Validation failed', message: msg });
    }
    const input: AnalyzeInput = inputResult.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    const subStatus = profile?.subscription_status ?? null;
    const isPro = subStatus === 'active' || subStatus === 'trialing';

    if (!isPro) {
      const limitResult = await enforceFreeLimit(supabase, user.id);
      if (!limitResult.ok) {
        return res.status(402).json({
          error: 'LIMIT',
          message: 'Free limit reached',
        });
      }
    }

    const { system, user: userPrompt } = buildAnalyzePrompt(input);

    let output: AnalyzeOutput;
    try {
      const raw = await callOpenAI(system, userPrompt);
      const parsed = parseOutput(raw);
      output = parsed ?? FALLBACK_OUTPUT;
      if (!parsed) {
        console.warn('[analyze] OpenAI output failed validation, using fallback');
      }
    } catch (err) {
      console.error('[analyze] OpenAI error:', err instanceof Error ? err.message : err);
      output = FALLBACK_OUTPUT;
    }

    return res.status(200).json(output);
  } catch (err) {
    console.error('[analyze] unexpected error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
