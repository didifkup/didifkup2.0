-- DidIFkUp: Initial schema
-- Profiles, analyses, subscriptions, usage_daily + RLS
--
-- How to run:
-- 1. Supabase Dashboard: SQL Editor → New query → paste this file → Run
-- 2. CLI: supabase db push  (from project root with supabase link)
-- 3. CLI: supabase migration up

-- profiles: one per auth user, created by trigger
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  prefs jsonb DEFAULT '{}'::jsonb
);

-- analyses: user analysis history
CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  input jsonb NOT NULL,
  output jsonb NOT NULL,
  model text
);

CREATE INDEX idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX idx_analyses_created_at ON public.analyses(created_at DESC);

-- subscriptions: Stripe subscription state
CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  status text,
  current_period_end timestamptz,
  price_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- usage_daily: daily check usage per user
CREATE TABLE public.usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  checks_used int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Trigger: create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

-- profiles: user can select/update own
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- analyses: user can select/insert/update/delete own
CREATE POLICY "analyses_select_own"
  ON public.analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "analyses_insert_own"
  ON public.analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analyses_update_own"
  ON public.analyses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analyses_delete_own"
  ON public.analyses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- subscriptions: user can select own; only service role can write
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- usage_daily: user can select own; only service role can write
CREATE POLICY "usage_daily_select_own"
  ON public.usage_daily FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
