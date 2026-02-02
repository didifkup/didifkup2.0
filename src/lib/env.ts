/**
 * Client-side env vars (VITE_*).
 * Throws friendly errors in dev only when required vars are missing.
 */

const isDev = import.meta.env.DEV;

function get(key: string): string | undefined {
  return import.meta.env[key] as string | undefined;
}

function requireEnv(key: string): string {
  const val = get(key);
  if (!val || val.trim() === '') {
    if (isDev) {
      throw new Error(
        `[env] Missing or empty required var: ${key}. Add it to .env and restart the dev server.`
      );
    }
    return '';
  }
  return val;
}

/** Supabase project URL (client-safe) */
export const supabaseUrl = (() => {
  try {
    return requireEnv('VITE_SUPABASE_URL');
  } catch {
    if (isDev) throw new Error('[env] VITE_SUPABASE_URL is required. Add it to .env');
    return '';
  }
})();

/** Supabase anon key (client-safe) */
export const supabaseAnonKey = (() => {
  try {
    return requireEnv('VITE_SUPABASE_ANON_KEY');
  } catch {
    if (isDev) throw new Error('[env] VITE_SUPABASE_ANON_KEY is required. Add it to .env');
    return '';
  }
})();

/** Stripe publishable key (client-safe) */
export const stripePublishableKey = (() => {
  try {
    return requireEnv('VITE_STRIPE_PUBLISHABLE_KEY');
  } catch {
    if (isDev) throw new Error('[env] VITE_STRIPE_PUBLISHABLE_KEY is required. Add it to .env');
    return '';
  }
})();
