## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
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
