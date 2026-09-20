# LepakMamak admin console — design

Date: 2026-09-09
Status: approved, not yet implemented

## Purpose

A private operations console at `admin.lepakmamak.my` for the single admin account
(`admin@example.com`) to moderate user content and administer in-game currency.

The immediate driver: the Lepak Wall now accepts player photo uploads, explicit-image
screening is deployed but **inactive** until `OPENAI_API_KEY` is set on Railway, and the
Wall API only permits players to delete *their own* posts. There is currently no way to
remove another player's photo. That gap is the highest-value item in v1.

## Shape: task console, not a table editor

The console exposes purpose-built actions, not raw row editing.

Rejected: a generic table browser. Balances are money; a mistyped value in a raw editor is
a silent, unauditable corruption, and it would bypass the ledger the game already keeps.
Every state change here is a named action with a recorded reason.

## Architecture

Next.js app, deployed to Cloudflare, reading and writing Supabase **directly** using the
service-role key. The key is used only in server-side code (Route Handlers / Server
Actions) and must never be exposed to the browser or inlined into a client bundle.

The console deliberately does **not** proxy through the Railway realtime server. That
process is the authoritative game server holding every player's WebSocket, is explicitly
single-instance (`docs/performance-review.md`: room and chair ownership are process-local,
"do not add replicas yet"), and admin traffic should not share its uptime or event loop.
Everything the console needs is a Supabase read or write.

Trade-off accepted: the game server and the console both write the same tables. This is
made safe by routing all balance mutation through a single Postgres function (below), so
balance arithmetic has exactly one implementation.

## Authentication

Cloudflare Access sits in front of the entire subdomain, with a Google SSO policy
allowlisting only `admin@example.com`. Unauthorised requests are rejected at the
edge and never reach the application, so there is no login page, session store, or
password path to implement or get wrong.

Defence in depth: the app additionally validates the `Cf-Access-Jwt-Assertion` header
server-side on every request and rejects anything unsigned or carrying a different email,
so hitting the origin directly is not a bypass.

This must be configured **before the first deploy**, not retrofitted. The app has
production write access to money from its first commit.

## Modules (v1)

### 1. Wall moderation
List recent `social_posts` newest-first with author, text and image thumbnail. Delete
removes the row and the corresponding object from the `social-wall` storage bucket, using
the same two-step delete the player-facing path already performs (`server/wall.mjs` DELETE
handler). Deleting a post cascades to `social_post_likes` and `social_post_replies` via
existing foreign keys.

### 2. Player lookup and coins
Search players by display name or email (`auth.users` via the admin API). Show profile
metadata, `player_social_stats`, current `game_wallets.balance`, and the full
`game_currency_transactions` history.

Grant or deduct coins with a required typed reason. This calls the SQL function below —
never a direct balance write.

### 3. Chat moderation
Browse recent `chat_messages` with author and timestamp; delete individual messages.

### 4. Shop and orders
View `shop_orders` and `shop_inventory`; see a player's purchases; grant an inventory item
without a Stripe payment.

## Money safety

All balance mutation goes through one Postgres function:

```
admin_adjust_balance(target_user uuid, delta integer, reason text, note text)
```

It runs in a single transaction and:
- locks the player's `game_wallets` row,
- computes the new balance and rejects the call if it would go negative
  (`game_wallets.balance` has `check (balance >= 0)`),
- updates `game_wallets.balance` and `updated_at`,
- appends one `game_currency_transactions` row with the computed `balance_after`,
- returns the new balance.

Rationale: `balance_after` must be consistent with `balance`, and both the game server and
the console write these tables. Computing it in one place, inside a transaction, is the
only way that invariant survives concurrent writes.

This is not a new pattern: the schema already holds `game_wallet_credit_stripe`,
`game_wallet_claim_daily`, `game_wallet_get`, `game_shop_buy`, `shop_fulfill` and
`shop_refund`, all declared
`language plpgsql security definer set search_path = public`, returning `jsonb`, revoked
from `public, anon, authenticated` and granted execute to `service_role` only.
`admin_adjust_balance` must follow that same shape so money handling stays uniform.

## Schema changes required

1. `game_currency_transactions.reason` currently has
   `check (reason in ('starter','daily','purchase'))`. Extend with `'admin'`.
2. Add `game_currency_transactions.note text` for the admin's stated reason. Nullable, so
   existing rows and the game server's inserts are unaffected.
3. New `admin_audit_log` table: id, actor email, action, target table, target id, detail
   (jsonb), created_at. Every destructive or money-moving action writes one row.

No additional grants are needed. Verified against the existing migrations: `service_role`
already holds `all` on `game_wallets` and `game_currency_transactions`, `all` on
`shop_orders` and `shop_inventory`, and `select, insert, delete` on `chat_messages`,
`social_posts`, `social_post_likes` and `social_post_replies`.

The audit log is non-negotiable in v1. There is one admin today, but an unlogged money tool
is a bad foundation, and it is far cheaper to add now than to reconstruct history later.

## Deployment

- Separate Cloudflare project from the game, so a broken admin deploy cannot affect
  `lepakmamak.my`.
- `admin.lepakmamak.my` DNS record pointing at that project, protected by the Access policy.
- Secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) as project environment bindings,
  never in the repo. `.env.production` in this repo holds **public** frontend settings only.
- The Next.js-on-Cloudflare adapter should be selected by checking the currently
  recommended option at build time rather than assumed here; that ecosystem moves quickly.

## Testing

- Playwright against the console with a mocked Supabase client, following the fake-client
  pattern already used in `tests/wall.spec.ts`.
- A direct test of `admin_adjust_balance` asserting the core invariant: after a grant, a
  deduction, and a rejected overdraft, `game_wallets.balance` equals the latest
  `balance_after`, and the rejected overdraft wrote no ledger row.
- A test that a request without a valid Access assertion is refused.

## Out of scope for v1

- Multiple admins or a role system. The email allowlist is the authorisation model.
- Player bans. No ban table exists; that is its own design.
- Editing Wall post text, or any content mutation beyond deletion.
- Analytics and dashboards.

## Open items

- Shop item grants append to the audit log too, since inventory carries cash value. Settled
  during review; noted here because it was raised as a question.
