# LepakMamak Blender web-asset pipeline

Reproducible starting point for **Blender 5.2 LTS → GLB → Three.js**. The initial profile supports small, opaque, unrigged, untextured static meshes. It does not replace any game asset or change the live game.

## Build and verify

Tested with Blender **5.2.1 LTS** (build `9e2066aef7ef`), Node 24, the repository's Three.js, and the pinned Khronos glTF validator. Blender Python uses only Blender's bundled libraries. Run these commands from the repository root:

```sh
npm ci --prefix art/blender/tools --ignore-scripts
python3 art/blender/scripts/verify.py --generated /tmp/lepakmamak-assets-v1
```

The output directory must be absent or empty for a new build. `verify.py` can also verify an unchanged existing build. It refuses stale scripts/config or modified artifacts; use a fresh output directory when iterating. Hand-edited `.blend` files are never overwritten. The supplied completed build is in `art/blender/generated/`.

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

References: [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator), [Three.js GLTFLoader](https://threejs.org/docs/#GLTFLoader). Export options were also checked against the installed Blender 5.2.1 operator API.
