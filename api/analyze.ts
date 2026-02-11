/**
 * POST /api/analyze
 *
 * OPTIONS preflight and CORS are handled inline first — no imports that could throw.
 * POST logic is lazy-loaded to guarantee OPTIONS never 500.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

function logError(req: VercelRequest, step: string, err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  if (process.env.DEBUG_ANALYZE === '1') {
    const payload: Record<string, unknown> = {
      route: '/api/analyze',
      step,
      method: req.method,
      hasBody: !!req.body,
      origin: req.headers?.origin ?? null,
      errName: e.name,
      errMessage: e.message?.slice(0, 200) ?? null,
    };
    const ext = err as { status?: number; code?: string; type?: string };
    if (ext.status != null) payload.errStatus = ext.status;
    if (ext.code != null) payload.errCode = ext.code;
    if (ext.type != null) payload.errType = ext.type;
    console.error('[analyze]', JSON.stringify(payload));
  } else {
    console.error('[analyze]', step, e.message?.slice(0, 100));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse | void> {
  const origin = (req.headers.origin as string) || '';
  const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
  const isAllowed = isLocalhost || origin === 'https://didifkup.vercel.app' || origin === 'https://didifkup.com';
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const MAX_BODY_BYTES = 50 * 1024;
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || typeof openaiKey !== 'string' || openaiKey.trim() === '') {
    return res.status(500).json({ ok: false, error: { code: 'MISSING_OPENAI_KEY', message: 'Server missing OPENAI_API_KEY' } });
  }

  try {
    const { handleAnalyzePost } = await import('./_lib/analyzePost.js');
    const result = await handleAnalyzePost(req, res);
    return result;
  } catch (err) {
    logError(req, 'handler', err);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Unexpected server error' } });
  }
}
