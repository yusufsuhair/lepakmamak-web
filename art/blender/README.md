# LepakMamak Blender web-asset pipeline

Reproducible **Blender 5.2 LTS → GLB → Three.js** workflow. The calibration profile supports small, opaque, unrigged, untextured static meshes. Mamak Maju v3 adds a separately validated Cycles AO/normal bake for its serving counter. All other assets keep their existing untextured profiles.

## Current local runtime: Mamak Maju v7

V7 adds Cycles CPU ambient occlusion baked into `COLOR_0` on the site, with a sparse
surface grid on the paving/building/awning. No extra texture or draw call is required.
The bake is neutral contact shading (linear multiplier 0.58–1), not fixed sunlight.
Night canopy pools now respect surface normals. Five table settings have rotated
mugs with open handles, saucers, folded roti, kuah bowls, spoons, tissue boxes and menu
cards; `shared/mamak-tabletop.json` keeps steam aligned with the authored cups.

Editable source and evidence: `generated/mamak-maju-v7/`.
Measured asset: 23,425 triangles, nine draws, seven materials, 1,737,876 bytes.
The two existing 512×512 counter maps remain; the added shading uses vertex data.
See [MAMAK-V7-REPORT.md](MAMAK-V7-REPORT.md).

Build into a fresh directory with `scripts/build_mamak_asset.py`, validate using
`tools/validate-mamak-glb.mjs` and `scripts/test_mamak_profile.py`, then compare a
second build with `tools/compare-mamak-builds.mjs`. Re-export with
`scripts/export_glb.py --profile mamak-v7 --source SOURCE.blend --output NEW.glb`.
Changing geometry requires rebuilding/rebaking AO; exporting alone cannot rebake it.
Unity must use a material shader that multiplies the base colour by `COLOR_0` to
retain the vertex bake, and recreate the runtime night-lighting shader separately.

## Archived runtime: Mamak Maju v6

Editable source, packed/external textures, five Blender previews and local browser
evidence live in `generated/mamak-maju-v6/`; the current refreshed palm and planter
sources live in `generated/street-props-v3/` (the prior V2 set remains archived under
`generated/street-props-v2/`). Earlier generated sources remain archived unchanged.
See [MAMAK-V6-REPORT.md](MAMAK-V6-REPORT.md).

V6 smooths festoon cable geometry, rounds bulbs, adds wall-side crates/bin/handwash
details and varies palm/planter foliage. Three.js adds localized warm canopy pools
at night without extra lights or draws. This runtime shader is not embedded in GLB;
Unity integration must recreate that lighting treatment.

V5 adds three Blender-authored festoon strings, six perimeter poles and 18 bulbs above
the courtyard. The festoons retain over 4.45 m of head clearance. Their separate mesh
gets a warm emissive night treatment in Three.js without real-time point lights,
additional textures or animation. Matching fallback geometry and pole collisions keep
the scene honest if the GLB cannot load.

V4 adds window reveals, shutters/transoms, facade cornices, service shelving,
canopy rafters, a nameboard border, flush courtyard grout and covered edge drains.
It changes no gameplay coordinates, camera, lighting, collisions or seat IDs.

V3 adds open lauk trays, a chamfered steel counter, tile joints, menu lettering,
service frames, a gutter/downpipes and tea-station props. Mamak-only roughness values
differentiate roof, plaster and plastic without altering the shared prop/shop palette.
The current shared layout supplies five tables and **25** playable chairs.

Measured runtime asset: **15,813 triangles, 9 primitives, 1,190,856 bytes**. The two
embedded 512×512 PNGs hold short-range AO and tangent-space bevel normals; base colour
has no baked sunlight or emission. Estimated RGBA8 texture memory including mipmaps
is about 2.67 MiB. This is not a physical-phone performance measurement.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/build_mamak_asset.py -- \
  --output /tmp/lepakmamak-mamak-v5-new
node art/blender/tools/validate-mamak-glb.mjs \
  /tmp/lepakmamak-mamak-v5-new/exports/LM_ENV_MamakMaju.glb /tmp/lepakmamak-mamak-v5-new/reports
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/test_mamak_profile.py -- \
  --generated /tmp/lepakmamak-mamak-v5-new
```

Run the builder again with another fresh directory, then compare GLB, both baked maps
and all five Blender previews with `node art/blender/tools/compare-mamak-builds.mjs FIRST SECOND`.
`mamak-profile.json` fixes budgets, bake dimensions, samples and CPU seed. The saved
`.blend` is reopened before export. The counter is triangulated before baking and
exports its tangent basis; untextured mesh UV streams are omitted from GLB copies only.
Source UVs and named parts remain editable. Normal/AO colour space, packed images,
shader wiring, mesh boundaries, budgets and actual furniture geometry are validated.

Re-export a hand-edited v5 source with `scripts/export_glb.py --source SOURCE.blend
--output NEW.glb --profile mamak-v5` using Blender's background Python invocation.
The `mamak-v3` profile name remains a backwards-compatible alias for the same shader contract.
Changing counter geometry or UVs requires a rebake with `mamak_polish.bake_counter`
before saving; re-export alone does not update the baked textures.

After copying the validated GLB to `public/assets/models/environment/LM_ENV_MamakMaju.glb`:

```sh
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-mamak-browser.mjs
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-mamak-polish-browser.mjs
```

The first checks the actual city in day/night at desktop/mobile viewport sizes and
exercises sit/stand. The second decodes the real embedded images, checks tangent/UV
and colour-space data, then renders counter A/B comparisons with the game's daylight
and night light intensities. It uses an isolated asset harness, not a full-city FPS benchmark.
The runtime URL carries `?v=mamak-v5` to bypass prior immutable asset cache entries.

## Current sky: procedural atmosphere v2

`src/clouds.ts` now renders a continuous gradient sky with warped multi-octave noise
and layered clouds. This replaces the repeated Blender cloud cards. One dome draw,
960 triangles, a deterministic 128×128 RGBA lookup generated in memory (64 KiB), and
no cloud image downloads. Smooth mode uses one layer/three octaves; detailed uses
two layers/five octaves. KL solar altitude drives dawn/dusk tones and warm lighting;
fog shares the horizon colour. See [SKY-V2-REPORT.md](SKY-V2-REPORT.md).

```sh
node art/blender/tools/test-sky-browser.mjs
```

Screenshots and checks are in `generated/sky-v2/`. The v1 Blender sources below remain
available for reuse; its runtime PNG was removed from public, not from source/history.

## Archived Blender clouds v1

`generated/clouds-v1/` preserves a smooth cumulus mesh, a source-only noisy volume,
packed 512×256 RGBA cloud card, proxy GLB and previews. The v1 game used the Cycles-rendered
card, not live volumes or the proxy GLB: 6–12 camera-facing instances in one draw.
Weather/night tint, reduced motion and fog/haze visibility are wired to existing controls.
See [CLOUDS-V1-REPORT.md](CLOUDS-V1-REPORT.md) for checks and limitations.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/build_cloud_asset.py -- \
  --output /tmp/lepakmamak-clouds-new
node art/blender/tools/validate-clouds.mjs /tmp/lepakmamak-clouds-new
# The historical test-clouds-browser.mjs harness requires the v1 runtime (b524b56).
```

Only the proxy mesh belongs to EXPORT. Cloud volume and preview lights/cameras stay
in the editable source; the web atlas is a separate pre-rendered asset. The PNG and
source mesh can also be reused in Unity with an appropriate billboard/shader setup.

## Calibration build and earlier Mamak profile

Tested with Blender **5.2.1 LTS** (build `9e2066aef7ef`), Node 24, the repository's Three.js, and the pinned Khronos glTF validator. Blender Python uses only Blender's bundled libraries. Run these commands from the repository root:

```sh
npm ci --prefix art/blender/tools --ignore-scripts
python3 art/blender/scripts/verify.py --generated /tmp/lepakmamak-assets-v1
```

The output directory must be absent or empty for a new build. `verify.py` can also verify an unchanged existing build. It refuses stale scripts/config or modified artifacts; use a fresh output directory when iterating. Hand-edited `.blend` files are never overwritten. The supplied completed build is in `art/blender/generated/`.

The archived v2 Mamak Maju site is in `art/blender/generated/mamak-maju/`. Its runtime successor is
`public/assets/models/environment/LM_ENV_MamakMaju.glb`; `src/web-assets.ts` loads it at
`(-29, 0, 30)` and hides the complete Mamak visual fallback after a successful load.
The v2 generator read `shared/tables.json` and `shared/chairs.json` to place five game tables,
20 player chairs and one reserved NPC chair. Existing seat logic and collision solids remain
independent of the visuals. The fallback includes furniture and is batched by material.
The canopy carries baked cream `MAMAK MAJU` lettering, with no runtime font or texture.
The complete-site profile allows 12,000 triangles, six materials/draws and 768 KiB; the asset
uses 10,072 triangles, six material primitives and 634,504 bytes. The scale-test profile is unchanged.

For requested asset work, complete Blender authoring, local integration and visual/test
checks without requiring a separate user review for each asset. Show the finished result
in the local game. Keep commits on the assigned branch; deployment is a separate request.

The current builder produces v5; build into a fresh directory and validate before copying the GLB:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/build_mamak_asset.py -- \
  --output /tmp/lepakmamak-mamak-v5
node art/blender/tools/validate-mamak-glb.mjs \
  /tmp/lepakmamak-mamak-v5/exports/LM_ENV_MamakMaju.glb /tmp/lepakmamak-mamak-v5/reports
```

Validation raycasts the exported chair seats/backrests and tabletops against the game
layout, checks sign direction, and runs Khronos validation. The source retains named part
vertex groups and properly framed preview cameras. Every closed authored solid must have
outward winding. Layout and script hashes are recorded in the manifest.

On Linux/Windows or another Blender installation, pass `--blender /path/to/blender` or set `BLENDER_BIN`. Run generation in a separate background Blender process: it resets that process's scene, without touching an open interactive Blender session.

For generation alone:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/build.py -- \
  --output /tmp/lepakmamak-assets-build
```

`--skip-renders` is available for quick generation; the full verification workflow expects all four previews. `--python-exit-code 1` is essential in automation so Python exceptions fail the command.

## Outputs and source preservation

| Path inside a build | Purpose |
| --- | --- |
| `templates/lepakmamak-web-template.blend` | Empty EXPORT collection, six retained shared materials, preview setup |
| `source/LM_TEST_ScaleMeter.blend` | Editable, one-meter cube and separate measurement guides |
| `exports/LM_TEST_ScaleMeter.glb` | Runtime asset, containing only EXPORT descendants |
| `previews/LM_TEST_ScaleMeter_{iso,front,right,top}.png` | Four 768 × 768 EEVEE renders |
| `reports/validation.json` | Source contract and GLB boundary/budget results |
| `reports/manifest.json` | Blender build, configuration/script hashes and generated artifact hashes |
| `reports/pipeline-tests.json` | Negative validation tests and selection-isolation check |
| `reports/gltf-validator.json` | Official Khronos format validation |
| `reports/three-validation.json` | GLTFLoader dimensions, materials, normals, counts and origin |
| `reports/reproducibility.json` | Clean-rebuild hash comparison and source preservation |
| `reports/browser-tests.json` | Desktop/mobile viewport WebGL smoke tests, when run |
| `mamak-maju/source/LM_ENV_MamakMaju.blend` | Editable complete site with named part vertex groups |
| `mamak-maju/exports/LM_ENV_MamakMaju.glb` | Runtime Mamak Maju site |
| `mamak-maju/reports/` | Pilot source, GLB and Three.js validation evidence |

The saved template and asset are reopened before validation/export. Exports are staged and promoted only after validation. Saved sources, previews and reports stay under `art/`; copy only approved GLBs to `public/assets/models/...` when integrating a real game asset. The test cube is intentionally not loaded by the game or shipped through `public/`.

## Coordinate and authoring contract

- Metric units, length in meters, unit scale **1.0**. One Blender unit becomes one Three.js unit; do not add a ×100 or ×0.01 runtime correction.
- Blender **+Z up / −Y forward** exports to glTF/Three.js **+Y up / +Z forward**. Exporter performs this conversion with `export_yup=True`.
- Scale-test bounds: Blender `[-0.5, -0.5, 0] → [0.5, 0.5, 1]`; Three.js `[-0.5, 0, -0.5] → [0.5, 1, 0.5]`. Origin is base-center at world zero.
- Green face verifies forward (+Z in Three.js); red verifies right (+X). Cream top verifies up (+Y).
- Asset names follow `LM_<CATEGORY>_<Name>`; mesh data adds `_Mesh`. Names containing spaces or Blender duplicate suffixes such as `.001` fail validation. Rebuilding starts from a clean scene, so names remain stable.
- Use `REFERENCE`, `EXPORT`, `COLLISION_GUIDES`, `LIGHTING_PREVIEW`. Nested collections under EXPORT are included. Cameras, lights, ground, ruler text and collision guides stay outside EXPORT. The supplied mesh lives in `EXPORT/LM_EXPORT_Geometry` to test recursion.
- Rotation and scale must be applied; geometry rests on Z=0. Meshes need finite coordinates, valid UVs, valid material slots and nondegenerate triangles. The validator examines evaluated geometry for modifier triangle cost. This initial profile excludes animation, constraints, shape keys, rigs and collection instances.

## Materials and preview

`config.json` holds six named, shared Principled BSDF materials: cream wall, red roof, warm wood, dark metal, green leaves and red plastic. Hex colors are converted from sRGB to linear before setting shader values. Materials have fake users so unused palette entries survive saving the template. Existing datablocks are reused by meshes; simple Principled → Material Output, opaque alpha and single-sided rendering are required.

EEVEE uses 32 samples, AgX / Medium High Contrast, a neutral world and three area lights. Four orthographic cameras frame the calibration cube. Browser preview uses the game's ACES filmic setting and exposure 1.08 with separate inspection lights. Blender's AgX and the game's ACES/lighting are different; these renders establish geometry, scale and direction, not exact color parity. Future larger assets need camera framing adjusted to their bounds.

## Mobile budget

The initial small-prop profile enforces ≤1,000 evaluated triangles, ≤4 Blender mesh objects, ≤4 used materials, ≤4 GLB primitives/draw calls and ≤64 KiB GLB. Textures are excluded in this profile. The cube has three face materials specifically to test orientation; an ordinary single-material prop should aim for one draw call.

GLBs are self-contained; cameras, lights and animations are explicitly disabled. Draco is disabled for this tiny asset, so Three.js needs no decoder. UVs are preserved for future authoring: the Khronos validator reports three **informational** unused-UV entries because this cube has no textures. These are not warnings or errors.

Budgets are per asset, not a measured total-world performance guarantee. The browser test checks WebGL rendering at desktop and 390px mobile viewports with DPR capped at 1.5; it does not measure FPS, GPU memory or thermal behavior on a physical phone. Add separate profiles and physical-device measurements before approving characters, textures, animation, LODs or a complete world.

## Inspect the actual GLB in a browser

The viewer reads the supplied `generated/exports` asset. It is a local engineering page served by Vite, not part of the game entry point.

```sh
npm run dev -- --host 127.0.0.1 --port 5192 --strictPort
```

Open `http://127.0.0.1:5192/art/blender/preview/`. Drag to orbit; use the four camera buttons. The grid is 10 cm. To run automated browser tests against that server:

```sh
LM_BROWSER_CHANNEL=chrome node art/blender/tools/test-browser.mjs
```

This uses installed Chrome in an isolated headless Playwright context. Alternatively install Playwright Chromium with `npx playwright install chromium` and omit `LM_BROWSER_CHANNEL`. Browser tests assert 1 m bounds, 12 rendered triangles, three asset-only draw calls, visible pixels in all views, no WebGL/console errors, and write eight screenshots.

## Export a hand-edited source

Save a copy of the template, model under EXPORT and reuse the palette. This command opens the source in a separate process and writes a **new** GLB plus validation report without saving or modifying the `.blend`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/export_glb.py -- \
  --source /absolute/path/to/asset.blend --output /tmp/asset-v2.glb
```

Add `--scale-test` only for the calibration cube. `tools/validate-glb.mjs` currently adds cube-specific assertions to Khronos validation; adapt those assertions when introducing another asset profile. Never auto-apply transforms to a rig with this static pipeline.

GLB byte reproducibility is enforced on a clean rebuild using the same Blender build/config/scripts. `.blend` files may contain file paths/session data and are not promised to be byte-identical. Preview PNGs omit timestamp, render-duration and source-path metadata. Their hash matches are recorded but may differ across GPU/driver/Blender versions.

The game integration is covered by `tests/mamak-asset.spec.ts`; it checks that the runtime GLB
is served as a binary model and that the fallback group becomes hidden only after the asset is
ready. If the GLB request fails, the game reports `fallback` in `window.__lepak.mamakMaju` and
continues with the complete procedural fallback. It also exercises sitting with a failed
asset request. To capture the integrated desktop/touch-mobile game and verify sit/stand:

```sh
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-mamak-browser.mjs
```

## Reusable neighbourhood props

`generated/street-props/` contains four standalone Blender sources/GLBs: a palm, wooden
bench, planter and street-lamp body. Each has four preview renders and retains named part
vertex groups. The per-prop profile permits 1,200 triangles, three materials/draws and 96 KiB.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/build_street_props.py -- \
  --output /tmp/lepakmamak-street-props-v1
node art/blender/tools/validate-street-props.mjs /tmp/lepakmamak-street-props-v1
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-street-browser.mjs
```

Only validated GLBs are copied to `public/assets/models/props/`. Positions live in
`shared/mamak-streets.json`; `src/mamak-streets.ts` loads all four models into staging,
then switches the complete neighbourhood fallback off. Repeated placements use
InstancedMesh: ten placed props require ten asset draw calls and 111,020 source GLB bytes.
Three existing switchable lamps keep their IDs, glow positions, night state and overrides;
the two decorative lamps retain their scenery role. Two benches are decorative street
furniture with collision, not additional player/game seats. Existing Mamak seats remain usable.

Focused checks cover all-or-nothing loading, failure fallback, lamp anchors/state and
bench collision against game seat/arrival positions. Browser screenshots cover the actual
desktop and touch-mobile game. These are not physical-device frame-rate benchmarks.

## Mamak neighbourhood shopfronts

Six editable shop sources live in `generated/mamak-shops/source/`: Bengkel Azlan,
7-Eleven, Warung Kak Ana, ZUS Coffee, FamilyMart and KK Super Mart. Their scale and world
positions come from `shared/mamak-shops.json`. `shop-profile.json` extends the shared
Principled palette for this batch without changing the base template palette. Each shop
permits 4,000 triangles, seven materials/draws and 256 KiB; no textures or transparency.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python-exit-code 1 --python art/blender/scripts/build_mamak_shops.py -- \
  --output /tmp/lepakmamak-shopfronts-v1
node art/blender/tools/validate-mamak-shops.mjs /tmp/lepakmamak-shopfronts-v1
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-shops-browser.mjs
```

Use a fresh output directory for generation. The builder reopens each saved `.blend`
before exporting only `EXPORT`, and retains named part vertex groups. The validator checks
source/GLB hashes, Khronos errors/warnings, actual body raycast dimensions, front-facing
baked sign geometry, materials and budgets. Copy only validated exports into
`public/assets/models/shops/`. See `SHOPFRONTS-REPORT.md` for measured batch results.

`src/mamak-shops.ts` replaces each facade independently. A failed request leaves that
shop's batched procedural fallback visible; the other five can still load. Existing map
entries, building colliders, ZUS tables and all twelve playable ZUS chairs remain authoritative.
These assets are exterior scenery, not enterable interiors or new shop gameplay.

References: [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator), [Three.js GLTFLoader](https://threejs.org/docs/#GLTFLoader). Export options were also checked against the installed Blender 5.2.1 operator API.
