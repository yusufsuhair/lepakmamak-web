create table if not exists public.shop_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 sku text not null check (sku in ('spectacles','cap')), status text not null default 'pending' check(status in ('pending','paid','expired','refunded')),
 stripe_session text unique, payment_intent text, created_at timestamptz not null default now()
);
create unique index if not exists shop_one_active_item on public.shop_orders(user_id,sku) where status in ('pending','paid');
create table if not exists public.shop_inventory (
 user_id uuid not null references auth.users(id) on delete cascade, sku text not null check(sku in ('spectacles','cap')),
 equipped boolean not null default false, primary key(user_id,sku)
);
alter table public.shop_orders enable row level security;
alter table public.shop_inventory enable row level security;
revoke all on public.shop_orders, public.shop_inventory from anon, authenticated;
grant select on public.shop_inventory to authenticated;
drop policy if exists "read own inventory" on public.shop_inventory;
create policy "read own inventory" on public.shop_inventory for select to authenticated using (auth.uid()=user_id);
create or replace function public.shop_fulfill(order_id uuid, session_id text, intent_id text) returns void language plpgsql security definer set search_path = public as $$
declare o public.shop_orders;
begin
 select * into o from public.shop_orders where id=order_id for update;
 if not found or o.status='refunded' then raise exception 'Invalid order'; end if;
 if o.stripe_session is not null and o.stripe_session<>session_id then raise exception 'Wrong session'; end if;
 update public.shop_orders set status='paid',stripe_session=session_id,payment_intent=intent_id where id=order_id;
 insert into public.shop_inventory(user_id,sku) values(o.user_id,o.sku) on conflict do nothing;
end $$;
revoke all on function public.shop_fulfill(uuid,text,text) from public,anon,authenticated;
grant execute on function public.shop_fulfill(uuid,text,text) to service_role;
create or replace function public.shop_refund(intent_id text) returns void language plpgsql security definer set search_path = public as $$
declare o public.shop_orders;
begin
 for o in select * from public.shop_orders where payment_intent=intent_id and status='paid' for update loop
 update public.shop_orders set status='refunded' where id=o.id;
 delete from public.shop_inventory where user_id=o.user_id and sku=o.sku;
 end loop;
end $$;
revoke all on function public.shop_refund(text) from public,anon,authenticated;
grant execute on function public.shop_refund(text) to service_role;

grant all on public.shop_orders, public.shop_inventory to service_role;
