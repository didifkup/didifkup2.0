import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Matches http://localhost:<any_port> */
const LOCALHOST_ORIGIN_REGEX = /^http:\/\/localhost:\d+$/;

const PRODUCTION_ORIGINS = new Set([
  'https://didifkup.vercel.app',
  'https://didifkup.com',
]);

function isAllowedOrigin(origin: string): boolean {
  return LOCALHOST_ORIGIN_REGEX.test(origin) || PRODUCTION_ORIGINS.has(origin);
}

/**
 * Sets CORS headers on the response. NEVER throws.
 * Allow-Origin: any http://localhost:<port>, https://didifkup.vercel.app, https://didifkup.com
 */
export function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  if (!req || !res) return;
  try {
    const origin = req.headers?.origin;
    const originStr = typeof origin === 'string' ? origin : Array.isArray(origin) ? origin[0] : '';
    if (originStr && isAllowedOrigin(originStr)) {
      res.setHeader('Access-Control-Allow-Origin', originStr);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
  } catch {
    /* never throw */
  }
}

/**
 * Handles OPTIONS preflight. Returns 200 with CORS headers.
 */
export function handleOptions(req: VercelRequest, res: VercelResponse): void {
  setCorsHeaders(req, res);
  res.status(200).end();
}
