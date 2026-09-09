alter table public.social_posts
  add column if not exists game_master boolean not null default false;

create table if not exists public.social_post_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists social_post_likes_post_idx on public.social_post_likes (post_id);

create table if not exists public.social_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 18),
  body text not null check (char_length(body) between 1 and 500),
  game_master boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists social_post_replies_post_created_idx on public.social_post_replies (post_id, created_at, id);

alter table public.social_post_likes enable row level security;
alter table public.social_post_replies enable row level security;
revoke all on public.social_post_likes from anon, authenticated;
revoke all on public.social_post_replies from anon, authenticated;
grant select, insert, delete on public.social_post_likes to service_role;
grant select, insert, delete on public.social_post_replies to service_role;
