-- Where new players are lost. One row per step per visit, written only by the realtime
-- server (server/funnel.mjs). The device id is a random UUID the browser makes for itself:
-- it is not an account, an address or a fingerprint, and it is never shown to other players.

create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  device_id uuid not null,
  -- Deleting an account leaves its counts behind with nobody's name on them.
  user_id uuid references auth.users (id) on delete set null,
  guest boolean not null default false,
  event text not null check (event in ('page_load', 'play_tapped', 'auth_shown', 'account_created', 'entered_city', 'first_sit', 'first_game'))
);
create index if not exists funnel_events_at_idx on public.funnel_events (at);
create index if not exists funnel_events_device_idx on public.funnel_events (device_id, at);

alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from anon, authenticated;
-- delete is for the thirteen-month purge in server/funnel.mjs.
grant select, insert, delete on public.funnel_events to service_role;

-- How many devices reached each step, per Kuala Lumpur day. Read it top to bottom:
--   select * from funnel_daily where day = current_date order by devices desc;
create or replace view public.funnel_daily with (security_invoker = true) as
select (at at time zone 'Asia/Kuala_Lumpur')::date as day, event, count(distinct device_id) as devices
from public.funnel_events
group by 1, 2;

-- Of the devices that first entered the city on a given day, how many came back the next
-- day and a week later.
-- ponytail: a device is not a person. Someone who plays on a phone and a laptop is two
-- cohort members, and clearing site data starts them over. Key on user_id once most
-- players have accounts.
create or replace view public.funnel_retention with (security_invoker = true) as
with visits as (
  select distinct device_id, (at at time zone 'Asia/Kuala_Lumpur')::date as day
  from public.funnel_events where event = 'entered_city'
), cohorts as (
  select device_id, min(day) as day0 from visits group by 1
)
select c.day0 as cohort, count(*) as players,
  count(*) filter (where exists (select 1 from visits v where v.device_id = c.device_id and v.day = c.day0 + 1)) as d1,
  count(*) filter (where exists (select 1 from visits v where v.device_id = c.device_id and v.day = c.day0 + 7)) as d7
from cohorts c
group by 1;

revoke all on public.funnel_daily, public.funnel_retention from anon, authenticated;
grant select on public.funnel_daily, public.funnel_retention to service_role;
