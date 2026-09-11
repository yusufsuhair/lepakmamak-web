# Mamak ambience — first performance and motion pass

Local-only follow-up to V6. Existing Blender geometry/source files are unchanged.
Hot-tea steam is a Three.js runtime particle effect aligned to the five authored
tables and their cup offsets: 30 points, one transparent draw, no textures/lights,
no per-frame geometry upload or allocation. It indicates hot drinks rather than
animating controls or readable content. Motion uses continuous shader time, with
opacity fading at the beginning/end of each particle lifetime.

Steam is disabled on reduced motion, pause, hidden document, Smooth quality,
automatic quality reduction, failed GLB load, and beyond 35 m of Mamak centre.
The nearby view was inspected using the real exported V6 GLB.

## Performance sample

`LM_BASE_URL=http://127.0.0.1:5252 node art/blender/tools/profile-mamak.mjs /tmp/profile.json`

Chrome headless on this Mac, fresh guest, fixed daytime weather, desktop 1440×900
and emulated mobile 390×844. Each sample warms up 120 frames then records 240 RAF
intervals. These are browser frame intervals, not isolated GPU timings or physical
phone benchmarks; the world still has moving traffic/NPCs.

| View | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Desktop | 16.7 / 16.8 ms | 16.7 / 16.7 ms |
| Emulated mobile | 16.7 / 16.8 ms | 16.7 / 16.8 ms |

Whole-world mean draw counts varied around 2,683–2,720 desktop and 309–319 mobile.
This variation is NOT an optimization claim: visibility changes as NPCs/traffic move.
No broad city batching or shadow policy was changed. A physical-device profile and
identification of the high-draw subscenes remain necessary before targeted batching.

## Checks and scope

- Build passed (existing large chunk warning remains).
- Five focused Playwright tests passed: model/fallback/night lighting and steam
  reduced-motion, pause and quality behavior.
- Existing editable `.blend` files and unrelated template were preserved.
- No full regression, deployment, merge or remote push.
- Fan/bunting animation, ambient audio and food/menu interaction remain future work;
  this is the first lightweight ambience increment, not completion of those features.
