# Project workflow

- Work directly on `main` for the maintainer's local workflow. Check the working
  directory, branch and dirty files before editing; preserve unrelated changes.
- Commit only the requested work. Pushing, publishing, changing repository
  visibility and deploying require the owner's explicit instruction.
- Default authorised deployment destination is development. Production requires
  an explicit production request. Use the targets in ignored `.env.deploy.local`;
  never assume an account, domain, project or service from historical notes.
- Use separate local server ports and test output directories when another task
  is active. Worktrees do not isolate databases or cloud resources.
- Read `docs/CONFIGURATION.md` and `docs/DEPLOYMENT.md` before infrastructure work.
  Never place server secrets in `VITE_*` values or commit actual env files.
- Keep existing server-side authorization, RLS, payment idempotency and
  accessibility protections. GM and admin are separate privileges.
- Run checks relevant to the change and report what passed and what remains
  unverified. Avoid live tests against player accounts; use isolated test resources.
- Report commit, checks and blockers to the owner. Do not send updates to other
  tasks or create new tasks unless coordination is explicitly requested.

## Optional Graphify index

If `graphify-out/graph.json` exists and the CLI is installed, use a scoped
`graphify query` before broad codebase searches. Use `graphify path` or
`graphify explain` for relationships, and `graphify update .` after source changes.
Generated graphs stay ignored. Graphify is not needed to build or run the project.

## Next step

Use `Next:` in progress updates to identify the smallest concrete step that
advances the active request. Continue within authorised scope; surface any
external mutation before acting and require explicit deployment/publication scope.
