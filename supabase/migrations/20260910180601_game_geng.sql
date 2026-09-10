create table if not exists public.game_gengs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 24),
  leader_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists game_gengs_name_lower_idx
  on public.game_gengs (lower(name));
create index if not exists game_gengs_leader_idx
  on public.game_gengs (leader_id);

create table if not exists public.game_geng_members (
  geng_id uuid not null references public.game_gengs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 18),
  status text not null default 'pending' check (status in ('pending', 'member')),
  requested_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (geng_id, user_id)
);

create index if not exists game_geng_members_geng_status_idx
  on public.game_geng_members (geng_id, status, requested_at);
create index if not exists game_geng_members_user_status_idx
  on public.game_geng_members (user_id, status);
create unique index if not exists game_geng_members_one_member_idx
  on public.game_geng_members (user_id)
  where status = 'member';

alter table public.game_gengs enable row level security;
alter table public.game_geng_members enable row level security;
revoke all on public.game_gengs, public.game_geng_members from anon, authenticated;
grant all on public.game_gengs, public.game_geng_members to service_role;

alter table public.game_currency_transactions
  drop constraint if exists game_currency_transactions_reason_check;
alter table public.game_currency_transactions
  add constraint game_currency_transactions_reason_check
  check (reason in ('starter', 'daily', 'purchase', 'topup', 'geng_create'));

create or replace function public.game_geng_create(
  p_user_id uuid,
  p_name text,
  p_display_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
  clean_display_name text;
  wallet public.game_wallets;
  geng public.game_gengs;
begin
  clean_name := regexp_replace(regexp_replace(trim(coalesce(p_name, '')), '[[:cntrl:]]+', ' ', 'g'), '[[:space:]]+', ' ', 'g');
  clean_display_name := regexp_replace(regexp_replace(trim(coalesce(p_display_name, 'Player')), '[[:cntrl:]]+', ' ', 'g'), '[[:space:]]+', ' ', 'g');
  if char_length(clean_name) < 2 or char_length(clean_name) > 24 then
    raise exception 'Invalid geng name';
  end if;
  if char_length(clean_display_name) < 2 or char_length(clean_display_name) > 18 then
    clean_display_name := 'Player';
  end if;

  if exists (
    select 1 from public.game_geng_members
    where user_id = p_user_id and status = 'member'
  ) then
    perform public.game_wallet_get(p_user_id);
    select * into wallet from public.game_wallets where user_id = p_user_id;
    return jsonb_build_object('created', false, 'reason', 'already_in_geng', 'balance', wallet.balance);
  end if;

  perform public.game_wallet_get(p_user_id);
  select * into wallet from public.game_wallets where user_id = p_user_id for update;
  if wallet.balance < 1000 then
    return jsonb_build_object('created', false, 'reason', 'insufficient', 'balance', wallet.balance);
  end if;

  -- The name insert comes before the debit. A duplicate name raises and rolls back the
  -- whole function, so a failed creation can never spend the player's coins.
  begin
    insert into public.game_gengs(name, leader_id)
      values (clean_name, p_user_id)
      returning * into geng;
  exception when unique_violation then
    return jsonb_build_object('created', false, 'reason', 'name_taken', 'balance', wallet.balance);
  end;
  update public.game_wallets
    set balance = balance - 1000, updated_at = now()
    where user_id = p_user_id
    returning * into wallet;
  insert into public.game_currency_transactions(user_id, amount, reason, balance_after)
    values (p_user_id, -1000, 'geng_create', wallet.balance);
  insert into public.game_geng_members(geng_id, user_id, display_name, status, joined_at)
    values (geng.id, p_user_id, clean_display_name, 'member', now());

  return jsonb_build_object(
    'created', true,
    'balance', wallet.balance,
    'geng', jsonb_build_object('id', geng.id, 'name', geng.name, 'leader', true, 'memberCount', 1)
  );
end;
$$;

create or replace function public.game_geng_request(
  p_user_id uuid,
  p_geng_id uuid,
  p_display_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_display_name text;
  existing_status text;
begin
  clean_display_name := regexp_replace(regexp_replace(trim(coalesce(p_display_name, 'Player')), '[[:cntrl:]]+', ' ', 'g'), '[[:space:]]+', ' ', 'g');
  if char_length(clean_display_name) < 2 or char_length(clean_display_name) > 18 then clean_display_name := 'Player'; end if;
  if not exists (select 1 from public.game_gengs where id = p_geng_id) then
    return jsonb_build_object('requested', false, 'reason', 'not_found');
  end if;
  if exists (select 1 from public.game_geng_members where user_id = p_user_id and status = 'member') then
    return jsonb_build_object('requested', false, 'reason', 'already_in_geng');
  end if;
  select status into existing_status from public.game_geng_members where geng_id = p_geng_id and user_id = p_user_id;
  if existing_status = 'member' then return jsonb_build_object('requested', false, 'reason', 'member'); end if;
  if existing_status = 'pending' then return jsonb_build_object('requested', false, 'reason', 'pending'); end if;
  insert into public.game_geng_members(geng_id, user_id, display_name, status)
    values (p_geng_id, p_user_id, clean_display_name, 'pending');
  return jsonb_build_object('requested', true);
end;
$$;

create or replace function public.game_geng_approve(
  p_leader_id uuid,
  p_user_id uuid,
  p_approved boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  geng_id_value uuid;
  member_status text;
begin
  select g.id into geng_id_value
  from public.game_gengs g
  join public.game_geng_members m on m.geng_id = g.id
  where g.leader_id = p_leader_id and m.user_id = p_leader_id and m.status = 'member';
  if geng_id_value is null then return jsonb_build_object('approved', false, 'reason', 'not_leader'); end if;

  select status into member_status from public.game_geng_members
    where geng_id = geng_id_value and user_id = p_user_id;
  if member_status is null then return jsonb_build_object('approved', false, 'reason', 'not_pending'); end if;
  if not p_approved then
    delete from public.game_geng_members where geng_id = geng_id_value and user_id = p_user_id;
    return jsonb_build_object('approved', false, 'rejected', true);
  end if;
  if member_status = 'member' then return jsonb_build_object('approved', false, 'reason', 'member'); end if;
  if exists (select 1 from public.game_geng_members where user_id = p_user_id and status = 'member') then
    return jsonb_build_object('approved', false, 'reason', 'already_in_geng');
  end if;
  update public.game_geng_members
    set status = 'member', joined_at = now()
    where geng_id = geng_id_value and user_id = p_user_id;
  return jsonb_build_object('approved', true);
end;
$$;

create or replace function public.game_geng_leave(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  geng_id_value uuid;
  leader_id_value uuid;
begin
  select m.geng_id, g.leader_id into geng_id_value, leader_id_value
  from public.game_geng_members m join public.game_gengs g on g.id = m.geng_id
  where m.user_id = p_user_id and m.status = 'member';
  if geng_id_value is null then return jsonb_build_object('left', false, 'reason', 'not_member'); end if;
  if leader_id_value = p_user_id and exists (
    select 1 from public.game_geng_members where geng_id = geng_id_value and status = 'member' and user_id <> p_user_id
  ) then
    return jsonb_build_object('left', false, 'reason', 'leader_has_members');
  end if;
  if leader_id_value = p_user_id then
    delete from public.game_gengs where id = geng_id_value;
  else
    delete from public.game_geng_members where geng_id = geng_id_value and user_id = p_user_id;
  end if;
  return jsonb_build_object('left', true);
end;
$$;

create or replace function public.game_geng_disband(p_leader_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  geng_id_value uuid;
begin
  select id into geng_id_value from public.game_gengs where leader_id = p_leader_id;
  if geng_id_value is null then return jsonb_build_object('disbanded', false, 'reason', 'not_leader'); end if;
  delete from public.game_gengs where id = geng_id_value;
  return jsonb_build_object('disbanded', true);
end;
$$;

revoke all on function public.game_geng_create(uuid, text, text) from public, anon, authenticated;
revoke all on function public.game_geng_request(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.game_geng_approve(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.game_geng_leave(uuid) from public, anon, authenticated;
revoke all on function public.game_geng_disband(uuid) from public, anon, authenticated;
grant execute on function public.game_geng_create(uuid, text, text) to service_role;
grant execute on function public.game_geng_request(uuid, uuid, text) to service_role;
grant execute on function public.game_geng_approve(uuid, uuid, boolean) to service_role;
grant execute on function public.game_geng_leave(uuid) to service_role;
grant execute on function public.game_geng_disband(uuid) to service_role;
