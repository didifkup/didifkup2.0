import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './env';

/** Browser Supabase client using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
