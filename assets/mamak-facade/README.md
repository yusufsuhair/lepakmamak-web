# Mamak façade — additive Blender kit

Owner: Modeller 1. Branch `codex/mamak-facade`, based on `fe40dc2`.
Modeller 2 retains furniture/food/planters/foliage/paving. No full-site source,
Realism loader, chairs, tables, collision layout or shared Blender pipeline was edited.
Only the main app's small import/load/weather hooks are shared integration points.
No merge, push, dev deployment or production deployment is included.

## Contents

Window hoods and shutter accents, pillar capitals, canopy end caps and gutter,
raised outer sign frame, two `ROTI CANAI` / `TEH TARIK` plaques with `BUKA 24 JAM`,
and four overhead lamp housings/diffusers. Existing MAMAK MAJU lettering is retained.
This is an architectural detail pass, not a whole-site photorealistic rebuild.

`v1/LM_ENV_MamakFacade.blend` preserves the editable source; named part vertex
groups survive batching. The accepted site's packed source is a separate REFERENCE
collection instance for context. Only the five meshes in EXPORT enter the GLB.
Native CPU Cycles front/iso/right renders are alongside the source.
Only `public/assets/models/environment/LM_ENV_MamakFacade.glb` is served to the game.

## Contract and portability

- Metric units. GLB is +Y up, with web-world placement **(-29, 3.555, 30)**,
  scale 1 and yaw 0. Do not reuse the full-site model's zero-height origin.
- Minimum world geometry height is 3.555m: no new gameplay collision is required.
  Existing collision and all 25 seats remain authoritative and untouched.
- 3,732 triangles, 5 primitives/draw calls, 4 shared opaque PBR materials in GLB,
  277,504 bytes, no textures, animations, cameras or punctual lights.
- SHA256: `1dce4e5bf46bd55dd6d127ba6f84cc84be4faa2e5860c3990b647f0224a659bd`.
- `lm_version=1`, `lm_origin_world`, `lm_collision` and `lm_lamp_count` are node extras.
- The runtime clones only diffuser material to isolate it from plaque lettering.
  Warm diffuser emission is .04 by day and 2.0 by night, including late downloads.
  These are visible emissive fixtures, **not extra lights casting illumination**.
  Unity must recreate this day/night emission control and apply its established
  handedness conversion consistently to the mesh and placement.
- Failure to load the optional kit keeps the accepted Mamak intact. If both base
  Mamak downloads fail, the kit is not requested and procedural fallback remains.
- Preview utility is local-development only; it is not a production Vite entry.

## Reproduce safely

Run from this worktree, with Blender 5.2 LTS. Each output directory must be fresh;
the builder refuses to overwrite it. Preserve edited sources before rebuilding.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/blender/scripts/build_mamak_facade.py -- --out /tmp/mamak-facade-new
node art/blender/tools/validate-mamak-facade.mjs /tmp/mamak-facade-new/LM_ENV_MamakFacade.glb
```

To re-export hand edits, add `--source path/to/LM_ENV_MamakFacade.blend` and choose
another fresh `--out`. `--skip-renders` omits only previews. The original export,
a fresh independent build and a re-export of the saved source were byte-identical
at the hash above. Source references/preview lights are excluded from all three.
Older generated trials are retained outside the repository, not deleted.

## Local verification

```sh
npm run build
PLAYWRIGHT_PORT=5293 npx playwright test tests/mamak-facade.spec.ts tests/mamak-asset.spec.ts tests/mamak-realism.spec.ts tests/mamak-steam.spec.ts --output=test-results/mamak-facade-release
npm run dev -- --host 127.0.0.1 --port 5263 --strictPort
```

Check ports are free and tests point at this checkout. Local game: port 5263 `/`;
comparison studio: `/mamak-facade-preview.html` (front/angle/detail, before/after,
day/night). Tests exercise geometry height, decoded runtime materials, optional
failure, late night-state application, base fallback, seating, steam and quality.
Khronos validation has **0 errors, 0 warnings** and 5 informational unused-UV
entries (UVs are retained for future material authoring). Build has the existing
large-bundle advisory. A clean dependency install reported 6 dependency audit
findings; no dependency versions or lockfiles were changed by this asset batch.
This is focused regression, not the full application/admin suite or physical-phone
GPU benchmarking. No performance claim is inferred from mobile viewport screenshots.

Final result: build passed; **17 focused tests passed (2.4m)** on the final GLB hash
above, including all 25 seats, actual guest sit/stand and Low/High rendering. Browser
evidence is in `v1/browser/`. The connection notice in game captures is intentional:
tests close the mock multiplayer socket and use an offline guest. One intermediate
run was interrupted by a development reload during guest entry; it was discarded,
then the complete suite was rerun without code changes. `v1/verification.json`
records the final accepted checks, not results from that interrupted run.
