alter table public.player_roles
  drop constraint if exists player_roles_role_check;
alter table public.player_roles
  add constraint player_roles_role_check
  check (role = any (array[
    'mafia'::text, 'don'::text, 'doctor'::text, 'detective'::text,
    'maniac'::text, 'courtesan'::text, 'barista'::text, 'civilian'::text
  ]));

alter table public.game_actions
  drop constraint if exists game_actions_action_check;
alter table public.game_actions
  add constraint game_actions_action_check
  check (action = any (array[
    'night_kill'::text, 'protect'::text, 'investigate'::text,
    'don_check'::text, 'maniac_kill'::text, 'block'::text, 'vote'::text
  ]));

alter table public.rooms
  drop constraint if exists rooms_winner_check;
alter table public.rooms
  add constraint rooms_winner_check
  check (winner = any (array['mafia'::text, 'town'::text, 'maniac'::text]));
