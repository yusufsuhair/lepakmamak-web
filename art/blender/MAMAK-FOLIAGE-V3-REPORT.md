# Mamak foliage V3 — palms and planters

This batch is isolated to the reusable neighbourhood props around Mamak Maju.
Façade, signage, awning and façade lighting remain owned by the parallel facade
task. No collision IDs or player seat coordinates change. Paving remains in the
validated Mamak site derivative and is not overlaid here, avoiding z-fighting or
full-site binary conflicts.

## Geometry

- `LM_PROP_PalmMamak`: 760 triangles, 63,720 bytes, three palette materials.
  Six tapered trunk sections carry cream growth rings, a crown sheath, coconuts,
  curved rachises and alternating double-sided pinnate leaflets. The leaflets
  use no alpha texture, so distant mobile views do not incur transparency sorting.
- `LM_PROP_PlanterMamak`: 720 triangles, 61,172 bytes, three palette materials.
  The planter adds an inset soil tray, body band, drainage feet, 14 folded
  broadleaf blades, 14 stems, six low-poly soil pebbles and inner leaf clusters.
- Existing bench and street-lamp props are copied unchanged: 264/20,804 bytes
  and 132/10,776 bytes respectively.

All four remain below the established per-prop limit of 1,200 triangles, three
materials/draws and 96 KiB. Every GLB has one mesh node, no textures, no lights,
and an opaque front-face material. Palm and planter nodes carry
`extras.lm_foliage_version = 3`.

## Reproducible source and checks

Builder: `art/blender/scripts/build_street_props.py` (Blender 5.2.1 CPU).
Fresh editable sources, previews and reports are under
`art/blender/generated/street-props-v3/`; only `exports/` are runtime files.
The prior V2 sources remain intact under `street-props-v2/`.

`validate-street-props.mjs` passes all four assets with zero Khronos errors and
warnings. The V3 palm and planter each render from front, right, top and iso
previews and retain zero-height ground contact. Runtime cache key is bumped to
`foliage-v3` in `src/mamak-streets.ts`; the all-or-nothing street fallback still
works if any asset fails.

This is an asset-only branch batch. It has not been merged, deployed, or used to
alter the façade task's full-site model.
