# Project workflow

## Current workflow — Yusuf’s latest instruction

- Game Dev 1 works and commits directly on `main` in `/Users/yusufsuhair/Downloads/astra`.
- Game Dev 1 (this task) is the sole owner of development deployments. Other developer tasks and the orchestrator must not deploy to dev unless Yusuf explicitly reassigns deployment ownership.
- Default deployment destination is dev only. Production requires a new explicit request from Yusuf.
- The rules below about separate branches and stopping before integration remain applicable to other developer tasks; they do not override the main-branch workflow for Game Dev 1.


- Parallel development tasks work and commit in separate worktrees on separate `codex/*` branches. This replaces the previous instruction to work directly on `main` for this project.
- Game Dev 1 owns assigned gameplay and web features; Mobile Dev owns assigned mobile/native integration; SQA owns verification, regression tests, and reproducible bug reports. Preserve each task's existing assignment and coordinate overlapping shared files only when necessary.
- Verify the actual working directory, branch, and uncommitted changes before starting. Never switch another task's branch, overwrite its changes, or force the same branch into multiple worktrees. Create a task branch before committing from a detached worktree.
- Use separate local server ports and test output directories. Verify tests target the intended worktree and commit. Worktrees do not isolate shared databases or external services.
- Each task reports status, commit, checks, and blockers directly to Yusuf in its own task. Do not automatically push updates to the orchestrator or other tasks. Direct task-to-task communication is only for a concrete collision or when Yusuf explicitly requests coordination.
- After completing its assignment, a task stops at its own branch. It must not automatically rebase, merge, cherry-pick, switch another worktree, or deploy. Yusuf decides whether and when a branch is rebased or merged into `main`.
- The orchestrator is on-demand. It only pulls status, reviews branches, coordinates integration, or deploys when Yusuf explicitly asks for that action.
- When Yusuf authorises deployment after integration, deploy frontend changes to both Cloudflare Pages projects (`lepakmamak` and `lepak-city`), and verify `lepakmamak.my` plus both default Pages domains. Deploy Railway when backend changes require it.
- Keep the archived KLCC rebuild off production unless explicitly requested.
