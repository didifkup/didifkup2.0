-- Scenarios: store analysis history for habit loop groundwork.
-- Streaks: daily check-in tracking.
-- User usage: ensure exists for free-tier limits.

-- user_usage (create only if missing)
create table if not exists public.user_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  analyses_used int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_usage enable row level security;

create policy "Users can select own user_usage"
  on public.user_usage for select using (auth.uid() = user_id);

create policy "Users can insert own user_usage"
  on public.user_usage for insert with check (auth.uid() = user_id);

create policy "Users can update own user_usage"
  on public.user_usage for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- didifkup_scenarios
create table if not exists public.didifkup_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  input_hash text not null,
  happened text not null,
  you_did text not null,
  they_did text not null,
  relationship text,
  context text,
  tone text not null,
  result jsonb not null,
  verdict text not null
);

alter table public.didifkup_scenarios enable row level security;

create policy "Users can select own scenarios"
  on public.didifkup_scenarios for select using (auth.uid() = user_id);

create policy "Users can insert own scenarios"
  on public.didifkup_scenarios for insert with check (auth.uid() = user_id);

create policy "Users can update own scenarios"
  on public.didifkup_scenarios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- didifkup_streaks
create table if not exists public.didifkup_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_checkin_date date,
  current_streak int not null default 0,
  best_streak int not null default 0,
  total_checks int not null default 0
);

alter table public.didifkup_streaks enable row level security;

create policy "Users can select own streaks"
  on public.didifkup_streaks for select using (auth.uid() = user_id);

create policy "Users can insert own streaks"
  on public.didifkup_streaks for insert with check (auth.uid() = user_id);

create policy "Users can update own streaks"
  on public.didifkup_streaks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
