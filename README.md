# Lepak City

A playable, stylised Kuala Lumpur browser prototype. Start at Mamak Maju, collect an order, hop on your kapcai, and deliver it near the twin towers. Earn RM 25, then explore or return for another job.

## Live deployment

Production URL: https://lepak-city.pages.dev/

The frontend is hosted on Cloudflare Pages and the realtime room service runs on Railway. The game still keeps earnings in the current browser's local storage; the shared room is temporary and does not need a database yet.

To publish a new frontend version using the authenticated Cloudflare account:

```sh
npm run deploy
```

This builds `dist/` and uploads it to the `lepak-city` Pages project on its `main` production branch. Configuration is in `wrangler.jsonc`; `public/_headers` controls static asset caching. Deployment is a direct upload, so commits alone do not trigger a release. Do not commit Cloudflare credentials.

The realtime server is optional for local development. Persistent storage can be introduced later for accounts and cross-device progress; it is not required for temporary rooms or recall emotes.

## Multiplayer preview

Multiplayer is now enabled in production. The Cloudflare frontend connects to `wss://lepak-city-realtime-production.up.railway.app/ws` and places players in the shared `kampung` room. The HUD shows `CITY ONLINE` and the player count when the connection is healthy; remote players appear as moving avatars in the same streets. Press `R`, or tap `RECALL` on a phone, to send the four-beat `bzz bzz bzz bzzz` recall emote to everyone in the room.

The realtime service has a `/health` endpoint and uses temporary in-memory state. A Railway restart clears the room, which is expected until accounts or persistent world state are added. The browser does not send earnings or personal information to the service.

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
- Live 3D title screen, responsive HUD, keyboard/touch controls, pause on window blur, and graphics error fallback.
- Local looping background music from `public/background-short.mp3`; it starts after the player gesture, pauses with the game, and follows the Music & city sounds setting.
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

This is the first playable slice, not a full GTA-scale game. Traffic follows simple routes, pedestrians are ambient, and the bike uses arcade movement rather than rigid-body physics. Rain is visual. Sound is a synthesised engine, delivery chimes, background music, and recall buzzes. Multiplayer currently synchronises temporary room movement and recall emotes; missions, earnings, and collisions remain local to each browser. There is no combat, police pursuit, moderation, authentication, or persistent account system. Mobile UI is tested in browser emulation; performance on physical phones still needs validation.

Next: improve the player/bike animations and street detail, replace selected procedural models with Blender-exported GLB assets, then expand the mission variety. Keep the first delivery playable as assets improve.
