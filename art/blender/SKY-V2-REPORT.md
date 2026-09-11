# Atmospheric sky v2

Replaces repeated cloud cards with a continuous Three.js sky shader. Local branch only:
`codex/blender-web-pipeline`. Inspired by the Dotonbori reference's soft, connected clouds
and dusk palette; no reference assets/code were copied and exact visual parity is not claimed.

## Implementation

- A camera-centred sphere carries a continuous directional gradient, warped value noise,
  five-octave lower clouds and a second thin layer. No identical cloud silhouettes.
- Smooth/mobile-auto mode reduces this to three octaves and one layer.
- Deterministic 128×128 RGBA noise lookup, generated once from a fixed seed: 64 KiB,
  linear-filtered, no colour conversion, no mipmaps and no network texture request.
- One sky draw, 960 dome triangles, no shadow passes. Far background depth and no depth
  writes allow every world object to occlude the sky, including distant landmarks.
- Motion advances slowly with the game clock; reduced motion holds shader time at zero.
- Day, dusk and night palettes; dusk/dawn strength comes from the same approximate KL
  solar model as the existing day/night calculation. It is not fixed to Japanese 17:30.
- Sunset blends the existing sun colour/intensity and ambient intensity; fog and horizon
  share colour. Weather/GM overrides remain authoritative. Forced day/night suppress dusk.
- Rain/cloudy lowers the density threshold; fog/haze suppresses clouds, keeping atmosphere.
- Existing Blender Mamak assets, collisions, furniture and game rules are untouched.

Runtime code is `src/clouds.ts`; solar integration is `src/weather.ts`.
This is a projected procedural sky, not true 3D volumetric ray marching or a physical
atmospheric-scattering simulation. Unity would need its own shader implementation;
the previous `.blend`, proxy GLB and cloud atlas remain preserved under `clouds-v1/`.
Only the unused public v1 PNG was removed; it is recoverable from Git and the archive.

## Verification

- TypeScript/Vite build passed; the existing large-bundle warning remains.
- 18 focused tests passed, covering weather, night, twilight, GM authority, manual rain, smooth mode,
  reduced motion, drift, no image dependency, Mamak fallback, lamp controls and graphics.
- Browser harness renders desktop/mobile day, dusk and night: no shader console errors,
  no WebGL errors, one draw and deterministic fixed-time screenshots.
- Sky occlusion matches a foreground-only control; night is measurably darker than day.
- Six actual-game captures use guest entry, desktop/mobile contexts, real camera dragging
  and deterministic weather times (14:00, 19:00 and 23:00 MYT). No page errors.
- Visually reviewed isolated dusk, Mamak dusk, daytime and mobile-night captures.
- Local isolated rendering timings are recorded in `generated/sky-v2/reports/browser-render.json`.
  Zero medians are rejected as insufficient timer precision, not reported as zero-cost rendering.
  Any usable result is an isolated measurement on this computer, not whole-game FPS,
  a physical-phone benchmark or a performance guarantee.

Full regression and physical-phone checks were not run. No merge, push or remote deployment.

```sh
PLAYWRIGHT_PORT=5233 npx playwright test tests/clouds.spec.ts tests/weather.spec.ts tests/weather-controls.spec.ts tests/rain-toggle.spec.ts tests/lamp-switch.spec.ts tests/mamak-asset.spec.ts tests/performance.spec.ts --output=/tmp/lm-sky-v2-focused
LM_BASE_URL=http://127.0.0.1:5192 node art/blender/tools/test-sky-browser.mjs
```
