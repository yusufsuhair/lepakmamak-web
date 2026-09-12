# Midnight Elegance — Meshy texture refinement

Source supplied by Yusuf: `Meshy_AI_Midnight_Elegance_0912154937_texture_fbx.zip`.
Direction: the approved black tank top, black tailored shorts, pointed black
heels and gold accessories reference. The source archive remains unchanged.

## Result

`meshy-reference-refined.blend` is the editable source with packed images.
`textures/` contains 4096 × 4096 PNG maps: base color (sRGB), roughness,
metallic, tangent normal (OpenGL), skin mask and hair mask (Non-Color).
The 2K roughness and metallic sources are baked at 4K for a consistent set;
this does not imply additional photographed detail.

The changes use the lossless source PNGs rather than the embedded FBX JPEGs,
warmer skin color, matte cotton/twill response, darker espresso hair with
softer highlights, controlled black pump gloss, refined metallic response,
and reduced/renormalized normal-map strength. Existing color detail and UV
placement are preserved. The saved workshop material retains the editable
adjustments; the assigned material uses the baked maps.

`before-front.png` and `after-front.png` use the same camera, lights, exposure
and color management for a fair material comparison. `refined-hero.png` is
rendered from the final baked material.

## Scope and limitations

The supplied Meshy geometry is retained, normalized to 1.700 m overall height
including heels to continue the companion brief. There is no resculpting,
retopology, new rig or game integration in this pass. The imported model has
no handbag. Generated geometry/UV artifacts around eyes, hair and jewelry
remain: texture/material refinement alone does not make this a pixel-exact
or finished photorealistic reconstruction of the reference.

The source has 1,518,522 vertices and 3,038,796 triangles. Shape and UV checks
against the normalized baseline are recorded in `validation.json`.

Large source archives, Blender files and texture binaries remain local and
are intentionally excluded from Git. The work scripts, notes, validation and
preview images are tracked. No services were deployed.

## Rebuild

With the archive extracted into `source/`, run Blender in background with
`inspect.py`, `setup.py`, `refine.py`, then `bake.py`. Use `validate.py` to
reopen the final blend and check geometry, UVs, packed textures and dimensions.
