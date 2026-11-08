-- Mafia: initial server-owned game schema.
-- All game mutations and reads are intended to go through trusted Edge Functions.
-- Never expose player_roles or service-role credentials to browser clients.

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'night', 'day', 'voting', 'finished')),
  settings jsonb not null default '{"max_players": 10, "discussion_seconds": 180, "voting_seconds": 30}'::jsonb,
  round_number integer not null default 0 check (round_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 18),
  is_alive boolean not null default true,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, nickname)
);

-- Secret assignments are kept separately and must never be client-readable.
create table if not exists public.player_roles (
  player_id uuid primary key references public.players(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  role text not null check (role in ('mafia', 'don', 'doctor', 'detective', 'civilian')),
  assigned_at timestamptz not null default now()
);

create table if not exists public.game_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_player_id uuid not null references public.players(id) on delete cascade,
  target_player_id uuid references public.players(id) on delete set null,
  action text not null check (action in ('night_kill', 'protect', 'investigate', 'vote', 'host_phase_change')),
  round_number integer not null check (round_number >= 0),
  created_at timestamptz not null default now()
);

create index if not exists players_room_id_idx on public.players(room_id);
create index if not exists player_roles_room_id_idx on public.player_roles(room_id);
create index if not exists game_actions_room_round_idx on public.game_actions(room_id, round_number);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_roles enable row level security;
alter table public.game_actions enable row level security;

-- Browser clients do not access game tables directly. Edge Functions use the
-- server-side service role after checking the caller's authenticated identity.
revoke all on table public.rooms from anon, authenticated;
revoke all on table public.players from anon, authenticated;
revoke all on table public.player_roles from anon, authenticated;
revoke all on table public.game_actions from anon, authenticated;

-- Private Realtime channels are named room:<SIX_CHARACTER_CODE>.
-- Only authenticated members of that room may subscribe to its broadcasts.
drop policy if exists "Room members can receive room broadcasts" on realtime.messages;
create policy "Room members can receive room broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() like 'room:%'
  and exists (
    select 1
    from public.players p
    join public.rooms r on r.id = p.room_id
    where p.user_id = auth.uid()
      and ('room:' || r.code) = realtime.topic()
  )
);
