/**
 * POST /api/analyze
 *
 * OPTIONS preflight and CORS are handled inline first — no imports that could throw.
 * POST logic is lazy-loaded to guarantee OPTIONS never 500.
 *
 * Test preflight:
 *   curl -X OPTIONS https://didifkup.vercel.app/api/analyze -H "Origin: http://localhost:5173" -v
 *   (expect 204, Access-Control-Allow-Origin: http://localhost:5173)
 *
 * Test POST:
 *   curl -X POST https://didifkup.vercel.app/api/analyze \
 *     -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
 *     -d '{"happened":"...","youDid":"...","theyDid":"...","relationship":"friend","context":"texting","tone":"neutral"}'
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { handleAnalyzePost } = await import('./_lib/analyzePost');
    return handleAnalyzePost(req, res);
  } catch (err) {
    console.error('[analyze] unexpected error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
