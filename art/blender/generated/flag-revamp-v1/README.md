# Jalur Gemilang flag revamp v1

Blender-authored refresh for the two street flags in `LM_ENV_Furniture.glb`.

- 24×9 wind-fold cloth grid with a shallow free-edge sag
- printed polyester atlas with directional weave, fold normals and stitched-hem shading
- satin fabric response (sheen/specular tuned in Blender 5.2)
- three stainless hoist eyelets per flag
- existing flag positions, pole layout, runtime loader and draw count preserved

Source: `source/zoo.blend` (editable Blender scene). The reproducible builders remain
`scripts/blender/furniture_models.py` and `scripts/blender/furniture_textures.py`.

Build/export:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python-exit-code 1 --python scripts/blender/build_zoo.py -- --only=Furniture
node scripts/blender/compress-glb.mjs public/assets/models/environment/LM_ENV_Furniture.glb
```

The compressed export passed the GLB round-trip check (1,820,604 bytes); the existing
validator baseline remains at 0 errors and 17 known warnings from meshopt/tangent/NPOT data.
