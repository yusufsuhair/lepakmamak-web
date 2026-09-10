# Project workflow

- Parallel development tasks work and commit in separate worktrees on separate `codex/*` branches. This replaces the previous instruction to work directly on `main` for this project.
- Game Dev 1 owns assigned gameplay and web features; Mobile Dev owns assigned mobile/native integration; SQA owns verification, regression tests, and reproducible bug reports. Preserve each task's existing assignment; coordinate overlapping shared files before editing them.
- Verify the actual working directory, branch, and uncommitted changes before starting. Never switch another task's branch, overwrite its changes, or force the same branch into multiple worktrees. Create a task branch before committing from a detached worktree.
- Use separate local server ports and test output directories. Verify tests target the intended worktree and commit. Worktrees do not isolate shared databases or external services.
- One designated integration task integrates completed branches into `main` sequentially, after review and relevant tests. Recheck the integrated result before deployment. Feature and SQA tasks report their branch, commit, checks, and remaining issues; they do not independently merge or deploy shared environments.
- After integrating and verifying application changes, the integration task deploys them by default; no separate deployment confirmation is needed. Instruction-only changes do not require an application deployment.
- Deploy frontend changes to both Cloudflare Pages projects (`lepakmamak` and `lepak-city`), and verify `lepakmamak.my` plus both default Pages domains. Deploy Railway when backend changes require it.
- Keep the archived KLCC rebuild off production unless explicitly requested.
