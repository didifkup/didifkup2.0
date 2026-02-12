import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomUUID } from 'node:crypto';
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
const OPENAI_TIMEOUT_MS = 25_000;
const OPENAI_MODEL = 'gpt-4o-mini';

function generateRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

function inputFingerprint(input: AnalyzeInput): string {
  const payload = JSON.stringify({
    happened: input.happened,
    youDid: input.youDid,
    theyDid: input.theyDid,
    relationship: input.relationship ?? null,
    context: input.context ?? null,
    tone: input.tone,
  });
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function getClientIp(req: { headers?: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (ip && typeof ip === 'string') return ip.split(',')[0].trim();
  return 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

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

interface OpenAIErrorInfo {
  status: number;
  code?: string;
  type?: string;
  message?: string;
}

function parseOpenAIError(status: number, errBody: string): OpenAIErrorInfo {
  const info: OpenAIErrorInfo = { status };
  try {
    const parsed = JSON.parse(errBody) as { error?: { code?: string; type?: string; message?: string } };
    const err = parsed?.error;
    if (err) {
      info.code = err.code;
      info.type = err.type;
      info.message = err.message;
    }
  } catch {
    info.message = errBody.slice(0, 200);
  }
  return info;
}

function isOpenAIBillingOrQuotaError(status: number, info: OpenAIErrorInfo): boolean {
  if (status === 402 || status === 429 || status === 403) return true;
  const code = (info.code ?? '').toLowerCase();
  const type = (info.type ?? '').toLowerCase();
  const msg = (info.message ?? '').toLowerCase();
  return (
    code.includes('insufficient_quota') ||
    code.includes('billing_not_active') ||
    type.includes('insufficient_quota') ||
    type.includes('billing') ||
    msg.includes('quota') ||
    msg.includes('billing')
  );
}

async function callOpenAI(
  system: string,
  user: string,
  openaiApiKey: string
): Promise<{ ok: true; content: string } | { ok: false; error: OpenAIErrorInfo }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error && err.name === 'AbortError' ? 'OpenAI request timed out' : (err instanceof Error ? err.message : String(err));
    return { ok: false, error: { status: 504, message: msg } };
  }
  clearTimeout(timeoutId);

  const rawBody = await res.text();

  if (!res.ok) {
    const error = parseOpenAIError(res.status, rawBody);
    return { ok: false, error };
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody || '{}') as { choices?: { message?: { content?: string } }[] };
  } catch {
    return { ok: false, error: { status: 502, message: 'Invalid OpenAI response' } };
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    return { ok: false, error: { status: 502, message: 'OpenAI returned empty or invalid response' } };
  }

  return { ok: true, content };
}

function stripJsonFromMarkdown(raw: string): string {
  const s = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/;
  const m = s.match(codeBlock);
  return m ? m[1].trim() : s;
}

function normalizeRiskLabel(label: unknown): 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK' {
  const str = typeof label === 'string' ? label.toUpperCase().replace(/\s+/g, ' ').trim() : '';
  if (/^LOW\s*RISK$/.test(str)) return 'LOW RISK';
  if (/^HIGH\s*RISK$/.test(str)) return 'HIGH RISK';
  return 'MEDIUM RISK';
}

function clampScore(n: unknown): number {
  const num = typeof n === 'number' && Number.isFinite(n) ? n : Number(n);
  return Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0.5;
}

/** Strict parse: must pass full Zod schema. */
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

/** Lenient parse: extract required fields from OpenAI output so we don't 503 for minor format issues. */
function parseOutputLenient(raw: string): AnalyzeOutput | null {
  try {
    const stripped = stripJsonFromMarkdown(raw);
    const json = JSON.parse(stripped) as Record<string, unknown>;
    if (!json || typeof json !== 'object') return null;

    const riskObj = json.risk && typeof json.risk === 'object' ? (json.risk as Record<string, unknown>) : {};
    const label = normalizeRiskLabel(riskObj.label);
    const score = clampScore(riskObj.score);

    const stabilization = typeof json.stabilization === 'string' && json.stabilization.trim()
      ? json.stabilization.trim()
      : FALLBACK_OUTPUT.stabilization;
    const interpretation = typeof json.interpretation === 'string' && json.interpretation.trim()
      ? json.interpretation.trim()
      : FALLBACK_OUTPUT.interpretation;
    const nextMove = typeof json.nextMove === 'string' && json.nextMove.trim()
      ? json.nextMove.trim()
      : FALLBACK_OUTPUT.nextMove;

    return { risk: { label, score }, stabilization, interpretation, nextMove };
  } catch {
    return null;
  }
}

function logStep(step: 'parse' | 'validate' | 'openai' | 'format' | string, extra?: Record<string, unknown>): void {
  console.error('[analyze]', JSON.stringify({ route: '/api/analyze', step, ...extra }));
}

function sendError(res: VercelResponse, status: number, code: string, message: string): VercelResponse {
  return res.status(status).json({ ok: false, error: { code, message } });
}

export async function handleAnalyzePost(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  try {
    return await handleAnalyzePostImpl(req, res);
  } catch (err) {
    logStep('format', { substep: 'unexpected', error: (err instanceof Error ? err.message : String(err)).slice(0, 200) });
    return sendError(res, 500, 'SERVER_ERROR', 'Something went wrong. Please try again.');
  }
}

function isDebugOpenAIEnabled(req: VercelRequest): boolean {
  const header = req.headers['x-debug-openai'];
  const query = req.query?.debug;
  const requested = header === '1' || query === '1';
  const allowed = process.env.NODE_ENV !== 'production' || process.env.DEBUG_OPENAI === '1';
  return !!(requested && allowed);
}

async function handleAnalyzePostImpl(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const origin = (req.headers.origin as string) || '';
  logStep('format', { substep: 'request_start', method: req.method, origin });

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return sendError(res, 429, 'RATE_LIMIT', 'Too many requests. Please try again in a minute.');
  }

  let env;
  try {
    env = getAnalyzeEnv();
  } catch (err) {
    logStep('format', { substep: 'env_failed', error: (err instanceof Error ? err.message : String(err)).slice(0, 100) });
    return sendError(res, 500, 'SERVER_ERROR', 'Server configuration error');
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } });
  }
  const accessToken = auth.slice(7).trim();
  if (!accessToken) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing Bearer token' } });
  }

  let user: { id: string } | null;
  try {
    user = await verifySupabaseUser(
      accessToken,
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
  } catch (err) {
    logStep('format', { substep: 'verify_user_failed', error: (err instanceof Error ? err.message : String(err)).slice(0, 100) });
    return sendError(res, 500, 'SERVER_ERROR', 'Unable to verify your account. Please try again.');
  }
  if (!user) {
    logStep('format', { substep: 'auth_failed', reason: 'invalid_or_expired_token' });
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }

  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    logStep('parse', { substep: 'json_parse' });
    return res.status(400).json({ ok: false, error: { code: 'BAD_INPUT', message: 'Invalid JSON body' } });
  }

  const bodyKeys = body && typeof body === 'object' ? Object.keys(body as object) : [];
  logStep('parse', { substep: 'body_parsed', keys: bodyKeys });

  const inputResult = analyzeInputSchema.safeParse(body);
  if (!inputResult.success) {
    const msg = (inputResult.error.issues?.[0] as { message?: string } | undefined)?.message ?? 'Validation failed';
    logStep('validate', { substep: 'failed', message: msg });
    return res.status(400).json({ ok: false, error: { code: 'BAD_INPUT', message: msg } });
  }
  const input: AnalyzeInput = inputResult.data;

  const requestId = generateRequestId();
  const fingerprint = inputFingerprint(input);
  console.log(
    JSON.stringify({
      requestId,
      inputFingerprint: fingerprint,
      preview: {
        happened: (input.happened || '').slice(0, 60),
        youDid: (input.youDid || '').slice(0, 60),
        theyDid: (input.theyDid || '').slice(0, 60),
      },
    })
  );

  let supabase: any;
  try {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  } catch (err) {
    logStep('format', { substep: 'create_client_failed', error: (err instanceof Error ? err.message : String(err)).slice(0, 100) });
    return sendError(res, 500, 'SERVER_ERROR', 'Server configuration error');
  }

  let subStatus: string | null = null;
  try {
    const profiles = supabase.from('profiles') as any;
    const { data: profile } = await profiles.select('subscription_status').eq('id', user.id).maybeSingle();
    subStatus = profile?.subscription_status ?? null;
  } catch (err) {
    logStep('format', { substep: 'profile_fetch_failed', error: (err instanceof Error ? err.message : String(err)).slice(0, 100) });
  }
  const isPro = subStatus === 'active' || subStatus === 'trialing';

  const inputHash = computeInputHash(input);

  if (!isPro) {
    let limitResult: { ok: true } | { ok: false; status: 402 };
    try {
      limitResult = await enforceFreeLimit(supabase, user.id);
    } catch (err) {
      logStep('format', { substep: 'enforce_limit_failed', error: (err instanceof Error ? err.message : String(err)).slice(0, 100) });
      limitResult = { ok: true };
    }
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
  const strictUserPrompt = `${userPrompt}\n\nReturn ONLY valid JSON with exactly these keys: risk.label, risk.score, stabilization, interpretation, nextMove, and optionally followUpTexts.soft, followUpTexts.neutral, followUpTexts.firm. No markdown. No other text.`;

  let output: AnalyzeOutput;
  let openaiDebugStatus: number | undefined;
  let openaiDebugCode: string | undefined;

  let openaiResult = await callOpenAI(system, userPrompt, env.OPENAI_API_KEY);

  if (!openaiResult.ok) {
    const openaiError = openaiResult.error;
    openaiDebugStatus = openaiError.status;
    openaiDebugCode = openaiError.code ?? undefined;
    logStep('openai', {
      substep: 'call_failed',
      requestId,
      inputFingerprint: fingerprint,
      status: openaiError.status,
      code: openaiError.code ?? null,
      type: openaiError.type ?? null,
      isBillingOrQuota: isOpenAIBillingOrQuotaError(openaiError.status, openaiError),
      message: (openaiError.message ?? '').slice(0, 150),
    });
    console.log(JSON.stringify({ requestId, inputFingerprint: fingerprint, openaiSuccess: false, model: OPENAI_MODEL }));
    return res.status(503).json({
      error: 'AI_UNAVAILABLE',
      message: 'Vibe check is temporarily unavailable. Please try again in a minute.',
      requestId,
      inputFingerprint: fingerprint,
    });
  }

  let parsed = parseOutput(openaiResult.content) ?? parseOutputLenient(openaiResult.content);
  if (!parsed) {
    logStep('openai', {
      substep: 'output_invalid',
      requestId,
      inputFingerprint: fingerprint,
      first300: openaiResult.content.slice(0, 300),
    });
    const retryResult = await callOpenAI(system, strictUserPrompt, env.OPENAI_API_KEY);
    if (retryResult.ok) {
      parsed = parseOutput(retryResult.content) ?? parseOutputLenient(retryResult.content);
    }
    if (!parsed) {
      logStep('openai', {
        substep: 'output_invalid_retry_content',
        requestId,
        inputFingerprint: fingerprint,
        first300: retryResult.ok ? retryResult.content.slice(0, 300) : undefined,
      });
      return res.status(503).json({
        error: 'AI_UNAVAILABLE',
        message: 'Vibe check is temporarily unavailable. Please try again in a minute.',
        requestId,
        inputFingerprint: fingerprint,
      });
    }
    if (retryResult.ok) logStep('openai', { substep: 'used_retry_parse', requestId });
  }
  output = parsed;
  console.log(JSON.stringify({ requestId, inputFingerprint: fingerprint, openaiSuccess: true, model: OPENAI_MODEL }));

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

  const response: Record<string, unknown> = { ...output };
  if (isDebugOpenAIEnabled(req)) {
    response.debug = {
      usedOpenAI: true,
      model: OPENAI_MODEL,
      ...(openaiDebugStatus != null && { openaiStatus: openaiDebugStatus }),
      ...(openaiDebugCode && { openaiErrorCode: openaiDebugCode }),
    };
  }
  if (process.env.NODE_ENV !== 'production') {
    response._debug = { requestId, inputFingerprint: fingerprint, model: OPENAI_MODEL };
  }
  return res.status(200).json(response);
}
