/**
 * Server env — reads process.env (Vercel). Never exposed to the client.
 * Throws in dev if required vars are missing or empty.
 */
function requireEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    const msg = `[api/env] Missing or empty required var: ${name}. Add it in Vercel Project Settings → Environment Variables.`;
    if (process.env.NODE_ENV !== 'production') {
      console.error(msg);
    }
    throw new Error(msg);
  }
  return trimmed;
}

export const env = {
  get supabaseUrl(): string {
    return requireEnv('SUPABASE_URL', process.env.SUPABASE_URL);
  },
  get supabaseServiceRoleKey(): string {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get openaiApiKey(): string {
    return requireEnv('OPENAI_API_KEY', process.env.OPENAI_API_KEY);
  },
  get stripeSecretKey(): string {
    return requireEnv('STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY);
  },
  get stripeWebhookSecret(): string {
    return requireEnv('STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET);
  },
  get stripePriceProMonthly(): string {
    return requireEnv('STRIPE_PRICE_PRO_MONTHLY', process.env.STRIPE_PRICE_PRO_MONTHLY);
  },
  /** Pro price ID — prefers STRIPE_PRO_PRICE_ID, falls back to STRIPE_PRICE_PRO_MONTHLY */
  get stripeProPriceId(): string {
    const v = process.env.STRIPE_PRO_PRICE_ID ?? process.env.STRIPE_PRICE_PRO_MONTHLY;
    return requireEnv('STRIPE_PRO_PRICE_ID or STRIPE_PRICE_PRO_MONTHLY', v);
  },
};
