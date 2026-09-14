# Branded stops: photographic pass

The seven LM_SHOP shoplots, the Shell forecourt and the KFC and McDonald's drive-throughs are
now built with the photographic kit in `scripts/blender/`, not with this folder's flat-palette
pipeline. The v1 facades (4,000-triangle budget, no textures, 2025) are in git history.

| Builder | Output |
| --- | --- |
| `scripts/blender/build_shops.py` | `public/assets/models/shops/LM_SHOP_*.glb` (all seven) |
| `scripts/blender/build_shell.py` | `public/assets/models/environment/LM_ENV_Shell.glb` |
| `scripts/blender/build_fastfood.py` | `public/assets/models/environment/LM_ENV_DriveThrough.glb` |
| `scripts/blender/brand_kit.py`, `brand_textures.py` | shared materials, geometry helpers, procedural textures |
| `src/brands.ts` | night lighting and local glass reflections at runtime |

## How they are made

- One material library for every brand. Surfaces are near-white procedural PBR textures
  (render with rain streaks, powder-coated panels with joints, porcelain tiles, brushed steel,
  forecourt concrete with fuel and oil stains, asphalt, pavers, timber slats, roller shutter,
  zinc) tinted per object with vertex colours, so one draw carries every colour of a fascia.
  Textures are WebP inside each GLB, 1024 px at most (the forecourt), mostly 512 or less.
- Brand marks are geometry in the brands' colours: the Shell pecten, the KFC roundel, stripes
  and bucket, the golden arches, the ZUS roundel, the Watsons cross, the 7-Eleven stripes and
  plaque, the FamilyMart and KK wordmarks. Nothing downloaded; lettering uses the system font.
- Ground floors are real rooms behind glass (lit ceilings, stocked shelving, counters, menu
  boards, seating), so shops read as open by day and glow from inside at night.
- Material names are the runtime contract (see `brand_kit.py`): `Night glow LED/sign/menu/shelves`
  emit more after dark, `Night wash` pools of light only draw at night, `... glass` and
  `Satin metal` reflect a painted street of their own (never `scene.environment`).
  `setBrandsNight` runs from the weather night callback in `src/main.ts`.

## Contracts kept

Colliders (`world.solids`), map footprints, the drive-through lanes, pump island and pylon
positions, ZUS pavement tables and all twelve chairs, audio anchors and the game's own canvas
signs on the Shell station (SHELL SELECT, deli2go, SHELL, 95 · 97, now turned to face the
street) are unchanged; `tests/city-brands.spec.ts` and `tests/mamak-shops.spec.ts` check them,
together with textures under the deployed CSP and the night switch.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_shops.py
node scripts/blender/compress-glb.mjs public/assets/models/shops/LM_SHOP_Watsons.glb   # and each other output
```

Previews from the game renderer: `assets/shops/`, `assets/shell/`, `assets/fastfood/`.
