# Mamak neighbourhood Blender props — 11 September 2026

Completed locally on `codex/blender-web-pipeline`. Four reusable assets were authored and
run in Blender 5.2.1 LTS, saved as editable `.blend` files and exported from EXPORT only.

| Asset | Triangles | GLB bytes | Material draws |
| --- | ---: | ---: | ---: |
| Palm | 888 | 64,320 | 3 |
| Wooden bench | 264 | 20,804 | 2 |
| Street-lamp body | 132 | 10,776 | 2 |
| Planter | 144 | 15,120 | 3 |

Total downloaded GLBs: 111,020 bytes (108.4 KiB). No textures, external fonts, rigs or lights
are exported. Per-prop limits are 1,200 triangles, three materials and 96 KiB. Named vertex
groups preserve editable parts; the existing shared Principled palette is reused.

The game places two palms, two decorative benches, one planter and five lamp bodies
(two decorative, three switchable). Instancing uses ten draws for the ten placements.
Source positions for existing trees/planter are retained, and the new bench collision avoids
all game chairs/table arrival points. The three switchable lamps preserve their original
IDs and luminous head/glow anchors, including both street orientations and night overrides.

Checks completed:

- All four GLBs: Khronos zero errors/warnings; Three.js geometry/material/scale checks passed.
- Independent rebuild: all four GLBs and 16 preview PNGs byte-identical; source hashes preserved.
- Application build passed; the pre-existing large JavaScript bundle warning remains.
- Initial relevant browser suite: 13/15 passed. Two new tests assumed one nearby switchable
  lamp; inspection showed three lamps inside the selected area. The tests now cover all
  three lamp anchors and ten placements. All four street-prop tests passed on rerun.
- Existing lamp interaction/state, Mamak fallback/seating, big-table layout and graphics
  quality tests passed in that suite. Full application regression was not run.
- Actual desktop and touch-mobile game walk-throughs passed with zero page errors.
  Model load failure retains the complete scenery fallback; the Mamak building loads independently.

Evidence: [GLB reports](generated/street-props/reports/three-validation.json),
[reproducibility](generated/street-props/reports/reproducibility.json),
[desktop game](generated/street-props/previews/game-desktop.png),
[mobile game](generated/street-props/previews/game-mobile.png).

The benches are decorative in this batch. Phone thermal/FPS measurements were not performed.
Deployment was not requested; changes remain on the local asset branch.
