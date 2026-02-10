import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://didifkup.vercel.app',
  'https://didifkup.com',
]);

/**
 * Sets CORS headers on the response. Uses allowlist; only sets Access-Control-Allow-Origin
 * when the request origin is in the allowlist.
 */
export function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin;
  const originStr = typeof origin === 'string' ? origin : Array.isArray(origin) ? origin[0] : '';

  if (originStr && ALLOWED_ORIGINS.has(originStr)) {
    res.setHeader('Access-Control-Allow-Origin', originStr);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

/**
 * Handles OPTIONS preflight. Returns 204 with CORS headers.
 */
export function handleOptions(req: VercelRequest, res: VercelResponse): void {
  setCorsHeaders(req, res);
  res.status(204).end();
}
