-- Run only against an isolated test database. Everything is rolled back.
begin;
insert into auth.users(id) values ('b4ddf73b-cc28-4e4f-8735-223e8a94d639'),('36fda325-b875-4ea5-8abd-886b5a065199');
do $$
declare a uuid := 'b4ddf73b-cc28-4e4f-8735-223e8a94d639';
  b uuid := '36fda325-b875-4ea5-8abd-886b5a065199'; result jsonb;
begin
  result := public.game_wallet_credit_iap(a,'google','Production',repeat('a',64),'syiling_500');
  assert result->>'credited' = 'true';
  result := public.game_wallet_credit_iap(a,'google','Production',repeat('a',64),'syiling_500');
  assert result->>'credited' = 'false';
  assert (select balance from public.game_wallets where user_id=a) = 1000;
  assert (select count(*) from public.game_currency_transactions where user_id=a and reason='topup') = 1;
  begin
    perform public.game_wallet_credit_iap(b,'google','Production',repeat('a',64),'syiling_500');
    raise exception 'Expected owner rejection' using errcode='ZX001';
  exception when raise_exception then null; end;
  begin
    perform public.game_wallet_credit_iap(a,'google','Production',repeat('a',64),'syiling_1200');
    raise exception 'Expected product rejection' using errcode='ZX001';
  exception when raise_exception then null; end;
  begin
    perform public.game_wallet_credit_iap(a,'google','Production',repeat('b',64),'unknown');
    raise exception 'Expected unknown-product rejection' using errcode='ZX001';
  exception when raise_exception then null; end;
  assert not exists(select 1 from public.game_iap_transactions where transaction_hash=repeat('b',64));
  perform public.game_wallet_credit_iap(a,'apple','Production',repeat('b',64),'my.lepakmamak.syiling1200');
  assert (select balance from public.game_wallets where user_id=a) = 2200;
  -- Simulate a failure after the claim: the complete transaction must roll back.
  update public.game_wallets set balance=2147483647 where user_id=a;
  begin
    perform public.game_wallet_credit_iap(a,'google','Production',repeat('c',64),'syiling_500');
    raise exception 'Expected integer overflow' using errcode='ZX001';
  exception when numeric_value_out_of_range then null; end;
  assert not exists(select 1 from public.game_iap_transactions where transaction_hash=repeat('c',64));
  delete from auth.users where id=a;
  assert (select user_id is null from public.game_iap_transactions where transaction_hash=repeat('a',64));
  begin
    perform public.game_wallet_credit_iap(b,'google','Production',repeat('a',64),'syiling_500');
    raise exception 'Expected deleted-owner replay rejection' using errcode='ZX001';
  exception when raise_exception then null; end;
  assert not has_function_privilege('authenticated','public.game_wallet_credit_iap(uuid,text,text,text,text)','EXECUTE');
  assert not has_table_privilege('authenticated','public.game_iap_transactions','INSERT');
end $$;
rollback;
