# Street sign board texture revamp v1

Blender-authored refresh for the two DBKL-style street boards in `LM_ENV_Furniture.glb`.

- full shallow board volume: front, rear and all four edges use the textured atlas
- reflective green paint with subtle weathering, raised white labels and tangent-space normal detail
- `JALAN LEPAK` and `KLCC ↑` keep their existing positions, dimensions and posts
- procedural canvas signs remain only as a load-failure fallback and are removed after the GLB swap

Source: `source/zoo.blend` (editable Blender scene). Reproducible builders remain
`scripts/blender/furniture_models.py` and `scripts/blender/furniture_textures.py`.

Build/export:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python-exit-code 1 --python scripts/blender/build_zoo.py -- --only=Furniture
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Furniture.glb
```

The compressed GLB passed the lossless meshopt round-trip check. Khronos validation reports
0 errors and 18 known tangent-space warnings (the previous asset had the same warning class).
`tests/street-furniture.spec.ts` passed with the textured street-sign primitive present and no
procedural canvas duplicates.
