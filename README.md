# LepakMamak

A Malaysian multiplayer browser game. Explore Kuala Lumpur, hang out at Mamak Maju, customise your character, chat with friends, and ride bikes or cars.

## Local version control

Git is already initialized on `main`, with no remote. See [VERSIONING.md](VERSIONING.md) for local commits, semantic versions and release tags, and [CHANGELOG.md](CHANGELOG.md) for release notes. The version in `package.json` is shared by Settings and the realtime health endpoint. Commits and tags do not deploy or push anything.

## Live deployment

Primary domain: https://lepakmamak.my/.
Cloudflare fallback: https://lepakmamak.pages.dev/
Both domains serve the same app and share Supabase accounts and Railway rooms. Sessions and local earnings are browser-origin-specific. The former lepak-city.pages.dev address remains available for existing links.

The frontend is hosted on Cloudflare Pages and the realtime room service runs on Railway. The game still keeps earnings in the current browser's local storage; the shared room is temporary and does not need a database yet.

To publish a new frontend version using the authenticated Cloudflare account:

```sh
npm run deploy
```

This builds `dist/` and uploads it to the `lepakmamak` Pages project on its `main` production branch. Configuration is in `wrangler.jsonc`; `public/_headers` controls static asset caching. The custom domain is associated in Pages and has a proxied apex CNAME to lepakmamak.pages.dev. Assigned nameservers: justin.ns.cloudflare.com and sneh.ns.cloudflare.com. Deployment is a direct upload, so commits alone do not trigger a release. Do not commit Cloudflare credentials.

The realtime server is optional for local development. Persistent storage can be introduced later for accounts and cross-device progress; it is not required for temporary rooms or recall emotes.

## Multiplayer preview

Multiplayer is enabled in production. The Cloudflare frontend connects to `wss://lepak-city-realtime-production.up.railway.app/ws` and places signed-in players in the shared `kampung` room. The HUD shows `CITY ONLINE` only after the server verifies the account. Players have display names above their avatars. Open City chat to talk to everyone in the room. An optional `?room=my-friends` URL puts players using that same link in a separate room (room names are not access controls). Press `R`, or tap `RECALL` on a phone, to send the recall emote; nearby players hear the buzz.

The in-game Lepak Wall is a public city feed for signed-in players. Registered accounts can publish filtered text, JPG/PNG/WebP photos up to 4 MB, and voice notes up to 30 seconds or 1.5 MB. Railway verifies account tokens and owns all database and Storage writes. Supabase persists the latest posts and serves public Wall media.

The realtime service has a `/health` endpoint and uses temporary in-memory state. A Railway restart clears the room; chat is not stored. The browser sends its Supabase access token for join verification; the server broadcasts display names and movement, never emails or tokens. Earnings remain local.

### Watching the realtime service

`GET /health` reports what the instance is doing right now: open `sockets`, `players`, a `rooms` array with the socket count and outbound bytes per second for each room, `bytesInPerSecond` and `bytesOutPerSecond`, `voicePacketsInPerSecond` and `voicePacketsOutPerSecond`, `droppedFramesPerSecond`, `residentMegabytes` and `uptimeSeconds`. Rates cover the last completed second. Byte counts are WebSocket payload bytes, so they read a few percent under what Railway bills.

`saturated` turns true after several consecutive seconds in which the server dropped frames because a socket was too far behind to take them. `/health` still answers HTTP 200 while saturated. Railway's `healthcheckPath` is unset today, but if it is ever pointed here a 503 would restart the instance and wipe the rooms it was complaining about, and the test suite already reads the status code as readiness. The body's `ok` field is the one that goes false.

Alerting is off until these are set on Railway:

| Variable | What it does |
| --- | --- |
| `ALERT_WEBHOOK_URL` | POSTed `{"content":…,"text":…}` when saturation starts, when it clears, and when the process is going down. Works as-is with a Discord or Slack webhook. |
| `HEARTBEAT_URL` | Pinged every `HEARTBEAT_SECONDS` (default 60). Point it at a dead-man's-switch service: a process that has already died cannot page anybody, so only a missing heartbeat catches a hard kill. |
| `ALERT_BYTES_PER_SECOND` | Optional second saturation trigger. Off by default, because nobody has measured what this instance actually tops out at. |
| `ALERT_SAMPLES` | Seconds a condition must hold before it pages, and before a recovery counts. Default 5. |

## Accounts

The existing Supabase project (`sbzvvhzibqpozqvojzhe`, dashboard label `LepakCity`) stores accounts. Registration asks for a display name, email, and password (minimum 8 characters). Supabase handles passwords and sessions. Railway verifies access tokens through Supabase Auth before joining; it derives the display name from the verified user, not the join payload. Display names are cosmetic and are not unique identity or authorization markers. Log out is in settings. Existing project identifiers, realtime hostname, and the `lepak-city-save` storage key are retained for compatibility.

Email confirmation is disabled for the initial friends MVP, so email ownership is unverified. Custom SMTP is not configured: password-reset delivery through Supabase's default mail service is limited and is not production-ready. Configure SMTP and test recovery before relying on email recovery or enabling confirmation. No application tables or RLS policies are needed for this release; auth records remain managed by Supabase.

Frontend public settings are in `.env.production`. Railway requires `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; it fails startup without them. Guest entry is absent from production builds; local development servers still require the explicit `ALLOW_GUESTS=true` alternative. Never place a secret or service-role key in frontend settings.

WebSocket connections are capped before any Supabase work is reached, so an anonymous caller cannot spend the auth quota or exhaust file descriptors: `WS_MAX_CONNECTIONS` (default ten rooms' worth) is the ceiling that holds regardless of what headers claim, and `WS_MAX_PER_ADDRESS` (default 64) stops a single host taking the whole server. The per-address share is read from the leftmost `X-Forwarded-For` entry, which a caller can forge — that only costs them the per-address cap, whereas reading the rightmost entry would collapse every player onto one key if the proxy chain ever gained a hop. Raise `WS_MAX_PER_ADDRESS` if legitimate players ever share one address. Unauthenticated Wall profile reads are capped separately at 30 per address per minute, since each one spends a Supabase admin call.

Wall photo uploads are screened for explicit content through OpenAI's free `omni-moderation-latest` endpoint, which requires `OPENAI_API_KEY` on Railway. The check runs on the decoded bytes before the upload reaches the public bucket, and it fails closed: without the key, or while the endpoint is unreachable, photo posts are rejected rather than published unchecked. Local development can set `ALLOW_UNMODERATED_IMAGES=true` to post photos without a key; it is the only way to reopen that path and does not belong on Railway. Text and voice notes are unaffected. The image path does not cover `sexual/minors`, which that endpoint scores for text only; hash-matching against a service such as PhotoDNA remains the answer for that category.

`node tests/online-smoke.mjs` tests production-built UI served on port 4173 against real services. `TEST_BASE_URL=https://lepakmamak.pages.dev node tests/online-smoke.mjs` tests the live UI. It uses the authenticated Supabase CLI to delete only its temporary accounts and uses an isolated test room. It checks signup, login/logout, incorrect passwords, session restoration, desktop/mobile chat, and unauthenticated rejection.

To redeploy the realtime service from this repository, run `npm run deploy:realtime` while authenticated with Railway. The service listens on Railway's `PORT` and exposes WebSockets at `/ws`.

## Run locally

Requires Node.js 22.12+ (developed with Node 24).

```sh
npm install
npm run dev
```

Open http://localhost:5173. The browser renders the 3D world locally with WebGL. No account, API key, remote models, or paid services are required.

```sh
npm run build   # Typecheck and produce dist/
npm run preview
npm test        # Physics/mission tests + Chrome browser gameplay tests
```

The test suite uses an installed Google Chrome through Playwright. On a machine without Chrome, install it or configure Playwright to use its bundled Chromium browser.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk; accelerate, reverse and steer the bike |
| Shift | Run |
| E | Reserved for future actions; click or tap a nearby object to interact |
| Space | Brake on the bike |
| Drag | Orbit the camera |
| Scroll | Adjust camera distance |
| C | Re-centre the camera |
| R | Spam the recall emote (`bzz bzz bzz bzzz`) |
| Escape | Pause and settings |

Touch devices get directional and interaction buttons. Desktop with a keyboard is the primary target. Pause settings offer rain, engine sounds, shadows, and a return-to-mamak recovery action.

## What's implemented

- Connected 3D streets, KLCC-inspired twin towers and park, mamak, shophouses, trees, Malaysian flags, road markings, and local signage.
- Third-person movement, arcade kapcai driving, wall/furniture/vehicle collision, moving cars, and pedestrians.
- A repeatable delivery mission with a map, world beacon, contextual prompts, and RM 25 payouts.
- Earnings and completed-delivery count in browser local storage. Active mission and position reset on reload.
- Live 3D title screen, responsive HUD, keyboard/touch controls, settings menu, and graphics error fallback. Settings do not pause the simulation or multiplayer. Losing focus clears held input without pausing; browsers may throttle rendering in background tabs.
- Valid signed-in sessions enter the city automatically on open or refresh; visitors without a session remain on the title and account flow.
- Local looping background music from `public/background-short.mp3`; it starts after the player gesture, continues through settings and focus changes, and follows the Music & city sounds setting.
- Proximity audio around both mosques from the optimized local `public/arrahman.mp3`, fading smoothly to silence outside their grounds and following the City sounds setting.
- Proximity hawker voice around the street booths from the local `public/duasinggit.mp3`, fading smoothly by distance and following the City sounds setting.
- A multiplayer recall emote with a mobile button, keyboard shortcut, short synthesized buzz sequence, local pulse animation, and room-wide WebSocket broadcast.
- Procedural models and locally bundled fonts; static scene geometry merged by material.

## Project structure

- `src/world.ts`: procedural environment, people, and vehicles.
- `src/main.ts`: scene, simulation, camera, input, audio, weather, and interface.
- `src/physics.ts`: substepped collision and safe dismount placement.
- `src/mission.ts`: delivery state and rewards.
- `src/style.css`: start screen, HUD, and responsive controls.
- `server/index.mjs`: Railway WebSocket room service and health endpoint.
- `server/metrics.mjs`: live traffic counters behind `/health`, and the saturation and shutdown alerts.
- `server/moderation.mjs`: reports, mutes and bans, read from and written to Supabase.
- `admin/`: the moderation console, behind Cloudflare Access.
- `tests/`: collision and mission tests, desktop delivery end-to-end test, mobile UI smoke test.
- `PLAN.md`: scope and next milestones.

## Current limits and next steps

This is the first playable slice, not a full GTA-scale game. Traffic follows simple routes, pedestrians are ambient, and the bike uses arcade movement rather than rigid-body physics. Multiplayer synchronises movement, text chat, and recall emotes; missions, earnings, and collisions remain local to each browser. There is no combat, police pursuit, or persistent world state. Accounts persist in Supabase. Mobile UI is tested in browser emulation; performance on physical phones still needs validation.

Next: improve the player/bike animations and street detail, replace selected procedural models with Blender-exported GLB assets, then expand the mission variety. Keep the first delivery playable as assets improve.

### Room voice chat

Mic and speaker buttons are independent and start off. Enabling the mic requests browser permission; disabling it stops its media tracks. Disconnecting or logging out stops capture and requires fresh opt-in after reconnecting. Speaker mute affects player voice only, not game music.

The first version relays transient mono 16 kHz PCM audio in 40 ms frames over the existing authenticated WSS connection. No audio is saved. Server routing uses the authenticated player and current room, excludes the sender, sends audio only within 15 metres (full volume inside 5 metres, fading outward), honors listener mute, limits audio packet rate, and drops packets for slow sockets. This avoids extra voice services and TURN setup for the initial small hangouts. TCP can add delay on poor connections, and PCM uses more bandwidth than Opus; move to a WebRTC SFU for larger voice crowds. Browser/OS background suspension can interrupt audio despite the game not deliberately pausing.

`tests/voice.spec.ts` uses generated browser audio to test playback between two clients, permission handling, independent mute, and capture cleanup. `tests/online-smoke.mjs` also checks playback through production using temporary accounts and a private test room.

## Moderation

Report → review → enforce.

**Report.** Right-click or long-press a player, choose **Report player**, pick what happened
and where. The server decides what is stored: who was reported, the room, the surface, the
reason, the reporter's note, and the names of players who were within hearing distance at
the time. Voice is never recorded, so those witness names are what makes a voice report
reviewable at all — there is no clip to replay, only people who can be asked. Chat reports
need nothing extra stored, because the room's public chat history already exists and the
console reads a five-minute window around the report out of it.

**Review.** `admin/` at **/reports**, behind Cloudflare Access, restricted to `ADMIN_EMAIL`.
Each report shows its evidence and offers mute, ban or dismiss. Every action is written to
`admin_audit_log` *before* it takes effect, so a decision that cannot be logged does not
happen.

**Enforce.** Penalties live in `player_bans` in Supabase, one row per account.

- A **ban** is refused at the socket during `join`, so it survives reconnects and Railway
  restarts — rooms are in-memory and are wiped, the ban is not.
- A **mute** is refused at a single gate in `server/index.mjs` covering every verb that
  carries a player's words, voice, drawing or display name to somebody else, plus a matching
  check on the Wall's HTTP routes, which never touch the socket. Nothing is enforced in the
  client.
- A penalty applied while the player is already in the city is picked up by a 15-second
  sweep, which refreshes mutes and disconnects bans.
- A mute is time-boxed and expires by itself; a ban has no expiry and has to be lifted by
  hand.

### Deploying this

**Apply the migration before deploying the realtime server.** The Wall's check fails
closed, so if `player_bans` does not exist yet every Wall post answers 503 until it does.
The admin console additionally needs `SUPABASE_SERVICE_ROLE_KEY`, `CF_ACCESS_TEAM_DOMAIN`,
`CF_ACCESS_AUD` and `ADMIN_EMAIL`.

### Child safety — this does not stop at the console

Muting and banning an account does nothing about material that is already out there, and
nothing about the legal duty to report it. **Anything involving a child goes to Yusuf
directly, and out of the product.** The report queue has a `child-safety` reason so those
reports arrive labelled rather than buried under "other", but arriving labelled is all it
does. Handling them properly needs hash-matching against a known-material database
(PhotoDNA or an equivalent) and a reporting route to the authorities. Neither exists here,
and neither is a filter or a prompt.

### What this does not cover

- **Guests have no account, so they cannot be banned.** `ALLOW_GUESTS` is off in production
  and this design assumes it stays off. Turning it on reopens the hole.
- **Bans are per account, not per person.** A new sign-up is a new account.
- Communications and Multimedia Act 1998 s.233 and MCMC takedown expectations apply to what
  the game broadcasts; the audit log is what lets us say who acted and when.

## Syiling Lepak shop

Open **Settings → Kedai · Skins & Accessories**. Every registered account starts with 500 Syiling Lepak and can claim another 100 every 24 hours. Spectacles, caps and Malaysian outfit skins are permanent account unlocks; owned items can be equipped at any time and appear to other players.

Wallet creation, daily rewards and purchases run through service-role-only Supabase functions. Purchases lock the wallet row, verify the catalog price in the database, prevent duplicate ownership and record an audit transaction before returning the new balance. Browser writes to wallets, transactions and inventory are denied by RLS. Signed-in players can top up Syiling Lepak through Stripe-hosted Checkout; the server verifies the Checkout Session and uses its unique Stripe ID to prevent duplicate credits.

Apply `supabase/migrations/202609080001_shop.sql` followed by `supabase/migrations/20260908134952_game_currency_shop.sql` when setting up a new environment. The Railway server only needs the existing Supabase service-role configuration for this shop.

`npx playwright test tests/shop.spec.ts` checks authorization, currency purchase responses, daily rewards and skin equipment without using a real account.
