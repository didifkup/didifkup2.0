/**
 * POST /api/vibecheck — VibeCheck V2. Isolated; does not touch old analyze flow.
 * POST only. Node runtime (Vercel serverless). Never logs user text.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  vibecheckInputSchema,
  vibecheckOutputSchema,
  VIBECHECK_SYSTEM_PROMPT,
  buildVibecheckUserPrompt,
} from './_lib/vibecheckSchema.js';

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 25_000;

function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers.origin as string) || '';
  const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
  const isAllowed = isLocalhost || origin === 'https://didifkup.vercel.app' || origin === 'https://didifkup.com';
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
}

function randomRequestId(): string {
  return `vc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse | void> {
  const method = req.method ?? 'UNKNOWN';
  const requestId = randomRequestId();
  console.log(JSON.stringify({ route: '/api/vibecheck', method, requestId, ts: new Date().toISOString() }));

  setCorsHeaders(req, res);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).setHeader('Allow', 'POST, OPTIONS').json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || typeof openaiKey !== 'string' || openaiKey.trim() === '') {
    return res.status(500).json({
      ok: false,
      error: { code: 'MISSING_OPENAI_KEY', message: 'Server missing OPENAI_API_KEY' },
      requestId,
    });
  }

  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
      requestId,
    });
  }

  const parsed = vibecheckInputSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
    return res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message },
      requestId,
    });
  }

  const { happened, youDid, theyDid } = parsed.data;
  const userPrompt = buildVibecheckUserPrompt(happened, youDid, theyDid);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let rawBody: string;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: VIBECHECK_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    rawBody = await response.text();
    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: {
          code: 'OPENAI_ERROR',
          message: 'Vibe check service temporarily unavailable. Please try again.',
        },
        requestId,
      });
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Request timed out' : String(err);
    console.error(JSON.stringify({ route: '/api/vibecheck', requestId, error: msg.slice(0, 200) }));
    return res.status(502).json({
      ok: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Vibe check service temporarily unavailable. Please try again.',
      },
      requestId,
    });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return res.status(502).json({
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'Invalid response from vibe check service. Please try again.',
      },
      requestId,
    });
  }

  const content =
    typeof json === 'object' && json !== null && 'choices' in json && Array.isArray((json as { choices: unknown }).choices)
      ? (json as { choices: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
      : undefined;

  const rawContent = typeof content === 'string' ? content : null;
  if (rawContent == null || rawContent === '') {
    return res.status(502).json({
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'Empty response from vibe check service. Please try again.',
      },
      requestId,
    });
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(rawContent);
  } catch {
    return res.status(502).json({
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'Vibe check response was not valid JSON. Please try again.',
      },
      requestId,
    });
  }

  const validated = vibecheckOutputSchema.safeParse(parsedOutput);
  if (!validated.success) {
    return res.status(502).json({
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'Vibe check response shape was invalid. Please try again.',
      },
      requestId,
    });
  }

  return res.status(200).json({
    ...validated.data,
    requestId,
  });
}
