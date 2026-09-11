# Mamak Maju v3 — counter and exterior polish

Completed locally on 2026-09-11 in `codex/blender-web-pipeline`.

## Delivered

- Steel worktop with a small physical chamfer, splashback, three open lauk trays,
  serving spoons, two lidded pots and handles.
- Counter tile joints, geometry menu lettering, service-opening frames, canopy gutter,
  downpipes/brackets, plate stacks and condiment bottles.
- Mamak-specific roof/plastic/plaster roughness values; original low-poly palette retained.
- Actual Cycles CPU baking: 512×512 short-range ambient occlusion and tangent-space
  bevel normal maps, 32 samples, fixed seed 17. No sun/shadow lighting in base colour.
- Packed editable `.blend`, external PNG maps, embedded GLB textures and preview cameras.
- Validated GLB installed in the HTML/Three.js client at `http://127.0.0.1:5192/`.
  Runtime URL is versioned with `?v=mamak-v3` for cache invalidation.

## Measured asset

| Measure | Result | Limit |
| --- | ---: | ---: |
| Triangles | 13,287 | 16,000 |
| Draw primitives / materials | 7 | 7 |
| Export mesh objects | 2 | 2 |
| GLB bytes | 1,042,308 | 1,310,720 |
| Embedded maps | 2 × 512×512 | 2 × 512×512 |
| Playable chairs checked against shared layout | 25 | All 25 |
| Tables checked by raycast | 5 | All 5 |

GLB SHA-256: `aab12c550bfadce0a6ddae4812e75e0705e93f25d675efbd82d9d80c1d90d504`.
The previous runtime GLB was 634,504 bytes; v3 adds 407,804 bytes and one material draw.
Two RGBA8 512 maps with mipmaps require approximately 2.67 MiB of texture memory.

## Verification

- Blender 5.2.1 LTS background authoring, Cycles baking, source reopen and EXPORT-only export: passed.
- Khronos glTF validation: 0 errors, 0 warnings, 0 infos.
- Three.js geometry validation: dimensions/base origin, front-facing sign, all chair
  seats/backrests, table tops, normalized counter UVs and exported tangents passed.
- Real browser GLTFLoader decodes both embedded maps as non-colour data. Day/night,
  baked/unbaked comparisons render at desktop and mobile viewport sizes; 7 draws,
  no WebGL or page errors. Baking changes the rendered output in both light states.
- Actual local game: guest entry, complete visual replacement and sit/stand passed
  in all four desktop/mobile × day/night combinations; no page errors.
- Focused Playwright regression: 31 passed (Mamak, shops, street props, large table,
  places, ZUS, lamp interaction and graphics quality).
- Mamak profile checks: 7 passed, including texture opt-in, colour space, resolution,
  shader graph, alpha, AO/base-colour separation and adversarial export selection.
- Original one-metre pipeline: build plus 15 contract/selection tests passed.
- Clean rebuild: GLB, both baked PNGs and five Blender preview PNGs were byte-identical
  across fresh builds with the same Blender version and bake settings (8 artifacts).
- `npm run build`: passed; existing bundle-size warning remains.

Focused checks were used for this asset change; the entire gameplay regression suite
was not rerun. Browser mobile emulation is not a physical-phone FPS, memory or thermal
benchmark. Whole-city draw counts vary with camera, quality and moving objects; the
seven-draw measurement above applies to this asset only.

## Files and reuse

Current source: `generated/mamak-maju-v3/source/LM_ENV_MamakMaju.blend`.
Current export: `generated/mamak-maju-v3/exports/LM_ENV_MamakMaju.glb`.
Evidence: `generated/mamak-maju-v3/reports/` and `previews/`.
Earlier `generated/mamak-maju/` sources and the user's untracked template are retained.

The two EXPORT objects use the same asset-local origin. Three.js places the complete
asset at `(-29, 0, 30)`. Positions, world collision, game rules and chair IDs are still
owned by shared game data. Decorative frames are not new enterable interiors.
Both bake maps are embedded in GLB and packed into `.blend`; a future Unity client
must map these PBR channels appropriately for its chosen importer/shader.

The source's preview uses EEVEE/AgX. The game uses Three.js/ACES with its runtime lights.
The comparison harness uses game light intensities but not full-city shadows, so its
images are material checks rather than exact Blender-to-game colour matches.

No remote deployment was performed for this change.
