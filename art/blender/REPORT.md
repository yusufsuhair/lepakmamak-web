# Validation report — 11 September 2026

Completed on branch `codex/blender-web-pipeline`. The current Mamak Maju asset is version 2,
covering the complete static site; the calibration and pilot history are retained below.

## Complete Mamak Maju site — current

The runtime GLB includes the building, roof, striped canopy, baked signage, courtyard,
five game tables, 20 player chairs plus one reserved NPC chair, cups/roti/tissue props,
nasi kandar counter with five pots, tea urns, static fans/lamps, planters and welcome board.
All authored closed solids are checked for outward winding. Named part vertex groups
and correctly framed preview cameras are preserved in the `.blend` source.

- GLB: **634,504 bytes, 10,072 triangles, six materials/primitives**, no textures, fonts,
  cameras or lights to download. Complete-site limits: 768 KiB / 12,000 triangles / six draws.
- Placement: `(-29, 0, 30)`; extent 37 × 9.95 × 40.7 m including the nine-seat courtyard.
- Khronos: zero errors, zero warnings, six informational unused-UV entries.
- Three.js: actual seat/backrest raycasts match all 20 authoritative player chair poses;
  table-top raycasts match all five game tables. Sign lettering faces the courtyard.
- Independent rebuild: GLB and all four Blender PNGs byte-identical; saved source hash preserved.
- Integration: building, paving, furniture and props switch together on successful load.
  The complete procedural fallback is separately batched and remains playable after failure.
- Application build passed (existing large JS bundle warning remains).
- **29 focused/regression tests passed** on isolated port 5199: asset success/failure,
  big-table layout, sit/stand audio, quiet seating, quality modes, render detail, arrival and places.
- Integrated desktop (1440 × 900) and touch-mobile (390 × 844) Chrome smoke checks passed,
  with zero page errors; desktop sit/stand passed. Inspected game screenshots and Blender views.

Asset SHA-256: `dcc1b5183e65fb24ee98da20f03d0398052f73bf04ec11a577af1fc719bb0c9c`.
Evidence: [machine validation](generated/mamak-maju/reports/three-validation.json),
[rebuild comparison](generated/mamak-maju/reports/reproducibility.json),
[browser checks](generated/mamak-maju/reports/browser-tests.json),
[seated game view](generated/mamak-maju/previews/game-seated.png).

The six draws describe this asset only. Total-world rendering remains substantially larger;
touch-mobile emulation is not a physical-phone FPS/thermal benchmark. Fans are static and
the serving bays are decorative; gameplay remains the existing outdoor seating/table games.
The full application suite was not run. No deployment was performed.

## Calibration and original pilot — historical

The pipeline was executed with Blender **5.2.1 LTS**, build `9e2066aef7ef`. The saved template and source asset were reopened in background Blender before validation and export. The interactive Blender session was not touched.

The pilot asset is positioned at world `(-29, 0, 30)`, uses the existing Mamak Maju footprint, and preserves the game’s table/seat coordinates. Its GLB is 66,732 bytes, 912 triangles and four primitives; the source and runtime asset use the canonical Blender `-Y` / glTF `+Z` forward convention.

| Check | Result |
| --- | --- |
| Metric units and scale | PASS — meters, unit scale 1.0 |
| Source and imported Three.js dimensions | PASS — exactly 1 × 1 × 1 m |
| Origin and axis conversion | PASS — base-center zero; red +X, green +Z, top +Y in Three.js |
| Shared materials retained in template | PASS — six Principled BSDF palette materials with fake users |
| EXPORT boundary | PASS — exactly one named asset node, including nested collection traversal |
| Selection isolation | PASS — selecting the preview ground and activating REFERENCE produces the identical GLB |
| Excluded content | PASS — no camera, light, guide, texture, animation or rig exported |
| Geometry and size | PASS — 12 triangles, 24 exported vertices, three materials/draw calls, 3,584 bytes |
| Khronos glTF Validator | PASS — zero errors, zero warnings; three informational unused-UV entries |
| Pipeline tests | PASS — 15 checks, including invalid units, geometry size, transforms, UVs, materials, names, visibility, budget and external parenting |
| Independent clean rebuild | PASS — GLB and all four Blender PNGs byte-identical on this machine/build |
| Standalone `export_glb.py` | PASS — same GLB SHA-256 as generated asset |
| Saved `.blend` preservation | PASS — verification leaves source hashes unchanged |
| Browser WebGL rendering | PASS — desktop 1100 × 1000 and mobile 390 × 844; four angles each; no console/WebGL errors |
| Existing application build | PASS — `npm run build`; existing >500 kB bundle warning remains |
| Runtime Mamak Maju integration | PASS — GLB served at `/assets/models/environment/LM_ENV_MamakMaju.glb`; focused Playwright test passes; fallback group hides only after GLB readiness |

GLB SHA-256:

```text
d59243071a55ed1264d9887d9e354fb7c8e190fbeb90641d212335069faa31b6
```

Visual inspection covered the four Blender views, the actual GLB in the browser, and the mobile isometric screenshot. The cube has the expected flat face colors and orientation; the Blender isometric/top views show the one-meter ruler with ten-centimeter ticks. The ruler is absent from the GLB. Browser colors differ from Blender because the inspection scene uses the game's ACES tone mapping while Blender uses AgX.

Generated files: [template](generated/templates/lepakmamak-web-template.blend), [editable scale source](generated/source/LM_TEST_ScaleMeter.blend), [Mamak Maju source](generated/mamak-maju/source/LM_ENV_MamakMaju.blend), [Mamak Maju GLB](generated/mamak-maju/exports/LM_ENV_MamakMaju.glb), [Blender isometric render](generated/mamak-maju/previews/LM_ENV_MamakMaju_iso.png), [mobile GLB render](generated/previews/three-mobile-iso.png). Full machine-readable evidence is in [generated/reports](generated/reports) and [generated/mamak-maju/reports](generated/mamak-maju/reports).

Run instructions and authoring/export conventions are in [README.md](README.md). The local viewer is available while Vite is running at `http://127.0.0.1:5192/art/blender/preview/`.

This is the initial static, opaque, palette-material profile. Physical-phone FPS/memory/thermal testing and whole-world performance are not measured. Animation, textured assets and LOD/compression need dedicated profiles. Only the Mamak Maju visual shell was replaced; gameplay interactions, seats, collision and the procedural fallback remain. No deployment was performed.

## Mamak Maju sign update — 2026-09-11

Added baked `MAMAK MAJU` lettering to a front-facing canopy board, reusing cream and wood
materials. Rebuilt source, GLB and four Blender previews. The new asset is 72,456 bytes,
1,020 triangles and four primitives, with no font/texture dependency. Its environment-only
triangle cap is now 1,500; the calibration asset budget is unchanged.

Khronos validation: zero errors/warnings. Three.js validation checks sign metadata, actual
letter vertices, board height and front-facing normals. Application build and the focused
Mamak asset browser test passed. Inspected the front render and the local game screenshot:
the name is readable on the canopy. Existing bundle-size warning remains. Full regression
was not rerun for this asset-only update; no production deployment was performed.
