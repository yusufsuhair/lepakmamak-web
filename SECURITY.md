# Security

Report vulnerabilities privately using the repository's GitHub **Security →
Report a vulnerability** form when enabled. If unavailable, ask the maintainer
for a private reporting channel without posting exploit details, credentials or
player data in a public issue. Include affected versions, minimal reproduction,
impact and suggested fixes. No response-time guarantee is implied.

Only the current maintained release is supported. Use a private development
installation for testing, not the live game or another player's account.

All `VITE_*` variables and public assets are downloadable. Service-role keys,
Stripe/OpenAI/DeepSeek secrets, Cloudflare tokens, webhook URLs and passwords
belong only in server secret stores or ignored local files. Supabase publishable
keys and resource identifiers are public configuration, not admin credentials.

If a secret is exposed, revoke/rotate it first, replace it in the affected
services, review provider logs and only then clean files/history. Deleting a file
or making a repository private does not revoke a leaked credential. Never attach
unredacted scanner reports or `.env` files to an issue.

Security boundaries include Supabase RLS/service-role separation, authoritative
realtime checks, exact origin allowlists, Cloudflare Access JWT verification,
trusted GM UUIDs and Stripe signature/idempotency checks. See
[CONFIGURATION.md](docs/CONFIGURATION.md) for current moderation and guest limitations.
