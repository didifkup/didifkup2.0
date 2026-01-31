/**
 * Client env — reads import.meta.env (Vite). Only VITE_* vars are exposed to the client.
 * Vite replaces import.meta.env.VITE_* at BUILD time — set them in Vercel Project Settings → Environment Variables.
 * If missing, uses placeholder so the build succeeds (auth won't work until vars are set).
 */
function requireEnv(name: string, value: string | undefined, placeholder: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[env] Missing ${name}. Add it in Vercel → Project Settings → Environment Variables. Auth will not work.`
      );
    }
    return placeholder;
  }
  return trimmed;
}

export const env = {
  get supabaseUrl(): string {
    return requireEnv(
      'VITE_SUPABASE_URL',
      import.meta.env.VITE_SUPABASE_URL,
      'https://placeholder.supabase.co'
    );
  },
  get supabaseAnonKey(): string {
    return requireEnv(
      'VITE_SUPABASE_ANON_KEY',
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      'placeholder-anon-key'
    );
  },
};
