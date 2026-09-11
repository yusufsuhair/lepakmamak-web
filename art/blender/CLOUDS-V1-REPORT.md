# Cloud sky v1

Blender-authored cumulus clouds integrated locally on `codex/blender-web-pipeline`.
Inspired by the soft sky appearance observed in the Dotonbori reference, not a copy
of its assets or a claim to use its internal rendering technique.

## Authoring and runtime

- Joined puffs, voxel union, smoothing and decimation produce an editable 1,350-triangle mesh.
- Source-only Principled Volume plus procedural density noise is rendered in Cycles CPU,
  48 samples, seed 17. A 512×256 RGBA atlas is packed into the saved `.blend`.
- Source: `generated/clouds-v1/source/LM_SKY_Cumulus.blend`.
- Proxy GLB: 38,232 bytes, one mesh/material; only EXPORT geometry. It is preserved for reuse,
  **not downloaded by the game**. Volume nodes do not transfer through GLB.
- Runtime: `public/assets/models/environment/LM_SKY_Cumulus.png`, 123,880 bytes,
  instanced camera-facing quads in `src/clouds.ts`. This is a baked cloud-card technique,
  not real-time volumetric rendering. Approximate RGBA8 GPU memory with mipmaps: 0.67 MiB.
- Sunny detailed: 9 cards/18 triangles; cloudy/rain detailed: 12/24; smooth/mobile-auto: 6/12.
  One cloud draw call; zero cloud shadows. Counts refer to clouds, not the entire city.
- Deterministic staggered placement and slow angular drift; reduced motion freezes drift.
- Existing KL weather/GM day-night drives tint; fog/haze hides clouds. Local rain switch
  now reapplies weather immediately, including clouds. Game rules and layouts are unchanged.
- Background-depth shader prevents distant buildings from being covered by cloud cards.
- If the atlas fails to load, the original clear-sky background and game remain available.

## Verification

- Blender export and Khronos: 0 errors, 0 warnings; one informational unused UV attribute on
  the untextured proxy (UV is intentionally retained for future material authoring).
- Two clean builds: proxy GLB, alpha PNG and four Blender previews byte-identical.
  Cycles initially embedded differing time/path text in PNG metadata; the builder now strips
  text-only ancillary chunks without changing compressed pixel data or colour profiles.
- Browser harness: decoded RGBA/sRGB atlas with partial alpha, desktop/mobile day/night,
  one draw call, no WebGL errors; farther-landmark occlusion matches a cloud-free control.
- Actual game screenshots: desktop/mobile day/night, guest entry, no page errors.
- 18 focused tests passed: cloud weather, reduced motion, quality caps, animation, missing
  download fallback, existing weather/GM authorization, rain toggle, Mamak and lamp regressions.
- TypeScript/Vite build passed. Existing large-JavaScript-chunk warning remains.

Physical-phone FPS, complete regression and production deployment were not performed.
The same cloud silhouette is reused with varied scale/aspect ratio; this is an initial
stylized cloud layer, not a full atmospheric simulation or a golden-hour lighting overhaul.

```sh
PLAYWRIGHT_PORT=5233 npx playwright test tests/clouds.spec.ts tests/weather.spec.ts tests/weather-controls.spec.ts tests/rain-toggle.spec.ts tests/lamp-switch.spec.ts tests/mamak-asset.spec.ts tests/performance.spec.ts --output=/tmp/lm-clouds-final-focused
node art/blender/tools/validate-clouds.mjs art/blender/generated/clouds-v1 SECOND_FRESH_BUILD
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-clouds-browser.mjs
```

Local only. No merge, push, dev deployment or production deployment.
