# Mamak neighbourhood shopfronts — local delivery

Built with Blender 5.2.1 LTS (`9e2066aef7ef`) on branch `codex/blender-web-pipeline`.
Local game: http://127.0.0.1:5192/ . No merge, push, cloud deployment or production change.

## Assets

| Shop | World X/Z | Triangles | Material draws | GLB bytes |
| --- | --- | ---: | ---: | ---: |
| Bengkel Azlan | -60 / 58 | 1,543 | 4 | 98,368 |
| 7-Eleven | -59 / 32 | 1,240 | 6 | 81,032 |
| Warung Kak Ana | 27 / 34 | 1,717 | 5 | 107,928 |
| ZUS Coffee | 27 / 58 | 1,413 | 5 | 93,352 |
| FamilyMart | 49 / 34 | 1,273 | 5 | 89,020 |
| KK Super Mart | 49 / 58 | 1,473 | 5 | 95,644 |
| Total | | 8,659 | 30 | 565,344 |

Total source payload is 552.1 KiB, before any HTTP compression. Draw counts are asset
material primitives in a single pass, not whole-city frame counts including shadow passes.
Each opaque, texture-free facade has baked name lettering, upper windows, trim, awning and
shop-specific displays. Small obscured plinth captions were removed after render inspection.
Six saved `.blend` sources preserve named component vertex groups and four preview cameras.
Only validated `EXPORT` meshes reach the runtime assets directory.

## Verification

- Blender profile validation passed for all six; Khronos validator: zero errors, zero warnings.
- Three.js GLTFLoader parsed every export. Raycasts verify actual 11 m body/12 m depth and
  each existing shop width; base rests at zero, roof tops at 11.76 m. Baked sign normals face
  the pavement. No cameras, lights, images, external buffers, animations or skins in GLBs.
- Original source hashes still match the authoring report. Independent clean rebuild:
  all six GLBs and all 24 Blender preview PNGs byte-identical on the same Blender build.
  `.blend` byte identity across different output directories is not promised.
- `npm run build` passed (TypeScript plus Vite). Existing large-chunk warning remains.
- 26 focused Playwright tests passed on this worktree's isolated port 5217, covering
  all/missing facade loading, fallback placement, unchanged collision/map/chair data, twelve
  ZUS chairs and clear arrival, Mamak fallback seating, street props, lamp state, graphics
  quality and mobile/desktop map directory. Full repository regression was not run.
- Actual local game browser review: desktop 1440×900 and touch-mobile emulation 390×844,
  six assets ready and zero page errors. Player reaches ZUS via ordinary movement;
  sitting and standing at the existing ZUS table pass on both viewports.
  Controlled cameras additionally inspect every new facade in the actual world geometry.
  Screenshots and runtime results are under `generated/mamak-shops/previews/` and `reports/`.

## Boundaries

This is an exterior asset migration, not a complete-city Blender migration. Existing ZUS
outdoor seating stays procedural and playable. No economy, server, audio, map destination,
seat ID or shop collision rule changes. Each facade independently retains its old appearance
if its GLB download fails. The untracked user source
`generated/templates/LM_ENV_MamakMaju.blend` was left untouched and excluded from the commit.

Browser mobile emulation is not physical-phone thermal/FPS or slow-network testing. The
whole city's existing geometry/shadow cost and bundle-size warning are outside this batch.
An online multiplayer service is not part of this local frontend delivery.
