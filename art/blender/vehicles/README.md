# Vehicle modeller 3

Scope: all twelve existing non-owner car styles plus Proton e.MAS 7. No motorcycles,
other vehicles, buildings, world lighting or owner Porsche assets were authored here.
Work is isolated on `codex/vehicle-model-revamp`. Yusuf explicitly authorized the V2
development deployment and rebase; the branch remains available for a later merge.

## Realism pass V2

The current source is `../generated/vehicles-v2`; `vehicles-final` is the
preserved first pass. `realism.py` supplies separately authored body/cabin profiles for
the thirteen styles, compound roof curvature, an open greenhouse, curved glass,
RHD seat/instrument geometry, optical housings, wipers, bumper sensors, panel seams,
cast/forged/aero wheel faces and brake-disc detail. Cybertruck retains flat stainless
facets. The original unnamed SUV, coupe and Formula styles keep their identities.

The runtime adds front steering pivots, restrained acceleration/braking pitch and turn
roll, independent brake/reverse lamps, amber turn repeaters, and day/night LED intensity.
Automatic indicators follow steering input while moving; these are presentation effects,
not a new networked signal command. Chassis effects never change authoritative physics.
Each instance owns its animated lamp materials, preventing another driver's brakes from
lighting every car of the same style.
Existing driver avatars are seated and scaled for each cabin height; remote animations
retain that scale. The game applies a 12 cm visual offset to match its ground anchor,
placing tyres on the road without changing network positions or collision shapes.

Three Meshopt levels retain axle pivots: near, medium at 18 m and far at 42 m, with 12%
hysteresis. Optional lower-detail downloads can fail without removing a working near
model. A shared 64px cube probe samples the real scene near a visible car, at most once
every 20 seconds after significant camera movement or a lighting change. It only assigns
vehicle materials, so the city lighting and owner Porsche materials remain untouched.
Two pooled, shadow-free headlights illuminate the road for the nearest car at night.

These are more detailed original realtime interpretations, not scan-quality factory
replicas or a claim of photographic accuracy. Solar glass is tinted alpha glazing in
Three.js; Blender preview lighting is intentionally a separate studio setup.

## Photographic pass V3

`vehicle_textures.py` (numpy) generates one shared 1024 px detail atlas (colour, normal,
ORM) and a tiling paint-flake normal. `atlas_pass()` in the builder gives every trim, alloy,
caliper, interior, tyre, rotor, plate, badge and lamp lens UVs into it, and every one of
those parts except the lamps one material, `Vehicle detail atlas`. A car is therefore
paint + atlas + glass + its animated lamp materials on the chassis and one call per wheel:
12 draw calls at every level (police 13, Formula 6), down from 22-33. Tyres carry tread
blocks, sipes and embossed sidewalls; open rim barrels show a drilled rotor and caliper.
Plates and POLIS markings are textured plates, not font geometry. Plate strings all use
the letter I, which JPJ never issues, so none can be a real registration; badges are
generic chrome shapes with no manufacturer marks.

The GLBs embed 4 px stand-ins (`placeholders()`); the game loads
`public/assets/textures/vehicles/*.webp` once and `src/vehicle-assets.ts` swaps them in by
material name, keeping gltfpack's UV dequantisation transform. At runtime the paint is a
clearcoat over a metallic base (flake on the near level only), glass is dark and
dielectric, lamp lenses double as emissive maps, and traffic carries road dust on its
lower body (`setVehicleDirt`, 0 in the showroom). Until the local probe samples the city,
vehicles reflect the live sky from `weather.ts`. Positions pack at 12 bits near and
11 bits mid/far, UVs at 10 bits; tangents are derived in the shader.

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

- `../generated/vehicles-v2/source/*.blend`: 13 editable scenes. `SOURCE` contains
  individual authored components. `EXPORT` contains material-batched copies, four
  independent named wheel pivots, and embedded textures.
- `../generated/vehicles-v2/previews/*.png`: Cycles studio inspection renders.
- `../generated/vehicles-v2/textures`: original tyre normal, carbon twill and brushed
  steel roughness images; embedded and packed in the sources and GLBs.
- `../generated/vehicles-v2/reports`: per-model Khronos validation and manifests.
- `public/assets/models/vehicles/*.glb`: validated Meshopt runtime files.
- `vehicles-preview.html`: interactive showroom on local and deployed dev, with model
  chooser, wheel spin, steering, brakes, reverse and day/night lighting. The production
  Vite entry excludes it; `--mode dev` explicitly includes it for phone-based review.

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

The pack step requires all 13 models and creates 39 GLBs, preserving named pivots/materials and extras,
uses EXT Meshopt, and verifies zero glTF errors and warnings (bar the shader-derived tangent
notice) before copying any model to public. Per-car limits: 45,000 triangles, 650,000
transfer bytes, 14 draw calls and stand-in textures only.
See `runtime-manifest.json` for measured sizes, triangles and SHA-256 values. The runtime
shares each detail-level download, geometry and static material set per style;
instances have independent wheel transforms. Private fallback geometry and labels are
disposed after a successful swap. The city renderer and Porsche materials are untouched.

The test configuration uses strict port 54531 (override with `PLAYWRIGHT_PORT`) and
refuses an occupied port. Use a local `npm ci`, not a node_modules symlink, because the
existing Porsche test imports Three.js through its raw filesystem path. Tests capture
the runtime GLBs, not only the procedural fallbacks, and exercise failure handling,
wheel-pivot invariance, transform/driver identity and e.MAS claim/release.
V2 also verifies three-level LOD reduction, steering, reversing, braking and isolation
of animated materials between cars. `review_sources.py --directory <build-directory>`
reopens all editable Blender files, checks wheel/steering hierarchy and renders studios.

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
