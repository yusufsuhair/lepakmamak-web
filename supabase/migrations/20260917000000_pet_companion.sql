alter table public.shop_inventory drop constraint if exists shop_inventory_sku_check;
alter table public.shop_inventory add constraint shop_inventory_sku_check
  check (sku in ('spectacles', 'cap', 'batik', 'harimau', 'pet-companion', 'pet-ginger', 'pet-cream', 'pet-collar-red', 'pet-collar-teal'));

-- A colour is a free style choice in Pet Studio. Existing colour SKUs remain valid
-- inventory history, but they count as ownership of the one companion.
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
    when 'pet-companion' then 250
    when 'pet-collar-red' then 60
    when 'pet-collar-teal' then 60
    else null
  end;
  if item_price is null then raise exception 'Unknown item'; end if;
  perform public.game_wallet_get(p_user_id);
  select * into wallet from public.game_wallets where user_id = p_user_id for update;
  if (p_sku = 'pet-companion' and exists(select 1 from public.shop_inventory where user_id = p_user_id and sku in ('pet-companion', 'pet-ginger', 'pet-cream')))
    or (p_sku <> 'pet-companion' and exists(select 1 from public.shop_inventory where user_id = p_user_id and sku = p_sku)) then
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

-- The canonical SKU is the paid companion. Legacy colour rows can still equip it so
-- existing players keep the pet they already bought without another charge.
create or replace function public.game_pet_equip(p_user_id uuid, p_sku text, p_equipped boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  slot text[];
  legacy_sku text;
begin
  slot := case
    when p_sku in ('pet-companion', 'pet-ginger', 'pet-cream') then array['pet-companion', 'pet-ginger', 'pet-cream']
    when p_sku in ('pet-collar-red', 'pet-collar-teal') then array['pet-collar-red', 'pet-collar-teal']
    else null end;
  if slot is null or p_equipped is null then raise exception 'Invalid pet item'; end if;
  perform public.game_wallet_get(p_user_id);
  perform 1 from public.game_wallets where user_id = p_user_id for update;
  if not exists(select 1 from public.shop_inventory where user_id = p_user_id and sku = any(slot)) then
    raise exception 'Item not owned';
  end if;
  if p_sku = 'pet-companion' then
    select sku into legacy_sku from public.shop_inventory
      where user_id = p_user_id and sku in ('pet-ginger', 'pet-cream') order by equipped desc, sku limit 1;
  end if;
  update public.shop_inventory set equipped = false where user_id = p_user_id and sku = any(slot);
  if p_equipped then
    if p_sku = 'pet-companion' and not exists(select 1 from public.shop_inventory where user_id = p_user_id and sku = 'pet-companion') then
      update public.shop_inventory set equipped = true where user_id = p_user_id and sku = legacy_sku;
    else
      update public.shop_inventory set equipped = true where user_id = p_user_id and sku = p_sku;
    end if;
  end if;
end $$;

revoke all on function public.game_pet_equip(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.game_pet_equip(uuid,text,boolean) to service_role;
