-- ZOMBIE SHOOTER — Supabase Free Tier Schema & RLS Policies
-- Run this once in Supabase Dashboard -> SQL Editor -> New Query

-- 1. Persistent Player Progression & Economy
create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Survivor',
  avatar_id integer not null default 0,
  level integer not null default 1,
  xp integer not null default 0,
  coins integer not null default 180,
  gems integer not null default 15,
  highest_wave integer not null default 0,
  total_kills integer not null default 0,
  games_played integer not null default 0,
  best_survival_time double precision not null default 0,
  save_data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

drop policy if exists "player_saves_select_own" on public.player_saves;
create policy "player_saves_select_own"
  on public.player_saves
  for select
  using (auth.uid() = user_id);

drop policy if exists "player_saves_insert_own" on public.player_saves;
create policy "player_saves_insert_own"
  on public.player_saves
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "player_saves_update_own" on public.player_saves;
create policy "player_saves_update_own"
  on public.player_saves
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_player_saves_leaderboard
  on public.player_saves (highest_wave desc, total_kills desc);

-- 2. Persistent Multiplayer Match History
create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  mode text not null check (mode in ('coop', 'competitive')),
  wave_reached integer not null default 1,
  winner_user_id uuid references auth.users(id) on delete set null,
  reason text not null default '',
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.match_results enable row level security;

drop policy if exists "match_results_select_authenticated" on public.match_results;
create policy "match_results_select_authenticated"
  on public.match_results
  for select
  to authenticated
  using (true);

create index if not exists idx_match_results_created_at
  on public.match_results (created_at desc);
