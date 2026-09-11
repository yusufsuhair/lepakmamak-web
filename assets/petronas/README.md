# PETRONAS / Kedai Mesra forecourt

Detailed Blender reconstruction of the existing station opposite Mamak, at world
`(-31, 0, 112)`. This is not the Petronas towers or a surveyed real-world station.
The requested realistic direction supersedes the repository's default low-poly
asset style. The native Cycles renders use studio lighting; the optimized web model
uses the game's lighting and is not expected to look identical to a path-traced render.

## Deliverables

- `petronas.blend`: editable, named meshes, text, curves, packed PBR images, lights and camera.
- `renders/`: daylight, night, pump close-up and Mesra frontage.
- `game-preview/`: browser screenshots of the exact compressed export.
- `../../public/assets/models/environment/LM_ENV_Petronas.glb`: game export.
- Local interactive preview: `http://127.0.0.1:5199/petronas-preview.html`.
  Drag to orbit, scroll to zoom; Stesen / Pam / Mesra / Malam controls.

The 58 × 52 m site includes a ribbed canopy, layered fascia and illuminated branding,
six dispensers with hose/nozzle geometry, payment panels, raised islands, bollards,
drains, concrete joints and wear, storefront glazing, stocked shelves/chillers,
café counter and rooftop services. The V2 detail pass adds an air/water cabinet,
waste sorting, trolley corral, tactile crossing, guardrails, emergency-stop cabinet,
CCTV heads, canopy scuppers and pump hazard stripes. Prices are deliberately not invented.

## Integration and limits

`src/petronas.ts` replaces the original station only after geometry and all four
embedded images successfully load. A failed download or blocked embedded texture
keeps the complete previous forecourt visible. A local reflection probe affects
only PETRONAS materials. The existing pump-island, pylon and shop collisions,
arrival marker and busker area are unchanged. Mesra's stocked interior is visible
through glass but remains non-enterable, matching the existing shop collider.

No backend changes, merge, push or deployment are included in this asset task.
Work is isolated on `codex/petronas-polish`; the original `codex/petronas-model` branch
and main's unrelated pending work are untouched.

## Rebuild and verify

From the repository root (Blender 5.2.1, CPU Cycles):

```sh
npm ci
npm ci --prefix art/blender/tools --ignore-scripts
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python scripts/blender/build_petronas.py -- --no-render
node scripts/blender/verify-petronas.mjs
node scripts/blender/compress-petronas.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python scripts/blender/build_petronas.py -- --render-only
PLAYWRIGHT_PORT=5200 npx playwright test tests/petronas.spec.ts --output=/tmp/petronas-tests
npm run build
```

Re-export an edited source with `--export-only --no-render`, then validate and
compress. Do not save the joined export over the editable source. Render one view
with `--render-only --view 03`. Blender backup files are ignored, not deleted.

Measured export: 244,471 triangles, 27 material batches, 6,108,516 bytes after
lossless meshopt compression (84 streams, byte-for-byte decode verified).
`manifest.json` records the raw 9,479,888-byte export; `web-compression.json`
records the shipped compressed size. The raw Khronos validation has 0 errors and
0 warnings (two informational entries: unused logo tangent and non-power-of-two
logo image). Browser preview renders 56 calls including shadows.

Five scoped Playwright tests cover deployed CSP image/decoder loading, geometry
budgets, retained collision layout, download fallback, mobile city loading and
actual keyboard movement through the forecourt. The preceding combined run also
passed the existing Mamak and Rembayung asset regressions (12 tests total).

## Visual references

Official PETRONAS Mesra imagery inspected on 11 September 2026:

- [PETRONAS Mesra](https://www.mymesra.com.my/)
- [Official white logo SVG](https://www.mymesra.com.my/themes/custom/petronas/images/petronas-logo-white.svg)
- [Station/canopy reference](https://www.mymesra.com.my/sites/default/files/uploads/content/2025/homepage/gas-station.png)
- [Nozzle reference](https://www.mymesra.com.my/sites/default/files/uploads/content/2025/homepage/fueling.png)

`references/official-logo.png` is a transparent rasterization of the official SVG,
embedded into the model. Reference photographs are retained for provenance and
are not used as scene textures. Branding remains the property of its owner.
