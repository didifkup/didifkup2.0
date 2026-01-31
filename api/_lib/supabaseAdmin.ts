/**
 * Supabase admin client — uses service role key for server-side operations.
 * Bypasses RLS. Never expose to the client.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
