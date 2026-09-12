# Character remodel V1 — approval sample

Requested by Yusuf: retrieve the Three.js characters, remodel in Blender toward cute characters with realistic materials, and show examples before proceeding.

This delivery is **look development**, awaiting visual approval. The current shape language is a cute figurine; it does not yet achieve fully hyperreal skin, grooming or clothing. No game code, deployed assets, animation or production deployment was changed.

## Review

- `../generated/character-revamp-v1/renders/lineup.png`: actual Blender Cycles render of the three new samples.
- `../generated/character-revamp-v1/renders/faces.png`: close face/material view.
- `../generated/character-revamp-v1/source/character-revamp-v1.blend`: editable meshes, separate materials, curves, modifiers, camera and lighting.
- `../generated/character-revamp-v1/source/original-avatar-library.blend`: 24 exact original avatar shape combinations imported from Three.js GLB exports.
- `../generated/character-revamp-v1/references/original-lineup.png`: original comparison catalogue, ordered by `inventory.json`.
- `../generated/character-revamp-v1/exports/`: standalone unrigged review GLBs.

## Source inventory

The game uses `createPerson` and `applyAppearance` in `src/world.ts`, with options in `shared/appearance.json`. There are two gender selections, three hairstyles and nine non-empty tudung choices. This gives 24 structural combinations (2 × (3 + 9)); hair under a tudung is omitted from that structural count. Five skin colours, five hair colours, six shirts and four trousers are modular swatches, not separate authored character bodies. dUCk Luxe and Ruffle are marked coming soon in the current appearance UI.

`references/inventory.json` records the source commit, every option, the 24 export definitions, and all 27 `createPerson` source call sites. NPCs reuse this body with different shirt colours, seated poses and scale. Roles include roadside/crowd pedestrians, mamak chef/customer, sellers, traffic riders/drivers, buskers and audience, beach characters, rooftop DJ/swimmers and Durian Village residents. Role props and instruments remain outside the base avatar library. This inventory does not claim to export every combinatorial palette or complete NPC prop assembly.

## Revamped samples

1. Male short hair: original orange shirt, tan skin, sand trousers, dark hair.
2. Female bob: original green shirt, warm skin, denim trousers, brown hair.
3. Female short tudung: original teal tudung, brown skin, cream shirt, charcoal trousers.

Materials include procedural cloth/skin micro-bump, skin subsurface scattering, roughness differences and fine hair curves. These Cycles shader details are **not baked into GLB textures**. GLBs preserve geometry and supported PBR factors; they should not be expected to match the offline render exactly.

The meshes are unrigged and use separate parts. Full topology, deformation testing, mobile mesh budgets/LODs, texture baking and Three.js integration follow visual approval; these GLBs are review sources and are not ready for crowded browser gameplay.

## Reproduce

Run from `/Users/yusufsuhair/Downloads/astra`:

```sh
node art/blender/character-revamp-v1/export-originals.mjs
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python art/blender/character-revamp-v1/import-library.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python art/blender/character-revamp-v1/build.py
npm ci --prefix art/blender/tools --ignore-scripts --no-audit --no-fund
node art/blender/character-revamp-v1/validate.mjs
```

Blender was run as a separate background process. Source export uses the actual current functions through an isolated local Vite page with external browser requests blocked. GLB validation uses Khronos glTF Validator; detailed results are in `../generated/character-revamp-v1/validation.json`.
