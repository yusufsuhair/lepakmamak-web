create table if not exists public.game_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 500 check (balance >= 0),
  last_daily_claim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_currency_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('starter', 'daily', 'purchase')),
  sku text,
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index if not exists game_currency_transactions_user_created_idx
  on public.game_currency_transactions (user_id, created_at desc);

alter table public.game_wallets enable row level security;
alter table public.game_currency_transactions enable row level security;
revoke all on public.game_wallets, public.game_currency_transactions from anon, authenticated;
grant all on public.game_wallets, public.game_currency_transactions to service_role;
grant usage, select on sequence public.game_currency_transactions_id_seq to service_role;

alter table public.shop_inventory drop constraint if exists shop_inventory_sku_check;
alter table public.shop_inventory add constraint shop_inventory_sku_check
  check (sku in ('spectacles', 'cap', 'batik', 'harimau'));

create or replace function public.game_wallet_get(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  wallet public.game_wallets;
  created_wallet boolean := false;
begin
  insert into public.game_wallets(user_id) values (p_user_id)
    on conflict (user_id) do nothing returning * into wallet;
  created_wallet := found;
  if not created_wallet then
    select * into wallet from public.game_wallets where user_id = p_user_id;
  else
    insert into public.game_currency_transactions(user_id, amount, reason, balance_after)
      values (p_user_id, 500, 'starter', 500);
  end if;
  return jsonb_build_object(
    'balance', wallet.balance,
    'dailyAvailable', wallet.last_daily_claim is null or wallet.last_daily_claim <= now() - interval '24 hours',
    'nextDailyAt', case when wallet.last_daily_claim is null then null else wallet.last_daily_claim + interval '24 hours' end
  );
end $$;

create or replace function public.game_wallet_claim_daily(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare wallet public.game_wallets;
begin
  perform public.game_wallet_get(p_user_id);
  select * into wallet from public.game_wallets where user_id = p_user_id for update;
  if wallet.last_daily_claim is not null and wallet.last_daily_claim > now() - interval '24 hours' then
    return jsonb_build_object('claimed', false, 'balance', wallet.balance, 'dailyAvailable', false, 'nextDailyAt', wallet.last_daily_claim + interval '24 hours');
  end if;
  update public.game_wallets set balance = balance + 100, last_daily_claim = now(), updated_at = now()
    where user_id = p_user_id returning * into wallet;
  insert into public.game_currency_transactions(user_id, amount, reason, balance_after)
    values (p_user_id, 100, 'daily', wallet.balance);
  return jsonb_build_object('claimed', true, 'balance', wallet.balance, 'dailyAvailable', false, 'nextDailyAt', wallet.last_daily_claim + interval '24 hours');
end $$;

create or replace function public.game_shop_buy(p_user_id uuid, p_sku text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  wallet public.game_wallets;
  item_price integer;
begin
  item_price := case p_sku
    when 'spectacles' then 120
    when 'cap' then 150
    when 'batik' then 220
    when 'harimau' then 260
    else null
  end;
  if item_price is null then raise exception 'Unknown item'; end if;
  perform public.game_wallet_get(p_user_id);
  select * into wallet from public.game_wallets where user_id = p_user_id for update;
  if exists(select 1 from public.shop_inventory where user_id = p_user_id and sku = p_sku) then
    return jsonb_build_object('purchased', false, 'reason', 'owned', 'balance', wallet.balance);
  end if;
  if wallet.balance < item_price then
    return jsonb_build_object('purchased', false, 'reason', 'insufficient', 'balance', wallet.balance);
  end if;
  update public.game_wallets set balance = balance - item_price, updated_at = now()
    where user_id = p_user_id returning * into wallet;
  insert into public.shop_inventory(user_id, sku) values (p_user_id, p_sku);
  insert into public.game_currency_transactions(user_id, amount, reason, sku, balance_after)
    values (p_user_id, -item_price, 'purchase', p_sku, wallet.balance);
  return jsonb_build_object('purchased', true, 'balance', wallet.balance);
end $$;

revoke all on function public.game_wallet_get(uuid) from public, anon, authenticated;
revoke all on function public.game_wallet_claim_daily(uuid) from public, anon, authenticated;
revoke all on function public.game_shop_buy(uuid, text) from public, anon, authenticated;
grant execute on function public.game_wallet_get(uuid) to service_role;
grant execute on function public.game_wallet_claim_daily(uuid) to service_role;
grant execute on function public.game_shop_buy(uuid, text) to service_role;
