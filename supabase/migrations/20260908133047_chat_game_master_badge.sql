alter table public.chat_messages
  add column if not exists game_master boolean not null default false;
