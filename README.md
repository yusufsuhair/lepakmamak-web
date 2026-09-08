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

The realtime service has a `/health` endpoint and uses temporary in-memory state. A Railway restart clears the room; chat is not stored. The browser sends its Supabase access token for join verification; the server broadcasts display names and movement, never emails or tokens. Earnings remain local.

## Accounts

The existing Supabase project (`sbzvvhzibqpozqvojzhe`, dashboard label `LepakCity`) stores accounts. Registration asks for a display name, email, and password (minimum 8 characters). Supabase handles passwords and sessions. Railway verifies access tokens through Supabase Auth before joining; it derives the display name from the verified user, not the join payload. Display names are cosmetic and are not unique identity or authorization markers. Log out is in settings. Existing project identifiers, realtime hostname, and the `lepak-city-save` storage key are retained for compatibility.

Email confirmation is disabled for the initial friends MVP, so email ownership is unverified. Custom SMTP is not configured: password-reset delivery through Supabase's default mail service is limited and is not production-ready. Configure SMTP and test recovery before relying on email recovery or enabling confirmation. No application tables or RLS policies are needed for this release; auth records remain managed by Supabase.

Frontend public settings are in `.env.production`. Railway requires `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; it fails startup without them. `ALLOW_GUESTS=true` is an explicit local-development alternative. Never place a secret or service-role key in frontend settings.

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
| E | Collect/deliver an order, mount/dismount the bike |
| Space | Brake on the bike |
| Drag | Orbit the camera |
| Scroll | Adjust camera distance |
| C | Re-centre the camera |
| R | Spam the recall emote (`bzz bzz bzz bzzz`) |
| Escape | Pause and settings |

Touch devices get directional and interaction buttons. Desktop with a keyboard is the primary target. Pause settings offer rain, engine/delivery sounds, shadows, and a return-to-mamak recovery action. Returning to the mamak preserves an active order and earnings.

## What's implemented

- Connected 3D streets, KLCC-inspired twin towers and park, mamak, shophouses, trees, Malaysian flags, road markings, and local signage.
- Third-person movement, arcade kapcai driving, wall/furniture/vehicle collision, moving cars, and pedestrians.
- A repeatable delivery mission with a map, world beacon, contextual prompts, and RM 25 payouts.
- Earnings and completed-delivery count in browser local storage. Active mission and position reset on reload.
- Live 3D title screen, responsive HUD, keyboard/touch controls, settings menu, and graphics error fallback. Settings do not pause the simulation or multiplayer. Losing focus clears held input without pausing; browsers may throttle rendering in background tabs.
- Local looping background music from `public/background-short.mp3`; it starts after the player gesture, continues through settings and focus changes, and follows the Music & city sounds setting.
- A multiplayer recall emote with a mobile button, keyboard shortcut, short synthesized buzz sequence, local pulse animation, and room-wide WebSocket broadcast.
- Procedural models and locally bundled fonts; static scene geometry merged by material.

## Project structure

- `src/world.ts`: procedural environment, people, and vehicles.
- `src/main.ts`: scene, simulation, camera, input, audio, weather, and interface.
- `src/physics.ts`: substepped collision and safe dismount placement.
- `src/mission.ts`: delivery state and rewards.
- `src/style.css`: start screen, HUD, and responsive controls.
- `server/index.mjs`: Railway WebSocket room service and health endpoint.
- `tests/`: collision and mission tests, desktop delivery end-to-end test, mobile UI smoke test.
- `PLAN.md`: scope and next milestones.

## Current limits and next steps

This is the first playable slice, not a full GTA-scale game. Traffic follows simple routes, pedestrians are ambient, and the bike uses arcade movement rather than rigid-body physics. Multiplayer synchronises movement, text chat, and recall emotes; missions, earnings, and collisions remain local to each browser. There is no combat, police pursuit, moderation, or persistent world state. Accounts persist in Supabase. Mobile UI is tested in browser emulation; performance on physical phones still needs validation.

Next: improve the player/bike animations and street detail, replace selected procedural models with Blender-exported GLB assets, then expand the mission variety. Keep the first delivery playable as assets improve.

### Room voice chat

Mic and speaker buttons are independent and start off. Enabling the mic requests browser permission; disabling it stops its media tracks. Disconnecting or logging out stops capture and requires fresh opt-in after reconnecting. Speaker mute affects player voice only, not game music.

The first version relays transient mono 16 kHz PCM audio in 40 ms frames over the existing authenticated WSS connection. No audio is saved. Server routing uses the authenticated player and current room, excludes the sender, sends audio only within 15 metres (full volume inside 5 metres, fading outward), honors listener mute, limits audio packet rate, and drops packets for slow sockets. This avoids extra voice services and TURN setup for the initial small hangouts. TCP can add delay on poor connections, and PCM uses more bandwidth than Opus; move to a WebRTC SFU for larger voice crowds. Browser/OS background suspension can interrupt audio despite the game not deliberately pausing.

`tests/voice.spec.ts` uses generated browser audio to test playback between two clients, permission handling, independent mute, and capture cleanup. `tests/online-smoke.mjs` also checks playback through production using temporary accounts and a private test room.

## Syiling Lepak shop

Open **Settings → Kedai · Skins & Accessories**. Every registered account starts with 500 Syiling Lepak and can claim another 100 every 24 hours. Spectacles, caps and Malaysian outfit skins are permanent account unlocks; owned items can be equipped at any time and appear to other players.

Wallet creation, daily rewards and purchases run through service-role-only Supabase functions. Purchases lock the wallet row, verify the catalog price in the database, prevent duplicate ownership and record an audit transaction before returning the new balance. Browser writes to wallets, transactions and inventory are denied by RLS. No real-money checkout is used.

Apply `supabase/migrations/202609080001_shop.sql` followed by `supabase/migrations/20260908134952_game_currency_shop.sql` when setting up a new environment. The Railway server only needs the existing Supabase service-role configuration for this shop.

`npx playwright test tests/shop.spec.ts` checks authorization, currency purchase responses, daily rewards and skin equipment without using a real account.
