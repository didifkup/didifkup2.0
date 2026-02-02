-- Add pro_status, stripe_subscription_id, pro_current_period_end to profiles.
-- Run in Supabase SQL Editor if migrations are not used.

alter table public.profiles add column if not exists pro_status text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists pro_current_period_end timestamptz;
