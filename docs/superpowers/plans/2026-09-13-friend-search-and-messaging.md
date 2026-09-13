# Friend Search, Handles and Stored Private Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players claim a permanent `@handle`, find each other by it, add friends through the existing flow, and send private messages that are stored and waiting when the recipient next logs in.

**Architecture:** One social store interface (`server/social-store.mjs`) with a Supabase implementation and an in-memory implementation used only when no `SUPABASE_*` is configured (dev). Friends, handles (`server/handles.mjs`) and messages (`server/messages.mjs`) are HTTP modules behind a shared bearer-token door (`server/social-http.mjs`); the socket only nudges (`dm-new`, `handle-required`). On the client, stored conversations reuse the chat's DM strip as `pm:` threads driven by `src/inbox.ts`; the claim screen is `src/handles.ts`; search lives in `src/friends.ts`.

**Tech Stack:** Node ESM (`server/*.mjs`), `ws`, `@supabase/supabase-js` 2.116, TypeScript + Vite client, Playwright for both server specs (import `server/*.mjs` directly) and browser specs.

**Spec:** `docs/superpowers/specs/2026-09-13-friend-search-and-messaging-design.md`

## Global Constraints

- Handles: 3 to 18 characters, lowercase `a-z`, `0-9`, `_` only; unique on `lower(handle)`; permanent once claimed.
- Reserved exact: `mod`, `moderator`, `gm`, `support`, `system`. Reserved prefix: `admin`, `staff`, `official`, `lepakmamak`.
- Suggestion: display name lowercased and stripped; if taken, reserved or under 3 characters, lowest free numeric suffix from 2 (`yusuf` → `yusuf2`).
- Message body 1..500 characters, **stored raw, filtered on display**. Report evidence is never run through `filterChat`.
- Conversation pages are 30 messages. Search is a case-insensitive prefix match on handles only, at most 20 results, `relation` is `none | pending | friend`.
- Send gates, in order, in one place: (1) ban then mute via `moderation.status()`, **503 if the lookup throws**; (2) Werewolf/Lukis lockout via the sender's room; (3) block → "You can't message this player"; (4) rate limit 20/minute total and 5 per recipient per 10 seconds → 429 with `retryAfter`.
- Written first, pushed second. Any account with a handle can be messaged; no friendship gate.
- Guests keep the existing in-room `channel === 'dm'` path unchanged.
- The in-memory adapter and stand-in account IDs exist only when no `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PUBLISHABLE_KEY` is set. Never issue a stand-in when Supabase is configured.
- `OWNED_ROWS` gains exactly: `['player_handles','user_id']`, `['game_messages','sender_user_id']`, `['game_messages','recipient_user_id']`, `['player_blocks','blocker_user_id']`, `['player_blocks','blocked_user_id']`.
- The migration is written, **never applied** (no `supabase db push`, no MCP write tools).
- Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. No deploys.

## Environment notes for every task

- Server specs: `npx playwright test tests/<file>.spec.ts > $SCRATCH/<name>.txt 2>&1; echo exit=$?` — never pipe the run.
- Browser specs need a vite on 5301 owned by this worktree:
  `VITE_MULTIPLAYER_URL=ws://127.0.0.1:8199 VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npx vite --host 127.0.0.1 --port 5301 --strictPort` (background), verify with
  `for pid in $(lsof -tiTCP:5301 -sTCP:LISTEN); do echo "$pid $(lsof -a -p $pid -d cwd -Fn | grep '^n' | sed 's/^n//')"; done`,
  then run with `PLAYWRIGHT_PORT=5301`.
- `node_modules/three` is an untracked symlink to the parent checkout. Never commit it.
- Pre-existing failures on main: `tests/sky-dining.spec.ts:45`, `tests/dance.spec.ts:9`.

## File map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260913120000_friend_search_messaging.sql` | `player_handles`, `game_messages`, `player_blocks`, report `dm` surface and `evidence` |
| `server/account.mjs` | five new `OWNED_ROWS` entries |
| `server/moderation.mjs` | `report()` carries `evidence` |
| `server/social-store.mjs` | store interface: Supabase + in-memory, `createSocialStore(env)`, `cleanDisplayName`, `pairOf` |
| `server/social-http.mjs` | shared CORS + bearer door, `HttpError`, `readJson`, `UUID` |
| `server/friends.mjs` | now reads and writes through the store |
| `server/handles.mjs` | handle rules, suggestion, claim/check/search routes, `required()` nudge |
| `server/messages.mjs` | send gates, pages, read, unread, blocks, `reportFor()` |
| `server/index.mjs` | store wiring, stand-ins, `handle-required`, `dm-new` push, DM report |
| `src/account-token.ts` | session token or dev stand-in token |
| `src/handles.ts` | claim screen |
| `src/friends.ts` + `src/friends.css` | handle search above the list; claim screen styles |
| `src/dm.ts`, `src/social.ts`, `src/style.css` | `pm:` threads, Block/Report header, notes with retry |
| `src/inbox.ts` | stored conversations: load, page, read, receive, send with retry, block, report |
| `src/main.ts` | wiring, report dialog `dm` surface |
| `tests/support/fake-supabase.ts`, `tests/support/http.ts` | test doubles |
| `tests/social-store.spec.ts` | contract test run against both stores |
| `tests/handles.spec.ts`, `tests/messages.spec.ts`, `tests/messages-socket.spec.ts` | server specs |
| `tests/handle-claim.spec.ts`, `tests/private-messages-ui.spec.ts`, `tests/private-messages.spec.ts` | browser specs |

---

## Phase 1 — Migration

### Task 1: Migration and account deletion rows

**Files:**
- Create: `supabase/migrations/20260913120000_friend_search_messaging.sql`
- Modify: `server/account.mjs` (`OWNED_ROWS`)
- Test: `tests/account-delete.spec.ts`

**Interfaces:**
- Produces: tables `player_handles(user_id, handle, created_at)`, `game_messages(id, sender_user_id, recipient_user_id, body, client_id, sent_at, read_at, pair)`, `player_blocks(blocker_user_id, blocked_user_id, created_at)`; `player_reports.surface` allows `dm`; `player_reports.evidence jsonb`.
- `pair` is `least(sender,recipient)::text || ':' || greatest(sender,recipient)::text`. uuid ordering is bytewise, which equals JS string ordering of lowercase hex, so `pairOf(a,b)` in JS matches it.

- [ ] **Step 1: Write the failing test** — append to `tests/account-delete.spec.ts`:

```ts
test('deleting an account also clears handles, both sides of messages, and blocks',()=>{
 for(const entry of [['player_handles','user_id'],['game_messages','sender_user_id'],['game_messages','recipient_user_id'],['player_blocks','blocker_user_id'],['player_blocks','blocked_user_id']])
  expect(OWNED_ROWS).toContainEqual(entry);
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx playwright test tests/account-delete.spec.ts > $SCRATCH/t1.txt 2>&1; echo exit=$?` → exit 1, `toContainEqual` fails on `player_handles`.

- [ ] **Step 3: Add the rows** — in `server/account.mjs`, after `['chat_messages', 'user_id'],`:

```js
  // Sent messages go too, out of other players' inboxes: the spec chose that over orphans.
  ['player_handles', 'user_id'],
  ['game_messages', 'sender_user_id'],
  ['game_messages', 'recipient_user_id'],
  ['player_blocks', 'blocker_user_id'],
  ['player_blocks', 'blocked_user_id'],
```

- [ ] **Step 4: Write the migration** — `supabase/migrations/20260913120000_friend_search_messaging.sql`:

```sql
-- Handles, stored private messages and blocks for LepakMamak.
-- Written for the owner to apply before the realtime server deploys: without these tables
-- every send answers 503, the same hazard already recorded for the Wall.

-- One permanent, findable name per account. The server never updates a row: a handle that
-- could change would free the old one for impersonation.
create table if not exists public.player_handles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,18}$'),
  created_at timestamptz not null default now(),
  -- Also refused by the server; kept here so no other writer can claim them either.
  check (handle not in ('mod', 'moderator', 'gm', 'support', 'system')),
  check (handle !~ '^(admin|staff|official|lepakmamak)')
);

create unique index if not exists player_handles_handle_lower
  on public.player_handles (lower(handle));
-- Search is a prefix match; text_pattern_ops lets LIKE 'abc%' use the index whatever the collation.
create index if not exists player_handles_handle_prefix
  on public.player_handles (handle text_pattern_ops);

alter table public.player_handles enable row level security;
revoke all on table public.player_handles from public, anon, authenticated;
grant all on table public.player_handles to service_role;

-- Stored raw: a report needs the words actually sent, and censoring to *** destroys that.
-- The server filters on the way out.
create table if not exists public.game_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  -- Generated by the sender, reused on retry, so a lost response cannot store a message twice.
  client_id text not null check (char_length(client_id) between 1 and 64),
  sent_at timestamptz not null default now(),
  -- Unread is read_at is null; there is no counter to drift.
  read_at timestamptz,
  pair text generated always as (
    least(sender_user_id, recipient_user_id)::text || ':' || greatest(sender_user_id, recipient_user_id)::text
  ) stored,
  check (sender_user_id <> recipient_user_id),
  unique (sender_user_id, client_id)
);

create index if not exists game_messages_pair_sent
  on public.game_messages (pair, sent_at desc);
create index if not exists game_messages_recipient_unread
  on public.game_messages (recipient_user_id, read_at);

alter table public.game_messages enable row level security;
revoke all on table public.game_messages from public, anon, authenticated;
grant all on table public.game_messages to service_role;

create table if not exists public.player_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

alter table public.player_blocks enable row level security;
revoke all on table public.player_blocks from public, anon, authenticated;
grant all on table public.player_blocks to service_role;

-- Reports gain the dm surface. The original check was declared inline, so its name is
-- generated; drop whichever check mentions surface rather than guessing the name.
do $$
declare
  existing record;
begin
  for existing in
    select conname from pg_constraint
    where conrelid = 'public.player_reports'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%surface%'
  loop
    execute format('alter table public.player_reports drop constraint %I', existing.conname);
  end loop;
end
$$;

alter table public.player_reports
  add constraint player_reports_surface_check
  check (surface in ('voice', 'chat', 'wall', 'drawing', 'name', 'behaviour', 'dm'));

-- The reported messages themselves. note is 300 characters and witnesses means who was in
-- earshot, so neither can hold a conversation.
alter table public.player_reports
  add column if not exists evidence jsonb not null default '[]'::jsonb;

alter table public.player_reports
  drop constraint if exists player_reports_evidence_shape;
alter table public.player_reports
  add constraint player_reports_evidence_shape
  check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) <= 50);
```

- [ ] **Step 5: Validate the SQL by reading** — no local Postgres or Docker is available. Check against `20260910130000_player_moderation.sql` and `20260911110000_game_friends.sql`: same `if not exists` idempotence, same RLS/revoke/grant block, `gen_random_uuid()` already used by `player_reports`. Generated-column expression uses only `least`/`greatest` on uuid and `uuid::text` (immutable). **Do not apply it.**

- [ ] **Step 6: Run the test, expect PASS** — same command, exit 0.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260913120000_friend_search_messaging.sql server/account.mjs tests/account-delete.spec.ts
git commit -m "feat: migration for handles, stored messages and blocks

Adds player_handles, game_messages and player_blocks, lets player_reports take
the dm surface with an evidence column, and clears all three tables when an
account is deleted. Written only; applying it is the owner's call.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 2: Reports carry evidence

**Files:**
- Modify: `server/moderation.mjs` (`report`)
- Test: `tests/messages.spec.ts` (created here, grown in Task 7)

**Interfaces:**
- Produces: `moderation.report({... , evidence?: {from, body, sentAt}[]})`. The `evidence` key is sent to Supabase only when non-empty, so every existing report keeps working even before the migration lands.

- [ ] **Step 1: Write the failing test** — create `tests/messages.spec.ts`:

```ts
import {test, expect} from '@playwright/test';
import {createModeration} from '../server/moderation.mjs';

const reportDb = () => {
  const inserted: any[] = [];
  return {inserted, db: {from: (table: string) => ({insert: async (row: any) => { inserted.push({table, row}); return {error: null}; }})}};
};

test('a report stores its evidence exactly as written, and older reports send no evidence key', async () => {
  const {db, inserted} = reportDb();
  const moderation = createModeration({db});
  const base = {reporterUserId: 'a', reporterName: 'Alya', reportedUserId: 'b', reportedName: 'Badrul', room: 'kampung', reason: 'harassment'};
  await moderation.report({...base, surface: 'dm', evidence: [{from: 'b', body: 'kau bodoh', sentAt: '2026-09-13T01:00:00.000Z'}]});
  await moderation.report({...base, surface: 'chat'});
  expect(inserted[0].row.evidence).toEqual([{from: 'b', body: 'kau bodoh', sentAt: '2026-09-13T01:00:00.000Z'}]);
  expect(inserted[0].row.surface).toBe('dm');
  expect('evidence' in inserted[1].row).toBe(false);
});
```

- [ ] **Step 2: Run, expect FAIL** — `evidence` is undefined.

- [ ] **Step 3: Implement** — in `server/moderation.mjs`, inside `report(entry)`'s insert object, after `witnesses: entry.witnesses || [],`:

```js
        // Only a DM report has evidence. Leaving the key off otherwise keeps every other report
        // working on a database that has not been migrated yet.
        ...(entry.evidence?.length ? { evidence: entry.evidence } : {}),
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `git add server/moderation.mjs tests/messages.spec.ts && git commit -m "feat: reports carry unfiltered DM evidence" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

---
## Phase 2 — Server stores and the in-memory dev adapter

### Task 3: Handle rules and suggestions

**Files:**
- Create: `server/handles.mjs` (rules only in this task; routes arrive in Task 6)
- Test: `tests/handles.spec.ts`

**Interfaces:**
- Produces: `HANDLE: RegExp`, `cleanHandle(value): string` (trim, strip one leading `@`, lowercase), `handleProblem(handle): null | 'invalid' | 'reserved'`, `handleBase(name): string`, `suggestHandle(name, taken: Set<string>): string`.

- [ ] **Step 1: Write the failing tests** — create `tests/handles.spec.ts`:

```ts
import {test, expect} from '@playwright/test';
import {cleanHandle, handleProblem, suggestHandle} from '../server/handles.mjs';

test('handles are 3 to 18 lowercase letters, digits or underscores', () => {
  expect(handleProblem('abc')).toBeNull();
  expect(handleProblem('a_1_b')).toBeNull();
  expect(handleProblem('abcdefghijklmnopqr')).toBeNull();
  expect(handleProblem('ab')).toBe('invalid');
  expect(handleProblem('abcdefghijklmnopqrs')).toBe('invalid');
  expect(handleProblem('Abc')).toBe('invalid');
  expect(handleProblem('ab-c')).toBe('invalid');
  expect(handleProblem('abç')).toBe('invalid');
  expect(cleanHandle('  @Yusuf ')).toBe('yusuf');
});

test('reserved names are refused exactly, and the impersonation ones as prefixes too', () => {
  for (const name of ['mod', 'moderator', 'gm', 'support', 'system']) expect(handleProblem(name)).toBe('reserved');
  for (const name of ['admin', 'admin_yusuf', 'staff1', 'official_x', 'lepakmamakhq']) expect(handleProblem(name)).toBe('reserved');
  for (const name of ['modi', 'gmail', 'supporter', 'systems', 'myadmin']) expect(handleProblem(name)).toBeNull();
});

test('a suggestion comes from the display name, with the lowest free suffix from 2', () => {
  expect(suggestHandle('Yusuf', new Set())).toBe('yusuf');
  expect(suggestHandle('Yusuf', new Set(['yusuf']))).toBe('yusuf2');
  expect(suggestHandle('Yusuf', new Set(['yusuf', 'yusuf2', 'yusuf4']))).toBe('yusuf3');
  expect(suggestHandle('Yusuf Suhair!', new Set())).toBe('yusufsuhair');
  expect(suggestHandle('José', new Set())).toBe('jose');
  expect(suggestHandle('Yu', new Set())).toBe('yu2');
  expect(suggestHandle('Mod', new Set())).toBe('mod2');
  expect(suggestHandle('Admin Yusuf', new Set())).toBe('player');
  expect(suggestHandle('李', new Set(['player']))).toBe('player2');
  expect(suggestHandle('abcdefghijklmnopqr', new Set(['abcdefghijklmnopqr']))).toBe('abcdefghijklmnopq2');
});
```

- [ ] **Step 2: Run, expect FAIL** — module not found.

- [ ] **Step 3: Implement** — create `server/handles.mjs`:

```js
import crypto from 'node:crypto';

export const HANDLE = /^[a-z0-9_]{3,18}$/;
const RESERVED = new Set(['mod', 'moderator', 'gm', 'support', 'system']);
// Refused as prefixes as well: these are the names worth impersonating.
const RESERVED_PREFIXES = ['admin', 'staff', 'official', 'lepakmamak'];

export const cleanHandle = value => typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';

export function handleProblem(handle) {
  if (typeof handle !== 'string' || !HANDLE.test(handle)) return 'invalid';
  if (RESERVED.has(handle) || RESERVED_PREFIXES.some(prefix => handle.startsWith(prefix))) return 'reserved';
  return null;
}

// A reserved prefix cannot be rescued by a suffix, so those names start again from "player".
export function handleBase(name) {
  const base = String(name || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);
  return base && !RESERVED_PREFIXES.some(prefix => base.startsWith(prefix)) ? base : 'player';
}

export function suggestHandle(name, taken = new Set()) {
  const base = handleBase(name);
  if (!handleProblem(base) && !taken.has(base)) return base;
  for (let n = 2; n < 100000; n++) {
    const suffix = String(n);
    const candidate = base.slice(0, 18 - suffix.length) + suffix;
    if (!handleProblem(candidate) && !taken.has(candidate)) return candidate;
  }
  return `player${crypto.randomInt(100000, 999999999)}`;
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `git add server/handles.mjs tests/handles.spec.ts && git commit -m "feat: handle rules, reserved names and suggestions" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

### Task 4: The social store, both implementations, and the contract test

**Files:**
- Create: `server/social-store.mjs`
- Create: `tests/support/fake-supabase.ts`
- Test: `tests/social-store.spec.ts`

**Interfaces:**
- Produces (every method async unless noted):
  - `cleanDisplayName(value): string` (sync, moved verbatim from `server/friends.mjs`), `pairOf(a, b): string` (sync)
  - `createSocialStore(env = process.env): Store | null` — Supabase store when URL and service role key are both set; **null** when only some `SUPABASE_*` is set; in-memory store only when none is.
  - `createSupabaseSocialStore(db): Store`, `createMemorySocialStore({now}?): Store & {issueStandIn, resumeStandIn}`
  - `Store.persistent: boolean`
  - `userForToken(token) → {id, name} | null` (anonymous users → null)
  - `account(id) → {id, name} | null`, `names(ids) → Map<id, name>`
  - `handleFor(userId) → string | null`, `handlesFor(ids) → Map<id, handle>`, `ownerOf(handle) → userId | null`
  - `claimHandle(userId, handle) → 'ok' | 'taken' | 'claimed'`
  - `searchHandles(prefix, limit) → [{userId, handle}]` sorted by handle
  - `insertMessage({senderId, recipientId, body, clientId}) → {message, created}` where `message = {id, senderId, recipientId, body, clientId, sentAt, readAt}`
  - `conversation(a, b, {before?, limit?}) → message[]` newest first
  - `markRead(recipientId, senderId)`, `unread(recipientId) → [{senderId, unread, lastAt}]`
  - `block(blocker, blocked)`, `unblock(blocker, blocked)`, `isBlocked(blocker, blocked) → boolean`, `blocks(blocker) → string[]`
  - `friendships(userId) → game_friendships rows` (rows where user_id = me first, newest first; then friend_id = me)
  - `friendRequest({userId, friendId, userName, friendName})`, `friendRespond({userId, friendId, userName, approved})`, `friendCancel({userId, friendId})`, `friendRemove({userId, friendId})` → the result objects the SQL functions return
  - memory only, sync: `issueStandIn(name) → {userId, token}`, `resumeStandIn(token, name) → {userId, token} | null`
- `tests/support/fake-supabase.ts` produces `fakeSupabase(): {db, tables, addUser({id?, token?, name, anonymous?}) → {id, token}}` — a PostgREST-shaped double with unique constraints (compared case-insensitively, like `lower(handle)`), the generated `pair` column, and the four friend RPCs ported from `tests/friends.spec.ts`.
- Known limit, stated plainly: the friend RPCs in the fake re-implement SQL, so the Supabase half of the friendship contract checks the store's call shapes and result handling, not Postgres itself.

- [ ] **Step 1: Write the fake** — `tests/support/fake-supabase.ts`:

```ts
import crypto from 'node:crypto';

type Row = Record<string, any>;
type Spec = {unique: string[][]; defaults: (row: Row) => Row};

// Just enough PostgREST for the social store: filters, ordering, limits, unique violations
// with Postgres' own code, and the generated conversation pair.
export function fakeSupabase() {
  const users: {id: string; token: string; name: string; anonymous: boolean}[] = [];
  const tables: Record<string, Row[]> = {player_handles: [], game_messages: [], player_blocks: [], game_friendships: []};
  let clock = Date.parse('2026-09-13T00:00:00.000Z');
  const stamp = () => new Date(++clock).toISOString();
  const specs: Record<string, Spec> = {
    player_handles: {unique: [['user_id'], ['handle']], defaults: row => ({created_at: stamp(), ...row})},
    game_messages: {unique: [['id'], ['sender_user_id', 'client_id']], defaults: row => ({
      id: crypto.randomUUID(), sent_at: stamp(), read_at: null, ...row,
      pair: [row.sender_user_id, row.recipient_user_id].sort().join(':'),
    })},
    player_blocks: {unique: [['blocker_user_id', 'blocked_user_id']], defaults: row => ({created_at: stamp(), ...row})},
    game_friendships: {unique: [['user_id', 'friend_id']], defaults: row => row},
  };
  const special = /[.*+?^${}()|[\]\\]/g;
  const likeToRegExp = (pattern: string) => {
    let source = '';
    for (let index = 0; index < pattern.length; index++) {
      const character = pattern[index];
      if (character === '\\' && index + 1 < pattern.length) source += pattern[++index].replace(special, '\\$&');
      else if (character === '%') source += '.*';
      else if (character === '_') source += '.';
      else source += character.replace(special, '\\$&');
    }
    return new RegExp(`^${source}$`);
  };

  function from(name: string) {
    const rows = tables[name];
    if (!rows) throw Error(`Unexpected table ${name}`);
    const filters: ((row: Row) => boolean)[] = [];
    const orders: [string, boolean][] = [];
    let limit = Infinity, mode = 'select', payload: Row = {}, options: Row = {}, single = false, returning = false;
    const run = () => {
      if (mode === 'insert' || mode === 'upsert') {
        const spec = specs[name];
        const row = spec.defaults({...payload});
        const clash = rows.some(existing => spec.unique.some(keys => keys.every(key => String(existing[key]).toLowerCase() === String(row[key]).toLowerCase())));
        if (clash) return mode === 'upsert' && options.ignoreDuplicates ? {data: null, error: null} : {data: null, error: {code: '23505', message: 'duplicate key value violates unique constraint'}};
        rows.push(row);
        return {data: single ? {...row} : returning ? [{...row}] : null, error: null};
      }
      let found = rows.filter(row => filters.every(filter => filter(row)));
      if (mode === 'update') { for (const row of found) Object.assign(row, payload); return {data: null, error: null}; }
      if (mode === 'delete') { for (const row of found) rows.splice(rows.indexOf(row), 1); return {data: null, error: null}; }
      for (const [key, ascending] of [...orders].reverse()) found = [...found].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
      found = found.slice(0, limit).map(row => ({...row}));
      if (single) return found.length === 1 ? {data: found[0], error: null} : {data: null, error: {code: 'PGRST116', message: 'not one row'}};
      return {data: found, error: null};
    };
    const chain: any = {
      select: () => { returning = true; return chain; },
      insert: (row: Row) => { mode = 'insert'; payload = row; return chain; },
      upsert: (row: Row, opts: Row = {}) => { mode = 'upsert'; payload = row; options = opts; return chain; },
      update: (values: Row) => { mode = 'update'; payload = values; return chain; },
      delete: () => { mode = 'delete'; return chain; },
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return chain; },
      is: (key: string, value: unknown) => { filters.push(row => row[key] === value); return chain; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return chain; },
      lt: (key: string, value: string) => { filters.push(row => row[key] < value); return chain; },
      like: (key: string, pattern: string) => { const re = likeToRegExp(pattern); filters.push(row => re.test(String(row[key]))); return chain; },
      order: (key: string, opts?: {ascending?: boolean}) => { orders.push([key, opts?.ascending !== false]); return chain; },
      limit: (count: number) => { limit = count; return chain; },
      single: () => { single = true; return chain; },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject),
    };
    return chain;
  }

  const friendRows = tables.game_friendships;
  async function rpc(name: string, args: Row) {
    const find = (user: string, friend: string) => friendRows.find(row => row.user_id === user && row.friend_id === friend);
    if (name === 'game_friend_request') {
      if (args.p_user_id === args.p_friend_id) return {data: {requested: false, reason: 'self'}, error: null};
      const same = find(args.p_user_id, args.p_friend_id), reverse = find(args.p_friend_id, args.p_user_id);
      if (same?.status === 'accepted') return {data: {requested: false, reason: 'already_friend'}, error: null};
      if (same?.status === 'pending') return {data: {requested: false, reason: 'pending'}, error: null};
      if (reverse?.status === 'accepted') return {data: {requested: false, reason: 'already_friend'}, error: null};
      if (reverse?.status === 'pending') return {data: {requested: false, reason: 'incoming'}, error: null};
      friendRows.push({user_id: args.p_user_id, friend_id: args.p_friend_id, requested_by: args.p_user_id, user_name: args.p_user_name, friend_name: args.p_friend_name, status: 'pending', requested_at: stamp(), accepted_at: null});
      return {data: {requested: true}, error: null};
    }
    if (name === 'game_friend_respond') {
      const request = find(args.p_friend_id, args.p_user_id);
      if (request?.status !== 'pending') return {data: {responded: false, reason: 'not_pending'}, error: null};
      if (!args.p_approved) { friendRows.splice(friendRows.indexOf(request), 1); return {data: {responded: false, declined: true}, error: null}; }
      const at = stamp();
      Object.assign(request, {status: 'accepted', accepted_at: at, friend_name: args.p_user_name});
      friendRows.push({user_id: args.p_user_id, friend_id: args.p_friend_id, requested_by: args.p_friend_id, user_name: args.p_user_name, friend_name: request.user_name, status: 'accepted', requested_at: at, accepted_at: at});
      return {data: {responded: true, accepted: true}, error: null};
    }
    if (name === 'game_friend_cancel') {
      const request = find(args.p_user_id, args.p_friend_id);
      if (request?.status !== 'pending') return {data: {cancelled: false, reason: 'not_pending'}, error: null};
      friendRows.splice(friendRows.indexOf(request), 1);
      return {data: {cancelled: true}, error: null};
    }
    if (name === 'game_friend_remove') {
      const before = friendRows.length;
      for (let index = friendRows.length - 1; index >= 0; index--) {
        const row = friendRows[index];
        if (row.status === 'accepted' && ((row.user_id === args.p_user_id && row.friend_id === args.p_friend_id) || (row.user_id === args.p_friend_id && row.friend_id === args.p_user_id))) friendRows.splice(index, 1);
      }
      return {data: friendRows.length === before ? {removed: false, reason: 'not_friend'} : {removed: true}, error: null};
    }
    throw Error(`Unexpected RPC ${name}`);
  }

  const authUser = (user: typeof users[number]) => ({id: user.id, is_anonymous: user.anonymous, user_metadata: {display_name: user.name}});
  const db = {
    from,
    rpc,
    auth: {
      getUser: async (token: string) => { const user = users.find(item => item.token === token); return user ? {data: {user: authUser(user)}, error: null} : {data: {user: null}, error: {message: 'invalid token'}}; },
      admin: {getUserById: async (id: string) => { const user = users.find(item => item.id === id); return user ? {data: {user: authUser(user)}, error: null} : {data: {user: null}, error: {message: 'not found'}}; }},
    },
  };
  function addUser({id = crypto.randomUUID(), token = crypto.randomBytes(12).toString('hex'), name, anonymous = false}: {id?: string; token?: string; name: string; anonymous?: boolean}) {
    users.push({id, token, name, anonymous});
    return {id, token};
  }
  return {db, tables, addUser};
}
```

- [ ] **Step 2: Write the failing contract test** — `tests/social-store.spec.ts`:

```ts
import {test, expect} from '@playwright/test';
import {createMemorySocialStore, createSocialStore, createSupabaseSocialStore} from '../server/social-store.mjs';
import {fakeSupabase} from './support/fake-supabase';

type Harness = {store: any; account: (name: string) => {userId: string; token: string}};
const harnesses: [string, () => Harness][] = [
  ['in-memory store', () => {
    const store = createMemorySocialStore();
    return {store, account: name => store.issueStandIn(name)};
  }],
  ['Supabase store', () => {
    const fake = fakeSupabase();
    return {store: createSupabaseSocialStore(fake.db), account: name => { const user = fake.addUser({name}); return {userId: user.id, token: user.token}; }};
  }],
];

// One contract, both stores: dev must not quietly drift from production.
for (const [label, make] of harnesses) {
  test.describe(label, () => {
    test('tokens resolve to named accounts', async () => {
      const {store, account} = make();
      const alya = account('Alya');
      expect(await store.userForToken(alya.token)).toEqual({id: alya.userId, name: 'Alya'});
      expect(await store.userForToken('nope')).toBeNull();
      expect(await store.account(alya.userId)).toEqual({id: alya.userId, name: 'Alya'});
      expect(await store.account('00000000-0000-4000-8000-000000000000')).toBeNull();
      expect(await store.names([alya.userId])).toEqual(new Map([[alya.userId, 'Alya']]));
    });

    test('a handle is claimed once, by one account, for good', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul');
      expect(await store.claimHandle(alya.userId, 'alya')).toBe('ok');
      expect(await store.claimHandle(badrul.userId, 'alya')).toBe('taken');
      expect(await store.claimHandle(alya.userId, 'alya_two')).toBe('claimed');
      expect(await store.handleFor(alya.userId)).toBe('alya');
      expect(await store.handleFor(badrul.userId)).toBeNull();
      expect(await store.ownerOf('alya')).toBe(alya.userId);
      expect(await store.ownerOf('nobody')).toBeNull();
      expect(await store.handlesFor([alya.userId, badrul.userId])).toEqual(new Map([[alya.userId, 'alya']]));
    });

    test('two accounts racing for one handle: exactly one wins', async () => {
      const {store, account} = make();
      const one = account('One'), two = account('Two');
      const results = await Promise.all([store.claimHandle(one.userId, 'ali'), store.claimHandle(two.userId, 'ali')]);
      expect(results.sort()).toEqual(['ok', 'taken']);
    });

    test('search is a prefix match on handles, limited and in order, with _ taken literally', async () => {
      const {store, account} = make();
      for (const handle of ['kaki3', 'kaki1', 'kaki2', 'kakitangan', 'ka_ki', 'kabc']) await store.claimHandle(account(handle).userId, handle);
      expect((await store.searchHandles('kaki', 3)).map((row: any) => row.handle)).toEqual(['kaki1', 'kaki2', 'kaki3']);
      expect((await store.searchHandles('ka_', 10)).map((row: any) => row.handle)).toEqual(['ka_ki']);
      expect(await store.searchHandles('zz', 10)).toEqual([]);
    });

    test('messages: stored once per client id, paged newest first in both directions', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul'), chong = account('Chong');
      const first = await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'hai', clientId: 'c-1'});
      expect(first.created).toBe(true);
      expect(first.message).toMatchObject({senderId: alya.userId, recipientId: badrul.userId, body: 'hai', clientId: 'c-1', readAt: null});
      const retry = await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'hai', clientId: 'c-1'});
      expect(retry).toEqual({message: first.message, created: false});
      await store.insertMessage({senderId: badrul.userId, recipientId: alya.userId, body: 'hello', clientId: 'c-1'});
      await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'jom', clientId: 'c-2'});
      await store.insertMessage({senderId: alya.userId, recipientId: chong.userId, body: 'other thread', clientId: 'c-3'});
      const page = await store.conversation(badrul.userId, alya.userId, {limit: 2});
      expect(page.map((m: any) => m.body)).toEqual(['jom', 'hello']);
      const older = await store.conversation(alya.userId, badrul.userId, {before: page[1].sentAt, limit: 2});
      expect(older.map((m: any) => m.body)).toEqual(['hai']);
    });

    test('unread is counted per sender until that conversation is read', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul'), chong = account('Chong');
      await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'one', clientId: 'a1'});
      await store.insertMessage({senderId: alya.userId, recipientId: badrul.userId, body: 'two', clientId: 'a2'});
      const last = await store.insertMessage({senderId: chong.userId, recipientId: badrul.userId, body: 'yo', clientId: 'c1'});
      const threads = await store.unread(badrul.userId);
      expect(threads).toHaveLength(2);
      expect(threads).toContainEqual({senderId: alya.userId, unread: 2, lastAt: expect.any(String)});
      expect(threads).toContainEqual({senderId: chong.userId, unread: 1, lastAt: last.message.sentAt});
      await store.markRead(badrul.userId, alya.userId);
      expect(await store.unread(badrul.userId)).toEqual([{senderId: chong.userId, unread: 1, lastAt: last.message.sentAt}]);
      expect(await store.unread(alya.userId)).toEqual([]);
    });

    test('blocks are one-directional and idempotent', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul');
      await store.block(badrul.userId, alya.userId);
      await store.block(badrul.userId, alya.userId);
      expect(await store.isBlocked(badrul.userId, alya.userId)).toBe(true);
      expect(await store.isBlocked(alya.userId, badrul.userId)).toBe(false);
      expect(await store.blocks(badrul.userId)).toEqual([alya.userId]);
      await store.unblock(badrul.userId, alya.userId);
      expect(await store.isBlocked(badrul.userId, alya.userId)).toBe(false);
    });

    test('friendships follow the same transitions as the SQL functions', async () => {
      const {store, account} = make();
      const alya = account('Alya'), badrul = account('Badrul');
      const ask = {userId: alya.userId, friendId: badrul.userId, userName: 'Alya', friendName: 'Badrul'};
      expect(await store.friendRequest(ask)).toEqual({requested: true});
      expect(await store.friendRequest(ask)).toEqual({requested: false, reason: 'pending'});
      expect(await store.friendRequest({userId: badrul.userId, friendId: alya.userId, userName: 'Badrul', friendName: 'Alya'})).toEqual({requested: false, reason: 'incoming'});
      expect((await store.friendships(badrul.userId)).map((row: any) => [row.user_id, row.status])).toEqual([[alya.userId, 'pending']]);
      expect(await store.friendCancel({userId: badrul.userId, friendId: alya.userId})).toEqual({cancelled: false, reason: 'not_pending'});
      expect(await store.friendRespond({userId: badrul.userId, friendId: alya.userId, userName: 'Badrul', approved: true})).toEqual({responded: true, accepted: true});
      expect((await store.friendships(alya.userId)).map((row: any) => row.status)).toEqual(['accepted', 'accepted']);
      expect(await store.friendRequest(ask)).toEqual({requested: false, reason: 'already_friend'});
      expect(await store.friendRemove({userId: badrul.userId, friendId: alya.userId})).toEqual({removed: true});
      expect(await store.friendRemove({userId: badrul.userId, friendId: alya.userId})).toEqual({removed: false, reason: 'not_friend'});
    });
  });
}

test('anonymous Supabase users are not accounts', async () => {
  const fake = fakeSupabase();
  const anon = fake.addUser({name: 'Anon', anonymous: true});
  expect(await createSupabaseSocialStore(fake.db).userForToken(anon.token)).toBeNull();
});

test('the in-memory store and stand-ins exist only when no Supabase setting is present', async () => {
  const blank = {SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_PUBLISHABLE_KEY: ''};
  expect(createSocialStore(blank)?.persistent).toBe(false);
  expect(createSocialStore({...blank, SUPABASE_URL: 'http://127.0.0.1:1'})).toBeNull();
  expect(createSocialStore({...blank, SUPABASE_PUBLISHABLE_KEY: 'x'})).toBeNull();
  expect(createSocialStore({...blank, SUPABASE_SERVICE_ROLE_KEY: 'x'})).toBeNull();
  const production = createSocialStore({SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'x'});
  expect(production?.persistent).toBe(true);
  expect('issueStandIn' in (production as object)).toBe(false);
  const memory = createMemorySocialStore();
  const standIn = memory.issueStandIn('Alya');
  expect(memory.resumeStandIn(standIn.token, 'Alya Baru')).toEqual(standIn);
  expect((await memory.userForToken(standIn.token))?.name).toBe('Alya Baru');
  expect(memory.resumeStandIn('forged', 'Alya')).toBeNull();
});
```

- [ ] **Step 3: Run, expect FAIL** — `server/social-store.mjs` does not exist.

- [ ] **Step 4: Implement** — `server/social-store.mjs`. `cleanDisplayName` is moved verbatim from `server/friends.mjs` (its control-character class is written with `\u` escapes, as in the original):

```js
import {createClient} from '@supabase/supabase-js';
import crypto from 'node:crypto';

// Friends, handles and messages all read and write through one of these. Production uses
// Supabase; dev has no database, so an in-memory store stands in and resets on restart.
// tests/social-store.spec.ts runs one contract against both so they cannot drift apart.

export function cleanDisplayName(value) {
  const clean = typeof value === 'string'
    ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 18)
    : '';
  return clean.length >= 2 ? clean : 'Player';
}

// Matches the generated game_messages.pair column: uuid order is bytewise, which is the
// same as ordering the lowercase hex strings.
export const pairOf = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

const UNIQUE_VIOLATION = '23505';
const failed = () => new Error('Database operation failed');
const check = result => { if (result?.error) throw failed(); return result.data; };
const escapeLike = prefix => `${prefix.replace(/[\\%_]/g, character => `\\${character}`)}%`;
const messageFrom = row => ({id: row.id, senderId: row.sender_user_id, recipientId: row.recipient_user_id, body: row.body, clientId: row.client_id, sentAt: row.sent_at, readAt: row.read_at});
const tally = rows => {
  const threads = new Map();
  for (const row of rows) {
    const thread = threads.get(row.senderId) || {senderId: row.senderId, unread: 0, lastAt: row.sentAt};
    thread.unread += 1;
    threads.set(row.senderId, thread);
  }
  return [...threads.values()];
};

export function createSocialStore(env = process.env) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return createSupabaseSocialStore(createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}}));
  }
  // Half-configured Supabase is still Supabase: the feature stays unavailable rather than
  // handing out stand-in accounts on anything that looks like production.
  if (env.SUPABASE_URL || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY) return null;
  return createMemorySocialStore();
}

export function createSupabaseSocialStore(db) {
  async function account(id) {
    const result = await db.auth.admin.getUserById(id);
    const user = result?.data?.user;
    return result?.error || !user || user.is_anonymous ? null : {id, name: cleanDisplayName(user.user_metadata?.display_name)};
  }
  async function handleFor(userId) {
    const rows = check(await db.from('player_handles').select('handle').eq('user_id', userId).limit(1));
    return rows?.[0]?.handle || null;
  }
  return {
    persistent: true,
    async userForToken(token) {
      const {data, error} = await db.auth.getUser(token);
      if (error || !data?.user || data.user.is_anonymous) return null;
      return {id: data.user.id, name: cleanDisplayName(data.user.user_metadata?.display_name)};
    },
    account,
    // ponytail: one admin read per offline name, at most 20 per search. A profile table with
    // display names would make this one query if search traffic ever warrants it.
    async names(ids) {
      const found = await Promise.all([...new Set(ids)].map(async id => [id, (await account(id).catch(() => null))?.name]));
      return new Map(found.filter(([, name]) => name));
    },
    handleFor,
    async handlesFor(ids) {
      const wanted = [...new Set(ids)];
      if (!wanted.length) return new Map();
      const rows = check(await db.from('player_handles').select('user_id,handle').in('user_id', wanted));
      return new Map((rows || []).map(row => [row.user_id, row.handle]));
    },
    async ownerOf(handle) {
      const rows = check(await db.from('player_handles').select('user_id').eq('handle', handle).limit(1));
      return rows?.[0]?.user_id || null;
    },
    async claimHandle(userId, handle) {
      const result = await db.from('player_handles').insert({user_id: userId, handle});
      if (!result?.error) return 'ok';
      if (result.error.code !== UNIQUE_VIOLATION) throw failed();
      // Either key can clash: this account already holds a handle, or someone else holds this one.
      return (await handleFor(userId)) ? 'claimed' : 'taken';
    },
    async searchHandles(prefix, limit) {
      const rows = check(await db.from('player_handles').select('user_id,handle').like('handle', escapeLike(prefix)).order('handle', {ascending: true}).limit(limit));
      return (rows || []).map(row => ({userId: row.user_id, handle: row.handle}));
    },
    async insertMessage({senderId, recipientId, body, clientId}) {
      const inserted = await db.from('game_messages').insert({sender_user_id: senderId, recipient_user_id: recipientId, body, client_id: clientId}).select('*').single();
      if (!inserted?.error) return {message: messageFrom(inserted.data), created: true};
      if (inserted.error.code !== UNIQUE_VIOLATION) throw failed();
      // A retry of something already stored: hand back the original.
      const rows = check(await db.from('game_messages').select('*').eq('sender_user_id', senderId).eq('client_id', clientId).limit(1));
      if (!rows?.[0]) throw failed();
      return {message: messageFrom(rows[0]), created: false};
    },
    // ponytail: the page cursor is sent_at alone, so two messages in one conversation with an
    // identical timestamp at a page boundary could hide one. Add id to the cursor if it shows up.
    async conversation(a, b, {before = null, limit = 30} = {}) {
      let query = db.from('game_messages').select('*').eq('pair', pairOf(a, b));
      if (before) query = query.lt('sent_at', before);
      const rows = check(await query.order('sent_at', {ascending: false}).order('id', {ascending: false}).limit(limit));
      return (rows || []).map(messageFrom);
    },
    async markRead(recipientId, senderId) {
      check(await db.from('game_messages').update({read_at: new Date().toISOString()}).eq('recipient_user_id', recipientId).eq('sender_user_id', senderId).is('read_at', null));
    },
    // ponytail: counts the newest 1000 unread rows; an inbox past that shows 1000 until read.
    async unread(recipientId) {
      const rows = check(await db.from('game_messages').select('sender_user_id,sent_at').eq('recipient_user_id', recipientId).is('read_at', null).order('sent_at', {ascending: false}).limit(1000));
      return tally((rows || []).map(row => ({senderId: row.sender_user_id, sentAt: row.sent_at})));
    },
    async block(blocker, blocked) {
      check(await db.from('player_blocks').upsert({blocker_user_id: blocker, blocked_user_id: blocked}, {onConflict: 'blocker_user_id,blocked_user_id', ignoreDuplicates: true}));
    },
    async unblock(blocker, blocked) {
      check(await db.from('player_blocks').delete().eq('blocker_user_id', blocker).eq('blocked_user_id', blocked));
    },
    async isBlocked(blocker, blocked) {
      const rows = check(await db.from('player_blocks').select('blocker_user_id').eq('blocker_user_id', blocker).eq('blocked_user_id', blocked).limit(1));
      return !!rows?.length;
    },
    async blocks(blocker) {
      const rows = check(await db.from('player_blocks').select('blocked_user_id').eq('blocker_user_id', blocker));
      return (rows || []).map(row => row.blocked_user_id);
    },
    async friendships(userId) {
      const columns = 'user_id,friend_id,requested_by,user_name,friend_name,status,requested_at,accepted_at';
      const [mine, theirs] = await Promise.all([
        db.from('game_friendships').select(columns).eq('user_id', userId).order('requested_at', {ascending: false}),
        db.from('game_friendships').select(columns).eq('friend_id', userId).order('requested_at', {ascending: false}),
      ]);
      return [...(check(mine) || []), ...(check(theirs) || [])];
    },
    friendRequest: async ({userId, friendId, userName, friendName}) => check(await db.rpc('game_friend_request', {p_user_id: userId, p_friend_id: friendId, p_user_name: userName, p_friend_name: friendName})),
    friendRespond: async ({userId, friendId, userName, approved}) => check(await db.rpc('game_friend_respond', {p_user_id: userId, p_friend_id: friendId, p_user_name: userName, p_approved: approved})),
    friendCancel: async ({userId, friendId}) => check(await db.rpc('game_friend_cancel', {p_user_id: userId, p_friend_id: friendId})),
    friendRemove: async ({userId, friendId}) => check(await db.rpc('game_friend_remove', {p_user_id: userId, p_friend_id: friendId})),
  };
}

// Dev only. Holds everything in this process and forgets it on restart, which the spec accepts.
export function createMemorySocialStore({now = Date.now} = {}) {
  const accounts = new Map();
  const tokens = new Map();
  const handles = new Map();
  const owners = new Map();
  const messages = [];
  const blocked = new Set();
  const friendships = new Map();
  const iso = () => new Date(now()).toISOString();
  const copy = row => ({...row});

  return {
    persistent: false,
    issueStandIn(name) {
      const userId = crypto.randomUUID();
      const token = crypto.randomBytes(24).toString('base64url');
      accounts.set(userId, {id: userId, name: cleanDisplayName(name)});
      tokens.set(token, userId);
      return {userId, token};
    },
    resumeStandIn(token, name) {
      const userId = typeof token === 'string' ? tokens.get(token) : undefined;
      if (!userId) return null;
      accounts.get(userId).name = cleanDisplayName(name);
      return {userId, token};
    },
    async userForToken(token) { const userId = tokens.get(token); return userId ? copy(accounts.get(userId)) : null; },
    async account(id) { return accounts.has(id) ? copy(accounts.get(id)) : null; },
    async names(ids) { return new Map(ids.filter(id => accounts.has(id)).map(id => [id, accounts.get(id).name])); },
    async handleFor(userId) { return handles.get(userId) || null; },
    async handlesFor(ids) { return new Map(ids.filter(id => handles.has(id)).map(id => [id, handles.get(id)])); },
    async ownerOf(handle) { return owners.get(handle.toLowerCase()) || null; },
    async claimHandle(userId, handle) {
      if (handles.has(userId)) return 'claimed';
      if (owners.has(handle.toLowerCase())) return 'taken';
      handles.set(userId, handle);
      owners.set(handle.toLowerCase(), userId);
      return 'ok';
    },
    async searchHandles(prefix, limit) {
      return [...owners.entries()]
        .filter(([handle]) => handle.startsWith(prefix))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .slice(0, limit)
        .map(([handle, userId]) => ({userId, handle}));
    },
    async insertMessage({senderId, recipientId, body, clientId}) {
      const existing = messages.find(message => message.senderId === senderId && message.clientId === clientId);
      if (existing) return {message: copy(existing), created: false};
      // Strictly increasing, so the sent_at page cursor never meets a tie here.
      const last = messages.at(-1);
      const at = Math.max(now(), last ? Date.parse(last.sentAt) + 1 : 0);
      const message = {id: crypto.randomUUID(), senderId, recipientId, body, clientId, sentAt: new Date(at).toISOString(), readAt: null};
      messages.push(message);
      return {message: copy(message), created: true};
    },
    async conversation(a, b, {before = null, limit = 30} = {}) {
      const pair = pairOf(a, b);
      return messages
        .filter(message => pairOf(message.senderId, message.recipientId) === pair && (!before || message.sentAt < before))
        .reverse().slice(0, limit).map(copy);
    },
    async markRead(recipientId, senderId) {
      const at = iso();
      for (const message of messages) if (message.recipientId === recipientId && message.senderId === senderId && !message.readAt) message.readAt = at;
    },
    async unread(recipientId) {
      return tally(messages.filter(message => message.recipientId === recipientId && !message.readAt).reverse());
    },
    async block(blocker, target) { blocked.add(`${blocker}:${target}`); },
    async unblock(blocker, target) { blocked.delete(`${blocker}:${target}`); },
    async isBlocked(blocker, target) { return blocked.has(`${blocker}:${target}`); },
    async blocks(blocker) { return [...blocked].filter(key => key.startsWith(`${blocker}:`)).map(key => key.slice(blocker.length + 1)); },
    async friendships(userId) {
      const rows = [...friendships.values()].map(copy);
      const newest = (a, b) => b.requested_at.localeCompare(a.requested_at);
      return [...rows.filter(row => row.user_id === userId).sort(newest), ...rows.filter(row => row.friend_id === userId).sort(newest)];
    },
    // The four transitions below are game_friend_* from 20260911110000_game_friends.sql.
    async friendRequest({userId, friendId, userName, friendName}) {
      if (userId === friendId) return {requested: false, reason: 'self'};
      const same = friendships.get(`${userId}:${friendId}`)?.status;
      const reverse = friendships.get(`${friendId}:${userId}`)?.status;
      if (same === 'accepted') return {requested: false, reason: 'already_friend'};
      if (same === 'pending') return {requested: false, reason: 'pending'};
      if (reverse === 'accepted') return {requested: false, reason: 'already_friend'};
      if (reverse === 'pending') return {requested: false, reason: 'incoming'};
      friendships.set(`${userId}:${friendId}`, {user_id: userId, friend_id: friendId, requested_by: userId, user_name: userName, friend_name: friendName, status: 'pending', requested_at: iso(), accepted_at: null});
      return {requested: true};
    },
    async friendRespond({userId, friendId, userName, approved}) {
      const request = friendships.get(`${friendId}:${userId}`);
      if (request?.status !== 'pending') return {responded: false, reason: 'not_pending'};
      if (!approved) { friendships.delete(`${friendId}:${userId}`); return {responded: false, declined: true}; }
      const at = iso();
      Object.assign(request, {status: 'accepted', accepted_at: at, friend_name: userName});
      friendships.set(`${userId}:${friendId}`, {user_id: userId, friend_id: friendId, requested_by: friendId, user_name: userName, friend_name: request.user_name, status: 'accepted', requested_at: at, accepted_at: at});
      return {responded: true, accepted: true};
    },
    async friendCancel({userId, friendId}) {
      const key = `${userId}:${friendId}`;
      if (friendships.get(key)?.status !== 'pending') return {cancelled: false, reason: 'not_pending'};
      friendships.delete(key);
      return {cancelled: true};
    },
    async friendRemove({userId, friendId}) {
      let removed = false;
      for (const key of [`${userId}:${friendId}`, `${friendId}:${userId}`]) {
        if (friendships.get(key)?.status === 'accepted') { friendships.delete(key); removed = true; }
      }
      return removed ? {removed: true} : {removed: false, reason: 'not_friend'};
    },
  };
}
```

- [ ] **Step 5: Run, expect PASS** — `npx playwright test tests/social-store.spec.ts > $SCRATCH/t4.txt 2>&1; echo exit=$?` → exit 0, 18 passed.

- [ ] **Step 6: Commit** — `git add server/social-store.mjs tests/support/fake-supabase.ts tests/social-store.spec.ts && git commit -m "feat: social store with Supabase and in-memory implementations" -m "One contract test runs against both, so dev cannot drift from production." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

### Task 5: Friends read and write through the store

**Files:**
- Modify: `server/friends.mjs`
- Test: `tests/friends.spec.ts` (existing server test must stay green; two new tests)

**Interfaces:**
- Consumes: `createSocialStore`, `createSupabaseSocialStore`, `cleanDisplayName`, `Store` from Task 4.
- Produces: `createFriends({store?, db?, resolvePlayer, playerFor, isOnline, onChanged})`. When the `store` key is present it wins, even as `null` (unavailable → 503); otherwise `db` is wrapped in the Supabase store; otherwise `createSocialStore()`.

- [ ] **Step 1: Write the failing tests** — add `import {createMemorySocialStore} from '../server/social-store.mjs';` to the imports of `tests/friends.spec.ts`, then append:

```ts
test('on dev, friends work against the in-memory store with stand-in accounts', async () => {
  const store = createMemorySocialStore();
  const alya = store.issueStandIn('Alya'), badrul = store.issueStandIn('Badrul');
  const module = createFriends({store});
  const server = createServer((request, response) => { void module.handle(request, response); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/friends`;
  const call = (path: string, token: string, method = 'GET', body?: unknown) => fetch(`${base}${path}`, {method, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  try {
    expect((await call('/request', alya.token, 'POST', {id: badrul.userId})).status).toBe(200);
    expect((await (await call('/state', badrul.token)).json()).state.incoming).toEqual([expect.objectContaining({id: alya.userId, name: 'Alya'})]);
    expect((await call('/respond', badrul.token, 'POST', {id: alya.userId, approved: true})).status).toBe(200);
    expect((await (await call('/state', alya.token)).json()).state.friends).toEqual([{id: badrul.userId, name: 'Badrul', online: false, playerId: null}]);
    expect((await call('/state', 'forged')).status).toBe(401);
  } finally { server.close(); }
});

test('friends are unavailable, not faked, when Supabase is only half configured', async () => {
  const module = createFriends({store: null});
  const server = createServer((request, response) => { void module.handle(request, response); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/friends/state`, {headers: {Authorization: 'Bearer x'}});
    expect(response.status).toBe(503);
  } finally { server.close(); }
});
```

- [ ] **Step 2: Run, expect FAIL** — the dev test gets 503 because `createFriends` ignores `store`.

- [ ] **Step 3: Implement** — edit `server/friends.mjs`:
  1. Replace the `createClient` import and the local `cleanDisplayName` function with `import {cleanDisplayName, createSocialStore, createSupabaseSocialStore} from './social-store.mjs';` (keep the `origins` import, `UUID` and `FriendsHttpError`).
  2. Replace the `db` construction and the `check` helper with:

```js
  // The server hands in the store it shares with handles and messages; on dev that store is in
  // memory. An explicit null means Supabase is half configured, and friends stay unavailable.
  const store = 'store' in services ? services.store
    : services.db ? createSupabaseSocialStore(services.db) : createSocialStore();
```

  3. Replace `userFor`, remove `rows`, and replace `state` with:

```js
  async function userFor(request) {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token || token.length > 3500 || !store) throw new FriendsHttpError(store ? 401 : 503, store ? 'Please log in again.' : 'Friends are not available yet.');
    const user = await store.userForToken(token);
    if (!user) throw new FriendsHttpError(401, 'Please log in again.');
    return user;
  }
```

```js
  async function state(userId) {
    if (!store) throw new FriendsHttpError(503, 'Friends are not available yet.');
    const rows = await store.friendships(userId);
    const friends = new Map();
    const incoming = new Map();
    const outgoing = new Map();
    for (const row of rows) {
      const mine = row.user_id === userId;
      const id = mine ? row.friend_id : row.user_id;
      const name = mine ? row.friend_name : row.user_name;
      if (row.status === 'accepted') friends.set(id, {id, name: cleanDisplayName(name), ...onlineInfo(id)});
      else if (row.status === 'pending') (mine ? outgoing : incoming).set(id, requestCopy(id, name, row.requested_at));
    }
    return {
      friends: [...friends.values()].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)),
      incoming: [...incoming.values()],
      outgoing: [...outgoing.values()],
    };
  }
```

  4. In `targetFor`, replace the admin lookup (from `if (!db.auth?.admin?.getUserById)` to its `return`) with:

```js
    const account = await store.account(id);
    if (!account) throw new FriendsHttpError(404, 'That player could not be found.');
    return {id, name: account.name};
```

  5. In `mutation`, replace the four `check(await db.rpc(...))` calls with:

```js
      result = await store.friendRequest({userId: user.id, friendId: target.id, userName: user.name, friendName: target.name});
```
```js
      result = await store.friendRespond({userId: user.id, friendId: targetId, userName: user.name, approved: input.approved});
```
```js
      result = await store.friendCancel({userId: user.id, friendId: targetId});
```
```js
      result = await store.friendRemove({userId: user.id, friendId: targetId});
```

  6. In `handle`, change `if (!db)` to `if (!store)`.

- [ ] **Step 4: Run** — `npx playwright test tests/friends.spec.ts --grep-invert "Friend List" > $SCRATCH/t5.txt 2>&1; echo exit=$?` → exit 0 (original persistence test and both new tests; the `Friend List` browser tests need vite and are re-run in Task 10).

- [ ] **Step 5: Commit** — `git add server/friends.mjs tests/friends.spec.ts && git commit -m "refactor: friends read and write through the social store" -m "Production behaviour is unchanged; on dev the in-memory store now makes friendships work." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

---

## Phase 3 — HTTP routes and socket push

### Task 6: The shared door and the handle routes

**Files:**
- Create: `server/social-http.mjs`
- Create: `tests/support/http.ts`
- Modify: `server/handles.mjs` (add `createHandles`)
- Test: `tests/handles.spec.ts`

**Interfaces:**
- Consumes: Task 3 rules, Task 4 store.
- Produces:
  - `HttpError(status, message, data?)` — replies `{error: message, ...data}`, so a `data.error` code overrides the text and `data.message` carries the text.
  - `UUID: RegExp`, `readJson(request, limit): Promise<object>`
  - `serveJson({store, methods, unavailable, failure}) → (request, response, route: (user) => Promise<object>) => Promise<void>` — the `server/friends.mjs` door: CORS for `origins`, `OPTIONS`, 403 for foreign origins, 503 with no store, 401 without a valid non-anonymous bearer token, 500 with `failure` text on anything unexpected.
  - `createHandles({store, playerFor}) → {handle(request, response): Promise<boolean>, required(userId, name): Promise<string | null>, suggestFor(text): Promise<string>}`
  - Routes: `POST /handles/claim {handle}` → `{handle}` | 422 `{error: 'invalid'|'reserved', message, suggestion}` | 409 `{error: 'taken', message, suggestion}` | 409 `{error: 'claimed', message, handle}`; `GET /handles/check?h=` → `{available, reason?}`; `GET /players/search?q=` → `{results: [{userId, handle, name, online, relation}]}`.
  - `tests/support/http.ts`: `listen(handle) → {call(token, method, path, body?) → {status, body}, close()}`.

- [ ] **Step 1: Write the test helper** — `tests/support/http.ts`:

```ts
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';

export async function listen(handle: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>) {
  const server = createServer((request, response) => {
    void handle(request, response).then(handled => { if (!handled) { response.writeHead(404); response.end('{}'); } });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address() as {port: number};
  const call = async (token: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}), ...headers},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    return {status: response.status, body: await response.json().catch(() => null)};
  };
  return {call, close: () => new Promise<void>(resolve => server.close(() => resolve()))};
}
```

- [ ] **Step 2: Write the failing route tests** — append to `tests/handles.spec.ts` (add the imports at the top):

```ts
import {createHandles} from '../server/handles.mjs';
import {createMemorySocialStore, createSupabaseSocialStore} from '../server/social-store.mjs';
import {fakeSupabase} from './support/fake-supabase';
import {listen} from './support/http';

async function handlesServer(playerFor: (id: string) => any = () => null) {
  const store = createMemorySocialStore();
  const module = createHandles({store, playerFor});
  const http = await listen(module.handle);
  return {store, module, ...http};
}

test('handle routes refuse anyone without an account', async () => {
  const {call, close} = await handlesServer();
  try {
    expect((await call(null, 'POST', '/handles/claim', {handle: 'alya'})).status).toBe(401);
    expect((await call('forged', 'GET', '/players/search?q=al')).status).toBe(401);
    expect((await call('x', 'GET', '/handles/check?h=alya', undefined, {Origin: 'https://evil.example'})).status).toBe(403);
  } finally { await close(); }
  const fake = fakeSupabase();
  const anon = fake.addUser({name: 'Anon', anonymous: true});
  const anonymous = await listen(createHandles({store: createSupabaseSocialStore(fake.db)}).handle);
  try { expect((await anonymous.call(anon.token, 'GET', '/handles/check?h=alya')).status).toBe(401); }
  finally { await anonymous.close(); }
  const unavailable = await listen(createHandles({store: null}).handle);
  try { expect((await unavailable.call('x', 'GET', '/handles/check?h=alya')).status).toBe(503); }
  finally { await unavailable.close(); }
});

test('claiming: rules, case-insensitive uniqueness, permanence and suggestions', async () => {
  const {store, call, close} = await handlesServer();
  const yusuf = store.issueStandIn('Yusuf'), other = store.issueStandIn('Yusuf');
  try {
    expect(await call(yusuf.token, 'POST', '/handles/claim', {handle: 'ab'})).toEqual({status: 422, body: expect.objectContaining({error: 'invalid', suggestion: 'ab2'})});
    expect(await call(yusuf.token, 'POST', '/handles/claim', {handle: 'admin_yusuf'})).toEqual({status: 422, body: expect.objectContaining({error: 'reserved', suggestion: 'player'})});
    expect(await call(yusuf.token, 'POST', '/handles/claim', {handle: '@Yusuf'})).toEqual({status: 200, body: {handle: 'yusuf'}});
    expect(await call(other.token, 'POST', '/handles/claim', {handle: 'YUSUF'})).toEqual({status: 409, body: expect.objectContaining({error: 'taken', suggestion: 'yusuf2'})});
    expect(await call(yusuf.token, 'POST', '/handles/claim', {handle: 'yusuf_baru'})).toEqual({status: 409, body: expect.objectContaining({error: 'claimed', handle: 'yusuf'})});
    expect((await call(other.token, 'GET', '/handles/check?h=yusuf')).body).toEqual({available: false});
    expect((await call(other.token, 'GET', '/handles/check?h=yusuf2')).body).toEqual({available: true});
    expect((await call(other.token, 'GET', '/handles/check?h=gm')).body).toEqual({available: false, reason: 'reserved'});
    expect((await call(other.token, 'GET', '/handles/check?h=x')).body).toEqual({available: false, reason: 'invalid'});
  } finally { await close(); }
});

test('a claim that loses the race gets taken with a fresh suggestion', async () => {
  const {store, call, close} = await handlesServer();
  const one = store.issueStandIn('One'), two = store.issueStandIn('Two');
  try {
    const results = await Promise.all([call(one.token, 'POST', '/handles/claim', {handle: 'ali'}), call(two.token, 'POST', '/handles/claim', {handle: 'ali'})]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(results.find(result => result.status === 409)!.body).toEqual(expect.objectContaining({error: 'taken', suggestion: 'ali2'}));
  } finally { await close(); }
});

test('search matches handles only, at most 20, with online state and relation', async () => {
  const online = new Map<string, {name: string}>();
  const {store, call, close} = await handlesServer(id => online.get(id) || null);
  const me = store.issueStandIn('Searcher');
  await store.claimHandle(me.userId, 'kakime');
  const kaki = [];
  for (let n = 0; n < 25; n++) {
    const account = store.issueStandIn(`Budak ${n}`);
    await store.claimHandle(account.userId, `kaki${String(n).padStart(2, '0')}`);
    kaki.push(account);
  }
  online.set(kaki[0].userId, {name: 'Budak Live'});
  await store.friendRequest({userId: me.userId, friendId: kaki[1].userId, userName: 'Searcher', friendName: 'Budak 1'});
  await store.friendRequest({userId: kaki[2].userId, friendId: me.userId, userName: 'Budak 2', friendName: 'Searcher'});
  await store.friendRespond({userId: me.userId, friendId: kaki[2].userId, userName: 'Searcher', approved: true});
  try {
    const found = (await call(me.token, 'GET', '/players/search?q=%40KAKI')).body.results;
    expect(found).toHaveLength(20);
    expect(found.some((row: any) => row.userId === me.userId)).toBe(false);
    expect(found[0]).toEqual({userId: kaki[0].userId, handle: 'kaki00', name: 'Budak Live', online: true, relation: 'none'});
    expect(found[1]).toEqual({userId: kaki[1].userId, handle: 'kaki01', name: 'Budak 1', online: false, relation: 'pending'});
    expect(found[2]).toMatchObject({handle: 'kaki02', relation: 'friend'});
    expect((await call(me.token, 'GET', '/players/search?q=Budak')).body.results).toEqual([]);
    expect((await call(me.token, 'GET', '/players/search?q=')).body.results).toEqual([]);
  } finally { await close(); }
});

test('the handle-required nudge suggests from the name until a handle is claimed', async () => {
  const store = createMemorySocialStore();
  const module = createHandles({store});
  const taken = store.issueStandIn('Someone');
  await store.claimHandle(taken.userId, 'yusufsuhair');
  const yusuf = store.issueStandIn('Yusuf Suhair');
  expect(await module.required(yusuf.userId, 'Yusuf Suhair')).toBe('yusufsuhair2');
  await store.claimHandle(yusuf.userId, 'yusuf');
  expect(await module.required(yusuf.userId, 'Yusuf Suhair')).toBeNull();
  expect(await createHandles({store: null}).required(yusuf.userId, 'Yusuf')).toBeNull();
});
```

- [ ] **Step 3: Run, expect FAIL** — `createHandles` is not exported.

- [ ] **Step 4: Implement the door** — `server/social-http.mjs`:

```js
import {origins} from '../shared/origins.mjs';

// The door handles and messages share, copied from server/friends.mjs: CORS for our own
// origins, a bearer token, and no anonymous users.

export class HttpError extends Error {
  constructor(status, message, data = {}) { super(message); this.status = status; this.data = data; }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readJson(request, limit = 16384) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
  catch { throw new HttpError(400, 'Send JSON.'); }
}

export function serveJson({store, methods, unavailable, failure}) {
  return async function serve(request, response, route) {
    const origin = request.headers.origin;
    const reply = (status, data) => {
      response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      response.end(JSON.stringify(data));
    };
    if (origin && origins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); response.setHeader('Access-Control-Allow-Methods', methods);
    }
    if (request.method === 'OPTIONS') { response.writeHead(origins.has(origin) ? 204 : 403); response.end(); return; }
    if (origin && !origins.has(origin)) { reply(403, {error: 'Origin not allowed'}); return; }
    if (!store) { reply(503, {error: unavailable}); return; }
    try {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token || token.length > 3500) throw new HttpError(401, 'Please log in again.');
      const user = await store.userForToken(token);
      if (!user) throw new HttpError(401, 'Please log in again.');
      reply(200, await route(user));
    } catch (error) {
      if (error instanceof HttpError) { reply(error.status, {error: error.message, ...error.data}); return; }
      reply(500, {error: failure});
    }
  };
}
```

- [ ] **Step 5: Implement the routes** — append to `server/handles.mjs` and add these imports at its top:

```js
import {createRateLimiter} from './limits.mjs';
import {HttpError, readJson, serveJson} from './social-http.mjs';
import {cleanDisplayName} from './social-store.mjs';
```

```js
export function createHandles({store = null, playerFor = () => null} = {}) {
  const checks = createRateLimiter({limit: 120, windowMs: 60000});
  const searches = createRateLimiter({limit: 60, windowMs: 60000});
  const serve = serveJson({store, methods: 'GET, POST, OPTIONS', unavailable: 'Handles are not available yet.', failure: 'Could not reach handles. Please try again.'});

  // Every candidate a suggestion can produce starts with the first 12 characters of its base,
  // so one prefix query answers them all.
  async function suggestFor(text) {
    const taken = new Set((await store.searchHandles(handleBase(text).slice(0, 12), 1000)).map(row => row.handle));
    return suggestHandle(text, taken);
  }

  async function required(userId, name) {
    if (!store || !userId || await store.handleFor(userId)) return null;
    return suggestFor(name);
  }

  async function search(user, url) {
    if (!searches(user.id)) throw new HttpError(429, 'Slow down.', {retryAfter: 60});
    const query = cleanHandle(url.searchParams.get('q'));
    if (!/^[a-z0-9_]{1,18}$/.test(query)) return {results: []};
    const found = (await store.searchHandles(query, 21)).filter(row => row.userId !== user.id).slice(0, 20);
    const offline = found.map(row => row.userId).filter(id => !playerFor(id));
    const [names, friendships] = await Promise.all([store.names(offline), store.friendships(user.id)]);
    const relations = new Map();
    for (const row of friendships) {
      const other = row.user_id === user.id ? row.friend_id : row.user_id;
      if (row.status === 'accepted') relations.set(other, 'friend');
      else if (relations.get(other) !== 'friend') relations.set(other, 'pending');
    }
    return {results: found.map(row => {
      const live = playerFor(row.userId);
      return {userId: row.userId, handle: row.handle, name: cleanDisplayName(live?.name || names.get(row.userId)), online: !!live, relation: relations.get(row.userId) || 'none'};
    })};
  }

  async function route(user, request, url) {
    if (url.pathname === '/handles/claim' && request.method === 'POST') {
      const input = await readJson(request, 4096);
      const handle = cleanHandle(input?.handle);
      const problem = handleProblem(handle);
      if (problem) {
        const message = problem === 'reserved' ? 'That handle is reserved.' : 'Handles are 3 to 18 letters, numbers or _.';
        throw new HttpError(422, message, {error: problem, message, suggestion: await suggestFor(handle || user.name)});
      }
      const result = await store.claimHandle(user.id, handle);
      if (result === 'claimed') throw new HttpError(409, 'Your handle is permanent.', {error: 'claimed', message: 'Your handle is permanent.', handle: await store.handleFor(user.id)});
      // Losing a race to the unique index lands here as well, with a fresh suggestion.
      if (result === 'taken') throw new HttpError(409, 'That handle is taken.', {error: 'taken', message: 'That handle is taken.', suggestion: await suggestFor(handle)});
      return {handle};
    }
    if (url.pathname === '/handles/check' && request.method === 'GET') {
      if (!checks(user.id)) throw new HttpError(429, 'Slow down.', {retryAfter: 60});
      const handle = cleanHandle(url.searchParams.get('h'));
      const problem = handleProblem(handle);
      if (problem) return {available: false, reason: problem};
      return {available: !(await store.ownerOf(handle))};
    }
    if (url.pathname === '/players/search' && request.method === 'GET') return search(user, url);
    throw new HttpError(404, 'Not found');
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith('/handles/') && url.pathname !== '/players/search') return false;
    await serve(request, response, user => route(user, request, url));
    return true;
  }

  return {handle, required, suggestFor};
}
```

- [ ] **Step 6: Run, expect PASS** — `npx playwright test tests/handles.spec.ts > $SCRATCH/t6.txt 2>&1; echo exit=$?` → exit 0.

- [ ] **Step 7: Commit** — `git add server/social-http.mjs server/handles.mjs tests/support/http.ts tests/handles.spec.ts && git commit -m "feat: claim, check and search handles over HTTP" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

### Task 7: Messages, the send gates, blocks and report evidence

**Files:**
- Create: `server/messages.mjs`
- Test: `tests/messages.spec.ts`

**Interfaces:**
- Consumes: Task 4 store, Task 6 `serveJson`/`HttpError`/`readJson`/`UUID`, `filterChat`, `createModeration`.
- Produces:
  - `cleanBody(value): string` — control characters to spaces, trimmed; **no filtering**.
  - `createSendLimit({now}) → {check(sender, recipient): number /* retryAfter seconds, 0 = allowed */, note(sender, recipient)}`
  - `createMessages({store, moderation, liveGame(accountId): boolean, push(accountId, payload): boolean, playerFor(accountId), now}) → {handle, reportFor(reporterId, reportedId): Promise<{name, evidence}>}`
  - Routes: `POST /messages {to, body, clientId}` → `{message, online}`; `GET /messages/unread` → `{threads: [{userId, handle, name, unread, lastAt}]}`; `GET /messages/:userId?before=` → `{messages, more}`; `POST /messages/:userId/read` → `{}`; `POST /blocks {userId}` → `{}`; `DELETE /blocks/:userId` → `{}`.
  - Shown message: `{id, from, to, body /* filtered */, clientId, sentAt}`.
  - Push payload: `{type: 'dm-new', message, from: {userId, handle, name}}`.
  - `online` in the send response is an addition to the spec's `{message}`; the client needs it to show "They'll see this when they're back online."

- [ ] **Step 1: Write the failing tests** — append to `tests/messages.spec.ts` (merge imports at the top):

```ts
import {createMessages} from '../server/messages.mjs';
import {createMemorySocialStore} from '../server/social-store.mjs';
import {listen} from './support/http';

async function inbox() {
  const store = createMemorySocialStore();
  const alya = store.issueStandIn('Alya'), badrul = store.issueStandIn('Badrul'), chong = store.issueStandIn('Chong');
  for (const [account, handle] of [[alya, 'alya'], [badrul, 'badrul'], [chong, 'chong']] as const) await store.claimHandle(account.userId, handle);
  const online = new Set<string>(), live = new Set<string>(), pushed: any[] = [];
  const penalties = new Map<string, any>();
  let moderationDown = false, clock = Date.parse('2026-09-13T10:00:00.000Z');
  const moderation = {status: async (id: string) => { if (moderationDown) throw Error('down'); return penalties.get(id) || {banned: false, muted: false}; }};
  const messages = createMessages({
    store, moderation, now: () => clock,
    liveGame: (id: string) => live.has(id),
    playerFor: (id: string) => online.has(id) ? {name: 'Live'} : null,
    push: (id: string, payload: unknown) => { if (!online.has(id)) return false; pushed.push({id, payload}); return true; },
  });
  const http = await listen(messages.handle);
  const send = (from: {token: string}, to: {userId: string}, body: string, clientId = crypto.randomUUID()) => http.call(from.token, 'POST', '/messages', {to: to.userId, body, clientId});
  return {
    store, messages, alya, badrul, chong, online, live, pushed, penalties, http, send,
    advance: (ms: number) => { clock += ms; },
    down: () => { moderationDown = true; },
  };
}

test('messages refuse anyone without an account', async () => {
  const box = await inbox();
  try {
    expect((await box.http.call(null, 'POST', '/messages', {to: box.badrul.userId, body: 'hai', clientId: 'x'})).status).toBe(401);
    expect((await box.http.call('forged', 'GET', '/messages/unread')).status).toBe(401);
    expect((await box.http.call(null, 'POST', '/blocks', {userId: box.alya.userId})).status).toBe(401);
  } finally { await box.http.close(); }
});

test('a message to someone online in any room is stored, then pushed', async () => {
  const box = await inbox();
  box.online.add(box.badrul.userId);
  try {
    const sent = await box.send(box.alya, box.badrul, 'jumpa kat klcc', 'c-1');
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({online: true, message: {id: expect.any(String), from: box.alya.userId, to: box.badrul.userId, body: 'jumpa kat klcc', clientId: 'c-1', sentAt: expect.any(String)}});
    expect(box.pushed).toEqual([{id: box.badrul.userId, payload: {type: 'dm-new', message: sent.body.message, from: {userId: box.alya.userId, handle: 'alya', name: 'Alya'}}}]);
    expect(await box.store.conversation(box.alya.userId, box.badrul.userId)).toHaveLength(1);
  } finally { await box.http.close(); }
});

test('a message to someone offline waits as unread for their next login, and reading clears it', async () => {
  const box = await inbox();
  try {
    const sent = await box.send(box.alya, box.badrul, 'esok?');
    expect(sent.body.online).toBe(false);
    expect(box.pushed).toEqual([]);
    expect((await box.http.call(box.badrul.token, 'GET', '/messages/unread')).body).toEqual({threads: [{userId: box.alya.userId, handle: 'alya', name: 'Alya', unread: 1, lastAt: sent.body.message.sentAt}]});
    expect((await box.http.call(box.badrul.token, 'POST', `/messages/${box.alya.userId}/read`, {})).body).toEqual({});
    expect((await box.http.call(box.badrul.token, 'GET', '/messages/unread')).body).toEqual({threads: []});
  } finally { await box.http.close(); }
});

test('a conversation pages 30 at a time, oldest first within a page', async () => {
  const box = await inbox();
  try {
    for (let n = 0; n < 35; n++) {
      expect((await box.send(n % 2 ? box.badrul : box.alya, n % 2 ? box.alya : box.badrul, `m${n}`)).status).toBe(200);
      box.advance(2500);
    }
    const first = (await box.http.call(box.alya.token, 'GET', `/messages/${box.badrul.userId}`)).body;
    expect(first.more).toBe(true);
    expect(first.messages.map((m: any) => m.body)).toEqual(Array.from({length: 30}, (_, n) => `m${n + 5}`));
    const older = (await box.http.call(box.alya.token, 'GET', `/messages/${box.badrul.userId}?before=${encodeURIComponent(first.messages[0].sentAt)}`)).body;
    expect(older).toEqual({more: false, messages: expect.any(Array)});
    expect(older.messages.map((m: any) => m.body)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    expect((await box.http.call(box.alya.token, 'GET', `/messages/${box.badrul.userId}?before=yesterday`)).status).toBe(400);
  } finally { await box.http.close(); }
});

test('each gate refuses in order: banned, muted, live game, blocked, rate limited', async () => {
  const box = await inbox();
  const {alya, badrul} = box;
  try {
    box.penalties.set(alya.userId, {banned: true, muted: false});
    box.live.add(alya.userId);
    await box.store.block(badrul.userId, alya.userId);
    expect(await box.send(alya, badrul, 'hai')).toEqual({status: 403, body: {error: 'Your account is suspended from LepakMamak.'}});
    box.penalties.set(alya.userId, {banned: false, muted: true});
    expect(await box.send(alya, badrul, 'hai')).toEqual({status: 403, body: {error: 'You are muted, so this did not send.'}});
    box.penalties.delete(alya.userId);
    expect(await box.send(alya, badrul, 'hai')).toEqual({status: 403, body: {error: 'Geng dan DM ditutup masa main. Guna chat meja.'}});
    box.live.delete(alya.userId);
    expect(await box.send(alya, badrul, 'hai')).toEqual({status: 403, body: {error: "You can't message this player."}});
    await box.store.unblock(badrul.userId, alya.userId);
    for (let n = 0; n < 5; n++) expect((await box.send(alya, badrul, `hai ${n}`)).status).toBe(200);
    const limited = await box.send(alya, badrul, 'hai lagi');
    expect(limited.status).toBe(429);
    expect(limited.body.retryAfter).toBeGreaterThan(0);
    expect(await box.store.conversation(alya.userId, badrul.userId)).toHaveLength(5);
  } finally { await box.http.close(); }
});

test('no more than 20 messages a minute across every recipient', async () => {
  const box = await inbox();
  try {
    for (let n = 0; n < 20; n++) {
      expect((await box.send(box.alya, n % 2 ? box.badrul : box.chong, `m${n}`)).status).toBe(200);
      box.advance(2100);
    }
    const limited = await box.send(box.alya, box.badrul, 'one too many');
    expect(limited.status).toBe(429);
    expect(limited.body.retryAfter).toBeGreaterThan(0);
    box.advance(60000);
    expect((await box.send(box.alya, box.badrul, 'later')).status).toBe(200);
  } finally { await box.http.close(); }
});

test('an unknown player looks the same as a block, and a handle-less account cannot be messaged', async () => {
  const box = await inbox();
  const stranger = box.store.issueStandIn('No Handle');
  try {
    expect(await box.send(box.alya, stranger, 'hai')).toEqual({status: 403, body: {error: "You can't message this player."}});
    expect(await box.send(box.alya, {userId: '00000000-0000-4000-8000-000000000009'}, 'hai')).toEqual({status: 403, body: {error: "You can't message this player."}});
    expect((await box.send(box.alya, box.alya, 'me')).status).toBe(400);
    expect((await box.send(box.alya, box.badrul, '   ')).status).toBe(400);
    expect((await box.send(box.alya, box.badrul, 'x'.repeat(501))).status).toBe(400);
    expect((await box.send(box.alya, box.badrul, 'x'.repeat(500))).status).toBe(200);
  } finally { await box.http.close(); }
});

test('the moderation lookup failing refuses the send with 503 and stores nothing', async () => {
  const box = await inbox();
  box.down();
  try {
    expect((await box.send(box.alya, box.badrul, 'hai')).status).toBe(503);
    expect(await box.store.conversation(box.alya.userId, box.badrul.userId)).toEqual([]);
  } finally { await box.http.close(); }
});

test('a retry with the same client id is stored once and pushed once', async () => {
  const box = await inbox();
  box.online.add(box.badrul.userId);
  try {
    const first = await box.send(box.alya, box.badrul, 'hai', 'retry-1');
    const second = await box.send(box.alya, box.badrul, 'hai', 'retry-1');
    expect(second.body.message.id).toBe(first.body.message.id);
    expect(await box.store.conversation(box.alya.userId, box.badrul.userId)).toHaveLength(1);
    expect(box.pushed).toHaveLength(1);
  } finally { await box.http.close(); }
});

test('the body is stored raw, shown filtered, and reported raw', async () => {
  const box = await inbox();
  box.online.add(box.badrul.userId);
  try {
    const sent = await box.send(box.alya, box.badrul, 'kau bodoh');
    expect(sent.body.message.body).toBe('***');
    expect(box.pushed[0].payload.message.body).toBe('***');
    expect((await box.store.conversation(box.alya.userId, box.badrul.userId))[0].body).toBe('kau bodoh');
    expect((await box.http.call(box.badrul.token, 'GET', `/messages/${box.alya.userId}`)).body.messages[0].body).toBe('***');
    const report = await box.messages.reportFor(box.badrul.userId, box.alya.userId);
    expect(report).toEqual({name: 'Alya', evidence: [{from: box.alya.userId, body: 'kau bodoh', sentAt: sent.body.message.sentAt}]});
  } finally { await box.http.close(); }
});

test('blocking hides that sender from unread, and unblocking works', async () => {
  const box = await inbox();
  try {
    await box.send(box.alya, box.badrul, 'hai');
    await box.send(box.chong, box.badrul, 'yo');
    expect((await box.http.call(box.badrul.token, 'POST', '/blocks', {userId: box.alya.userId})).status).toBe(200);
    expect((await box.http.call(box.badrul.token, 'GET', '/messages/unread')).body.threads.map((t: any) => t.handle)).toEqual(['chong']);
    expect((await box.http.call(box.badrul.token, 'POST', '/blocks', {userId: 'nope'})).status).toBe(400);
    expect((await box.http.call(box.badrul.token, 'DELETE', `/blocks/${box.alya.userId}`)).status).toBe(200);
    expect(await box.store.isBlocked(box.badrul.userId, box.alya.userId)).toBe(false);
  } finally { await box.http.close(); }
});
```

- [ ] **Step 2: Run, expect FAIL** — `server/messages.mjs` not found.

- [ ] **Step 3: Implement** — `server/messages.mjs`:

```js
import {filterChat} from './chat-filter.mjs';
import {createModeration} from './moderation.mjs';
import {HttpError, UUID, readJson, serveJson} from './social-http.mjs';
import {cleanDisplayName} from './social-store.mjs';

const PAGE = 30;
const BODY_MAX = 500;
const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?(Z|[+-]\d\d:\d\d)$/;
const REFUSED = "You can't message this player.";

// Control characters become spaces and nothing else changes: the body is stored raw so a
// report still holds the words that were sent. filterChat runs only on the way out.
export const cleanBody = value => typeof value === 'string' ? value.replace(/\p{Cc}/gu, ' ').trim() : '';

// ponytail: per-process windows, like server/limits.mjs. A shared store only matters if the
// realtime service ever runs more than one instance.
export function createSendLimit({now = Date.now} = {}) {
  const sent = new Map();
  return {
    check(sender, recipient) {
      const at = now();
      if (sent.size > 5000) for (const [key, entries] of sent) if (!entries.length || at - entries.at(-1).at >= 60000) sent.delete(key);
      const recent = (sent.get(sender) || []).filter(entry => at - entry.at < 60000);
      sent.set(sender, recent);
      if (recent.length >= 20) return Math.max(1, Math.ceil((recent[recent.length - 20].at + 60000 - at) / 1000));
      const toThem = recent.filter(entry => entry.to === recipient && at - entry.at < 10000);
      if (toThem.length >= 5) return Math.max(1, Math.ceil((toThem[toThem.length - 5].at + 10000 - at) / 1000));
      return 0;
    },
    note(sender, recipient) {
      if (!sent.has(sender)) sent.set(sender, []);
      sent.get(sender).push({at: now(), to: recipient});
    },
  };
}

export function createMessages({store = null, moderation = createModeration(), liveGame = () => false, push = () => false, playerFor = () => null, now = Date.now} = {}) {
  const limit = createSendLimit({now});
  const serve = serveJson({store, methods: 'GET, POST, DELETE, OPTIONS', unavailable: 'Messages are not available yet.', failure: 'Could not reach your messages. Please try again.'});
  const shown = message => ({id: message.id, from: message.senderId, to: message.recipientId, body: filterChat(message.body), clientId: message.clientId, sentAt: message.sentAt});
  const otherId = value => {
    const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return UUID.test(id) ? id : '';
  };

  async function send(user, input) {
    const to = otherId(input?.to);
    const body = cleanBody(input?.body);
    const clientId = typeof input?.clientId === 'string' ? input.clientId : '';
    if (!to || to === user.id) throw new HttpError(400, 'Choose another player.');
    if (!body || body.length > BODY_MAX) throw new HttpError(400, `A message is 1 to ${BODY_MAX} characters.`);
    if (!CLIENT_ID.test(clientId)) throw new HttpError(400, 'Invalid message.');

    // 1. Ban, then mute. Mutes live in the socket's MUTED set, which never sees HTTP, so this
    // is the only mute a private message meets. Copied from server/wall.mjs, and it fails
    // closed for the Wall's reason: a blip costs one refused message, not an open channel.
    let penalty;
    try { penalty = await moderation.status(user.id); }
    catch { throw new HttpError(503, 'Could not check your account right now. Please try again in a moment.'); }
    if (penalty.banned) throw new HttpError(403, 'Your account is suspended from LepakMamak.');
    if (penalty.muted) throw new HttpError(403, 'You are muted, so this did not send.');
    // 2. The Werewolf and Lukis rule from the socket's chat gate. Not in the city means no game.
    if (liveGame(user.id)) throw new HttpError(403, 'Geng dan DM ditutup masa main. Guna chat meja.');
    // 3. A block reads exactly like an unknown player: no fake delivery, no hint of the block.
    if (await store.isBlocked(to, user.id)) throw new HttpError(403, REFUSED);
    // 4. Per sender account.
    const retryAfter = limit.check(user.id, to);
    if (retryAfter) throw new HttpError(429, 'Slow down.', {retryAfter});
    if (!(await store.handleFor(to))) throw new HttpError(403, REFUSED);

    const {message, created} = await store.insertMessage({senderId: user.id, recipientId: to, body, clientId});
    const out = shown(message);
    if (!created) return {message: out, online: !!playerFor(to)};
    limit.note(user.id, to);
    // Written first, pushed second: a socket that closed in between loses nothing.
    let online = false;
    try { online = !!push(to, {type: 'dm-new', message: out, from: {userId: user.id, handle: await store.handleFor(user.id), name: user.name}}); }
    catch { online = false; }
    return {message: out, online};
  }

  async function page(user, id, before) {
    if (!id || id === user.id) throw new HttpError(400, 'Choose another player.');
    if (before && !TIMESTAMP.test(before)) throw new HttpError(400, 'Invalid page.');
    const rows = await store.conversation(user.id, id, {before: before || null, limit: PAGE + 1});
    return {messages: rows.slice(0, PAGE).reverse().map(shown), more: rows.length > PAGE};
  }

  async function unread(user) {
    const [threads, blocked] = await Promise.all([store.unread(user.id), store.blocks(user.id)]);
    const visible = threads.filter(thread => !blocked.includes(thread.senderId));
    const ids = visible.map(thread => thread.senderId);
    const [handles, names] = await Promise.all([store.handlesFor(ids), store.names(ids.filter(id => !playerFor(id)))]);
    return {threads: visible.map(thread => ({
      userId: thread.senderId,
      handle: handles.get(thread.senderId) || null,
      name: cleanDisplayName(playerFor(thread.senderId)?.name || names.get(thread.senderId)),
      unread: thread.unread,
      lastAt: thread.lastAt,
    }))};
  }

  async function route(user, request, url) {
    const path = url.pathname;
    if (path === '/messages' && request.method === 'POST') return send(user, await readJson(request, 4096));
    if (path === '/messages/unread' && request.method === 'GET') return unread(user);
    const read = path.match(/^\/messages\/([^/]+)\/read$/);
    if (read && request.method === 'POST') {
      const id = otherId(decodeURIComponent(read[1]));
      if (!id) throw new HttpError(400, 'Choose another player.');
      await store.markRead(user.id, id);
      return {};
    }
    const thread = path.match(/^\/messages\/([^/]+)$/);
    if (thread && request.method === 'GET') return page(user, otherId(decodeURIComponent(thread[1])), url.searchParams.get('before'));
    if (path === '/blocks' && request.method === 'POST') {
      const id = otherId((await readJson(request, 4096))?.userId);
      if (!id || id === user.id) throw new HttpError(400, 'Choose another player.');
      await store.block(user.id, id);
      return {};
    }
    const unblock = path.match(/^\/blocks\/([^/]+)$/);
    if (unblock && request.method === 'DELETE') {
      const id = otherId(decodeURIComponent(unblock[1]));
      if (!id) throw new HttpError(400, 'Choose another player.');
      await store.unblock(user.id, id);
      return {};
    }
    throw new HttpError(404, 'Not found');
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    if (path !== '/messages' && !path.startsWith('/messages/') && path !== '/blocks' && !path.startsWith('/blocks/')) return false;
    await serve(request, response, user => route(user, request, url));
    return true;
  }

  // What a moderator reads: the recent conversation, both sides, in the words actually sent.
  // Never passed through filterChat.
  async function reportFor(reporterId, reportedId) {
    const [rows, handle, names] = await Promise.all([
      store.conversation(reporterId, reportedId, {limit: 20}),
      store.handleFor(reportedId),
      store.names([reportedId]),
    ]);
    return {
      name: String(names.get(reportedId) || handle || 'Player').slice(0, 18),
      evidence: rows.reverse().map(row => ({from: row.senderId, body: row.body, sentAt: row.sentAt})),
    };
  }

  return {handle, reportFor};
}
```

- [ ] **Step 4: Run, expect PASS** — `npx playwright test tests/messages.spec.ts > $SCRATCH/t7.txt 2>&1; echo exit=$?` → exit 0, 12 passed.

- [ ] **Step 5: Commit** — `git add server/messages.mjs tests/messages.spec.ts && git commit -m "feat: stored private messages with ban, mute, lockout, block and rate gates" -m "Sends fail closed with 503 when moderation cannot be checked, like the Wall. Bodies are stored raw and filtered on the way out." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

### Task 8: Wire the realtime server — stand-ins, nudges, push and DM reports

**Files:**
- Modify: `server/index.mjs`
- Test: `tests/messages-socket.spec.ts`

**Interfaces:**
- Consumes: `createSocialStore` (Task 4), `createFriends({store})` (Task 5), `createHandles` (Task 6), `createMessages` (Task 7), `UUID` (Task 6).
- Produces (socket, server to client):
  - `welcome` gains `standIn: {userId, token}` **only** when the store is in memory (no Supabase) and the joiner has no account.
  - `handle-required {suggestion}` after `welcome` for an account (or stand-in) with no handle. A failed lookup sends nothing.
  - `dm-new {message, from}` to the recipient's socket in whatever room they are in.
- Produces (socket, client to server):
  - `join` accepts `standInToken` to keep the same stand-in across reconnects.
  - `report` with `surface: 'dm'` and `userId` reports a stored conversation; the server attaches the evidence itself.
- `player.standInId` is never sent in room snapshots.

- [ ] **Step 1: Write the failing socket spec** — `tests/messages-socket.spec.ts`:

```ts
import {test, expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const blank = {ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SERVICE_ROLE_KEY: ''};

function start(port: string, env: Record<string, string>) {
  const child = spawn(process.execPath, ['server/index.mjs'], {env: {...process.env, ...blank, PORT: port, ...env}, stdio: 'ignore'});
  const ready = () => expect.poll(async () => { try { return (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch { return false; } }, {timeout: 30000}).toBe(true);
  const call = async (token: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {method, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    return {status: response.status, body: await response.json().catch(() => null)};
  };
  const sockets: WebSocket[] = [];
  const join = (room: string, name: string, extra: object = {}) => new Promise<{ws: WebSocket; welcome: any; seen: any[]}>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const seen: any[] = [];
    sockets.push(ws);
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({type: 'join', room, guest: true, name, ...extra})));
    ws.on('message', raw => {
      const message = JSON.parse(String(raw));
      seen.push(message);
      if (message.type === 'welcome') resolve({ws, welcome: message, seen});
      if (message.type === 'error') reject(Error(message.message));
    });
  });
  const stop = () => { sockets.forEach(ws => ws.close()); child.kill(); };
  return {ready, call, join, stop};
}

test('on dev a guest gets a stand-in, claims a handle, and messages across rooms and reconnects', async () => {
  const server = start('8263', {});
  try {
    await server.ready();
    const alya = await server.join('kampung', 'Alya');
    const badrul = await server.join('klcc', 'Badrul');
    const A = alya.welcome.standIn, B = badrul.welcome.standIn;
    expect(A).toEqual({userId: expect.stringMatching(UUID), token: expect.any(String)});
    expect(B.userId).not.toBe(A.userId);
    expect(JSON.stringify(alya.welcome.players)).not.toContain(A.userId);
    await expect.poll(() => alya.seen.find(m => m.type === 'handle-required')?.suggestion).toBe('alya');

    expect((await server.call(A.token, 'POST', '/handles/claim', {handle: 'alya'})).body).toEqual({handle: 'alya'});
    expect((await server.call(B.token, 'POST', '/handles/claim', {handle: 'badrul'})).body).toEqual({handle: 'badrul'});
    expect((await server.call(A.token, 'GET', '/players/search?q=bad')).body.results).toEqual([{userId: B.userId, handle: 'badrul', name: 'Badrul', online: true, relation: 'none'}]);

    // Different rooms: the push still finds Badrul.
    const live = await server.call(A.token, 'POST', '/messages', {to: B.userId, body: 'jumpa kat klcc', clientId: 'm-1'});
    expect(live.body.online).toBe(true);
    await expect.poll(() => badrul.seen.find(m => m.type === 'dm-new')?.message.body).toBe('jumpa kat klcc');
    expect(badrul.seen.find(m => m.type === 'dm-new').from).toEqual({userId: A.userId, handle: 'alya', name: 'Alya'});

    badrul.ws.close();
    await expect.poll(async () => (await server.call(A.token, 'GET', '/players/search?q=badrul')).body.results[0]?.online).toBe(false);
    expect((await server.call(A.token, 'POST', '/messages', {to: B.userId, body: 'esok?', clientId: 'm-2'})).body.online).toBe(false);

    const back = await server.join('kampung', 'Badrul', {standInToken: B.token});
    expect(back.welcome.standIn).toEqual(B);
    const threads = (await server.call(B.token, 'GET', '/messages/unread')).body.threads;
    expect(threads).toEqual([expect.objectContaining({userId: A.userId, handle: 'alya', unread: 2})]);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(back.seen.some(m => m.type === 'handle-required')).toBe(false);

    // Guests' in-room DMs are untouched.
    alya.ws.send(JSON.stringify({type: 'chat', channel: 'dm', to: back.welcome.id, text: 'hai dalam bilik'}));
    await expect.poll(() => back.seen.find(m => m.type === 'chat' && m.channel === 'dm')?.text).toBe('hai dalam bilik');

    // Friendships work on dev through the same store.
    expect((await server.call(A.token, 'POST', '/friends/request', {id: B.userId})).status).toBe(200);
    expect((await server.call(B.token, 'POST', '/friends/respond', {id: A.userId, approved: true})).status).toBe(200);
    expect((await server.call(A.token, 'GET', '/players/search?q=badrul')).body.results[0].relation).toBe('friend');

    // A DM report is accepted by account; on dev there is no report table, so it fails politely.
    back.ws.send(JSON.stringify({type: 'report', surface: 'dm', userId: A.userId, reason: 'harassment', note: ''}));
    await expect.poll(() => back.seen.find(m => m.type === 'notice' && /report/i.test(m.message))?.message).toBe('Could not file that report. Please try again in a moment.');
  } finally { server.stop(); }
});

test('with Supabase configured, no stand-in is ever issued and messages stay unavailable', async () => {
  const server = start('8264', {SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_PUBLISHABLE_KEY: 'test'});
  try {
    await server.ready();
    const guest = await server.join('kampung', 'Guesty');
    expect('standIn' in guest.welcome).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(guest.seen.some(m => m.type === 'handle-required')).toBe(false);
    expect((await server.call('anything', 'GET', '/messages/unread')).status).toBe(503);
    expect((await server.call('anything', 'GET', '/players/search?q=a')).status).toBe(503);
  } finally { server.stop(); }
});
```

- [ ] **Step 2: Run, expect FAIL** — `welcome.standIn` is undefined.

- [ ] **Step 3: Imports** — in `server/index.mjs`, after `import {createFriends} from './friends.mjs';`:

```js
import {createSocialStore} from './social-store.mjs';
import {createHandles} from './handles.mjs';
import {createMessages} from './messages.mjs';
import {UUID} from './social-http.mjs';
```

- [ ] **Step 4: Store, friends, handles, messages** — replace the whole `const friends = createFriends({ ... });` block with:

```js
// Dev has no Supabase, so the social store is in memory there and a guest carries a stand-in
// account id for friends, handles and stored messages. createSocialStore never returns the
// in-memory store while any SUPABASE_* setting is present, so production cannot issue one.
const socialStore = createSocialStore();
function seatOfAccount(accountId) {
  if (!accountId) return null;
  for (const players of rooms.values()) for (const player of players.values()) {
    if (player.userId === accountId || player.standInId === accountId) return {player, players};
  }
  return null;
}
const playerForAccount = accountId => seatOfAccount(accountId)?.player || null;
// Friends checks userId and guest; a stand-in answers as its account, and only for this.
const accountView = player => player && !player.userId && player.standInId ? {...player, userId: player.standInId, guest: false} : player;
const friends = createFriends({
  store: socialStore,
  playerFor: playerForAccount,
  resolvePlayer: playerId => accountView(playerForId(playerId)),
  isOnline: userId => !!playerForAccount(userId),
  onChanged: ids => {
    const changed = new Set(ids);
    for (const players of rooms.values()) for (const player of players.values()) {
      const accountId = player.userId || player.standInId;
      if (accountId && changed.has(accountId)) send(player.ws, {type: 'friends-updated'});
    }
  },
});
const handles = createHandles({store: socialStore, playerFor: playerForAccount});
const messages = createMessages({
  store: socialStore,
  moderation,
  playerFor: playerForAccount,
  // The sender's own room decides the lockout. Someone not in the city is in no live game.
  liveGame: accountId => {
    const seat = seatOfAccount(accountId);
    return !!seat && (werewolf.live(seat.players, seat.player) || lukis.live(seat.players, seat.player));
  },
  push: (accountId, payload) => {
    const player = playerForAccount(accountId);
    if (!player || player.ws.readyState !== 1) return false;
    send(player.ws, payload);
    return true;
  },
});
```

- [ ] **Step 5: HTTP routes** — after `if (await friends.handle(request, response)) return;`:

```js
  if (await handles.handle(request, response)) return;
  if (await messages.handle(request, response)) return;
```

- [ ] **Step 6: Keep stand-ins out of snapshots** — in `snapshot()`, add `standInId: _standInId,` to the destructured keys, after `userId: _userId,`.

- [ ] **Step 7: Issue or resume the stand-in at join** — directly after `const id = crypto.randomUUID();` in the join branch:

```js
      // Dev only (see socialStore). A reconnecting guest hands its token back and keeps the same
      // stand-in, so its handle and inbox survive a dropped socket.
      const standIn = !identity.userId && socialStore && !socialStore.persistent
        ? socialStore.resumeStandIn(message.standInToken, identity.name) || socialStore.issueStandIn(identity.name)
        : null;
```

In the `player = { ... }` literal, change `userId: identity.userId,` to `userId: identity.userId, standInId: standIn?.userId || null,`.

Change the welcome line to:

```js
      send(ws, { type: 'welcome', id, room: room.name, version, voiceTransport:sfu.enabled?'sfu':'legacy', players: snapshot(room.players), ...(standIn ? { standIn } : {}) });
```

Directly before the join branch's final `return;` (after `syncVoiceCodec(room.players);`):

```js
      // A nudge, not a gate: a failed lookup must never stand between a player and the city.
      const accountId = identity.userId || standIn?.userId;
      if (accountId) handles.required(accountId, identity.name).then(suggestion => { if (suggestion) send(ws, { type: 'handle-required', suggestion }); }).catch(() => {});
```

- [ ] **Step 8: DM reports** — replace the body of `if (message.type === 'report') { ... }` with:

```js
      const now = Date.now();
      if (now - lastReportAt < 60000) { send(ws, { type: 'notice', message: 'You just filed a report. Give it a minute.' }); return; }
      const reason = REASONS.has(message.reason) ? message.reason : 'other';
      // Deliberately not run through filterChat: this note is read by a moderator, never
      // broadcast, and 'he called me a babi' censored down to *** destroys the evidence.
      const note = typeof message.note === 'string' ? message.note.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) : '';
      let target, surface, witnesses = [], evidence = [];
      if (message.surface === 'dm') {
        // A conversation is reported by account: the other person may be offline or in another
        // room. The server attaches the messages itself; the client never supplies them.
        const reporterId = player.userId || player.standInId;
        const reportedId = typeof message.userId === 'string' ? message.userId.toLowerCase() : '';
        if (!reporterId || !UUID.test(reportedId) || reportedId === reporterId) { send(ws, { type: 'notice', message: 'Open the conversation you want to report.' }); return; }
        if (reported.has(reportedId)) { send(ws, { type: 'notice', message: 'You have already reported this player. It is with the moderators.' }); return; }
        try {
          const found = await messages.reportFor(reporterId, reportedId);
          target = { id: reportedId, userId: reportedId, name: found.name };
          evidence = found.evidence;
        } catch { send(ws, { type: 'notice', message: 'Could not file that report. Please try again in a moment.' }); return; }
        if (!player || !currentRoom) return;
        surface = 'dm';
      } else {
        target = currentRoom.players.get(message.id);
        if (!target || target.id === player.id) { send(ws, { type: 'notice', message: 'That player is no longer in the city.' }); return; }
        if (reported.has(target.id)) { send(ws, { type: 'notice', message: 'You have already reported this player. It is with the moderators.' }); return; }
        surface = SURFACES.has(message.surface) ? message.surface : 'behaviour';
        // Nobody records the room's audio, so what makes a voice report reviewable is who
        // else was close enough to have heard it. Names only, and only those in earshot.
        witnesses = [...currentRoom.players.values()]
          .filter(other => other.id !== player.id && other.id !== target.id && Math.hypot(other.x - target.x, other.z - target.z) < voiceConfig.hearingRadius)
          .slice(0, 10).map(other => other.name);
      }
      try {
        await moderation.report({
          reporterUserId: player.userId, reporterName: player.name,
          reportedUserId: target.userId, reportedName: target.name,
          room: currentRoom.name, surface, reason, note, witnesses, evidence,
        });
      } catch { send(ws, { type: 'notice', message: 'Could not file that report. Please try again in a moment.' }); return; }
      // Only a report that actually landed spends the cooldown.
      lastReportAt = now; reported.add(target.id);
      send(ws, { type: 'notice', message: 'Report sent. A moderator will look at it.' });
      return;
```

(The `note` line keeps the file's existing control-character class exactly as it is today; copy it from the current source rather than retyping it.)

- [ ] **Step 9: Run** — `npx playwright test tests/messages-socket.spec.ts tests/guest.spec.ts tests/moderation-socket.spec.ts tests/chat-integrity.spec.ts tests/afk.spec.ts --grep-invert "AFK note persists" > $SCRATCH/t8.txt 2>&1; echo exit=$?` → exit 0.

- [ ] **Step 10: Commit** — `git add server/index.mjs tests/messages-socket.spec.ts && git commit -m "feat: realtime server issues dev stand-ins, nudges for handles and pushes stored DMs" -m "Reports on a conversation go by account with server-attached evidence. Guests' in-room DMs are unchanged." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

---

## Phase 4 — Client

Every browser spec in this phase needs the vite on port 5301 described under "Environment notes", and runs as `PLAYWRIGHT_PORT=5301 npx playwright test <spec> > $SCRATCH/<name>.txt 2>&1; echo exit=$?`.

### Task 9: Account token and the claim screen

**Files:**
- Create: `src/account-token.ts`
- Create: `src/handles.ts`
- Modify: `src/friends.css` (claim screen styles)
- Test: `tests/handle-claim.spec.ts`

**Interfaces:**
- Produces:
  - `accountToken(): string` — the Supabase session token for an account; the dev stand-in token for a guest holding one; otherwise `''`.
  - `setStandInToken(token)`, `standInTokenFor(): string` (per guest name, per tab, from `sessionStorage`), `clearStandIn()`.
  - `setupHandleClaim(endpoint, onClaimed(handle)) → {require(suggestion): void, readonly opened: boolean}` — a modal that cannot be dismissed, pre-filled, checks availability as the player types, and on `taken` fills in the server's suggestion.

- [ ] **Step 1: Write the failing spec** — `tests/handle-claim.spec.ts`:

```ts
import {test, expect} from '@playwright/test';

test('the claim screen is pre-filled, checks live, cannot be dismissed, and recovers from a lost race', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: `export const session={access_token:'test',user:{id:'me'}};export let guestName='';`}));
  const claims: unknown[] = [];
  await page.route('http://handles.test/handles/check*', route => {
    const handle = new URL(route.request().url()).searchParams.get('h');
    return route.fulfill({json: handle === 'yusuf' ? {available: false} : {available: true}});
  });
  await page.route('http://handles.test/handles/claim', route => {
    claims.push(route.request().postDataJSON());
    return claims.length === 1
      ? route.fulfill({status: 409, json: {error: 'taken', message: 'That handle is taken.', suggestion: 'yusuf3'}})
      : route.fulfill({json: {handle: 'yusuf3'}});
  });
  await page.route('**/handle-harness', route => route.fulfill({contentType: 'text/html', body: `<main><script type="module">import {setupHandleClaim} from '/src/handles.ts';window.claimed=[];window.claim=setupHandleClaim('http://handles.test',handle=>window.claimed.push(handle));window.claim.require('Yusuf');</script></main>`}));
  await page.goto('/handle-harness');

  const dialog = page.getByRole('dialog', {name: 'Pick your @handle'});
  await expect(dialog).toBeVisible();
  await expect(page.locator('#handle-input')).toHaveValue('yusuf');
  await expect(page.locator('#handle-status')).toHaveText('@yusuf is taken.');
  await expect(page.getByRole('button', {name: 'Claim handle'})).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await page.locator('#handle-input').fill('Yusuf Two!');
  await expect(page.locator('#handle-input')).toHaveValue('yusuftwo');
  await expect(page.locator('#handle-status')).toHaveText('@yusuftwo is free.');
  await page.getByRole('button', {name: 'Claim handle'}).click();
  await expect(page.locator('#handle-input')).toHaveValue('yusuf3');
  await expect(page.locator('#handle-status')).toHaveText('Taken. How about @yusuf3?');
  await page.getByRole('button', {name: 'Claim handle'}).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => (window as any).claimed)).toEqual(['yusuf3']);
  expect(claims).toEqual([{handle: 'yusuftwo'}, {handle: 'yusuf3'}]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
```

- [ ] **Step 2: Run, expect FAIL** — `/src/handles.ts` does not exist, the dialog never appears.

- [ ] **Step 3: Account token** — `src/account-token.ts`:

```ts
import {guestName, session} from './auth';

// Dev has no accounts, so the realtime server hands a guest a stand-in token for handles,
// friends and stored messages. Production never sends one, so there this is the session token.
let standIn = '';
const storageKey = () => `lepak-stand-in:${guestName}`;

export function setStandInToken(token: string) {
  standIn = token;
  try { sessionStorage.setItem(storageKey(), token); } catch { /* A reload simply starts a new stand-in. */ }
}

// Per tab and per guest name, so a reload or a quick relog keeps the same stand-in inbox.
export function standInTokenFor() {
  try { return sessionStorage.getItem(storageKey()) || ''; } catch { return ''; }
}

export function clearStandIn() { standIn = ''; }

export function accountToken() {
  if (session && !guestName) return session.access_token;
  return guestName ? standIn : '';
}
```

- [ ] **Step 4: Claim screen** — `src/handles.ts`:

```ts
import {accountToken} from './account-token';
import './friends.css';

const HANDLE = /^[a-z0-9_]{3,18}$/;

// Shown once, on the first login without a handle, and it cannot be dismissed: search only
// works if everyone has a handle, and a handle is permanent, so it deserves a real choice.
export function setupHandleClaim(endpoint: string, onClaimed: (handle: string) => void = () => {}) {
  const base = endpoint.replace(/^ws/i, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  const dialog = document.createElement('dialog');
  dialog.id = 'handle-claim'; dialog.setAttribute('aria-labelledby', 'handle-claim-title');
  dialog.innerHTML = `<form class="handle-card" novalidate><small>LEPAKMAMAK · YOUR HANDLE</small><h2 id="handle-claim-title">Pick your @handle</h2><p>Friends find you by it. It is yours for good, so choose carefully.</p><label for="handle-input">Handle</label><div class="handle-field"><span aria-hidden="true">@</span><input id="handle-input" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="18" aria-describedby="handle-status"></div><p id="handle-status" role="status" aria-live="polite"></p><button type="submit" id="handle-submit">Claim handle</button></form>`;
  document.body.append(dialog);
  const input = dialog.querySelector<HTMLInputElement>('#handle-input')!;
  const status = dialog.querySelector<HTMLElement>('#handle-status')!;
  const submit = dialog.querySelector<HTMLButtonElement>('#handle-submit')!;
  let checkTimer = 0, checkSeq = 0, busy = false, required = false;
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);

  async function call(path: string, init: RequestInit = {}) {
    const response = await fetch(`${base}${path}`, {...init, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${accountToken()}`}});
    return {response, data: await response.json().catch(() => ({}))};
  }

  async function check() {
    const handle = input.value, mine = ++checkSeq;
    if (!HANDLE.test(handle)) { status.textContent = '3 to 18 letters, numbers or _.'; submit.disabled = true; return; }
    status.textContent = 'Checking…';
    try {
      const {response, data} = await call(`/handles/check?h=${encodeURIComponent(handle)}`);
      if (mine !== checkSeq) return;
      if (!response.ok) throw Error(data.error);
      status.textContent = data.available ? `@${handle} is free.` : data.reason === 'reserved' ? 'That handle is reserved.' : `@${handle} is taken.`;
      submit.disabled = !data.available;
    } catch {
      // The claim itself is the real check, so a failed preview never blocks it.
      if (mine === checkSeq) { status.textContent = 'Could not check right now. You can still try.'; submit.disabled = false; }
    }
  }

  input.addEventListener('input', () => {
    const next = clean(input.value);
    if (next !== input.value) input.value = next;
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => void check(), 250);
  });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('cancel', event => event.preventDefault());
  // Chrome lets a repeated Escape close a modal whose cancel was refused; put it straight back.
  dialog.addEventListener('close', () => { if (required) dialog.showModal(); });

  dialog.querySelector('form')!.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !HANDLE.test(input.value)) return;
    busy = true; submit.disabled = true; status.textContent = 'Claiming…';
    try {
      const {response, data} = await call('/handles/claim', {method: 'POST', body: JSON.stringify({handle: input.value})});
      const handle = response.ok ? data.handle : data.error === 'claimed' ? data.handle : '';
      if (handle) { required = false; dialog.close(); onClaimed(handle); return; }
      if (data.suggestion) input.value = clean(data.suggestion);
      status.textContent = data.error === 'taken' ? `Taken. How about @${input.value}?`
        : data.error === 'reserved' ? `That one is reserved. Try @${input.value}.`
        : data.error === 'invalid' ? `3 to 18 letters, numbers or _. Try @${input.value}.`
        : data.message || data.error || 'Could not claim it. Try again.';
      submit.disabled = false;
    } catch {
      status.textContent = 'Could not reach the city. Try again.';
      submit.disabled = false;
    } finally { busy = false; }
  });

  return {
    require(suggestion: string) {
      required = true;
      input.value = clean(suggestion);
      if (!dialog.open) dialog.showModal();
      input.focus();
      void check();
    },
    get opened() { return dialog.open; },
  };
}
```

- [ ] **Step 5: Styles** — append to `src/friends.css`:

```css
#handle-claim{width:min(420px,calc(100vw - 28px));padding:0;border:1px solid #a8b891;border-radius:16px;background:#f4f0df;color:#234839;box-shadow:0 24px 90px #10251b66}
#handle-claim::backdrop{background:#102b24d9;backdrop-filter:blur(5px)}
#handle-claim .handle-card{display:grid;gap:9px;padding:24px}
#handle-claim small{font-size:9px;letter-spacing:.18em;font-weight:800;color:#6b806b}
#handle-claim h2{margin:0;font:800 28px/1.05 'Oxanium',sans-serif;text-transform:uppercase;overflow-wrap:anywhere}
#handle-claim p{margin:0;color:#597064;font-size:12px;line-height:1.5}
#handle-claim label{font-size:11px;font-weight:700}
#handle-claim .handle-field{display:flex;align-items:center;border:1px solid #9caf95;border-radius:8px;background:#fffdf5}
#handle-claim .handle-field:focus-within{outline:3px solid #d8ee8d;outline-offset:2px}
#handle-claim .handle-field span{padding:0 2px 0 12px;font:800 16px 'Oxanium',sans-serif}
#handle-claim input{flex:1;min-width:0;min-height:44px;border:0;background:none;color:#234839;font:700 16px 'Oxanium',sans-serif;outline:none}
#handle-claim #handle-status{min-height:18px}
#handle-claim button{min-height:44px;border:0;border-radius:8px;background:#2d674f;color:#f4f2d9;font:800 12px 'Oxanium',sans-serif;cursor:pointer}
#handle-claim button:disabled{opacity:.5;cursor:default}
#handle-claim button:focus-visible{outline:3px solid #d8ee8d;outline-offset:2px}
```

- [ ] **Step 6: Run, expect PASS.**

- [ ] **Step 7: Commit** — `git add src/account-token.ts src/handles.ts src/friends.css tests/handle-claim.spec.ts && git commit -m "feat: claim screen for a permanent @handle" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

### Task 10: Search by handle in the friends panel

**Files:**
- Modify: `src/friends.ts`, `src/friends.css`
- Test: `tests/friends.spec.ts`

**Interfaces:**
- Consumes: `accountToken()` (Task 9), `GET /players/search` (Task 6), the existing `/friends/request {id}` flow.
- Produces: `setupFriends(endpoint, onState, release, messageFriend, onEvent, messageAccount: (userId, handle, name) => void = () => {})`; `export type SearchResult`.

- [ ] **Step 1: Write the failing test** — append to `tests/friends.spec.ts`:

```ts
test('search finds players by handle and offers Message and the existing friend request', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: `export const session={access_token:'test',user:{id:'me',user_metadata:{display_name:'Tester'}}};export let guestName='';`}));
  await page.route('**/friends/state', route => route.fulfill({json: {state: {friends: [], incoming: [], outgoing: []}}}));
  const queries: string[] = [];
  await page.route('**/players/search?*', route => {
    queries.push(new URL(route.request().url()).searchParams.get('q') || '');
    return route.fulfill({json: {results: [
      {userId: 'u-1', handle: 'badrul', name: '<b>Badrul</b>', online: true, relation: 'none'},
      {userId: 'u-2', handle: 'badrulx', name: 'Other', online: false, relation: 'pending'},
      {userId: 'u-3', handle: 'badrul_3', name: 'Mate', online: false, relation: 'friend'},
    ]}});
  });
  let requested: unknown = null;
  await page.route('**/friends/request', route => {
    requested = route.request().postDataJSON();
    return route.fulfill({json: {result: {requested: true}, state: {friends: [], incoming: [], outgoing: [{id: 'u-1', name: 'Badrul'}]}}});
  });
  await page.route('**/friends-search-harness', route => route.fulfill({contentType: 'text/html', body: `<main><script type="module">import {setupFriends} from '/src/friends.ts';window.opened=[];window.friendApi=setupFriends('http://friends.test',()=>{},()=>{},()=>{},()=>{},(userId,handle,name)=>window.opened.push({userId,handle,name}));window.friendApi.open();</script></main>`}));
  await page.goto('/friends-search-harness');

  await page.getByRole('searchbox', {name: 'Search players by handle'}).fill('@Bad');
  const results = page.locator('.friend-result');
  await expect(results).toHaveCount(3);
  expect(queries).toEqual(['bad']);
  await expect(results.nth(0)).toContainText('@badrul');
  await expect(results.nth(0)).toContainText('<b>Badrul</b>');
  await expect(results.nth(0)).toContainText('Online');
  await expect(results.nth(1)).toContainText('Offline');
  await expect(page.locator('#game-friends b, #game-friends img')).toHaveCount(0);
  await expect(results.nth(1).getByRole('button', {name: 'Pending'})).toBeDisabled();
  await expect(results.nth(2).getByRole('button', {name: 'Friends'})).toBeDisabled();

  await results.nth(0).getByRole('button', {name: 'Add friend'}).click();
  await expect(results.nth(0).getByRole('button', {name: 'Pending'})).toBeDisabled();
  expect(requested).toEqual({id: 'u-1'});
  await results.nth(0).getByRole('button', {name: 'Message'}).click();
  expect(await page.evaluate(() => (window as any).opened)).toEqual([{userId: 'u-1', handle: 'badrul', name: '<b>Badrul</b>'}]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
```

- [ ] **Step 2: Run, expect FAIL** — no searchbox.

- [ ] **Step 3: Implement** — in `src/friends.ts`:
  1. Replace `import {guestName, session} from './auth';` with `import {accountToken} from './account-token';`.
  2. After the `FriendEvent` type add:

```ts
export type SearchResult = {userId: string; handle: string; name: string; online: boolean; relation: 'none' | 'pending' | 'friend'};
```

  3. Add a sixth parameter after `onEvent`:

```ts
  messageAccount: (userId: string, handle: string, name: string) => void = () => {},
```

  4. In the dialog template, directly before `<section aria-labelledby="friends-list-title">`, insert:

```html
<section id="friends-search-section" aria-labelledby="friends-search-title"><div class="friends-section-head"><div><small>FIND PLAYERS</small><h3 id="friends-search-title">Search by handle</h3></div></div><input id="friends-search" class="friends-search" type="search" placeholder="@handle" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="19" aria-label="Search players by handle"><ul id="friends-results"></ul></section>
```

  5. Replace `const loggedIn = () => !!session && !guestName;` with `const loggedIn = () => !!accountToken();`, and in `request()` replace `session!.access_token` with `accountToken()`.
  6. After the `empty()` function add:

```ts
  const searchSection = el('friends-search-section');
  const searchInput = el<HTMLInputElement>('friends-search');
  const results = el('friends-results');
  let found: SearchResult[] = [];
  let searchTimer = 0, searchSeq = 0;

  function renderResults() {
    results.replaceChildren();
    for (const result of found) {
      const row = document.createElement('li'); row.className = 'friend-row friend-result';
      const copy = document.createElement('span'); copy.className = 'friend-copy';
      const initial = document.createElement('i'); initial.className = 'friend-initial'; initial.setAttribute('aria-hidden', 'true');
      initial.textContent = (result.name || result.handle).slice(0, 1).toUpperCase();
      const names = document.createElement('span');
      const handle = document.createElement('strong'); handle.textContent = `@${result.handle}`;
      const name = document.createElement('small'); name.className = 'friend-name'; name.textContent = result.name;
      names.append(handle, name);
      const status = document.createElement('small'); status.className = result.online ? 'is-online' : 'is-offline'; status.textContent = result.online ? 'Online' : 'Offline';
      copy.append(initial, names, status);
      const actions = document.createElement('span'); actions.className = 'friend-actions';
      const chat = document.createElement('button'); chat.type = 'button'; chat.textContent = 'Message';
      chat.onclick = () => messageAccount(result.userId, result.handle, result.name);
      const add = document.createElement('button'); add.type = 'button'; add.dataset.uiSound = 'none';
      add.textContent = result.relation === 'friend' ? 'Friends' : result.relation === 'pending' ? 'Pending' : 'Add friend';
      if (result.relation === 'none') add.className = 'primary';
      add.disabled = result.relation !== 'none' || busy;
      // The same request flow as everywhere else; the result only mirrors what it did.
      add.onclick = async () => {
        await mutate('request', {id: result.userId}, 'Friend request sent.', 'request-sent');
        const relation = relationship(result.userId);
        if (relation !== 'none') result.relation = relation === 'friend' ? 'friend' : 'pending';
        renderResults();
      };
      actions.append(chat, add); row.append(copy, actions); results.append(row);
    }
  }

  async function search() {
    const query = searchInput.value.trim().replace(/^@/, '').toLowerCase();
    const mine = ++searchSeq;
    if (!query || !base || !loggedIn()) { found = []; renderResults(); return; }
    try {
      const response = await fetch(`${base}/players/search?q=${encodeURIComponent(query)}`, {headers: {Authorization: `Bearer ${accountToken()}`}});
      const data = await response.json().catch(() => ({}));
      if (mine !== searchSeq) return;
      if (!response.ok) throw Error(data.error || 'Search is not available right now.');
      found = Array.isArray(data.results) ? data.results : [];
      renderResults();
      if (!found.length) results.append(empty('No players with that handle.'));
    } catch (error) {
      if (mine !== searchSeq) return;
      found = []; renderResults();
      results.append(empty(error instanceof Error ? error.message : 'Search failed.'));
    }
  }
  searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = window.setTimeout(() => void search(), 250); });
```

  7. At the top of `render()`, after `const state = currentState;`, add `searchSection.hidden = !loggedIn();`.
  8. In the returned `open()`, after `void refresh(false);`, add `if (searchInput.value) void search();`.

- [ ] **Step 4: Styles** — append to `src/friends.css`:

```css
#game-friends .friends-search{display:block;width:100%;box-sizing:border-box;min-height:42px;margin-top:12px;padding:0 12px;border:1px solid #9caf95;border-radius:8px;background:#fffdf5;color:#234839;font:600 16px 'Oxanium',sans-serif}
#game-friends .friends-search:focus-visible{outline:3px solid #d8ee8d;outline-offset:2px}
#game-friends .friend-initial{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;background:#2d674f;color:#f4f2d9;font:800 12px 'Oxanium',sans-serif;font-style:normal}
#game-friends .friend-copy .friend-name{display:block;padding-left:0;color:#657564;font-size:10px;white-space:normal;overflow-wrap:anywhere}
#game-friends .friend-copy .friend-name::before{content:none}
```

- [ ] **Step 5: Run** — `PLAYWRIGHT_PORT=5301 npx playwright test tests/friends.spec.ts > $SCRATCH/t10.txt 2>&1; echo exit=$?` → exit 0 (all Friend List tests plus the new one).

- [ ] **Step 6: Commit** — `git add src/friends.ts src/friends.css tests/friends.spec.ts && git commit -m "feat: search players by handle in the friends panel" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

### Task 11: Stored conversations in the chat strip, and the game wiring

**Files:**
- Modify: `src/dm.ts`, `src/social.ts`, `src/style.css`
- Create: `src/inbox.ts`
- Modify: `src/main.ts`
- Test: `tests/private-messages-ui.spec.ts`

**Interfaces:**
- Consumes: `accountToken`, `setStandInToken`, `standInTokenFor`, `clearStandIn` (Task 9); `setupHandleClaim` (Task 9); `setupFriends(..., messageAccount)` (Task 10); the HTTP routes (Tasks 6–7); socket `welcome.standIn`, `handle-required`, `dm-new`, `report {surface:'dm', userId}` (Task 8).
- Produces:
  - `DmThread.stored?: boolean`; `createDmBar({select, close, block?, report?})` renders `Block <name>` / `Report <name>` buttons for the active stored conversation.
  - `setupChat(send, focus, hooks: PmHooks = {})` where `send`'s channel may be `'pm'`, `PmHooks = {opened?(userId), older?(userId), block?(userId), report?(userId)}`; the returned object gains `pm: PmChat`.
  - `PmChat = {open(userId, label), add(userId, label, entries, {mode?: 'append'|'prepend'|'replace', notify?}), note(userId, text, action?) → HTMLElement|null, unread(userId, label, count), active(userId) → boolean, close(userId)}`. Stored threads are keyed `pm:<userId>`, never `dm:<playerId>`, so `dm-closed` and `chat.online()` never touch them.
  - `setupInbox(endpoint, chat: PmChat, {me(), toast(title, body), report(peer)}) → {open(peer), opened(userId), older(userId), receive(message, from?), send(userId, text) → boolean, login(), block(userId), report(userId), reset()}`; `Peer = {userId, handle, name}`, `StoredMessage = {id, from, to, body, clientId, sentAt}`.

- [ ] **Step 1: Write the failing harness spec** — `tests/private-messages-ui.spec.ts`:

```ts
import {test, expect, type Page} from '@playwright/test';

const mount = async (page: Page) => {
  await page.route('**/src/auth.ts*', route => route.fulfill({contentType: 'application/javascript', body: `export const session={access_token:'tok',user:{id:'me'}};export let guestName='';export const displayName=()=>'Me';`}));
  await page.route('**/pm-harness', route => route.fulfill({contentType: 'text/html', body: '<link rel="stylesheet" href="/src/style.css"><div id="hud"></div>'}));
  await page.goto('/pm-harness');
  await page.evaluate(async () => {
    const {setupChat} = await import('/src/social.ts');
    const {setupInbox} = await import('/src/inbox.ts');
    const w = window as any;
    w.reports = []; w.toasts = [];
    w.chat = setupChat((text: string, channel: string, to?: string) => channel === 'pm' ? w.inbox.send(to, text) : true, () => {}, {
      opened: (id: string) => void w.inbox.opened(id),
      older: (id: string) => w.inbox.older(id),
      block: (id: string) => void w.inbox.block(id),
      report: (id: string) => w.inbox.report(id),
    });
    w.inbox = setupInbox('http://pm.test', w.chat.pm, {me: () => 'Me', toast: (title: string, body: string) => w.toasts.push({title, body}), report: (peer: unknown) => w.reports.push(peer)});
  });
};
const at = (seconds: number) => new Date(Date.parse('2026-09-13T09:00:00.000Z') + seconds * 1000).toISOString();

test('unread conversations appear at login as chips; opening one loads it, marks it read, and pages older ones in', async ({page}) => {
  const read: string[] = [], pages: string[] = [];
  await page.route('http://pm.test/messages/unread', route => route.fulfill({json: {threads: [{userId: 'u-alya', handle: 'alya', name: 'Alya', unread: 2, lastAt: at(39)}]}}));
  await page.route(url => url.hostname === 'pm.test' && url.pathname.startsWith('/messages/u-alya'), route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/read')) { read.push('u-alya'); return route.fulfill({json: {}}); }
    const before = url.searchParams.get('before') || '';
    pages.push(before);
    const lines = before ? Array.from({length: 10}, (_, n) => n) : Array.from({length: 30}, (_, n) => n + 10);
    return route.fulfill({json: {more: !before, messages: lines.map(n => ({id: `m${n}`, from: n % 2 ? 'me' : 'u-alya', to: n % 2 ? 'u-alya' : 'me', body: `line ${n}`, clientId: `c${n}`, sentAt: at(n)}))}});
  });
  await mount(page);
  await page.evaluate(() => (window as any).inbox.login());

  const chip = page.getByRole('button', {name: 'Private messages with @alya, 2 unread'});
  await expect(chip).toBeVisible();
  await chip.click();
  const log = page.locator('.chat-log:not([hidden])');
  await expect(log.locator('p[data-key]')).toHaveCount(30);
  await expect(log).toContainText('line 39');
  await expect.poll(() => read).toEqual(['u-alya']);
  await expect(page.getByRole('button', {name: 'Private messages with @alya', exact: true})).toBeVisible();

  await log.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  await expect(log.locator('p[data-key]')).toHaveCount(40);
  await expect(log.locator('p[data-key]').first()).toContainText('line 0');
  expect(pages).toEqual(['', at(10)]);
});

test('sending: the offline note shows once, a lost connection keeps a retry with the same client id', async ({page}) => {
  const posts: any[] = [];
  let mode: 'offline' | 'drop' | 'blocked' = 'offline';
  await page.route('http://pm.test/messages', route => {
    const body = route.request().postDataJSON();
    posts.push(body);
    if (mode === 'drop') { mode = 'offline'; return route.abort('internetdisconnected'); }
    if (mode === 'blocked') return route.fulfill({status: 403, json: {error: "You can't message this player."}});
    return route.fulfill({json: {online: false, message: {id: `id-${posts.length}`, from: 'me', to: 'u-badrul', body: body.body, clientId: body.clientId, sentAt: new Date().toISOString()}}});
  });
  await page.route(url => url.hostname === 'pm.test' && url.pathname.startsWith('/messages/u-badrul'), route => route.fulfill({json: route.request().url().endsWith('/read') ? {} : {messages: [], more: false}}));
  await mount(page);
  await page.evaluate(() => (window as any).inbox.open({userId: 'u-badrul', handle: 'badrul', name: 'Badrul'}));
  const log = page.locator('.chat-log:not([hidden])');
  const type = async (text: string) => {
    await page.locator('#chat-compose').click();
    await page.locator('#chat-input').fill(text);
    await page.locator('#chat-input').press('Enter');
  };

  await type('jumpa esok');
  await expect(log.locator('p[data-key]')).toContainText(['jumpa esok']);
  await expect(log.locator('.chat-note')).toHaveText(["They'll see this when they're back online."]);
  await type('kat mamak');
  await expect(log.locator('p[data-key]')).toHaveCount(2);
  await expect(log.locator('.chat-note')).toHaveCount(1);

  mode = 'drop';
  await type('dah sampai?');
  const failed = log.locator('.chat-note', {hasText: 'Not sent'});
  await expect(failed).toBeVisible();
  await failed.getByRole('button', {name: 'Retry'}).click();
  await expect(log.locator('p[data-key]', {hasText: 'dah sampai?'})).toHaveCount(1);
  await expect(failed).toHaveCount(0);
  expect(posts[3]).toEqual(posts[2]);

  mode = 'blocked';
  await type('hello?');
  await expect(log.locator('.chat-note').last()).toHaveText("You can't message this player.");
});

test('a pushed message lands in its own conversation; Block and Report sit in the conversation header', async ({page}) => {
  let blocked: unknown = null;
  const message = {id: 'x1', from: 'u-chong', to: 'me', body: 'yo', clientId: 'k1', sentAt: at(1)};
  await page.route('http://pm.test/blocks', route => { blocked = route.request().postDataJSON(); return route.fulfill({json: {}}); });
  await page.route(url => url.hostname === 'pm.test' && url.pathname.startsWith('/messages/u-chong'), route => route.fulfill({json: route.request().url().endsWith('/read') ? {} : {messages: [message], more: false}}));
  await mount(page);
  await page.evaluate(m => (window as any).inbox.receive(m, {userId: 'u-chong', handle: 'chong', name: 'Chong'}), message);

  const chip = page.getByRole('button', {name: 'Private messages with @chong, 1 unread'});
  await expect(chip).toBeVisible();
  await expect(page.getByRole('button', {name: 'Block @chong'})).toBeHidden();
  await chip.click();
  await expect(page.locator('.chat-log:not([hidden]) p[data-key]')).toHaveCount(1);
  await expect(page.locator('#chat-input')).toHaveAttribute('maxlength', '500');

  await page.getByRole('button', {name: 'Report @chong'}).click();
  expect(await page.evaluate(() => (window as any).reports)).toEqual([{userId: 'u-chong', handle: 'chong', name: 'Chong'}]);

  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', {name: 'Block @chong'}).click();
  await expect(page.getByRole('button', {name: /Private messages with @chong/})).toHaveCount(0);
  expect(blocked).toEqual({userId: 'u-chong'});
  expect(await page.evaluate(() => (window as any).toasts)).toEqual([{title: 'Blocked', body: "@chong can't message you any more."}]);
});
```

- [ ] **Step 2: Run, expect FAIL** — `/src/inbox.ts` does not exist.

- [ ] **Step 3: The strip** — replace `src/dm.ts` with:

```ts
// A private message is not a broadcast scope, so it does not belong in the composer's
// ALL / PARTY list. Conversations get their own strip above the log: one chip each,
// carrying the name, the unread count and the way out of the conversation. A stored
// conversation also carries Block and Report, one tap away while it is open.
export type DmThread = {key: string; name: string; unread: number; stored?: boolean};

export function createDmBar(actions: {select: (key: string) => void; close: (key: string) => void; block?: (key: string) => void; report?: (key: string) => void}) {
  const root = document.createElement('div');
  root.id = 'chat-dms'; root.hidden = true;
  root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Private messages');
  const heading = document.createElement('small'); heading.textContent = 'MESEJ';
  const list = document.createElement('div'); list.className = 'dm-chips';
  const tools = document.createElement('span'); tools.className = 'dm-tools'; tools.hidden = true;
  const block = document.createElement('button'); block.type = 'button'; block.textContent = 'Block';
  const report = document.createElement('button'); report.type = 'button'; report.textContent = 'Report';
  for (const button of [block, report]) button.onkeydown = event => event.stopPropagation();
  tools.append(block, report);
  root.append(heading, list, tools);

  return {
    root,
    render(threads: DmThread[], active: string) {
      // Nothing open means nothing to show; the strip must not eat log space for free.
      root.hidden = !threads.length;
      list.replaceChildren();
      for (const thread of threads) {
        const on = thread.key === active;
        const chip = document.createElement('div'); chip.className = `dm-chip${on ? ' on' : ''}`;
        const open = document.createElement('button');
        open.type = 'button'; open.className = 'dm-open'; open.setAttribute('aria-pressed', String(on));
        open.setAttribute('aria-label', `Private messages with ${thread.name}${thread.unread ? `, ${thread.unread} unread` : ''}`);
        const face = document.createElement('i'); face.setAttribute('aria-hidden', 'true');
        face.textContent = thread.name.replace(/^@/, '').slice(0, 1).toUpperCase();
        const name = document.createElement('b'); name.textContent = thread.name;
        open.append(face, name);
        if (thread.unread) {
          const count = document.createElement('span'); count.className = 'opt-unread';
          count.textContent = String(thread.unread); open.append(count);
        }
        open.onclick = () => actions.select(thread.key);
        const shut = document.createElement('button');
        shut.type = 'button'; shut.className = 'dm-close'; shut.textContent = '×';
        shut.setAttribute('aria-label', `Close chat with ${thread.name}`);
        shut.onclick = event => { event.stopPropagation(); actions.close(thread.key); };
        chip.append(open, shut);
        list.append(chip);
      }
      const current = threads.find(thread => thread.key === active && thread.stored);
      tools.hidden = !current;
      if (current) {
        block.setAttribute('aria-label', `Block ${current.name}`);
        report.setAttribute('aria-label', `Report ${current.name}`);
        block.onclick = () => actions.block?.(current.key);
        report.onclick = () => actions.report?.(current.key);
      }
    },
  };
}
```

- [ ] **Step 4: The chat** — in `src/social.ts`:
  1. Replace the `Thread` type and the `setupChat` signature line with:

```ts
type Thread = {key: string; label: string; channel: 'all' | 'party' | 'dm' | 'table' | 'pm'; to?: string; name?: string; log: HTMLElement; unread: number; closable: boolean};
// Stored conversations (channel 'pm', keyed by account) travel over HTTP through src/inbox.ts;
// the chat only draws them and reports what the player did.
export type PmHooks = {opened?: (userId: string) => void; older?: (userId: string) => void; block?: (userId: string) => void; report?: (userId: string) => void};
export type PmEntry = {key: string; name: string; text: string; sentAt?: string};

export function setupChat(send: (text: string, channel: Thread['channel'], to?: string) => boolean, focus: () => void, hooks: PmHooks = {}) {
```

  2. Replace the `createDmBar(...)` line with:

```ts
  const accountOf = (key: string) => threads.get(key)?.to || '';
  const dmBar = createDmBar({
    select: key => select(key), close: key => closeThread(key),
    block: key => { const id = accountOf(key); if (id) hooks.block?.(id); },
    report: key => { const id = accountOf(key); if (id) hooks.report?.(id); },
  });
```

  (`threads` is declared a few lines later with `const`; these callbacks only run on clicks, after it exists.)

  3. After `logs.addEventListener('scroll', renderJump, true);` add:

```ts
  // A stored conversation pages older messages in as you reach the top of it.
  logs.addEventListener('scroll', event => {
    const thread = threads.get(active);
    if (thread?.channel === 'pm' && thread.to && event.target === thread.log && thread.log.scrollTop < 8) hooks.older?.(thread.to);
  }, true);
```

  4. At the end of `select(key)`, after `renderJump();`, add:

```ts
    const chosen = threads.get(key)!;
    if (chosen.channel === 'pm' && chosen.to) hooks.opened?.(chosen.to);
```

  5. In `renderMenu()`, change `if (thread.channel === 'dm') continue;` to `if (thread.channel === 'dm' || thread.channel === 'pm') continue;`.
  6. In `render()`, change `const private_ = current.channel === 'dm';` to `const private_ = current.channel === 'dm' || current.channel === 'pm';`, change the `dmBar.render(...)` call to:

```ts
    dmBar.render([...threads.values()].filter(thread => thread.channel === 'dm' || thread.channel === 'pm').map(thread => ({key: thread.key, name: thread.name || thread.label, unread: thread.unread, stored: thread.channel === 'pm'})), active);
    // Stored messages allow 500 characters, matching the Wall; live chat stays at 200.
    input.maxLength = current.channel === 'pm' ? 500 : 200;
```

  7. After the existing `openDm` function add:

```ts
  function openPm(userId: string, label: string) {
    const key = `pm:${userId}`;
    const thread = threads.get(key) || build(key, label, 'pm', {to: userId, name: label, closable: true});
    thread.label = label; thread.name = label;
    return thread;
  }

  function line(name: string, text: string, sentAt?: string, gameMaster = false, area = '') {
    const parsed = sentAt ? new Date(sentAt) : new Date();
    const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
    const timestamp = document.createElement('time'); timestamp.dateTime = date.toISOString();
    timestamp.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
    timestamp.title = `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'medium' }).format(date)} MYT`;
    timestamp.setAttribute('aria-label', timestamp.title);
    const row = document.createElement('p');
    // Name on top, where they were standing underneath it. The area is stamped by the
    // server when the message is sent, so it is where they said it, not where they are now.
    const who = document.createElement('span'); who.className = 'chat-who';
    const author = document.createElement('strong'); author.textContent = gameMaster ? `✦ GM · ${name}:` : `${name}:`;
    who.append(author);
    if (area) { const place = document.createElement('small'); place.className = 'chat-area'; place.textContent = area; who.append(place); }
    if (gameMaster) row.className = 'game-master-chat';
    const said = document.createElement('span'); said.className = 'chat-said'; said.textContent = text;
    row.append(timestamp, document.createTextNode(' '), who, document.createTextNode(' '), said);
    return row;
  }
```

  8. Replace the body of the returned `append(...)` with (same behaviour, using `line`):

```ts
      const target = channel === 'dm' && thread ? openDm(thread.id, thread.name) : channel === 'party' ? (party ??= build('party', 'GENG', 'party')) : channel === 'table' ? (table ??= build('table', 'MEJA', 'table')) : all;
      const follow = !collapsed && target.key === active && atBottom(target.log);
      target.log.append(line(name, text, sentAt, gameMaster, area));
      while (target.log.children.length > 50) target.log.firstElementChild!.remove();
      if (notify && (collapsed || target.key !== active)) target.unread++;
      render();
      if (follow) toBottom(target.log);
      renderJump();
```

  9. Add to the returned object (after `closeDm,`):

```ts
    pm: {
      open(userId: string, label: string) { openPm(userId, label); select(`pm:${userId}`); },
      // ponytail: no 50-row cap here, since older pages are prepended on purpose; a very long
      // scroll-back simply keeps its rows until the conversation is closed.
      add(userId: string, label: string, entries: PmEntry[], options: {mode?: 'append' | 'prepend' | 'replace'; notify?: boolean} = {}) {
        const thread = openPm(userId, label), log = thread.log, mode = options.mode || 'append';
        const follow = !collapsed && thread.key === active && atBottom(log);
        const height = log.scrollHeight;
        if (mode === 'replace') log.querySelectorAll('p[data-key]').forEach(row => row.remove());
        const rows = entries
          .filter(entry => !log.querySelector(`p[data-key="${CSS.escape(entry.key)}"]`))
          .map(entry => { const row = line(entry.name, entry.text, entry.sentAt); row.dataset.key = entry.key; return row; });
        if (mode === 'prepend') log.prepend(...rows); else log.append(...rows);
        if (options.notify && rows.length && (collapsed || thread.key !== active)) thread.unread += rows.length;
        render();
        if (mode === 'prepend') log.scrollTop += log.scrollHeight - height;
        else if (follow || mode === 'replace') toBottom(log);
        renderJump();
      },
      note(userId: string, text: string, action?: {label: string; run: (row: HTMLElement) => void}) {
        const thread = threads.get(`pm:${userId}`);
        if (!thread) return null;
        const row = document.createElement('p'); row.className = 'chat-note';
        const said = document.createElement('span'); said.textContent = text; row.append(said);
        if (action) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = action.label;
          button.onkeydown = event => event.stopPropagation();
          button.onclick = () => action.run(row);
          row.append(button);
        }
        const follow = atBottom(thread.log);
        thread.log.append(row);
        if (follow) toBottom(thread.log);
        renderJump();
        return row;
      },
      unread(userId: string, label: string, count: number) {
        const thread = openPm(userId, label);
        if (thread.key !== active) thread.unread = count;
        render();
      },
      active: (userId: string) => active === `pm:${userId}` && !collapsed,
      close(userId: string) { closeThread(`pm:${userId}`); },
    },
```

- [ ] **Step 5: Styles** — in `src/style.css`, after the `.dm-chip.on .dm-open i` rule:

```css
.dm-tools { display: flex; gap: 4px; flex: 0 0 auto; margin-left: auto; }
.dm-tools[hidden] { display: none; }
.dm-tools button { border: 1px solid #99ad8966; border-radius: 11px; background: #ffffff12; color: #cdd8c0; padding: 4px 9px; font-size: 10px; cursor: pointer; }
.dm-tools button:focus-visible, .chat-note button:focus-visible { outline: 2px solid #ddf69a; outline-offset: 2px; }
.chat-log .chat-note { color: #9fb094; font-size: 11px; font-style: italic; }
.chat-log .chat-note button { margin-left: 6px; border: 1px solid #ddf69a88; border-radius: 9px; background: none; color: #ddf69a; padding: 2px 8px; font-size: 10px; font-style: normal; cursor: pointer; }
```

- [ ] **Step 6: The inbox** — `src/inbox.ts`:

```ts
import {accountToken} from './account-token';

// Stored private messages. The chat owns the strip and the log; this owns the HTTP side:
// loading and paging, marking read, sending with a retry that keeps its client id, and the
// Block and Report actions in a conversation's header.

export type StoredMessage = {id: string; from: string; to: string; body: string; clientId: string; sentAt: string};
export type Peer = {userId: string; handle: string | null; name: string};
type Entry = {key: string; name: string; text: string; sentAt?: string};
export type PmChat = {
  open(userId: string, label: string): void;
  add(userId: string, label: string, entries: Entry[], options?: {mode?: 'append' | 'prepend' | 'replace'; notify?: boolean}): void;
  note(userId: string, text: string, action?: {label: string; run: (row: HTMLElement) => void}): HTMLElement | null;
  unread(userId: string, label: string, count: number): void;
  active(userId: string): boolean;
  close(userId: string): void;
};
type Conversation = Peer & {more: boolean; oldest: string | null; loading: boolean; offlineNoted: boolean};
type Failure = Error & {status?: number; data?: {retryAfter?: number}};

export function setupInbox(endpoint: string, chat: PmChat, options: {me: () => string; toast: (title: string, body: string) => void; report: (peer: Peer) => void}) {
  const base = endpoint.replace(/^ws/i, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '');
  const conversations = new Map<string, Conversation>();
  const label = (peer: Peer) => peer.handle ? `@${peer.handle}` : peer.name;

  async function api(path: string, init: RequestInit = {}) {
    const token = accountToken();
    if (!base || !token) throw Object.assign(Error('Log in to use private messages.'), {status: 401});
    const response = await fetch(`${base}${path}`, {...init, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(Error(data.error || 'Please try again.'), {status: response.status, data});
    return data;
  }

  function conversation(peer: Peer) {
    const known = conversations.get(peer.userId);
    if (known) {
      if (peer.handle) known.handle = peer.handle;
      if (peer.name && peer.name !== 'Player') known.name = peer.name;
      return known;
    }
    const fresh: Conversation = {...peer, more: false, oldest: null, loading: false, offlineNoted: false};
    conversations.set(peer.userId, fresh);
    return fresh;
  }

  const entry = (message: StoredMessage, peer: Conversation): Entry => ({key: message.id, name: message.from === peer.userId ? label(peer) : options.me(), text: message.body, sentAt: message.sentAt});

  async function load(peer: Conversation, older: boolean) {
    if (peer.loading || (older && (!peer.more || !peer.oldest))) return;
    peer.loading = true;
    try {
      const query = older ? `?before=${encodeURIComponent(peer.oldest!)}` : '';
      const data = await api(`/messages/${encodeURIComponent(peer.userId)}${query}`);
      const page: StoredMessage[] = Array.isArray(data.messages) ? data.messages : [];
      if (page.length) peer.oldest = page[0].sentAt;
      peer.more = !!data.more;
      chat.add(peer.userId, label(peer), page.map(message => entry(message, peer)), {mode: older ? 'prepend' : 'replace'});
    } catch (error) {
      chat.note(peer.userId, (error as Error).message || 'Could not load this conversation.');
    } finally { peer.loading = false; }
  }

  async function markRead(userId: string) {
    try { await api(`/messages/${encodeURIComponent(userId)}/read`, {method: 'POST', body: '{}'}); }
    catch { /* The next open marks it again. */ }
  }

  async function deliver(peer: Conversation, text: string, clientId: string) {
    try {
      const data = await api('/messages', {method: 'POST', body: JSON.stringify({to: peer.userId, body: text, clientId})});
      chat.add(peer.userId, label(peer), [entry(data.message, peer)]);
      if (!data.online && !peer.offlineNoted) { peer.offlineNoted = true; chat.note(peer.userId, "They'll see this when they're back online."); }
    } catch (error) {
      const failure = error as Failure;
      const retry = {label: 'Retry', run: (row: HTMLElement) => { row.remove(); void deliver(peer, text, clientId); }};
      if (failure.status === 429) chat.note(peer.userId, `Slow down. Try again in ${failure.data?.retryAfter || 10}s.`, retry);
      else if (failure.status && failure.status < 500) chat.note(peer.userId, failure.message);
      // No status means it never arrived, and a 5xx may not have stored it. Either way the retry
      // reuses the client id, so the server keeps the message once.
      else chat.note(peer.userId, `Not sent: “${text}”`, retry);
    }
  }

  return {
    open(peer: Peer) { const known = conversation(peer); chat.open(known.userId, label(known)); },
    // ponytail: every open reloads the newest page instead of tracking what the log still holds.
    // One request per chip tap; worth caching only if people flick between many conversations.
    async opened(userId: string) {
      const peer = conversations.get(userId);
      if (!peer) return;
      await load(peer, false);
      await markRead(userId);
    },
    older(userId: string) { const peer = conversations.get(userId); if (peer) void load(peer, true); },
    receive(message: StoredMessage, from?: Peer | null) {
      const peer = conversation(from && from.userId === message.from ? from : {userId: message.from, handle: null, name: 'Player'});
      chat.add(peer.userId, label(peer), [entry(message, peer)], {notify: true});
      if (chat.active(peer.userId)) void markRead(peer.userId);
    },
    send(userId: string, text: string) {
      const peer = conversations.get(userId);
      if (!peer) return false;
      void deliver(peer, text, crypto.randomUUID());
      return true;
    },
    async login() {
      try {
        const data = await api('/messages/unread');
        for (const thread of Array.isArray(data.threads) ? data.threads : []) {
          const peer = conversation({userId: thread.userId, handle: thread.handle, name: thread.name});
          chat.unread(peer.userId, label(peer), Number(thread.unread) || 0);
        }
      } catch { /* The chips come back at the next login. */ }
    },
    async block(userId: string) {
      const peer = conversations.get(userId);
      if (!peer || !confirm(`Block ${label(peer)}? They won't be able to message you.`)) return;
      try {
        await api('/blocks', {method: 'POST', body: JSON.stringify({userId})});
        chat.close(userId);
        conversations.delete(userId);
        options.toast('Blocked', `${label(peer)} can't message you any more.`);
      } catch (error) { chat.note(userId, (error as Error).message); }
    },
    report(userId: string) {
      const peer = conversations.get(userId);
      if (peer) options.report({userId: peer.userId, handle: peer.handle, name: peer.name});
    },
    reset() { for (const userId of [...conversations.keys()]) chat.close(userId); conversations.clear(); },
  };
}
```

- [ ] **Step 7: Run the harness, expect PASS** — `PLAYWRIGHT_PORT=5301 npx playwright test tests/private-messages-ui.spec.ts tests/chat-channels.spec.ts tests/chat-collapse.spec.ts > $SCRATCH/t11a.txt 2>&1; echo exit=$?` → exit 0.

- [ ] **Step 8: Wire the game** — in `src/main.ts`:
  1. After `import {setupFriends, type FriendEvent, type FriendState} from './friends';`:

```ts
import {setupHandleClaim} from './handles';
import {setupInbox, type Peer, type StoredMessage} from './inbox';
import {accountToken, clearStandIn, setStandInToken, standInTokenFor} from './account-token';
```

  2. Replace the `const chat = setupChat(...)` call with:

```ts
  const chat = setupChat((text, channel, to) => {
    // Stored conversations go over HTTP and survive a dropped socket; everything else is live.
    if (channel === 'pm') return !!to && inbox.send(to, text);
    if (!networkConnected || networkSocket?.readyState !== WebSocket.OPEN) return false;
    networkSocket.send(JSON.stringify({ type: 'chat', text, channel, to })); return true;
  }, () => { keys.clear(); resetStick(); dragging = false; }, {
    opened: userId => void inbox.opened(userId),
    older: userId => inbox.older(userId),
    block: userId => void inbox.block(userId),
    report: userId => inbox.report(userId),
  });
```

  3. In `setupFriends(...)`: change `if (friendsButton) friendsButton.hidden = !session || !!guestName;` to `if (friendsButton) friendsButton.hidden = !accountToken();`, and after the `onEvent` callback's closing `}` (before the final `);`) add the sixth argument:

```ts
  , (userId, handle, name) => {
    friendsUI.close(); inbox.open({userId, handle, name}); chat.open();
  }
```

  4. Directly after the `setupFriends(...)` statement:

```ts
  const handleClaim = setupHandleClaim(apiBase, handle => toast('Handle claimed', `Friends can find you as @${handle}.`, 5));
  const inbox = setupInbox(apiBase, chat.pm, {
    me: () => displayName(),
    toast: (title, body) => toast(title, body, 5),
    report: peer => openConversationReport(peer),
  });
```

  5. In the `join` message sent on socket open, add `standInToken: guestName ? standInTokenFor() || undefined : undefined,` after `name: guestName || undefined`.
  6. After the `if (message.type === 'welcome' && message.id) { ... }` line add:

```ts
        if (message.type === 'welcome' && message.id) {
          // Dev only: the server hands a guest a stand-in account for handles and stored messages.
          const standIn = (message as unknown as {standIn?: {token?: string}}).standIn;
          if (standIn?.token && guestName) { setStandInToken(standIn.token); void friendsUI.refresh(); }
          if (friendsButton) friendsButton.hidden = !accountToken();
          if (accountToken()) void inbox.login();
        }
        if (message.type === 'handle-required') {
          keys.clear(); resetStick(); dragging = false;
          handleClaim.require(String((message as unknown as {suggestion?: string}).suggestion || ''));
        }
        if (message.type === 'dm-new') {
          const pushed = message as unknown as {message?: StoredMessage; from?: Peer};
          if (pushed.message) { inbox.receive(pushed.message, pushed.from); chatPop(); }
        }
```

  7. Replace both remaining `friendsButton.hidden=!session||!!guestName;` / `friendsButton.hidden = !session || !!guestName;` with `friendsButton.hidden = !accountToken();` (the button creation line and `start()`).
  8. In `leaveCity()`, change `friendsUI.close(); clearGuest();` to `friendsUI.close(); inbox.reset(); clearStandIn(); clearGuest();`.
  9. In the report dialog template, after `<option value="chat">City chat</option>` add `<option value="dm">Private messages</option>`.
  10. Replace the report block from `let reportTargetId = '';` through the end of the `$('report-form').addEventListener('submit', ...)` handler with:

```ts
  let reportTargetId = '', reportAccountId = '';
  const reportSurface = $<HTMLSelectElement>('report-surface');
  const reportPrivacy = $('report-privacy').textContent || '';
  $('report-player').onclick = () => {
    closeOptions(); reportTargetId = selectedProfileId; reportAccountId = '';
    $('report-target').textContent = `You are reporting ${selectedName}.`;
    reportSurface.disabled = false; if (reportSurface.value === 'dm') reportSurface.value = 'behaviour';
    $('report-privacy').textContent = reportPrivacy;
    $<HTMLTextAreaElement>('report-note').value = '';
    reportDialog.showModal();
  };
  // A conversation is reported by account; the server attaches the recent messages itself.
  function openConversationReport(peer: Peer) {
    reportTargetId = ''; reportAccountId = peer.userId;
    $('report-target').textContent = `You are reporting ${peer.handle ? `@${peer.handle}` : peer.name} for private messages.`;
    reportSurface.value = 'dm'; reportSurface.disabled = true;
    $('report-privacy').textContent = 'Your recent private messages with them are attached, exactly as they were sent.';
    $<HTMLTextAreaElement>('report-note').value = '';
    reportDialog.showModal();
  }
  $('cancel-report').onclick = () => { reportDialog.close(); canvas.focus(); };
  reportDialog.addEventListener('cancel', event => { event.preventDefault(); reportDialog.close(); canvas.focus(); });
  reportDialog.addEventListener('keydown', event => event.stopPropagation());
  $('report-form').addEventListener('submit', () => {
    // The server decides whether this counts, who was in earshot and what gets stored;
    // the client only carries the reporter's answers across.
    const reason = $<HTMLSelectElement>('report-reason').value, note = $<HTMLTextAreaElement>('report-note').value;
    if ((reportTargetId || reportAccountId) && networkSocket?.readyState === WebSocket.OPEN) networkSocket.send(JSON.stringify(reportAccountId
      ? { type: 'report', surface: 'dm', userId: reportAccountId, reason, note }
      : { type: 'report', id: reportTargetId, surface: reportSurface.value, reason, note }));
    else toast('Report not sent', 'Reconnect to the city and try again.');
    reportTargetId = ''; reportAccountId = ''; canvas.focus();
  });
```

  (`openConversationReport` is a function declaration, so the `setupInbox` call above can name it; `reportDialog`, `reportSurface` and `reportPrivacy` exist by the time anyone clicks Report.)

- [ ] **Step 9: Type-check** — `npx tsc --noEmit > $SCRATCH/tsc11.txt 2>&1; echo exit=$?` → exit 0.

- [ ] **Step 10: Run the affected browser specs** — `PLAYWRIGHT_PORT=5301 npx playwright test tests/private-messages-ui.spec.ts tests/friends.spec.ts tests/handle-claim.spec.ts tests/chat-channels.spec.ts tests/chat-collapse.spec.ts tests/party-comms.spec.ts tests/guest.spec.ts > $SCRATCH/t11b.txt 2>&1; echo exit=$?` → exit 0.

- [ ] **Step 11: Commit** — `git add src/dm.ts src/social.ts src/style.css src/inbox.ts src/main.ts tests/private-messages-ui.spec.ts && git commit -m "feat: stored conversations in the chat strip with Block and Report" -m "Unread conversations appear as chips at login, older messages page in, a failed send keeps a retry with its client id, and reporting a conversation uses the dm surface." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

---

## Phase 5 — Tests

### Task 12: The browser journey against the real dev server

**Files:**
- Test: `tests/private-messages.spec.ts`

**Interfaces:**
- Consumes: everything above. The client under test is built against `ws://127.0.0.1:8199` (`playwright.config.ts`). Every other spec intercepts that socket; this one starts the real dev server (`ALLOW_GUESTS=true`, no `SUPABASE_*`) on 8199 behind it.
- The dev server only answers CORS for real origins, and `http://127.0.0.1:5301` is not one, so the spec routes HTTP to 8199 through Playwright and strips `Origin`. The WebSocket connects directly (the server does not check origins on upgrade).

- [ ] **Step 1: Write the spec** — `tests/private-messages.spec.ts`:

```ts
import {test, expect, type BrowserContext, type Page} from '@playwright/test';
import {spawn} from 'node:child_process';

const API = 'http://127.0.0.1:8199';

async function throughProxy(context: BrowserContext) {
  const cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS'};
  await context.route(`${API}/**`, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
    const headers = {...route.request().headers()};
    delete headers.origin;
    const response = await route.fetch({headers});
    return route.fulfill({response, headers: {...response.headers(), ...cors}});
  });
}

async function enter(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', {name: "Jom, let's go"}).click();
  await page.locator('#auth-guest').click();
  await page.locator('#guest-name').fill(name);
  await page.getByRole('button', {name: 'Enter as guest', exact: true}).click();
}

async function claim(page: Page, handle: string) {
  const dialog = page.getByRole('dialog', {name: 'Pick your @handle'});
  await expect(dialog).toBeVisible({timeout: 90000});
  await expect(page.locator('#handle-input')).toHaveValue(handle);
  await expect(page.locator('#handle-status')).toHaveText(`@${handle} is free.`);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', {name: 'Claim handle'}).click();
  await expect(dialog).toBeHidden();
}

test('claim a handle, find a friend, message them offline, see the unread chip on return, report and block', async ({browser}) => {
  test.setTimeout(420000);
  const server = spawn(process.execPath, ['server/index.mjs'], {env: {...process.env, PORT: '8199', ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SERVICE_ROLE_KEY: ''}, stdio: 'ignore'});
  const alyaContext = await browser.newContext();
  const badrulContext = await browser.newContext();
  try {
    await expect.poll(async () => { try { return (await fetch(`${API}/health`)).ok; } catch { return false; } }, {timeout: 30000}).toBe(true);
    await throughProxy(alyaContext);
    await throughProxy(badrulContext);
    const alya = await alyaContext.newPage();
    const badrul = await badrulContext.newPage();
    const badrulFrames: any[] = [];
    badrul.on('websocket', socket => socket.on('framesent', frame => { try { badrulFrames.push(JSON.parse(String(frame.payload))); } catch { /* binary */ } }));

    await enter(badrul, 'Badrul');
    await claim(badrul, 'badrul');
    await enter(alya, 'Alya');
    await claim(alya, 'alya');

    // Search by handle, then the existing friend request flow.
    await alya.locator('#open-friends').click();
    await alya.getByRole('searchbox', {name: 'Search players by handle'}).fill('@bad');
    const result = alya.locator('.friend-result', {hasText: '@badrul'});
    await expect(result).toContainText('Online');
    await result.getByRole('button', {name: 'Add friend'}).click();
    await expect(result.getByRole('button', {name: 'Pending'})).toBeDisabled();

    await badrul.locator('#open-friends').click();
    await badrul.locator('#friends-incoming').getByRole('button', {name: 'Accept'}).click();
    await expect(badrul.locator('#friends-list')).toContainText('Alya');
    await badrul.getByRole('button', {name: 'Close Friends'}).click();

    // Badrul leaves. The tab keeps its stand-in for when he comes back, like a returning account.
    await badrul.goto('about:blank');
    await alya.getByRole('searchbox', {name: 'Search players by handle'}).fill('badrul');
    await expect(result).toContainText('Offline', {timeout: 15000});
    await expect(result.getByRole('button', {name: 'Friends'})).toBeDisabled();
    await result.getByRole('button', {name: 'Message'}).click();
    await expect(alya.getByRole('dialog', {name: 'Friends'})).toBeHidden();
    await alya.locator('#chat-input').fill('Jumpa esok kat mamak');
    await alya.locator('#chat-input').press('Enter');
    const alyaLog = alya.locator('.chat-log:not([hidden])');
    await expect(alyaLog.locator('p[data-key]')).toContainText(['Jumpa esok kat mamak']);
    await expect(alyaLog.locator('.chat-note')).toHaveText(["They'll see this when they're back online."]);

    // Badrul returns: no claim screen, and the conversation is waiting with its count.
    await enter(badrul, 'Badrul');
    const chip = badrul.getByRole('button', {name: 'Private messages with @alya, 1 unread'});
    await expect(chip).toBeVisible({timeout: 90000});
    await expect(badrul.getByRole('dialog', {name: 'Pick your @handle'})).toBeHidden();
    await chip.click();
    await expect(badrul.locator('.chat-log:not([hidden])')).toContainText('Jumpa esok kat mamak');

    // Report from the conversation header: the dm surface, and the server attaches the messages.
    await badrul.getByRole('button', {name: 'Report @alya'}).click();
    await expect(badrul.locator('#report-player-dialog')).toBeVisible();
    await expect(badrul.locator('#report-surface')).toHaveValue('dm');
    await badrul.getByRole('button', {name: 'Send report'}).click();
    await expect.poll(() => badrulFrames.find(frame => frame.type === 'report')).toMatchObject({surface: 'dm', userId: expect.any(String)});
    expect(Object.keys(badrulFrames.find(frame => frame.type === 'report'))).not.toContain('evidence');

    // Block, and Alya's next message is refused without revealing why.
    badrul.once('dialog', dialog => void dialog.accept());
    await badrul.getByRole('button', {name: 'Block @alya'}).click();
    await expect(badrul.getByRole('button', {name: /Private messages with @alya/})).toHaveCount(0);
    await alya.locator('#chat-compose').click();
    await alya.locator('#chat-input').fill('Hello?');
    await alya.locator('#chat-input').press('Enter');
    await expect(alyaLog.locator('.chat-note').last()).toHaveText("You can't message this player.");
  } finally {
    await alyaContext.close();
    await badrulContext.close();
    server.kill();
  }
});
```

- [ ] **Step 2: Check nothing else holds 8199** — `lsof -iTCP:8199 -sTCP:LISTEN` → no output. If a sibling holds it, stop and report rather than killing it.

- [ ] **Step 3: Run** — `PLAYWRIGHT_PORT=5301 npx playwright test tests/private-messages.spec.ts > $SCRATCH/t12.txt 2>&1; echo exit=$?` → exit 0. If it fails, read the trace in `test-results/` before changing anything; a failure in entering the city is the environment (vite, `three` symlink), not this feature.

- [ ] **Step 4: Commit** — `git add tests/private-messages.spec.ts && git commit -m "test: browser journey for handles, search, stored DMs, report and block" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`

### Task 13: Verification

- [ ] **Step 1: Type-check and build** — `npx tsc --noEmit > $SCRATCH/tsc.txt 2>&1; echo exit=$?` → exit 0.

- [ ] **Step 2: Server specs** — `npx playwright test tests/account-delete.spec.ts tests/social-store.spec.ts tests/handles.spec.ts tests/messages.spec.ts tests/messages-socket.spec.ts tests/moderation-socket.spec.ts tests/guest.spec.ts tests/chat-integrity.spec.ts tests/party-comms.spec.ts tests/join-concurrency.spec.ts tests/single-session.spec.ts > $SCRATCH/server-specs.txt 2>&1; echo exit=$?`, plus `tests/friends.spec.ts` in the browser run. Record the pass and fail counts from the summary line.

- [ ] **Step 3: Browser specs** — with the 5301 vite verified: `PLAYWRIGHT_PORT=5301 npx playwright test tests/friends.spec.ts tests/handle-claim.spec.ts tests/private-messages-ui.spec.ts tests/private-messages.spec.ts tests/chat-channels.spec.ts tests/chat-collapse.spec.ts tests/chat-composer.spec.ts tests/profiles.spec.ts tests/guest.spec.ts tests/afk.spec.ts > $SCRATCH/browser-specs.txt 2>&1; echo exit=$?`. Any failure outside this feature is checked against unmodified `main` before it is called pre-existing.

- [ ] **Step 4: Graph** — `graphify update .` if `graphify-out/graph.json` exists.

- [ ] **Step 5: Report** — branch, commits, plan path, spec-to-commit map, real exit codes, migration path (not applied), and anything found contradictory.

---

## Self-review

**Spec coverage.**

| Spec requirement | Task |
| --- | --- |
| `player_handles`, rules, unique `lower(handle)`, reserved exact/prefix, permanence | 1 (schema), 3 (rules), 4 (`claimHandle` → `claimed`), 6 (routes) |
| Claim screen, pre-fill, lowest suffix from 2, live check, race → `taken` + suggestion, cannot be dismissed | 3, 6, 8 (`handle-required`), 9 |
| `game_messages` shape, `client_id` uniqueness, generated `pair`, both indexes, raw body | 1, 4, 7 |
| `player_blocks` | 1, 4, 7 |
| `player_reports` `dm` surface + `evidence`, never filtered | 1, 2, 7 (`reportFor`), 8 (socket report), 11 (dialog) |
| `OWNED_ROWS` five entries | 1 |
| HTTP with bearer token, anonymous rejected, socket only nudges | 6, 7, 8 |
| Every route in the table | 6, 7 |
| `dm-new` to recipient in any room, `handle-required` on welcome | 8 |
| Search: prefix, ≤20, handles only, `relation`, existing friend flow | 4, 6, 10 |
| Any account with a handle can be messaged | 7 (no friendship check) |
| Gates in order: ban/mute (own check), lockout, block (generic text), rate limit (429 `retryAfter`) | 7, 8 (`liveGame`) |
| Moderation lookup failure → 503 | 7 |
| Written then pushed; push failure harmless | 7 |
| Guests keep in-room DMs | 8 (test), unchanged `channel === 'dm'` path |
| Dev in-memory adapter for handles, messages, blocks, friendships; stand-in IDs; never with Supabase; one contract test on both | 4, 5, 8 |
| Client: search UI, conversations in strip, 30 + paging, offline note once, unread chips at login, open marks read, Block/Report header, retry with same `client_id` | 10, 11 |
| Server specs listed in the spec's Testing section | 1–8 |
| Browser journey | 12 |

**Deviations stated plainly, not hidden.**
- `POST /messages` also returns `online`; `dm-new` also carries `from`; `POST /handles/claim` can return `{error: 'claimed', handle}` when the account already has one. All three are additions the client needs; none changes a spec'd field.
- The Supabase half of the contract test runs against a PostgREST-shaped fake, and its friend RPCs mirror the SQL rather than execute it. No local Postgres or Docker is available to do better without the live database.
- On dev there is no `player_reports` table, so a DM report there answers "Could not file that report". Reports work where Supabase exists.
- The moderation console (`admin/`) does not yet display `evidence` or name the `dm` surface; the spec does not ask for it, so it is flagged rather than built.
