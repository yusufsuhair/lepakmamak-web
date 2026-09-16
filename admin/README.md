# LepakMamak admin

The production admin console runs at `admin.lepakmamak.my` behind Cloudflare Access. Access permits only `yusufmohdsuhair@gmail.com`; the Worker validates Cloudflare's signed JWT again before serving a page or action.

Supabase remains the moderation datastore only. It is not used for admin login.

Required Worker secrets: `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ADMIN_EMAIL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

Run `npm test`, `npm run build`, and `npm run deploy` from this directory.
