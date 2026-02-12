import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '../_lib/env.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { verifySupabaseUser } from '../_lib/verifySupabaseUser.js';

const LIMIT = 20;
const MIN_CHECKS = 3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
  }
  const accessToken = auth.slice(7).trim();
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing Bearer token' });
  }

  let env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string };
  try {
    env = getSupabaseEnv();
  } catch (e) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const user = await verifySupabaseUser(
    accessToken,
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase
    .from('vibecheck_results')
    .select('overthinking_pct')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch pattern', message: error.message });
  }

  const list = Array.isArray(rows) ? rows : [];
  if (list.length < MIN_CHECKS) {
    return res.status(200).json({ avgOverthinking: null, count: list.length });
  }

  const sum = list.reduce((acc, r) => acc + (r?.overthinking_pct ?? 0), 0);
  const avgOverthinking = Math.round(sum / list.length);
  return res.status(200).json({ avgOverthinking, count: list.length });
}
