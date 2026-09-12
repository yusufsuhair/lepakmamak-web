# Character remodel V2 — Malay facial direction

Yusuf's requested revision: “buat macam muka orang melayu”.

Three fictional Malay character designs, retaining the cute proportions, outfits and palette of the first approval sample. The individual faces vary in cheek fullness, jaw shape, eye opening, brow weight, nose width and lip contour. The choices are art direction for these characters, not a claim that all Malay people share one face.

Changes from V1:

- Integrated nose bridge, nose tip, wings, cheeks and muzzle into the continuous head surface.
- Replaced round protruding eyes with almond-shaped openings, fitted lids, dark brown irises and smaller highlights. Irises are clipped to the eyelid boundary.
- Added tapered eyebrows with fine hairs and subtle nostril details.
- Replaced the drawn smile with shaped upper/lower lips and a restrained closed smile.
- Reduced skin gloss; preserved three skin tones and distinct face proportions.

Actual Blender Cycles renders, editable source and review GLBs are in `../generated/character-revamp-v2/`. V1 and its original Three.js avatar library remain available. Review outputs: `renders/faces.png`, `renders/lineup.png`, and `source/character-revamp-v2.blend`.

These are unrigged approval samples. Shader microdetail is procedural in Blender and has not been baked into glTF textures. No runtime integration or deployment is included. Browser mesh budgets, deformation, animation and texture baking remain pending visual approval.

Reproduce from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python art/blender/character-revamp-v2/build.py
node art/blender/character-revamp-v2/validate.mjs
```
