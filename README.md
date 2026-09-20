# LepakMamak

A Malaysian multiplayer browser game. Explore Kuala Lumpur, lepak at the mamak,
play table games, customise your character, chat, and drive around the city.
Built with TypeScript, Three.js, Vite and a Node.js WebSocket server.

## Run locally

Use Node.js 24 (minimum 22.12) and npm. No cloud account is needed for guest play.

```sh
git clone https://github.com/yusufsuhair/lepakmamak.git
cd lepakmamak
npm ci
cp .env.example .env.local
cp .env.server.example .env.server.local
npm run dev:server
```

In another terminal:

```sh
npm run dev
```

Open http://localhost:5173. Choose guest entry. Run two browser windows to try
multiplayer. The local server listens on 8120. Without Supabase, data is temporary
or stored in the browser; account-only features are unavailable. The frontend can
also run alone for offline exploration. Production builds retain local assets
unless you explicitly configure your own CDN.

## Documentation

- [Configuration](docs/CONFIGURATION.md): all environments, secrets, GM roles and feature switches.
- [Deployment](docs/DEPLOYMENT.md): Supabase, Railway, Cloudflare Pages/R2, voice and admin.
- [Admin console](admin/README.md): Cloudflare Access authentication and operator setup.
- [Open-source preparation](docs/OPEN_SOURCE.md): audit findings and maintainer publication steps.
- [Contributing](CONTRIBUTING.md), [security reports](SECURITY.md), [asset credits](THIRD_PARTY_NOTICES.md).
- [Versioning](VERSIONING.md) and [changelog](CHANGELOG.md).

## Architecture

| Directory | Purpose |
| --- | --- |
| `src/`, `public/` | Browser game, UI and runtime assets |
| `server/` | Authoritative multiplayer, moderation, shop and social APIs |
| `shared/` | Data and rules shared by browser and server |
| `supabase/migrations/` | Account-linked persistence, RLS, wallet and Wall storage |
| `admin/` | Separate Next.js moderation console behind Cloudflare Access |
| `scripts/` | Asset processing, local server and deployment commands |
| `art/`, `assets/` | Editable art sources and production tools |
| `ios/`, `android/`, `unity/` | Native wrappers and experimental Unity client; separate toolchains |

Hosting is optional for development. A full hosted installation uses Pages for
the browser, R2 for larger assets, Railway for one realtime process, Supabase for
Auth/database/Wall uploads, and optionally Cloudflare Realtime SFU for voice.
Stripe and AI providers are optional. Each fork uses its own accounts and resources.

## Development checks

```sh
npm run build
npm run preview
npm run test:config
npm --prefix admin ci
npx playwright install chrome
npm test
```

Playwright uses Google Chrome. `PLAYWRIGHT_PORT=5209 npm test` gives your test
server a separate port. Focused tests are documented in [CONTRIBUTING.md](CONTRIBUTING.md).
Live integration scripts are opt-in and require an isolated test deployment.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk or drive |
| Shift | Run |
| Click / tap nearby object | Interact |
| Space | Bike brake |
| Drag / scroll | Orbit / zoom camera |
| C | Re-centre camera |
| R | Recall emote |
| Escape | Settings |

Touch controls are available. Settings and background tabs do not pause shared rooms.

## License

Original project code is [ISC licensed](LICENSE). Third-party dependencies,
fonts, audio and other assets retain their own terms; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Brand names and logos do not imply
endorsement or grant trademark rights.
