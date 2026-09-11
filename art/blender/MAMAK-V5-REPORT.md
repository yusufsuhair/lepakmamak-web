# Mamak Maju v5 — courtyard atmosphere

Completed locally on 2026-09-11, branch `codex/blender-web-pipeline`.
No rebase, merge, push or remote deployment.

## Delivered

- Three Blender-authored festoon strings across the Mamak courtyard.
- Six slim support poles sit on the two perimeter drains, outside all table arrivals
  and playable chair footprints.
- Eighteen faceted bulbs follow a deterministic parabolic sag and keep more than
  4.45 metres of avatar clearance.
- A separate named festoon mesh lets Three.js give only the bulbs a warm emissive
  night treatment. No real-time point lights, textures or animation were added.
- The complete procedural fallback includes matching geometry and pole collisions.
- Runtime GLB replaced and URL bumped to `?v=mamak-v5`.

Furniture, seat IDs, building collisions and game rules are unchanged. This is the
first courtyard-atmosphere pass; adjacent storefronts, street props and the existing
procedural sky retain their previous implementations.

## Asset contract and evidence

Source: `generated/mamak-maju-v5/source/LM_ENV_MamakMaju.blend`.
Runtime: `public/assets/models/environment/LM_ENV_MamakMaju.glb`.
Only the `EXPORT` collection is included. Preview cameras/lights remain source-only.
The user's untracked template `.blend` and all earlier generated sources were preserved.

| Metric | v4 | v5 |
|---|---:|---:|
| GLB bytes | 1,144,804 | 1,183,396 |
| Triangles | 15,185 | 15,917 |
| Material primitives | 7 | 9 |
| Meshes | 2 | 3 |
| Embedded maps | 2 × 512² | 2 × 512² |
| Festoon bulbs / poles | 0 / 0 | 18 / 6 |
| Tables / playable chairs | 5 / 25 | 5 / 25 |

GLB SHA256: `07b1a3aaaca8ee9edf48dc3838944eb9ca72e6fb213f589538ebbdf6defc23b5`.
Bounds remain 37 × 9.95 × 40.7 metres in Three.js coordinates. The pass uses
15,917 of the existing 16,000-triangle cap and 1,183,396 of 1,310,720 bytes.

## Checks

- Blender 5.2.1 LTS generation, Cycles CPU counter bake and GLB export: passed.
- Khronos glTF validation: 0 errors, 0 warnings, 0 infos.
- Three.js geometry, sign, furniture raycasts and embedded-map validation: passed.
- Blender profile tests: 10 passed, including named festoon parts, counts, head
  clearance, source preservation and isolated `EXPORT` re-export.
- Independent clean rebuild: eight runtime/preview artifacts byte-identical.
- Production build: passed; existing large-JavaScript-chunk warning remains.
- Focused Playwright: 45 passed across Mamak asset/street, lamp, weather,
  performance, shop, table, place, sky and rain coverage. A final 3-test asset rerun
  also passed after the night fixture was tightened.
- Actual game browser: desktop/mobile × day/night, asset ready, fallback hidden,
  sit/stand passed and no page errors. Counter texture decoding/rendering passed on
  desktop/mobile with 9 asset draw calls and no WebGL errors.

## Reproduce

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/build_mamak_asset.py -- \
  --output /tmp/lepakmamak-mamak-v5-new
node art/blender/tools/validate-mamak-glb.mjs \
  /tmp/lepakmamak-mamak-v5-new/exports/LM_ENV_MamakMaju.glb \
  /tmp/lepakmamak-mamak-v5-new/reports
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/test_mamak_profile.py -- \
  --generated /tmp/lepakmamak-mamak-v5-new
```

Authoring lives in `scripts/mamak_atmosphere.py`. Runtime-only warm emission is
isolated by the named `LM_ENV_MamakMaju_Festoon` mesh in `src/web-assets.ts`.
