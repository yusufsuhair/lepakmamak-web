create table public.player_social_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 18),
  sessions integer not null default 0 check (sessions >= 0),
  recalls integer not null default 0 check (recalls >= 0),
  punches integer not null default 0 check (punches >= 0),
  dances integer not null default 0 check (dances >= 0),
  tables_sat integer not null default 0 check (tables_sat >= 0),
  basketball_points integer not null default 0 check (basketball_points >= 0),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.player_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null check (achievement_id in ('first_lepak','regular','recall_rider','dance_floor','street_fighter','table_regular','hoops')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.profile_guestbook (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references auth.users(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 18),
  body text not null check (char_length(body) between 1 and 160),
  created_at timestamptz not null default now()
);
create index profile_guestbook_profile_created_idx on public.profile_guestbook(profile_user_id, created_at desc);

create table public.profile_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('joined','achievement','basketball','table_game')),
  label text not null check (char_length(label) between 1 and 100),
  created_at timestamptz not null default now()
);
create index profile_activity_user_created_idx on public.profile_activity(user_id, created_at desc);

alter table public.player_social_stats enable row level security;
alter table public.player_achievements enable row level security;
alter table public.profile_guestbook enable row level security;
alter table public.profile_activity enable row level security;
revoke all on public.player_social_stats, public.player_achievements, public.profile_guestbook, public.profile_activity from anon, authenticated;
grant select, insert, update on public.player_social_stats to service_role;
grant select, insert on public.player_achievements to service_role;
grant select, insert, delete on public.profile_guestbook to service_role;
grant select, insert, delete on public.profile_activity to service_role;
