create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 18),
  body text not null default '' check (char_length(body) <= 500),
  media_path text,
  media_type text check (media_type in ('image', 'audio')),
  media_mime text,
  created_at timestamptz not null default now(),
  check (body <> '' or media_path is not null),
  check ((media_path is null and media_type is null and media_mime is null) or (media_path is not null and media_type is not null and media_mime is not null))
);

create index if not exists social_posts_created_at_idx on public.social_posts (created_at desc, id desc);
create index if not exists social_posts_user_created_at_idx on public.social_posts (user_id, created_at desc);

alter table public.social_posts enable row level security;
revoke all on public.social_posts from anon, authenticated;
grant select, insert, delete on public.social_posts to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-wall', 'social-wall', true, 4194304, array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mpeg','audio/mp4'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Reads use the public bucket CDN. Only the trusted Railway service role writes,
-- so no anon/authenticated storage.objects write policies are created.
