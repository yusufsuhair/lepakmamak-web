# Deploy your own installation

Use separate development and production resources. Commands below create or
change your own cloud resources; no deploy is part of `npm ci`, tests or builds.
Keep actual targets in ignored env files. Read [configuration](CONFIGURATION.md)
first. CLI login alone must never select a deployment target for this project.

## 1. Supabase

Create a new Supabase project. Copy its URL and public publishable key into your
frontend env, and its server-only service-role key into Railway/admin secrets.
Follow [database setup for a fresh fork](../supabase/README.md). The CLI applies
all migrations in order and records their versions; do not paste individual SQL
files into the dashboard.

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
npm run db:plan
npm run db:push
npm run db:status
```

Check the linked project before pushing. The guide covers hosted setup, optional
local Supabase, environment keys, upgrades and recovery from migration errors.
No player data, default accounts or secrets are seeded.

In hosted Auth settings, set your frontend Site URL and exact redirect URLs for
local, development and production clients. Configure SMTP and test signup,
verification and password recovery. Google login is optional: enable its provider
and configure the callback given by your Supabase project. Keep RLS and the SQL
function grants from the migrations. Do not grant browser roles service access.

Reference: [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations).

## 2. Railway realtime server

Create a project and service from your fork, rooted at this repository. The
checked-in `railway.json` uses `Dockerfile`, `npm start`, `/health`, and one replica.
The image contains server/shared code and production dependencies; it does not
contain env files, frontend builds or art. Set the runtime variables from
[CONFIGURATION.md](CONFIGURATION.md). Leave the injected `PORT` to Railway.

Generate an HTTPS domain for the service. Use it as
`VITE_MULTIPLAYER_URL=wss://YOUR_SERVICE_DOMAIN` when building the frontend.
Set `ALLOWED_ORIGINS` to the exact frontend origins (primary first). Keep
`ALLOW_DEV_TOOLS=false` in production and configure `GM_USER_IDS` explicitly.
If allowing guests, enable `ALLOW_GUESTS=true` before offering frontend guest entry.

For explicit CLI deployment, install/login to the Railway CLI, then:

```sh
cp .env.deploy.example .env.deploy.local
# Fill RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID and RAILWAY_ENVIRONMENT.
npm run deploy:realtime -- --dry-run
npm run deploy:realtime
```

This deploys **committed `main`**, from a temporary clean checkout. Commit first;
uncommitted work is not uploaded. Development uses `RAILWAY_DEV_SERVICE_ID` and
`RAILWAY_DEV_ENVIRONMENT` via `npm run deploy:realtime:dev`. The scripts fail when
the project/service is missing. `--dry-run` does not call Railway.

Verify `https://YOUR_SERVICE_DOMAIN/health`, then join with two clients. Deployment
health checks prove readiness; they do not replace uptime monitoring. Do not enable
multiple replicas or sleeping/serverless instances for persistent live rooms.

Optional Docker run (explicitly set `PORT=8080` in the supplied env file):

```sh
docker build -t lepakmamak-server .
docker run --rm --env-file .env.server.local -e PORT=8080 -p 8080:8080 lepakmamak-server
```

Reference: [Railway config as code](https://docs.railway.com/config-as-code/reference).

## 3. Cloudflare R2 assets

For local or ordinary static hosting, leave `VITE_CDN_BASE_URL` empty. Builds keep
`public/` assets. Pages limits individual assets to 25 MiB, so use R2 when an asset
exceeds that size; the deploy helper checks before uploading.
[Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

```sh
npx wrangler login
npx wrangler r2 bucket create YOUR_BUCKET
```

Attach your own R2 custom domain (e.g. `assets.example.com`) in Cloudflare. Edit
`scripts/cdn-cors.json` to allow your exact game origins, then apply it:

```sh
npx wrangler r2 bucket cors set YOUR_BUCKET --file scripts/cdn-cors.json
```

Set these in `.env.deploy.local`:

```dotenv
R2_BUCKET=YOUR_BUCKET
VITE_CDN_BASE_URL=https://assets.example.com/
CDN_ORIGIN=https://game.example.com
```

Upload/verify assets and save the content-hashed manifest:

```sh
node scripts/cdn.mjs
node scripts/cdn.mjs --check
```

Commit `src/cdn-manifest.json`. Also set the same `VITE_CDN_BASE_URL` in your
frontend build env if building outside the deploy script. The uploader verifies
content, Brotli encoding, MIME, CORS and audio ranges. It preserves old objects so
older client builds keep working. Changing the CDN base requires running the
uploader for the new bucket even when the content hashes are unchanged.

Reference: [R2 CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/).

## 4. Cloudflare Pages frontend

Create a Pages direct-upload project under your own account:

```sh
npx wrangler pages project create YOUR_PAGES_PROJECT --production-branch main
cp .env.example .env.production.local
```

Edit `.env.production.local`: use your `wss://` backend, Supabase public values,
guest policy and CDN base. Set `VITE_DEV_TOOLS=false`. Set `CF_PAGES_PROJECT` in
`.env.deploy.local`, then:

```sh
npm run deploy -- --dry-run
npm run deploy
```

The command verifies configured CDN assets, typechecks, builds, checks asset sizes,
and uploads to the named Pages project. It builds the **current working tree**.
Associate a custom domain in Pages and add both that domain and the Pages default
domain to Railway's `ALLOWED_ORIGINS`, Supabase Auth redirects and R2 CORS.
`dist/_headers` already contains the configured backend/CDN CSP origins.

For a separate dev frontend, use `.env.dev.local`, `CF_PAGES_DEV_PROJECT` and
`npm run deploy:dev`. Never point it at production Supabase by default. Keep all
resource IDs and secrets out of Git. Cloudflare CLI authentication or a scoped
account API token should identify your own account.

Reference: [Pages direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## 5. Optional services

- **Voice:** create a Cloudflare Realtime SFU app and set `CF_SFU_APP_ID` /
  `CF_SFU_APP_SECRET` on Railway. Test two clients over HTTPS, microphone consent,
  proximity, party scope and mute. `/health` reports `voiceTransport`. Without SFU
  credentials the existing legacy voice transport remains active.
- **Stripe:** use test credentials first. Send `checkout.session.completed` and
  `checkout.session.async_payment_succeeded` webhooks to
  `https://YOUR_SERVICE_DOMAIN/shop/webhook`. Configure the signing secret on
  Railway. Amounts/currency come from `shared/currency-packs.json`; credits use
  server RPCs and unique Checkout session IDs. Test duplicate delivery and refunds
  operationally before accepting real money; refund automation is not implemented.
- **AI:** set DeepSeek and/or OpenAI keys only on Railway. See the provider and
  moderation behavior in [configuration](CONFIGURATION.md).
- **Admin:** follow [admin/README.md](../admin/README.md), including Cloudflare Access
  before making the custom domain available.
- **Status page:** edit `health/config.json` to use your HTTPS `/health/public` URL,
  set `connect-src` in `health/_headers` to `'self'` plus that endpoint origin,
  change both game links in `health/index.html`, set `CF_PAGES_HEALTH_PROJECT`, then
  `npm run deploy:health`. The health API permits public reads.

## Fork branding and optional clients

Before launching a fork, update canonical/Open Graph/JSON-LD URLs in `index.html`,
`public/robots.txt`, `public/sitemap.xml`, and the operator/support details in
`public/privacy.html` and `public/terms.html`. If changing the inline JSON-LD,
recalculate its SHA-256 CSP hash in `public/_headers`. These are original-service
branding, not backend connection settings.

Native wrappers and the Unity experiment are optional. Review `capacitor.config.json`,
the iOS/Android application identifiers and signing, and `unity/wrangler.jsonc`
before using their separate build/deployment commands. They are not part of the
web setup or its deployment helpers.

## Existing maintainer deployment: migration before the next release

This preparation does not change live cloud resources. Before deploying it to an
existing installation:

1. Copy the former public build settings to ignored `.env.production.local`.
   That backup was preserved on the preparation machine. Remove stale `.env.production`
   once the new file is verified; neither file is tracked now.
2. Set explicit Pages/Railway/R2 targets in `.env.deploy.local`; restore the original
   CDN URL there and in build settings, then run the CDN upload/check for that base.
3. Set `GM_USER_IDS` using the actual operator's Auth UUID, and `ALLOWED_ORIGINS`
   with every supported frontend/native origin. The former email-based GM and
   original production origin defaults have been removed.
4. Restore the actual admin custom domain in your local Worker config. The old
   config is preserved as ignored `admin/wrangler.local.jsonc`; use it explicitly
   or copy it over `admin/wrangler.jsonc` locally before deploying. Review the diff
   before staging to keep operator details private.
5. Set the status page endpoint/game links, then run local checks and a separate
   development deployment before production.

For rollback, redeploy a known frontend build and backend commit with its matching
configuration. Back up Supabase before migrations; rolling back code does not undo
schema/data changes. Never delete old R2 objects while released clients still use them.
