# Rembayung Blender integration

The detailed photographic reconstruction is preserved in `assets/rembayung/rembayung.blend`. The city loads a separate web export, `public/assets/models/environment/LM_ENV_Rembayung.glb`, without blocking startup. The old solid placeholder has been replaced by a restaurant with an open entrance, dining aisles, staircase and accessible mezzanine.

## Placement

The entrance is at world **(-136, 0.12, 125)**. Blender X remains world X, Blender Z becomes world Y, and positive Blender depth becomes negative world Z. The 18 × 34 m shell occupies X [-145, -127], Z [91, 125]. Its proportions are photographic estimates.

This placement fits the existing southwest paved site without shrinking the furniture or crossing the street at Z=78. Existing buskers (-116,119), the ice-cream bike, parked cars, ownership IDs and teleport destination remain in place. The map marker points to the new entrance. The old 30 × 22 m solid is removed.

The western decorative palm is shifted forward to (-147,128), keeping its fronds outside the restaurant glazing.

## Runtime behavior

- `src/rembayung.ts` loads the compressed GLB into a group outside the city's static merge. Shared chair geometry becomes GPU instances. The visual fallback is removed only after a nonempty model loads successfully.
- `shared/rembayung.json` records placement and furniture collision bounds extracted from actual Blender object bounds. `src/rembayung-layout.ts` adds the shell, planters, privacy screens and guards.
- The ground-height function follows the staircase up to the 4.06 m mezzanine. The existing multiplayer Y field already supports this height; no server changes are needed.
- Movement collision remains active for furniture and rails. Camera obstruction additionally considers their top height so low rails do not force the camera into the avatar upstairs. Other city solids retain their existing behavior.
- Chairs and tables in this reconstruction are visual furnishings and collision geometry. They are not new networked game-table or reserved-seat IDs.
- If the model request fails, a batched procedural shell, furniture, planters, stairs and guards stay visible and navigable.

## Web budget

The web asset is **5,206,076 bytes**, with **41 material/instance draw batches** and **160,271 rendered mesh triangles** before the optional shadow pass. The isolated preview's shadow pass approximately doubles draw submissions. These counts are not a physical-phone FPS benchmark.

Web preparation removes render-only site context, replaces individual floor tiles with a small repeating texture, reduces foliage and chair detail, preserves shared chair meshes, and groups other meshes by material. Glass uses inexpensive alpha blending instead of an offscreen refraction pass. Meshopt compression is lossless relative to this web mesh, with every decoded stream checked byte for byte. The native high-detail reconstruction is untouched.

## Rebuild and check

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/export_rembayung_web.py
node scripts/blender/compress-rembayung.mjs
npm run build
PLAYWRIGHT_PORT=5198 npx playwright test tests/rembayung.spec.ts tests/collision-footprints.spec.ts tests/gt3-rs.spec.ts --output=/tmp/rembayung-game-tests --reporter=line
```

Choose a free server port and a fresh output directory when another task is running. The tests verify compressed decoding, drawing budget, desktop/mobile viewport rendering, failed-download fallback, collision-safe city placement, the entire stair route, actual game avatar height and camera clearance, and existing nearby car behavior.

For local review, run Vite on the task's own port and open `/rembayung-preview.html`. **Luar**, **Interior**, and **Mezzanine** select viewpoints; **Jalan** uses the same collision and height functions as the game. WASD or the on-screen buttons move; dragging looks around. This additional preview page is a development-only entry; the production game integration is in the normal city entry.

All work remains on `codex/rembayung-model`. No main-branch integration or deployment has been performed.
