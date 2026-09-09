create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor text not null check (char_length(actor) between 3 and 254),
  action text not null check (char_length(action) between 1 and 64),
  target_table text not null check (char_length(target_table) between 1 and 64),
  target_id text not null check (char_length(target_id) between 1 and 128),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc, id desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_table, target_id);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select, insert on public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;
