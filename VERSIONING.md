# Local Git and releases

Work directly on `main`. Keep commits and tags local until publishing is explicitly requested; a configured remote does not authorize a push.

## Source of truth

`package.json` holds the app version. `package-lock.json` mirrors it. The frontend reads it for Settings and the backend reads it for `/health`. Use npm's version commands to keep the two files consistent.

- Patch (`1.0.0` → `1.0.1`): fixes and small corrections.
- Minor (`1.0.0` → `1.1.0`): new compatible features.
- Major (`1.0.0` → `2.0.0`): breaking changes that require migration or coordination.

A release tag records the exact local source revision. It does not mean that version has been deployed. The initial baseline is `v1.0.0`.

## Commit work

Review `git status` and `git diff`, stage only the intended files, then commit with a descriptive message. Update the Unreleased section of `CHANGELOG.md` as features and fixes land. Keep credentials, dependencies, generated builds and test artifacts out of Git. Only env examples are tracked. Keep all actual environment files ignored; `VITE_*` values are public and must never contain secrets.

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

## Release notes players can read

`shared/changelog.json` holds the player-facing notes, newest first, as
`{version, date, title, notes[]}`. Settings renders it under "Apa yang baharu"
with the current version and when it last changed.

Every release bumps `package.json` and adds an entry. `tests/changelog.spec.ts`
fails when the two disagree, so a version cannot ship without notes, and the
notes are checked for developer language so they stay written for players.
