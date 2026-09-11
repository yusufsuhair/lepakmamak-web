# Mamak Maju v4 — frontage polish

Completed locally on 2026-09-11, branch `codex/blender-web-pipeline`.
No rebase, merge, push or remote deployment.

## Delivered

- Blender-authored window reveals, dark pane backing, timber transoms and green shutters.
- Cornice, pilaster caps, service-bay shelves/tins and canopy rafters.
- Fine nameboard border, terracotta service threshold, courtyard/annex grout and flush edge drains.
- Existing Cycles counter AO/normal maps retained. No additional textures, materials or draw calls.
- Runtime GLB replaced and URL bumped to `?v=mamak-v4`.

This is a modelling/detail pass, not the entire visual overhaul discussed against the
Dotonbori reference. Camera, world lighting, character art and game UI are unchanged.
Furniture, seat IDs, collisions and game rules are unchanged. No gameplay logic was edited.

## Asset contract and evidence

Source: `generated/mamak-maju-v4/source/LM_ENV_MamakMaju.blend`.
Runtime: `public/assets/models/environment/LM_ENV_MamakMaju.glb`.
Editable named parts, UVs, packed textures and five preview cameras are preserved.
Only EXPORT collection geometry is exported; no preview lights/cameras enter the GLB.
Earlier generated sources and the user's untracked template `.blend` were preserved.

| Metric | v3 | v4 |
|---|---:|---:|
| GLB bytes | 1,042,308 | 1,144,804 |
| Triangles | 13,287 | 15,185 |
| Material primitives | 7 | 7 |
| Meshes | 2 | 2 |
| Embedded maps | 2 × 512² | 2 × 512² |
| Tables / playable chairs | 5 / 25 | 5 / 25 |

GLB SHA256: `1af550d05ad9b067baf385b015f079bac9f03b23b107f6a57e22fe786c4943b2`.
Bounds remain 37 × 9.95 × 40.7 metres in Three.js coordinates.
The initial build exceeded the existing 16,000-triangle limit. Flush decorative inlays
were reduced to upward-facing quads instead of boxes; the budget was not increased.

## Checks

- Blender generation/export: passed; 5.2.1 LTS, Cycles CPU bake.
- Khronos glTF validation: 0 errors, 0 warnings, 0 infos.
- Three.js geometry checks: passed, including actual exported tabletops/chair seats/backrests.
- Blender profile tests: 9 passed, including required frontage parts, upward flush inlays,
  bad shader rejection, EXPORT isolation and source preservation.
- Two independent builds: GLB, two PNG maps and five Blender previews byte-identical (8 artifacts).
- Standalone source re-export with `--profile mamak-v4`: identical GLB.
- `npm run build`: passed; existing large-JavaScript-chunk warning remains.
- Focused Playwright: 31 passed on dedicated port 5233, output `/tmp/lm-mamak-v4-focused`.
- Actual local game: desktop/mobile viewport × day/night, asset ready, fallback hidden,
  sit/stand passed, no page errors (4 variants).
- Browser texture decoding/rendering: passed, 8 counter A/B renders, 7 asset draw calls,
  no WebGL errors, valid normal/occlusion maps and tangent basis.
- Visually inspected Blender front render and actual desktop-day/mobile-night game captures.

Full regression was not rerun for this asset-only pass. Physical-phone performance and
online multiplayer were not measured. The 7 draw calls refer to this asset, not the full city.
The browser screenshots use deterministic day/night weather fixtures and guest entry.

## Reproduce

From repository root, use the commands in README with a fresh output directory.
Frontage authoring is in `scripts/mamak_frontage.py`; the manifest records its hash.

```sh
node art/blender/tools/validate-mamak-glb.mjs
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-mamak-browser.mjs
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-mamak-polish-browser.mjs
PLAYWRIGHT_PORT=5233 npx playwright test tests/mamak-asset.spec.ts tests/mamak-streets.spec.ts tests/mamak-shops.spec.ts tests/big-table.spec.ts tests/places.spec.ts tests/zus.spec.ts tests/lamp-switch.spec.ts tests/performance.spec.ts --output=/tmp/lm-mamak-v4-focused
```
