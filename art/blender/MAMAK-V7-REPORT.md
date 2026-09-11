# Mamak V7 — baked contact shading and tabletop detail

Local integration on `codex/blender-web-pipeline`, based on `727b170`.
No main integration, push or deployment. The production audio mixer is on main;
this asset branch retains its prior application baseline pending explicit integration.

## Delivered

- Blender 5.2.1 LTS / Cycles CPU AO baked into vertex colours on the site.
  A sparse 1.5 m surface grid supports variation across paving, building and canopy.
  Seed 17, 32 samples, 1.25 m AO radius, linear multiplier clamped to 0.58–1.
- Five varied table settings: handled teh tarik mugs, saucers, foam, folded roti,
  kuah bowls, spoons, tissue boxes and graphic menu cards. The large table has a
  sharing plate. All props remain inside tabletops, clear of all player seats.
- Shared tabletop layout drives both Blender cup placement and Three.js steam.
  Raycasts against the real GLB confirm all ten steam origins sit over tea surfaces.
- Warm canopy pools respect surface normals, improving front/back differentiation
  without additional lights or shader draws.
- Saved packed `.blend`, two existing counter maps, GLB, multi-angle Blender renders,
  tabletop and counter A/B renders, and actual city desktop/mobile day/night captures.

## Checks

- Build: passed (`tsc --noEmit` and Vite); existing large-bundle warning.
- Blender source/profile checks: 13 passed, including geometry clearance, vertex AO,
  source preservation and identical re-export from reopened source.
- Khronos glTF validator: zero errors, warnings or informational issues.
- Five tables and 25 playable chairs checked by actual GLB raycasts.
- Two independent clean Blender builds: eight GLB/texture/render files byte-identical.
- Focused Playwright: 17 passed (Mamak, shops, steam, street props and streetlights),
  isolated test port 5280, output under the v7 generated directory.
- Browser A/B: baked contact shading changes actual rendered pixels in day/night,
  desktop/mobile; nine asset draws, zero WebGL or page errors.
- Actual city: four day/night desktop/mobile cases pass loading and sit/stand with
  no page errors, served from this worktree at `http://127.0.0.1:5252/`.

## Performance and portability

The asset has 23,425 triangles, nine primitives, seven materials, three meshes and
1,737,876 bytes. Compared with v6: +7,612 triangles and +547,020 bytes; no extra draws
or textures. The profile explicitly caps this at 24,000 triangles and 2 MiB.
SHA256: `0ceffb4493fbb787378e27be4284f4c7f5f22842dd874e196377c465f58f2a3c`.

Local Chrome RAF profiling (120 warmup + 240 sampled frames): desktop High median
16.7 ms / p95 16.7 ms, mobile viewport Low median 16.7 ms / p95 16.8 ms. These are
desktop-host frame intervals, not GPU timings or physical-phone measurements. Full
city draw counts remain approximately 2,786 High / 311 Low at the sampled camera;
the nine-draw measurement applies only to this asset. Full app regression was not run.

AO is stored as standard `COLOR_0`, separate from material base factors, with no fixed
sunlight baked in. Unity requires a shader that reads these vertex colours to reproduce
the shading. Three.js night pools remain runtime shader code to recreate in Unity.
Re-export preserves baked data; geometry edits require a rebake. The original untracked
template and previous source archives were preserved. Development trials live outside
the repository in `/tmp/lm-mamak-v7-work.luvFtz/`.

Evidence: `generated/mamak-maju-v7/reports/` and `generated/mamak-maju-v7/previews/`.
