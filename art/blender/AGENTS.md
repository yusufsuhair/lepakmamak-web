# Blender asset workflow

Yusuf wants requested asset work completed end to end: author in Blender, preserve the
editable source, export and validate GLB, integrate in the game, and inspect/test locally.
Do not stop for an asset-by-asset visual approval; use the approved Mamak palette and
low-poly direction, then show the finished game result.

Run Blender in a separate background process. Generate into a fresh directory and retain
hand-edited or untracked source copies. Only validated EXPORT geometry goes to public.
For gameplay furniture, use authoritative shared layout data and verify actual mesh
positions, not just metadata. Keep game rules and seat IDs intact.

Follow root branch/worktree rules. Local integration does not authorize deployment.
