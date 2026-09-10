-- Report → review → enforce. Both tables live in Supabase because Railway wipes
-- in-memory rooms on every restart, and a ban that dies with the process is not a ban.

create table if not exists public.player_reports (
  id uuid primary key default gen_random_uuid(),
  -- Accounts can vanish; the report and the name it was filed against must not.
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_name text not null check (char_length(reporter_name) between 1 and 18),
  reported_user_id uuid references auth.users(id) on delete set null,
  reported_name text not null check (char_length(reported_name) between 1 and 18),
  room text not null check (room ~ '^[A-Za-z0-9_-]{1,24}$'),
  surface text not null check (surface in ('voice','chat','wall','drawing','name','behaviour')),
  reason text not null check (reason in ('harassment','sexual','hate','threat','scam','child-safety','other')),
  note text not null default '' check (char_length(note) <= 300),
  -- Who else was within earshot when the report was filed. This is the whole reason a
  -- voice report is reviewable at all: nobody records the audio, so the reviewer needs
  -- to know which other players heard it and can be asked.
  witnesses jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);

create index if not exists player_reports_open_idx on public.player_reports (status, created_at desc, id desc);
create index if not exists player_reports_reported_idx on public.player_reports (reported_user_id, created_at desc);

alter table public.player_reports enable row level security;
revoke all on public.player_reports from anon, authenticated;
grant select, insert, update, delete on public.player_reports to service_role;

-- One live penalty per account. Escalating a mute to a ban overwrites the row; lifting
-- one deletes it. The history of who did what and why is admin_audit_log's job, so this
-- table only ever has to answer "what is true about this account right now".
create table if not exists public.player_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kind text not null check (kind in ('mute','ban')),
  expires_at timestamptz,
  reason text not null default '' check (char_length(reason) <= 200),
  actor text not null check (char_length(actor) between 3 and 254),
  report_id uuid references public.player_reports(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.player_bans enable row level security;
revoke all on public.player_bans from anon, authenticated;
grant select, insert, update, delete on public.player_bans to service_role;
