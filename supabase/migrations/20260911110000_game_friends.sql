-- Persistent friend requests for LepakMamak.
-- A friendship is stored in both directions after approval. Keeping the two
-- directions makes the read path simple while the RPCs keep each transition atomic.
create table if not exists public.game_friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  friend_name text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_id, friend_id),
  check (user_id <> friend_id),
  check (char_length(user_name) between 2 and 18),
  check (char_length(friend_name) between 2 and 18),
  check ((status = 'pending' and accepted_at is null) or (status = 'accepted' and accepted_at is not null))
);

create index if not exists game_friendships_by_user
  on public.game_friendships(user_id, status, requested_at desc);
create index if not exists game_friendships_by_friend
  on public.game_friendships(friend_id, status, requested_at desc);

alter table public.game_friendships enable row level security;
revoke all on table public.game_friendships from public, anon, authenticated;
grant all on table public.game_friendships to service_role;

create or replace function public.game_friend_request(
  p_user_id uuid,
  p_friend_id uuid,
  p_user_name text,
  p_friend_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_user_name text;
  clean_friend_name text;
  existing_status text;
begin
  if p_user_id = p_friend_id then
    return jsonb_build_object('requested', false, 'reason', 'self');
  end if;

  clean_user_name := regexp_replace(regexp_replace(trim(coalesce(p_user_name, 'Player')), '[[:cntrl:]]+', ' ', 'g'), '[[:space:]]+', ' ', 'g');
  clean_friend_name := regexp_replace(regexp_replace(trim(coalesce(p_friend_name, 'Player')), '[[:cntrl:]]+', ' ', 'g'), '[[:space:]]+', ' ', 'g');
  if char_length(clean_user_name) < 2 or char_length(clean_user_name) > 18 then clean_user_name := 'Player'; end if;
  if char_length(clean_friend_name) < 2 or char_length(clean_friend_name) > 18 then clean_friend_name := 'Player'; end if;

  select status into existing_status
    from public.game_friendships
    where user_id = p_user_id and friend_id = p_friend_id;
  if existing_status = 'accepted' then return jsonb_build_object('requested', false, 'reason', 'already_friend'); end if;
  if existing_status = 'pending' then return jsonb_build_object('requested', false, 'reason', 'pending'); end if;

  select status into existing_status
    from public.game_friendships
    where user_id = p_friend_id and friend_id = p_user_id;
  if existing_status = 'accepted' then return jsonb_build_object('requested', false, 'reason', 'already_friend'); end if;
  if existing_status = 'pending' then return jsonb_build_object('requested', false, 'reason', 'incoming'); end if;

  insert into public.game_friendships(user_id, friend_id, requested_by, user_name, friend_name, status)
    values (p_user_id, p_friend_id, p_user_id, clean_user_name, clean_friend_name, 'pending');
  return jsonb_build_object('requested', true);
end;
$$;

create or replace function public.game_friend_respond(
  p_user_id uuid,
  p_friend_id uuid,
  p_user_name text,
  p_approved boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_name text;
  clean_user_name text;
begin
  clean_user_name := regexp_replace(regexp_replace(trim(coalesce(p_user_name, 'Player')), '[[:cntrl:]]+', ' ', 'g'), '[[:space:]]+', ' ', 'g');
  if char_length(clean_user_name) < 2 or char_length(clean_user_name) > 18 then clean_user_name := 'Player'; end if;

  -- The recipient is p_user_id. The requester is p_friend_id. This prevents
  -- the requester from approving their own request by swapping the IDs.
  select user_name into requester_name
    from public.game_friendships
    where user_id = p_friend_id and friend_id = p_user_id and status = 'pending'
    for update;
  if requester_name is null then
    return jsonb_build_object('responded', false, 'reason', 'not_pending');
  end if;

  if not p_approved then
    delete from public.game_friendships where user_id = p_friend_id and friend_id = p_user_id and status = 'pending';
    return jsonb_build_object('responded', false, 'declined', true);
  end if;

  update public.game_friendships
    set status = 'accepted', accepted_at = now(), friend_name = clean_user_name
    where user_id = p_friend_id and friend_id = p_user_id and status = 'pending';

  insert into public.game_friendships(user_id, friend_id, requested_by, user_name, friend_name, status, requested_at, accepted_at)
    values (p_user_id, p_friend_id, p_friend_id, clean_user_name, requester_name, 'accepted', now(), now())
    on conflict (user_id, friend_id) do update set
      requested_by = excluded.requested_by,
      user_name = excluded.user_name,
      friend_name = excluded.friend_name,
      status = 'accepted',
      accepted_at = excluded.accepted_at;
  return jsonb_build_object('responded', true, 'accepted', true);
end;
$$;

create or replace function public.game_friend_cancel(
  p_user_id uuid,
  p_friend_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.game_friendships
    where user_id = p_user_id and friend_id = p_friend_id and status = 'pending';
  if not found then return jsonb_build_object('cancelled', false, 'reason', 'not_pending'); end if;
  return jsonb_build_object('cancelled', true);
end;
$$;

create or replace function public.game_friend_remove(
  p_user_id uuid,
  p_friend_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.game_friendships
    where status = 'accepted'
      and ((user_id = p_user_id and friend_id = p_friend_id)
        or (user_id = p_friend_id and friend_id = p_user_id));
  if not found then return jsonb_build_object('removed', false, 'reason', 'not_friend'); end if;
  return jsonb_build_object('removed', true);
end;
$$;

revoke all on function public.game_friend_request(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.game_friend_respond(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.game_friend_cancel(uuid, uuid) from public, anon, authenticated;
revoke all on function public.game_friend_remove(uuid, uuid) from public, anon, authenticated;
grant execute on function public.game_friend_request(uuid, uuid, text, text) to service_role;
grant execute on function public.game_friend_respond(uuid, uuid, text, boolean) to service_role;
grant execute on function public.game_friend_cancel(uuid, uuid) to service_role;
grant execute on function public.game_friend_remove(uuid, uuid) to service_role;
