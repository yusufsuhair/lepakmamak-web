alter table public.game_currency_transactions
  add column if not exists provider_reference text;

create unique index if not exists game_currency_transactions_provider_reference_idx
  on public.game_currency_transactions(provider_reference)
  where provider_reference is not null;

alter table public.game_currency_transactions
  drop constraint if exists game_currency_transactions_reason_check;
alter table public.game_currency_transactions
  add constraint game_currency_transactions_reason_check
  check (reason in ('starter', 'daily', 'purchase', 'topup'));

create or replace function public.game_wallet_credit_stripe(
  p_user_id uuid,
  p_amount integer,
  p_session_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare wallet public.game_wallets;
begin
  if p_amount not in (500, 1200, 3000) or p_session_id !~ '^cs_' then
    raise exception 'Invalid Stripe credit';
  end if;
  perform public.game_wallet_get(p_user_id);
  select * into wallet from public.game_wallets where user_id = p_user_id for update;
  if exists(select 1 from public.game_currency_transactions where provider_reference = p_session_id) then
    return jsonb_build_object('credited', false, 'balance', wallet.balance);
  end if;
  update public.game_wallets set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id returning * into wallet;
  insert into public.game_currency_transactions(user_id, amount, reason, provider_reference, balance_after)
    values (p_user_id, p_amount, 'topup', p_session_id, wallet.balance);
  return jsonb_build_object('credited', true, 'balance', wallet.balance);
end $$;

revoke all on function public.game_wallet_credit_stripe(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.game_wallet_credit_stripe(uuid, integer, text) to service_role;
