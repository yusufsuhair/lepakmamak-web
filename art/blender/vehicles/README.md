# Vehicle modeller 3

Scope: all twelve existing non-owner car styles plus Proton e.MAS 7. No motorcycles,
other vehicles, buildings, world lighting or owner Porsche assets were authored here.
Work is isolated on `codex/vehicle-model-revamp`; deployment belongs to Game Dev 1.

## Model coverage

| Game key | Model direction |
| --- | --- |
| `myvi` | Perodua Myvi AV, swept lamps, vertical DRLs, L rear lamps |
| `axia` | Perodua Axia AV, compact hatch, horizontal lamps |
| `emas` | Proton e.MAS 7, closed EV face, panoramic roof, connected rear LEDs |
| `avanza` | Toyota Avanza MPV |
| `vellfire` | Toyota Vellfire, tall cabin and layered chrome grille |
| `suv` | Original Lepak SUV; retains the previously unnamed style |
| `sport` | Original Lepak GT coupe; retains the previously unnamed style |
| `ferrari` | Original Ferrari-inspired berlinetta, not claimed as an exact factory variant |
| `lamborghini` | Aventador SVJ direction, Y LEDs, rear wing, carbon aero and engine louvres |
| `model-y` | Tesla Model Y fastback, glass roof, flush handles |
| `cybertruck` | Faceted stainless body, sail panels, ribbed tonneau, full-width LEDs |
| `police` | Malaysian POLIS patrol livery and lightbar |
| `f1` | Original open-wheel Formula car with halo, suspension and multi-element wings |

These are original game meshes and original procedural PBR textures, not manufacturer
CAD, scans or licensed factory replicas. Body shapes are interpretations. The Blender
studio renders use Cycles; the actual game uses Three.js raster lighting. The render
previews should not be presented as photographs or as pixel-identical game screenshots.

`taycan` and `gt3-rs` bypass the loader. Their source, paint, labels, plates, footprint,
fleet entries and ownership behavior stay unchanged. Existing Lamborghini claim rules
and its traffic style ID remain unchanged. The new `parked-emas` is in the authoritative
shared fleet at (-117.2, 134), beside the existing parking row.

## Files and coordinates

- `../generated/vehicles-final/source/*.blend`: 13 editable scenes. `SOURCE` contains
  individual authored components. `EXPORT` contains material-batched copies, four
  independent named wheel pivots, and embedded textures.
- `../generated/vehicles-final/previews/*.png`: Cycles studio inspection renders.
- `../generated/vehicles-final/textures`: original tyre normal, carbon twill and brushed
  steel roughness images; embedded and packed in the sources and GLBs.
- `../generated/vehicles-final/reports`: per-model Khronos validation and manifests.
- `public/assets/models/vehicles/*.glb`: validated Meshopt runtime files.
- `vehicles-preview.html`: local interactive showroom, model chooser, wheel spin and
  day/night lighting. This is a development entry, not part of the production Vite entry.

Units are metres. Blender -Y is forward / +Z up; glTF +Z is forward / +Y up.
Wheel pivots are `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`; positive X is the
right-hand driver side. Their local X axis is the rolling axle. Brake calipers remain
on the chassis. Source geometry is kept separate from the preview floor/cameras/lights;
only EXPORT objects enter the GLBs.

## Build, export and verify

Run from the vehicle worktree. The builder refuses an existing output directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python art/blender/vehicles/build_vehicles.py -- \
  --output art/blender/generated/vehicles-next
npm ci --prefix art/blender/vehicles/tools
node art/blender/vehicles/tools/pack-validate.mjs art/blender/generated/vehicles-next
npm run build
npx playwright test --config=playwright.vehicles.config.ts \
  tests/vehicle-revamp.spec.ts tests/taycan.spec.ts tests/gt3-rs.spec.ts \
  tests/lamborghini.spec.ts tests/car-seats.spec.ts tests/cars.spec.ts
```

The pack step requires all 13 models, preserves named pivots/materials and extras,
generates tangents, uses EXT Meshopt, and verifies zero glTF errors and warnings before
copying any model to public. Per-car limits: 45,000 triangles and 650,000 transfer bytes.
See `runtime-manifest.json` for measured sizes, triangles and SHA-256 values. The runtime
shares one download, geometry, material set and neutral reflection probe per style;
instances have independent wheel transforms. Private fallback geometry and labels are
disposed after a successful swap. The city renderer and Porsche materials are untouched.

The test configuration uses strict port 54531 (override with `PLAYWRIGHT_PORT`) and
refuses an occupied port. Use a local `npm ci`, not a node_modules symlink, because the
existing Porsche test imports Three.js through its raw filesystem path. Tests capture
the runtime GLBs, not only the procedural fallbacks, and exercise failure handling,
wheel-pivot invariance, transform/driver identity and e.MAS claim/release.

Local showroom:

```sh
npm run dev -- --host 127.0.0.1 --port 54532 --strictPort
# Open http://127.0.0.1:54532/vehicles-preview.html
```

## Reference provenance

Only dimensions/design references were consulted; no third-party meshes or textures
were copied. Generated registration plates are illustrative Malaysian-style plates.

- [Perodua Myvi](https://www.perodua.com.my/our-models/hatchback/myvi)
  and [manufacturer brochure](https://www.perodua.com.my/files/Myvi_Brochure.pdf).
- [Perodua Axia](https://www.perodua.com.my/our-models/hatchback/axia).
- [Proton e.MAS 7](https://emas.proton.com/e-mas-7/) and
  [Proton dimension announcement](https://www.proton.com/happenings/2024/august/proton-emas-reveals-name-for-first-malaysian-ev).
- [Lamborghini Aventador SVJ](https://www.lamborghini.com/en-en/history/aventador-svj).
- [Tesla Cybertruck dimensions](https://www.tesla.com/ownersmanual/cybertruck/en_us/GUID-12A976DD-EB60-431B-AFF1-5A37E95006DB.html).
