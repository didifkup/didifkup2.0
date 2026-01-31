-- Reset: drops objects from 0001_init. Run this first if you get "already exists" errors.
-- Use only in dev. WARNING: destroys data.

DROP POLICY IF EXISTS "usage_daily_select_own" ON public.usage_daily;
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "analyses_delete_own" ON public.analyses;
DROP POLICY IF EXISTS "analyses_update_own" ON public.analyses;
DROP POLICY IF EXISTS "analyses_insert_own" ON public.analyses;
DROP POLICY IF EXISTS "analyses_select_own" ON public.analyses;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS public.usage_daily;
DROP TABLE IF EXISTS public.subscriptions;
DROP TABLE IF EXISTS public.analyses;
DROP TABLE IF EXISTS public.profiles;
