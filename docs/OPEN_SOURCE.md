# Open-source preparation record

Prepared on 21 September 2026. This is a repository preparation, not a cloud
release or a change to GitHub visibility. The owner selected ISC and confirmed
redistribution rights for the included audio and 3D assets. Existing third-party
licenses and credits remain applicable; see [notices](../THIRD_PARTY_NOTICES.md).

## Completed

- ISC license, README, contributor/security guidance and per-service setup docs.
- Examples separate public frontend, private backend, deployment and admin values.
- Production env and machine-specific launch/hooks config removed from tracking;
  local copies retained. Ignored files are not part of a clone or source archive.
- GM privileges now require configured verified Supabase user UUIDs; no personal
  email is a default operator. Admin remains independently protected by Access.
- Origin/Checkout configuration, optional local/CDN assets, generated CSP,
  explicit Pages/Railway targets and Docker/Railway deployment files.
- Live test helpers require an explicit isolated test environment; they no longer
  discover service-role keys through an authenticated Supabase CLI.
- CI runs config checks, web/admin builds, admin tests and secret scanning. It
  does not deploy or need cloud credentials.

## Security review

Gitleaks 8.30.1 scanned 801 commits across all local refs before these changes.
The three initial findings were reviewed: two duplicate detections of harmless
localStorage key names in `src/explore.ts`, and a `VITE_SUPABASE_PUBLISHABLE_KEY`
explicitly meant for browser distribution. `.gitleaksignore` contains only those
two exact historical fingerprints plus the same localStorage finding in a
source-tree scan. A repeat history scan found no unreviewed
secrets. This is automated pattern scanning, not proof that every secret or piece
of personal data has been eliminated.

The original history still contains public infrastructure identifiers, author
emails, local paths, screenshots and old deployment notes. History was not
rewritten, and no credentials were rotated: none of the reviewed findings was a
server credential. Review these metadata before publishing the full history.
Do not upload the working directory wholesale; it contains ignored private files.

Dependency audit fixes updated compatible Cloudflare tooling and removed the
vulnerable `sharp` dependency path. Root **production** dependencies and the admin
package have no reported advisories at preparation time. Three moderate entries
remain in the root **development-only** `@capacitor/cli → xcode → uuid` chain.
The offered npm fix downgrades Capacitor outside the declared range; it was not
forced. This is native packaging tooling, not code in the game/server bundle.
Re-evaluate before distributing native builds; rerun `npm audit` as advisories change.

## Validation and limits

- Web TypeScript/production build; local and custom-CDN build behavior.
- Ten Node configuration/backend checks; 27 focused game/GM/shop/Wall/CDN,
  weather and status-page checks.
- Nineteen admin authorization/audit/moderation tests and Next production build.
- Gitleaks history and exported-tree scans, plus dependency audits.
- A clean exported snapshot, with no private env files: fresh `npm ci`, web build,
  configuration tests, admin tests and admin build all passed.
- The full gameplay suite, native/Unity builds, Docker image execution, cloud
  provisioning and hosted integration tests were not run as part of this prep.
  Docker daemon was unavailable. No existing cloud database, keys, deployments,
  DNS records or GitHub visibility were changed.

## Maintainer publication steps

1. Read the existing-deployment migration in [DEPLOYMENT.md](DEPLOYMENT.md).
   Set `GM_USER_IDS`, `ALLOWED_ORIGINS` and explicit cloud/CDN targets before the
   next deployment; old hardcoded defaults no longer exist.
2. Review this commit and asset notices. Keep private permission receipts outside
   Git. Update the in-game privacy/terms/support pages for each independently
   operated fork; the shipped pages describe the original service.
3. Rerun builds, relevant tests and `npm run test:secrets` on the commit to publish.
   Review `git status` and the tracked file list, especially any new screenshots,
   database exports, native signing files or provider configuration.
4. Push the reviewed commit only when publication is intended. In GitHub enable
   private vulnerability reporting, secret scanning/push protection where available,
   and appropriate merge/review rules. Enable Actions and verify the first CI run.
   The Gitleaks action may require a license if the repository moves to an organization;
   the local Gitleaks CLI remains usable independently.
5. Review GitHub's visibility-change confirmation and switch the repository to
   public deliberately. Check issues, releases, Actions artifacts and all exposed
   branches/tags as well as `main`. Publicizing the entire working directory or
   rewriting existing refs is not part of this preparation.
6. Perform a deployment into separate test resources using the guide, then test
   accounts, ordinary-user rejection of GM/admin operations, storage permissions,
   voice and Stripe test-mode webhooks. Only then schedule a production upgrade.

If preserving historical metadata is undesirable, create a reviewed source-only
release from the committed tree in a separate repository, retaining required
copyright/attribution. Do not force-push rewritten history over existing collaborators.
