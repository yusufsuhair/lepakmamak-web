-- Run with npm run test:db against the local Supabase stack. Fixtures always roll back.
begin;

do $$
declare
  name text;
  fn regprocedure;
begin
  foreach name in array array[
    'shop_orders','shop_inventory','game_wallets','game_currency_transactions',
    'chat_messages','social_posts','social_post_likes','social_post_replies',
    'player_social_stats','player_achievements','profile_guestbook','profile_activity',
    'admin_audit_log','player_weekly_stats','player_reports','player_bans',
    'game_gengs','game_geng_members','game_friendships','player_handles',
    'game_messages','player_blocks','funnel_events'
  ] loop
    if to_regclass('public.' || name) is null then raise exception 'Missing table: %', name; end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass('public.' || name)) then
      raise exception 'RLS disabled: %', name;
    end if;
    if has_table_privilege('anon', 'public.' || name, 'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('authenticated', 'public.' || name, 'INSERT,UPDATE,DELETE')
      or (name <> 'shop_inventory' and has_table_privilege('authenticated', 'public.' || name, 'SELECT')) then
      raise exception 'Unexpected browser access: %', name;
    end if;
  end loop;
  foreach name in array array[
    'shop_fulfill(uuid,text,text)','shop_refund(text)',
    'game_wallet_get(uuid)','game_wallet_claim_daily(uuid)','game_shop_buy(uuid,text)',
    'game_wallet_credit_stripe(uuid,integer,text)','game_pet_equip(uuid,text,boolean)',
    'game_geng_create(uuid,text,text)','game_geng_request(uuid,uuid,text)',
    'game_geng_approve(uuid,uuid,boolean)','game_geng_leave(uuid)','game_geng_disband(uuid)',
    'game_friend_request(uuid,uuid,text,text)','game_friend_respond(uuid,uuid,text,boolean)',
    'game_friend_cancel(uuid,uuid)','game_friend_remove(uuid,uuid)'
  ] loop
    fn := to_regprocedure('public.' || name);
    if fn is null then raise exception 'Missing RPC: %', name; end if;
    if has_function_privilege('anon', fn, 'EXECUTE') or has_function_privilege('authenticated', fn, 'EXECUTE')
      or not has_function_privilege('service_role', fn, 'EXECUTE') then
      raise exception 'Incorrect RPC grants: %', name;
    end if;
  end loop;
  if not exists(select 1 from storage.buckets where id = 'social-wall' and public and file_size_limit = 4194304) then
    raise exception 'Wall storage bucket is missing or misconfigured';
  end if;
  if to_regclass('public.funnel_daily') is null or to_regclass('public.funnel_retention') is null then
    raise exception 'Analytics views are missing';
  end if;
end $$;

-- Random IDs avoid collisions with existing local users. No password or login is seeded.
select set_config('lepak.test_user', gen_random_uuid()::text, true);
select set_config('lepak.test_friend', gen_random_uuid()::text, true);
insert into auth.users(id) values
  (current_setting('lepak.test_user')::uuid), (current_setting('lepak.test_friend')::uuid);

set local role service_role;
do $$
declare
  player uuid := current_setting('lepak.test_user')::uuid;
  friend uuid := current_setting('lepak.test_friend')::uuid;
  payment text := 'cs_smoke_' || player;
  result jsonb;
begin
  result := public.game_wallet_get(player);
  if (result->>'balance')::integer is distinct from 500 then raise exception 'Starter balance missing'; end if;
  perform public.game_wallet_get(player);
  if (select count(*) from public.game_currency_transactions where user_id = player and reason = 'starter') <> 1 then
    raise exception 'Starter credit was duplicated';
  end if;
  if (public.game_wallet_claim_daily(player)->>'claimed')::boolean is distinct from true
    or (public.game_wallet_claim_daily(player)->>'claimed')::boolean is distinct from false then raise exception 'Daily reward is not idempotent'; end if;
  if (public.game_wallet_credit_stripe(player, 500, payment)->>'credited')::boolean is distinct from true
    or (public.game_wallet_credit_stripe(player, 500, payment)->>'credited')::boolean is distinct from false then raise exception 'Stripe credit is not idempotent'; end if;
  if (public.game_shop_buy(player, 'pet-companion')->>'purchased')::boolean is distinct from true then raise exception 'Current pet SKU missing'; end if;
  perform public.game_pet_equip(player, 'pet-companion', true);
  if not exists(select 1 from public.shop_inventory where user_id = player and sku = 'pet-companion' and equipped) then
    raise exception 'Pet equipment failed';
  end if;
  if (public.game_friend_request(player, friend, 'Test Player', 'Test Friend')->>'requested')::boolean is distinct from true
    or (public.game_friend_respond(friend, player, 'Test Friend', true)->>'accepted')::boolean is distinct from true then raise exception 'Friend RPCs failed'; end if;
  insert into public.game_messages(sender_user_id, recipient_user_id, body, client_id) values (player, friend, 'Local schema check', 'smoke');
  insert into public.profile_activity(user_id, activity_type, label) values (player, 'joined', 'Local schema check');
  insert into public.funnel_events(device_id, user_id, event) values (gen_random_uuid(), player, 'entered_city');
  insert into public.admin_audit_log(actor, action, target_table, target_id) values ('test@example.com', 'smoke', 'game_wallets', player::text);
end $$;

-- The only browser-readable table must filter rows by the authenticated account.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('lepak.test_friend'), true);
do $$ begin
  if exists(select 1 from public.shop_inventory where user_id = current_setting('lepak.test_user')::uuid) then
    raise exception 'Inventory RLS leaked another user inventory';
  end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('lepak.test_user'), true);
do $$ begin
  if not exists(select 1 from public.shop_inventory where sku = 'pet-companion' and user_id = current_setting('lepak.test_user')::uuid) then
    raise exception 'Owner cannot read own inventory';
  end if;
end $$;
rollback;
select 'Database smoke check passed; fixtures rolled back.' as result;
