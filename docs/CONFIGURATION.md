# Configuration

Never put server credentials in `VITE_*`: Vite embeds these values in downloadable
JavaScript. Frontend changes require a rebuild; server changes require a restart.
No production credentials or deployment targets are supplied by this repository.

## Files and precedence

| File | Consumer | Commit? |
| --- | --- | --- |
| `.env.example` → `.env.local` | Local Vite frontend | Example only |
| `.env.production.local` | Production frontend build | No |
| `.env.dev.local` | Development Pages build (`--mode dev`) | No |
| `.env.server.example` → `.env.server.local` | `npm run dev:server` | Example only |
| `.env.deploy.example` → `.env.deploy.local` | Deploy and CDN scripts | Example only |
| `admin/.dev.vars.example` → `admin/.dev.vars` | Local Workers preview | Example only |
| `.env.test.local` | Opt-in live test scripts | No |

Shell variables take precedence. Vite also reads its normal `.env` and mode files;
a `.env.development.local` left from a previous checkout overrides `.env.local` in
development. Remove stale local overrides when changing environments.
`npm start` loads no env file: set runtime variables on Railway or use Node's
`--env-file` explicitly. Deploy scripts load `.env.deploy.local`, not server secrets.

## Public frontend

| Variable | Meaning / default |
| --- | --- |
| `VITE_MULTIPLAYER_URL` | WebSocket server, e.g. `ws://localhost:8120` or `wss://city.example.com`; `/ws` suffix is optional |
| `VITE_SUPABASE_URL` | Your Supabase URL; blank disables account login |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public publishable key, never a service-role key |
| `VITE_ALLOW_GUESTS` | Literal `true` enables guests in built clients; Vite development also permits guests |
| `VITE_DEV_TOOLS` | Literal `true` shows development controls; leave false in public deployments |
| `VITE_CDN_BASE_URL` | Your CDN base URL, e.g. `https://assets.example.com/`; empty keeps assets local |
| `MIN_CLIENT_VERSION` | Build-process variable, default `0.0.0`; release refresh compatibility floor |

The build generates the multiplayer/CDN entries in `dist/_headers` from these
URLs. `public/_headers` is a template, not a finished hosting artifact. Supabase
and radio provider origins remain in its CSP; change those when using custom
provider domains. Do not remove the CSP to solve a configuration error.

## Realtime server / Railway

| Variable | Requirement / behavior |
| --- | --- |
| `PORT` | Railway supplies this; direct `npm start` defaults to 8080, local helper to 8120 |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Required for accounts; startup refuses missing values unless `ALLOW_GUESTS=true` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; required for persistent Wall, shop, social, moderation and analytics features |
| `ALLOW_GUESTS` | Literal `true` permits guests; direct production start defaults off |
| `ALLOWED_ORIGINS` | Comma-separated exact HTTP origins; replaces the local defaults. Include Pages/custom domains and native origins you actually use. No wildcard, path or trailing slash |
| `GM_USER_IDS` | Comma-separated Supabase Auth user UUIDs; blank grants no GM privileges |
| `ALLOW_DEV_TOOLS` | Development bot controls; false on public services. `RAILWAY_ENVIRONMENT_NAME=development` also enables them |
| `GUEST_SEATS` | Guest share of a room; default 60% of room capacity |
| `WS_MAX_CONNECTIONS` | Total connections; default ten rooms' worth |
| `WS_MAX_PER_ADDRESS` | Per-address connections; default two rooms' worth; forwarded IPs are not a security identity |
| `CF_SFU_APP_ID`, `CF_SFU_APP_SECRET` | Optional Cloudflare Realtime SFU credentials; server-only |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional payments; keep both on the server, use test-mode keys first |
| `DEEPSEEK_API_KEY` | Optional AI chat, preferred when both AI keys exist |
| `OPENAI_API_KEY` | Optional fallback AI chat and Wall image moderation |
| `ALERT_WEBHOOK_URL` | Optional saturation/recovery/shutdown webhook |
| `HEARTBEAT_URL`, `HEARTBEAT_SECONDS` | Optional external heartbeat; interval defaults to 60 seconds |
| `ALERT_BYTES_PER_SECOND`, `ALERT_SAMPLES` | Optional saturation threshold (off by default), consecutive sample count (default 5) |

With Supabase configured, guests have generated names and restrictions on chat,
voice publication and account features. A guests-only local instance is more
permissive: do not expose that development configuration as an account-backed city.
HTTP CORS is not authentication; WebSockets and APIs still verify account tokens.

Checkout redirects use an allowed HTTP(S) request origin, or the first HTTP(S)
origin in `ALLOWED_ORIGINS` for native clients. Put your primary web origin first.
There is no fallback to the original project's domain.

## Game Masters

1. Register the operator in **your** Supabase project and verify the email.
2. Copy the user's UUID from Supabase Authentication → Users.
3. Set `GM_USER_IDS=first-uuid,second-uuid` on the realtime server and restart it.
4. Sign in again and verify the GM badge, announcements and weather controls.
5. To revoke, remove the UUID and restart the server, disconnecting existing sessions.

Only the verified Auth `user.id` is allowlisted. Display names, email strings,
client messages and editable `user_metadata` cannot grant the role. Anonymous
users cannot be GMs. Badge fields saved on old chat/Wall records are historical
presentation, not current authorization. GM status does not grant admin-console
access or service-role access.

## Admin console

The Worker requires `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ADMIN_EMAIL`,
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Access JWT signature, issuer,
audience, age and exact admin email are verified server-side on requests. There
is no local login bypass. See [admin setup](../admin/README.md).

## Known operating behavior

- One realtime process owns rooms, games, rate limits and queues. Use one replica.
  Restarting clears rooms; persisted Supabase data survives.
- `/health` remains HTTP 200 during saturation; inspect `ok`/`saturated`, not only
  the status code. `/health/public` is the smaller public status response.
- Wall images are **allowed** when the moderation provider is unavailable or its
  key is absent; a successful explicit-content verdict rejects the photo. This
  is the existing availability policy, not a guarantee of screened uploads.
- AI chat sends recent room conversation to the selected provider. Wall uploads
  and profile content may be public. Review the shipped privacy/terms pages for
  your own operator, providers, retention, support details and payment policy.
