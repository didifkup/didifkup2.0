/**
 * Server-side env vars (process.env).
 * Scoped getters validate only the vars needed by each route.
 */

function get(key: string): string | undefined {
  return process.env[key];
}

export function mustGet(name: string): string {
  const val = get(name);
  if (!val || val.trim() === '') {
    throw new Error(`[env] Missing or empty required var: ${name}. Set it in Vercel project settings or .env`);
  }
  return val;
}

export interface AnalyzeEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY: string;
}

/** Validate only vars needed by /api/analyze. Does not require STRIPE_*. */
export function getAnalyzeEnv(): AnalyzeEnv {
  return {
    SUPABASE_URL: mustGet('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: mustGet('SUPABASE_SERVICE_ROLE_KEY'),
    OPENAI_API_KEY: mustGet('OPENAI_API_KEY'),
  };
}

export interface StripeEnv {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_PRO_MONTHLY: string;
  SITE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/** Validate only Supabase vars (e.g. for vibecheck save/pattern). */
export function getSupabaseEnv(): SupabaseEnv {
  return {
    SUPABASE_URL: mustGet('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: mustGet('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

/** Validate Stripe + Supabase vars needed for billing/webhooks. */
export function getStripeEnv(): StripeEnv {
  return {
    STRIPE_SECRET_KEY: mustGet('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: mustGet('STRIPE_WEBHOOK_SECRET'),
    STRIPE_PRICE_PRO_MONTHLY: mustGet('STRIPE_PRICE_PRO_MONTHLY'),
    SITE_URL: mustGet('SITE_URL'),
    SUPABASE_URL: mustGet('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: mustGet('SUPABASE_SERVICE_ROLE_KEY'),
  };
}
