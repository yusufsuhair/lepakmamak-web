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
- When Yusuf authorises deployment after integration, deploy frontend changes to the `lepakmamak` Cloudflare Pages project and verify `lepakmamak.my` plus its default Pages domain. Deploy Railway when backend changes require it.
- Keep the archived KLCC rebuild off production unless explicitly requested.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Predictive next step

At the start of a task and after each completed milestone, identify the next smallest step that moves the user's current goal forward. Use the current user request, unfinished work, failing tests, `git status`, deployment state and Graphify relationships as evidence.

Rules:
- Say `Next:` in the progress update with one concrete action and the reason it follows.
- Continue automatically when that action is already covered by the user's authorization and stays within the current task.
- Surface the action before taking it when it would expand scope, affect external services or data, deploy, merge, or modify another worktree's code.
- Prefer an existing blocker, failing test, dependency or unfinished request over inventing a new feature.
- Re-check `main`, the active worktree and Graphify freshness before acting on a predicted step; do not follow a stale summary.
- After the predicted step, verify its result and recalculate the next step instead of chaining an unverified plan.
