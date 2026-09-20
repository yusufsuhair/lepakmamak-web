# LepakMamak admin

A separate Next.js/OpenNext Worker for moderation, reports, audit and currency
operations. Cloudflare Access handles login; Supabase is the datastore. GM status
inside the game does not grant access here.

1. Run `npm ci` in this directory.
2. Change the Worker name and `admin.example.com` route in `wrangler.jsonc` to your
   own admin hostname. Keep `workers_dev=false` and `preview_urls=false`.
3. In Cloudflare Zero Trust, create a self-hosted Access application for that
   hostname. Allow only the operator email you control. Record its AUD and team
   domain. Require your chosen identity provider / MFA policy.
4. Configure these Worker secrets with `npx wrangler secret put NAME`:

   | Secret | Value |
   | --- | --- |
   | `CF_ACCESS_TEAM_DOMAIN` | Your team name or `your-team.cloudflareaccess.com` |
   | `CF_ACCESS_AUD` | The Access application's audience tag |
   | `ADMIN_EMAIL` | Exact email allowed by both Access and the Worker |
   | `SUPABASE_URL` | Your game's Supabase project |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key for that project |

   If the Worker does not exist yet, provision it or set these in its dashboard
   after the first deploy; requests without the configuration fail closed.
5. Run `npm test`, `npm run build`, then `npm run deploy` from `admin/`.
6. Verify signed-out requests require Access login, the allowed identity works,
   and a different account / missing or forged assertion is rejected. Test against
   your development database first. The Worker verifies signed JWTs again on pages
   and actions; hiding a hostname is not authorization.

For Workers preview copy `.dev.vars.example` to `.dev.vars`, fill your development
values and run `npm run preview`. Direct localhost requests without a valid Access
assertion are denied; tests use signed fixtures instead of a login bypass.
`npm run dev` runs Next locally; provide server variables separately for that mode.

Reference: [Access self-hosted apps](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
and [JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
