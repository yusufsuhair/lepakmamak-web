# Rembayung · reference reconstruction

A Blender reconstruction of the Rembayung restaurant, based on Yusuf's four supplied photographs and the 35.92-second edited walkthrough video. The exterior references are images 1 and 4; the interior references are images 2 and 3. The building is a continuous space, not a set of disconnected scene facades.

## Deliverables

- `rembayung.blend`: editable architectural scene, packed original wordmark, procedural materials, lighting, furniture, planting and four cameras.
- `rembayung.glb`: portable PBR geometry export, including exterior and interior. Blender's procedural material grain is not baked into this export; use the native file for the most faithful render appearance.
- `renders/`: blue-hour facade, interior towards the rear, interior towards the front, and aerial exterior views.
- `manifest.json`: estimated dimensions and generated asset statistics.
- `verification.json`: checked export statistics, successful Blender round-trip import, and full-size render dimensions.
- `references/`: the four user-supplied still photographs and original edited video.
- [Model generator](../../scripts/blender/build_rembayung.py): deterministic Blender Python source.
- [Artifact verification](../../scripts/blender/verify_rembayung.py): native mesh checks and a GLB round-trip import.

## Reference features modelled

Tall continuous gabled roof; graphite standing seams; honey-toned ceiling; dark steel portal frames, tension rods and suspended fans; fully glazed front gable with the original Rembayung script; dark entrance fascia; open glass entrance doors; side glazing and bamboo blinds; terracotta dining areas separated by grey concrete aisles; timber tables; bentwood and cane-backed chairs; slatted timber pergolas; woven pendant lamps; planting strips; large central tree in a cream ceramic pot; glass kuih cabinet; rear red-brick wall, staircase and mezzanine.

The four saved cameras correspond to the reference directions. Use Blender's Outliner collections to hide the roof for a plan view or isolate the furniture, glazing, planting or site.

## Scale and uncertainty

Blender uses metres. Estimated shell: **18 m wide × 34 m deep**, **7.5 m eaves**, **14.1 m ridge**, mezzanine floor around **4 m**. These are photo-derived working proportions, not surveyed dimensions. X runs across the facade, positive Y runs towards the rear, Z is vertical. The entrance threshold is at the origin.

The high interior shot looking towards the reversed logo establishes the relationship between the front facade and rear mezzanine. The floor-level reverse shot establishes the brick wall and stair. Furniture counts, exact spacing, stair dimensions, rear service openings and obscured areas are approximations. The kitchen, toilets and neighbouring buildings are not reconstructed from unseen evidence. The paved forecourt and road are contextual geometry.

## Rebuild

From the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/build_rembayung.py
```

Append `-- --draft` for smaller preview renders, `-- --no-render` for modelling/export only, or `-- --render-only` to render the saved native file. CPU rendering is the portable default; `--metal` opts into Apple Metal when its shader compiler is available. The script overwrites only its named generated outputs in `assets/rembayung/`.

Use `--views=01,03,04` to render selected viewpoints. Validate the complete full-resolution deliverable with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/verify_rembayung.py
```

## Integration boundary

This package is an independent modelling deliverable on `codex/rembayung-model`. It does not replace the existing procedural Rembayung in `src/world.ts`, change gameplay collisions, or deploy a frontend. Its physical footprint differs from the old placeholder. A later integration must reconcile world placement, collision geometry, walkable entrances and the mobile rendering budget. The GLB is a review/interchange asset, not yet a profiled mobile LOD.
