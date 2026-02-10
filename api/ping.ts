/**
 * GET /api/ping — diagnostics endpoint. No local imports.
 *
 * Test: curl https://didifkup.vercel.app/api/ping
 * Preflight: curl -X OPTIONS https://didifkup.vercel.app/api/ping -H "Origin: http://localhost:5173" -v
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

function setCors(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers.origin as string) || '';
  const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
  const isAllowed = isLocalhost || origin === 'https://didifkup.vercel.app' || origin === 'https://didifkup.com';
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

export default function handler(req: VercelRequest, res: VercelResponse): VercelResponse | void {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    commit: 'ping',
  });
}
