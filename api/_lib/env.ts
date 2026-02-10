/**
 * Server-side env vars (process.env).
 * Throws clear errors when required vars are missing.
 */

function get(key: string): string | undefined {
  return process.env[key];
}

function requireEnv(key: string): string {
  const val = get(key);
  if (!val || val.trim() === '') {
    throw new Error(`[env] Missing or empty required var: ${key}. Set it in Vercel project settings or .env`);
  }
  return val;
}

export const STRIPE_SECRET_KEY = requireEnv('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = requireEnv('STRIPE_WEBHOOK_SECRET');
export const STRIPE_PRICE_PRO_MONTHLY = requireEnv('STRIPE_PRICE_PRO_MONTHLY');
export const SUPABASE_URL = requireEnv('SUPABASE_URL');
export const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
export const SITE_URL = requireEnv('SITE_URL');
export const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
