# Database setup for a fresh fork

**Do not run the SQL files one by one.** The Supabase CLI applies the migrations
in order and records which ones succeeded. The same command handles a new project
and later upgrades. You do not need a copy of the original game's database.

Guest-only local play needs **no database**; use the root README. Follow this guide
when you want accounts, persistent inventory, friends, Wall or moderation.

## Hosted Supabase: the normal fork setup

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
(tested with 2.111.0), and create an **empty Supabase project in your own account**.
From the repository root:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
npm run db:plan
npm run db:push
npm run db:status
```

The project ref is in your Supabase dashboard URL. `link` prompts for credentials
when needed; do not put passwords in Git. Check the displayed project and planned
migration list before `db:push`. Answer the CLI confirmation only for your project.
A fresh installation currently applies 17 files; future versions may add more.
`db:status` should show matching local/remote versions. Running `db:push` again
with no changes should report that the database is up to date.

These npm commands are aliases for the official CLI, not another migration system.
They use the project you explicitly linked. An ignored `supabase/.temp/` from a
previous checkout can retain a different link, so relink when changing projects.

### Connect the game

Get your project's URL, publishable key and service-role key from its dashboard.
Copy the env examples, then fill these values:

| Value | Frontend `.env.local` | Backend `.env.server.local` / Railway |
| --- | --- | --- |
| Project URL | `VITE_SUPABASE_URL` | `SUPABASE_URL` |
| Public publishable key | `VITE_SUPABASE_PUBLISHABLE_KEY` | `SUPABASE_PUBLISHABLE_KEY` |
| Private service-role key | **Never here** | `SUPABASE_SERVICE_ROLE_KEY` |

Use the **same project** for both sides. Restart the server and frontend after
editing env files. Set Auth Site URL / redirect URLs for your frontend, configure
email delivery for hosted use, then create an account through the game. Verify
the email before assigning its Auth UUID in `GM_USER_IDS`.

No seed accounts, default GM, passwords, real users, payment history or player
uploads are copied. The wallet creates its starter balance on first use. Shop
catalogs live in `shared/`; they do not need a database seed. SQL creates the
`social-wall` bucket automatically. SMTP, OAuth, API keys, GM configuration,
Cloudflare and Railway settings are configured separately; migrations do not
provision those services. Continue with [hosting](../docs/DEPLOYMENT.md).

## Fully local Supabase (optional)

Requires Docker running plus the CLI. This does not link or change a hosted project.

```sh
npm run db:start
supabase status
```

The first start creates the local stack and applies migrations. Copy its local
API URL and public/server keys into the env files above. Local email is captured
by the mail UI whose URL is printed by `supabase status`; use it to verify accounts.
The local project name is `lepakmamak`. Stop another stack or change local ports
if they are already occupied. Do not run `supabase init`: this repo already has
its configuration and migrations.

After pulling new commits:

```sh
npm run db:local
npm run test:db
```

`db:local` applies pending local migrations without deleting existing data.
`test:db` checks tables, RLS, RPC grants, wallet/payment idempotency, current pet
inventory, friends, messages and server writes. Its test users/data are rolled
back. It runs `psql` inside the **local** `supabase_db_lepakmamak` Docker
container; it cannot use a linked cloud database. If you rename `project_id`,
update the container name in the `test:db` npm command too.

To deliberately wipe disposable local data and rebuild from zero:

```sh
supabase db reset --local
npm run test:db
```

**Reset deletes local data. Never add `--linked` to this reset command.** Hosted
installs and upgrades use `db:push`, not reset. `supabase stop` stops the local
stack; the default preserves its database volume.

## Existing installation / troubleshooting

| Situation | Action |
| --- | --- |
| Upgrading an existing fork | Back up the DB, pull code, `db:plan`, `db:push`, `db:status`, then deploy backend/frontend |
| Empty migration plan | Normal if all versions are applied; use `db:status` to verify |
| Missing `player_handles`, `game_messages`, pets or analytics | Apply all pending migrations; do not cherry-pick individual SQL files |
| SQL Editor already used / “relation already exists” | Stop and compare schema plus migration history. Do not blindly run `migration repair` or delete tables |
| CLI cannot connect | Verify project link/database password and project availability; retry after resolving connectivity |
| API returns permission denied or features return 503 | Verify backend service-role key, project URL and migration status; do not disable RLS |
| Signup works but email does not arrive | Configure hosted SMTP or check the local mail UI; migrations do not send emails |

Keep historical migration filenames unchanged, including the first file's shorter
version identifier: deployed databases already recorded those IDs. Add a new
migration for changes; do not squash the history in an existing deployment. The
CLI handles ordering and skips completed versions. A single copy-pasted schema
file would lose that upgrade tracking.

Reference: [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).
