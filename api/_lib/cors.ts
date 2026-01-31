/**
 * CORS helpers for serverless (req, res) Node-style handlers.
 * Allows same-origin + localhost for dev.
 */

export interface ReqLike {
  headers: { [key: string]: string | string[] | undefined };
  method?: string;
}

export interface ResLike {
  status(code: number): ResLike & { end: () => void };
  setHeader(name: string, value: string | number | string[]): void;
  end(body?: string): void;
}

function getAllowedOrigin(req: ReqLike): string | null {
  const origin = req.headers.origin ?? req.headers.Origin;
  const originStr = Array.isArray(origin) ? origin[0] : origin;
  if (!originStr || typeof originStr !== 'string') return null;

  try {
    const u = new URL(originStr);
    // localhost for dev
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return originStr;
    // same-origin: allow Vercel deployment URL
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl && u.hostname === vercelUrl) return originStr;
    if (u.hostname.endsWith('.vercel.app')) return originStr;
  } catch {
    return null;
  }

  return null;
}

/**
 * Apply CORS headers. Call before other response logic.
 * Handles OPTIONS preflight — returns 204 if handled, caller should return.
 */
export function applyCors(req: ReqLike, res: ResLike): boolean {
  const origin = getAllowedOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
