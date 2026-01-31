/**
 * HTTP helpers for serverless (req, res) Node-style handlers.
 * Framework-agnostic; works with Vercel's VercelRequest/VercelResponse.
 */

export interface ResLike {
  status(code: number): { json(body: unknown): void; end(body?: string): void };
  json(body: unknown): void;
  setHeader(name: string, value: string | number | string[]): void;
  end(body?: string): void;
}

export function json(res: ResLike, status: number, data: unknown): void {
  res.status(status).json(data);
}

export function badRequest(res: ResLike, message = 'Bad request'): void {
  res.status(400).json({ error: message });
}

export function unauthorized(res: ResLike, message = 'Unauthorized'): void {
  res.status(401).json({ error: message });
}

export function serverError(res: ResLike, message = 'Internal server error'): void {
  res.status(500).json({ error: message });
}

export function methodNotAllowed(res: ResLike, message = 'Method not allowed'): void {
  res.status(405).json({ error: message });
}

export function paywall(res: ResLike, message = 'Out of free checks'): void {
  res.status(402).json({ error: 'PAYWALL', message });
}
