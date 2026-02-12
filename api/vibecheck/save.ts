import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '../_lib/env.js';
import { setCorsHeaders, handleOptions } from '../_lib/cors.js';
import { verifySupabaseUser } from '../_lib/verifySupabaseUser.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
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

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const overthinkingPct = Number(body.overthinkingPct);
  const messedUpPct = Number(body.messedUpPct);
  if (
    !Number.isInteger(overthinkingPct) ||
    overthinkingPct < 0 ||
    overthinkingPct > 100 ||
    !Number.isInteger(messedUpPct) ||
    messedUpPct < 0 ||
    messedUpPct > 100
  ) {
    return res.status(400).json({ error: 'Invalid body', message: 'overthinkingPct and messedUpPct must be 0-100 integers' });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from('vibecheck_results').insert({
    user_id: user.id,
    overthinking_pct: overthinkingPct,
    messed_up_pct: messedUpPct,
  });

  if (error) {
    return res.status(500).json({ error: 'Failed to save', message: error.message });
  }
  return res.status(200).json({ ok: true });
}
