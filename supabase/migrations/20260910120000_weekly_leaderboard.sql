-- A weekly bucket beside the lifetime counters in player_social_stats. Only the two
-- counters that survive being public get a column: punches is player-versus-player and a
-- ranking of it rewards what it counts, while recalls, dances and sessions are farmable
-- alone. Keeping them out of the table keeps them off the board by construction.
create table if not exists public.player_weekly_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  display_name text not null,
  tables_sat integer not null default 0,
  basketball_points integer not null default 0,
  primary key (user_id, week_start)
);
create index if not exists player_weekly_stats_hoops_idx on public.player_weekly_stats (week_start, basketball_points desc);
create index if not exists player_weekly_stats_tables_idx on public.player_weekly_stats (week_start, tables_sat desc);

alter table public.player_weekly_stats enable row level security;
revoke all on public.player_weekly_stats from anon, authenticated;
grant select, insert, update on public.player_weekly_stats to service_role;
