-- Mafia live game schema. Apply to a fresh Supabase project.
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','night','day','voting','finished')),
  winner text check (winner in ('mafia','town')),
  settings jsonb not null default '{"max_players":10,"discussion_seconds":180,"voting_seconds":30}'::jsonb,
  round_number integer not null default 0 check (round_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 18),
  is_alive boolean not null default true,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id,user_id)
);
create unique index if not exists players_room_nickname_lower_idx on public.players(room_id,lower(nickname));
create index if not exists players_room_id_idx on public.players(room_id);
create table if not exists public.player_roles (
  player_id uuid primary key references public.players(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  role text not null check (role in ('mafia','doctor','detective','civilian')),
  assigned_at timestamptz not null default now()
);
create index if not exists player_roles_room_id_idx on public.player_roles(room_id);
create table if not exists public.game_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_player_id uuid not null references public.players(id) on delete cascade,
  target_player_id uuid references public.players(id) on delete set null,
  action text not null check (action in ('night_kill','protect','investigate','vote')),
  round_number integer not null check (round_number >= 1),
  created_at timestamptz not null default now(),
  unique (room_id,actor_player_id,action,round_number)
);
create index if not exists game_actions_room_round_idx on public.game_actions(room_id,round_number);
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  nickname text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists room_messages_room_created_idx on public.room_messages(room_id,created_at desc);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_roles enable row level security;
alter table public.game_actions enable row level security;
alter table public.room_messages enable row level security;

create or replace function public.is_room_member(target_room_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.players p where p.room_id=target_room_id and p.user_id=auth.uid());
$$;
revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

drop policy if exists "Room members can view rooms" on public.rooms;
create policy "Room members can view rooms" on public.rooms for select to authenticated using (public.is_room_member(id));
drop policy if exists "Room members can view players" on public.players;
create policy "Room members can view players" on public.players for select to authenticated using (public.is_room_member(room_id));
drop policy if exists "Room members can view messages" on public.room_messages;
create policy "Room members can view messages" on public.room_messages for select to authenticated using (public.is_room_member(room_id));

revoke all on public.rooms from anon,authenticated;
revoke all on public.players from anon,authenticated;
revoke all on public.player_roles from anon,authenticated;
revoke all on public.game_actions from anon,authenticated;
revoke all on public.room_messages from anon,authenticated;
grant select on public.rooms,public.players,public.room_messages to authenticated;

do $$ begin alter publication supabase_realtime add table public.rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.players; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.room_messages; exception when duplicate_object then null; end $$;
