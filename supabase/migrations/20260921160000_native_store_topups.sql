-- Keep transaction claims after account deletion: a deleted account must not permit replay.
create table public.game_iap_transactions (
  store text not null check (store in ('apple', 'google')),
  environment text not null check (environment in ('Production', 'Sandbox')),
  transaction_hash text not null check (transaction_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid references auth.users(id) on delete set null,
  product_id text not null,
  amount integer not null check (amount in (500,1200,3000)),
  created_at timestamptz not null default now(),
  primary key (store, environment, transaction_hash)
);
alter table public.game_iap_transactions enable row level security;
revoke all on public.game_iap_transactions from anon, authenticated;
grant all on public.game_iap_transactions to service_role;

create or replace function public.game_wallet_credit_iap(
  p_user_id uuid, p_store text, p_environment text, p_transaction_hash text, p_product_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  claim public.game_iap_transactions;
  coins integer;
  wallet public.game_wallets;
begin
  coins := case
    when p_store = 'apple' then case p_product_id
      when 'my.lepakmamak.syiling500' then 500 when 'my.lepakmamak.syiling1200' then 1200
      when 'my.lepakmamak.syiling3000' then 3000 end
    when p_store = 'google' then case p_product_id
      when 'syiling_500' then 500 when 'syiling_1200' then 1200 when 'syiling_3000' then 3000 end
  end;
  if coins is null or p_user_id is null then raise exception 'Invalid store credit'; end if;
  insert into public.game_iap_transactions(store, environment, transaction_hash, user_id, product_id, amount)
    values(p_store, p_environment, p_transaction_hash, p_user_id, p_product_id, coins)
    on conflict do nothing returning * into claim;
  if not found then
    select * into claim from public.game_iap_transactions
      where store=p_store and environment=p_environment and transaction_hash=p_transaction_hash;
    if claim.user_id is distinct from p_user_id or claim.product_id is distinct from p_product_id then
      raise exception 'Store transaction already claimed by another account or product';
    end if;
    return jsonb_build_object('fulfilled', true, 'credited', false);
  end if;
  perform public.game_wallet_get(p_user_id);
  update public.game_wallets set balance=balance+coins, updated_at=now()
    where user_id=p_user_id returning * into wallet;
  insert into public.game_currency_transactions(user_id, amount, reason, provider_reference, balance_after)
    values(p_user_id, coins, 'topup', 'iap:'||p_store||':'||p_environment||':'||p_transaction_hash, wallet.balance);
  return jsonb_build_object('fulfilled', true, 'credited', true);
end $$;
revoke all on function public.game_wallet_credit_iap(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.game_wallet_credit_iap(uuid,text,text,text,text) to service_role;
