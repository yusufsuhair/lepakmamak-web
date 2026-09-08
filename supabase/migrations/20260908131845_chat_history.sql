create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null check (room ~ '^[A-Za-z0-9_-]{1,24}$'),
  player_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  player_name text not null check (char_length(player_name) between 1 and 18),
  message text not null check (char_length(message) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_at_idx
  on public.chat_messages (room, created_at desc, id desc);

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
grant select, insert, delete on public.chat_messages to service_role;
grant usage, select on sequence public.chat_messages_id_seq to service_role;
