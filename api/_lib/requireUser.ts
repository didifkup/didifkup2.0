/**
 * Reads Authorization Bearer token, verifies via Supabase, returns user.
 * On failure, calls unauthorized(res) and returns null.
 */
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabaseAdmin';
import { unauthorized } from './http';
import type { ResLike } from './http';

export interface ReqLike {
  headers: { [key: string]: string | string[] | undefined };
}

export async function requireUser(req: ReqLike, res: ResLike): Promise<User | null> {
  const auth = req.headers.authorization ?? req.headers.Authorization;
  const authStr = Array.isArray(auth) ? auth[0] : auth;
  const token = authStr?.startsWith('Bearer ') ? authStr.slice(7) : null;

  if (!token) {
    unauthorized(res, 'Missing or invalid Authorization header');
    return null;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    unauthorized(res, 'Invalid or expired token');
    return null;
  }

  return user;
}
