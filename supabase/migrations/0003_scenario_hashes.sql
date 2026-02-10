-- Scenario cooldown: prevent free users from re-checking same scenario within 6 hours.
-- Run in Supabase SQL Editor if migrations are not used.

create table if not exists public.didifkup_scenario_hashes (
  user_id uuid not null references auth.users(id) on delete cascade,
  input_hash text not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, input_hash)
);

alter table public.didifkup_scenario_hashes enable row level security;

-- Users can select/insert/update their own rows.
create policy "Users can select own scenario hashes"
  on public.didifkup_scenario_hashes
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own scenario hashes"
  on public.didifkup_scenario_hashes
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scenario hashes"
  on public.didifkup_scenario_hashes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
