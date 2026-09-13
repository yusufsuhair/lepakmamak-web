# LepakMamak character module V1

Replaces the procedural city avatars and wardrobe preview with modular Blender geometry based on Yusuf's approved V2 Malay facial direction. Includes two bodies, 24 hairstyles and 12 tudung styles. This is a curated game catalogue, not an exhaustive list of hairstyles worn in Malaysia.

## Deliverables

- Editable Blender source: `../generated/character-module-v1/source/character-module-v1.blend`.
- Exported assets: `public/assets/models/characters/` (38 self-contained GLBs and a manifest).
- Real model thumbnails: `public/assets/characters/thumbs/` (36 PNGs).
- Review: `../generated/character-module-v1/review/catalog.png`, `poses.png`, `wardrobe-in-game.png`, `wardrobe-390.png`, `wardrobe-1280.png`.
- Shared catalogue: `shared/character-styles.json`; persisted allowlist: `shared/appearance.json`.

| Collection | Styles |
| --- | --- |
| Rambut lelaki | Short klasik, Buzz cut, Crew cut, French crop, Side part, Comb over, Undercut, Quiff, Pompadour, Curtains, Mullet moden, Curly top |
| Rambut perempuan | Bob, Long bob, Panjang lurus, Panjang beralun, Panjang berlapis, Curtain bangs, Wolf cut, Pixie, Ponytail tinggi, Ponytail rendah, Sanggul, Tocang |
| Tudung | Pendek, Labuh, Turban, Shawl, Bawal, Satin, Instant, dUCk Luxe, Ruffle, Bawal labuh, Shawl loose, Tudung sukan |

Original saved hairstyle and tudung IDs remain valid. Collections suggest styles by body selection; every hairstyle works on either body. Selecting hair removes the tudung so the selected hair is visible. Wearing a tudung preserves the previous hairstyle and suppresses both hair and an equipped cap.

## Wardrobe and runtime

The existing inventory now offers Body, Hair, Hair colour, Skin tone, Tops, Bottoms and Tudung alongside owned accessories and skins. Style tiles show Blender renders. The 3D preview rotates, displays equipped items and remains visible while scrolling on phones. Loading failures expose a retry action. Guest storage and signed-in account metadata keep the same seven-field appearance format; queued saves prevent earlier requests overwriting the latest selection. WebSocket outfit messages now carry all seven validated appearance fields.

The city, bike riders, car drivers, NPCs, shop try-on and wardrobe all use `src/character-assets.ts` through the existing `createPerson` API. Stable limb/visual slots preserve dance elbows and gameplay props during asynchronous appearance changes. Models share cached geometry, with per-avatar palette materials. Disposal only releases owned palette materials. Avatar meshes opt out of static city batching so fallback bodies cannot become permanent ghost geometry.

The browser exports target approximately 3.9k triangles per body plus at most 800 per hairstyle/tudung — about 4.7k per avatar — with 12 body/style draws before accessories. All 38 GLBs together are approximately 720 KB after lossless EXT_meshopt_compression and before HTTP compression; individual avatars load a body and one style. The editable sculpt retains far more detail than the web exports.

`BUDGET` in `build.py` is sized against the size an avatar actually draws at: roughly 83px tall for the local player at the default camera, 60px for a neighbour at the mamak, and 280px at minimum zoom or in the wardrobe preview. Every surface is a smooth low-frequency form under smooth shading, so the silhouette rather than the triangle count carries the read. The first pass spent 5000 triangles on the head alone — nearly half the body — which is why the head is where most of the reduction came from. Remote avatars past 22 m or outside the nearest-24 detail budget are already replaced by a single shared capsule in `src/main.ts`, so the expensive articulated avatars are by construction the near ones; a per-model distance LOD would duplicate that existing mechanism rather than add to it. These exports are stylised cute characters with sculpted facial forms; they do not include photoreal skin scans, facial blendshapes, strand simulation or cloth simulation. Existing game poses use rigid limb pivots.

## Reproduce

Run from the repository root with Blender 5.2 and project Node dependencies installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/blender/character-module-v1/build.py
node art/blender/character-module-v1/compress.mjs
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/blender/character-module-v1/render_catalog.py
npm ci --prefix art/blender/tools
node art/blender/character-module-v1/validate.mjs
node art/blender/character-module-v1/review.mjs
npm run build
PLAYWRIGHT_PORT=5197 npx playwright test tests/character-module.spec.ts tests/inventory.spec.ts tests/avatar-hidden.spec.ts tests/wardrobe.spec.ts tests/shop-try.spec.ts --output=test-results-character-module
```

`build.py` derives the approved head/body from `character-revamp-v2/build.py`, retains editable source collections, bakes fixed colours into vertex attributes, creates material palette channels, reduces export geometry and writes a budget manifest, taking the asset version from `shared/character-styles.json` so the manifest cannot drift from the cache-bust key the loader uses. `compress.mjs` then applies the shared lossless EXT_meshopt_compression path to all 38 GLBs and refreshes the manifest to the sizes that actually ship, since `build.py` records each size before compression. The validator checks all expected assets, Khronos validation, finite bounds, self-contained buffers, transfer/triangle budgets, thumbnail presence and unique style geometry.

Focused browser checks cover all 36 styles on both bodies, palette changes, hidden hair, static-batching exclusion, late-load races, held props, download retry, shared geometry disposal, desktop/mobile wardrobe persistence, shop try-on isolation, full-game entry and peer appearance updates. The pose review renders the actual loaded GLBs in Three.js.

## Validation result

22 distinct focused browser tests passed across the final runs, including 72 body/style combinations. All 38 GLBs passed validation with zero errors and zero warnings. TypeScript and the Vite production build passed. Graphify was updated. The full repository suite and physical mobile devices were not tested. See `../generated/character-module-v1/checks.json` and `validation.json`.

## Release state

Integrated and verified locally. No deployment is included. Frontend assets/client and the server's complete outfit handler should be released together by the deployment owner.
