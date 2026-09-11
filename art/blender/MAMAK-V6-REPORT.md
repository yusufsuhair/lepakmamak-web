# Mamak V6 — courtyard finish

Local integration on `codex/blender-web-pipeline`. No merge, push or deployment.

## Delivered

1. Continuous curved festoon cables and faceted round bulbs, retaining 18 bulbs,
   six poles and avatar head clearance.
2. Three localized warm canopy pools at night, implemented on Mamak materials
   without extra real-time lights, textures or draw calls.
3. Wall-side drink crates, bin and handwash station, with shared collision footprints.
4. Deterministically varied palm fronds and nine-leaf planter clusters.

Blender 5.2.1 LTS authored/exported the geometry. Editable packed `.blend` sources,
textures and multi-angle previews are retained in `generated/mamak-maju-v6/` and
`generated/street-props-v2/`. Only validated GLBs were copied to public assets.
The unrelated untracked template `.blend` was not modified or committed.

## Validation

- Mamak: 15,813 triangles, 9 primitives, 3 meshes, 7 materials, 1,190,856 bytes.
- Mamak GLB SHA256: `4e566998e44aa4682505ec5e353803b530c15f2e373514e5f4ecc88e87df300f`.
- Palm: 888 triangles, 64,324 bytes. Planter: 264 triangles, 27,360 bytes.
- Khronos validation: zero errors/warnings; props have informational unused-UV notices.
- Actual exported furniture geometry: five tables and 25 playable chairs verified.
- Blender profile tests: 11 passed, including service geometry within collision bounds,
  export isolation, unchanged source, textures, inlays and festoon head clearance.
- Two independent Mamak builds: eight GLB/texture/render artifacts byte-identical.
- Focused Playwright suite: 15 passed (assets, streets, shops, streetlights).
- Desktop/mobile, day/night local browser checks: loading and sit/stand passed,
  no page errors. Warmth A/B checks passed with nine asset draws and no WebGL error.
- `npm run build`: passed; existing large-bundle warning remains.
- Inspected game night view, counter lighting comparison and Blender foliage renders.

Browser evidence targets `http://127.0.0.1:5252/`; focused tests used separate port 5255.
Full application regression and physical-phone FPS profiling were not run. Whole-world
desktop draw counts remain high (~2,700); nine draws refers only to this Mamak asset.

## Portability

The warm canopy treatment is a Three.js runtime shader, not a baked lightmap or GLB
feature. Unity can reuse geometry/material textures but must recreate this lighting.
The existing counter AO/normal textures remain separate from direct illumination.
