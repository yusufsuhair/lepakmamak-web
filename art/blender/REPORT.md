# Validation report — 11 September 2026

Completed on branch `codex/blender-web-pipeline`, created from the existing clean `develop` worktree. Blender pipeline and the first Mamak Maju runtime pilot are included; game integration files also touch `src/`, `public/` and `tests/`.

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
