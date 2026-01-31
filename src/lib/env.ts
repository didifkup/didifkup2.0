/**
 * Client env — reads import.meta.env (Vite). Only VITE_* vars are exposed to the client.
 * In dev, missing vars use placeholders so the app loads (auth won't work until .env is set).
 * In prod, throws if required vars are missing.
 */
function requireEnv(name: string, value: string | undefined, placeholder: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    if (import.meta.env.DEV) {
      console.warn(
        `[env] Missing ${name}. Using placeholder — auth will not work. Add it to .env and restart.`
      );
      return placeholder;
    }
    throw new Error(`[env] Missing or empty required var: ${name}. Set it in your deployment env.`);
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
