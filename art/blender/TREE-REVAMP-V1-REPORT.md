# LepakMamak tree revamp V1

The live world uses four distinct tree treatments. This release rebuilds the two
repeated procedural families as deterministic Blender assets, refreshes the compact
Mamak palm, and verifies the already detailed Rembayung feature tree.

| Family | Runtime use | Result |
| --- | --- | --- |
| `LM_TREE_RainTree` | City roadside canopy | 356 triangles, 2 draws, 31,516 bytes |
| `LM_TREE_CoconutPalm` | KLCC, zoo, Rembayung exterior and Pantai Senja | 1,392 triangles, 3 draws, 103,220 bytes |
| `LM_PROP_PalmMamak` | Mamak street layout | 1,496 triangles, 3 draws, 110,948 bytes |
| Rembayung indoor feature tree | Inside `LM_ENV_Rembayung.glb` | Existing individual-leaf tree retained; procedural failure fallback upgraded |

Every new family rests at base-centre in metre scale, uses deterministic naming,
shared Principled BSDF palette materials, has no textures, animation, cameras or
lights in the GLB, and is exported only from `EXPORT`. Editable `.blend` sources,
four-angle renders and validation JSON are retained under
`art/blender/generated/tree-revamp-v1/`.

At runtime, repeated city trees are collected into one instanced batch per family,
parent and material. The old procedural versions remain visible until the complete
asset loads, and remain playable if a GLB request fails. Stable coordinate-derived
rotation prevents obvious repetition without introducing nondeterministic captures.

The rain tree and city coconut palm rows above are superseded by the photographic, textured
build in `scripts/blender/build_trees.py` (foliage version 5, `?v=trees-v2`); its budgets and
sizes are in `assets/trees/manifest.json`. The Mamak palm still comes from this pipeline.
