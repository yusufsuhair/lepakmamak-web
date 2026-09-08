# Local Git and releases

Work directly on `main`. This repository has no remote. Keep all commits and tags local until a remote is explicitly requested; do not push or add one automatically.

## Source of truth

`package.json` holds the app version. `package-lock.json` mirrors it. The frontend reads it for Settings and the backend reads it for `/health`. Use npm's version commands to keep the two files consistent.

- Patch (`1.0.0` → `1.0.1`): fixes and small corrections.
- Minor (`1.0.0` → `1.1.0`): new compatible features.
- Major (`1.0.0` → `2.0.0`): breaking changes that require migration or coordination.

A release tag records the exact local source revision. It does not mean that version has been deployed. The initial baseline is `v1.0.0`.

## Commit work

Review `git status` and `git diff`, stage only the intended files, then commit with a descriptive message. Update the Unreleased section of `CHANGELOG.md` as features and fixes land. Keep credentials, dependencies, generated builds and test artifacts out of Git. `.env.production` contains public frontend configuration only; secrets must never be added there.

## Release locally

1. Move the Unreleased notes into a new dated version section in `CHANGELOG.md`, keeping an empty Unreleased section above it.
2. Commit all intended work on `main`; the working tree must be clean.
3. Run exactly one command:

   ```sh
   npm run release:patch
   # or npm run release:minor
   # or npm run release:major
   ```

   The preversion hook builds and runs the tests. If they pass, npm updates both package files, creates a release commit, and creates an annotated `vX.Y.Z` tag locally. Nothing is pushed or deployed.
4. Confirm with `git status`, `git log -1 --oneline`, and `git tag --list`.

The preversion build validates the old version before npm changes it. Run `npm run build` again when preparing artifacts for the new release. Frontend and backend deployment are separate, explicit steps; both must be deployed to display the same version in production.

Inspect any saved release with `git show v1.0.0`. Preserve published tags; create a new version for subsequent fixes.
