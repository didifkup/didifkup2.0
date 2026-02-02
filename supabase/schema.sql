-- Profiles table: one row per auth user, holds subscription info.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,  -- e.g. 'active', 'inactive', 'canceled'
  current_period_end timestamptz,
  pro_status text,           -- 'pro' | 'past_due' | 'free'
  pro_current_period_end timestamptz
);

-- Optional: ensure RLS is enabled (default for new tables in Supabase)
alter table public.profiles enable row level security;

-- Users can read their own row only.
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Optional: allow service role / backend to manage rows (no policy needed; service role bypasses RLS).
-- Optional: trigger to create a profile row on signup (uncomment if you want auto-creation):
-- create or replace function public.handle_new_user()
-- returns trigger language plpgsql security definer set search_path = public
-- as $$
-- begin
--   insert into public.profiles (id, email)
--   values (new.id, new.email);
--   return new;
-- end;
-- $$;
-- create or replace trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();
