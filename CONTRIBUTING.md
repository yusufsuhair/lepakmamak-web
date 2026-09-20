# Contributing

Start with the README local guest setup. Keep changes focused and use existing
modules and dependencies. Discuss large gameplay or architecture changes in an
issue before building them. Reports should include browser/device, reproduction
steps, expected behavior and relevant console errors, with tokens and player data
removed. Include screenshots for visual changes and steps to verify accessibility.

```sh
npm ci
npm --prefix admin ci
npm run build
npm run test:config
PLAYWRIGHT_PORT=5209 npx playwright test tests/roles.spec.ts tests/gm-aura.spec.ts tests/wall.spec.ts tests/shop.spec.ts tests/cdn.spec.ts
npm --prefix admin test
```

Install Chrome with `npx playwright install chrome` if needed. Run the relevant
existing gameplay tests for your change; `npm test` runs the full Playwright game
suite plus admin tests. Do not reuse another checkout's dev server. Some legacy
live/manual scripts are intentionally outside that suite.

Opt-in integration scripts (`tests/online-smoke.mjs`,
`scripts/verify-live-profile.mjs`) create/delete temporary users. They require
`.env.test.local` containing `TEST_BASE_URL`, `VITE_MULTIPLAYER_URL`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. Use only an isolated test project. These scripts do
not fetch account-wide credentials automatically and are not run by CI.

Do not commit secrets, cloud account exports, player data, screenshots showing
private records, local tooling config, `node_modules`, generated builds or logs.
Install [Gitleaks](https://github.com/gitleaks/gitleaks) and run `npm run test:secrets`
before publication. Dependency changes must update the matching lockfile.

Preserve RLS, server-side identity checks, token verification, payment idempotency,
accessibility and existing asset credits. New assets need provenance and a license
that permits source redistribution. Original code contributions use the ISC
license; third-party material retains its own terms.

Forks can use pull requests on GitHub. The maintainer's local workflow commits
reviewed work directly to `main`; do not deploy or publish as part of a contribution.
See [VERSIONING.md](VERSIONING.md) for releases.
