-- VibeCheck results: store per-check metrics for pattern feedback (e.g. "You overthink ~X% of situations").
-- Optional: only used when user is signed in; front-end calls POST /api/vibecheck/save after a check.

create table if not exists public.vibecheck_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  overthinking_pct int not null check (overthinking_pct >= 0 and overthinking_pct <= 100),
  messed_up_pct int not null check (messed_up_pct >= 0 and messed_up_pct <= 100)
);

create index if not exists vibecheck_results_user_created
  on public.vibecheck_results (user_id, created_at desc);

alter table public.vibecheck_results enable row level security;

create policy "Users can select own vibecheck_results"
  on public.vibecheck_results for select using (auth.uid() = user_id);

create policy "Users can insert own vibecheck_results"
  on public.vibecheck_results for insert with check (auth.uid() = user_id);
