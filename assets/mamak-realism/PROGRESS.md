# Mamak realism — AFK work log

## Authority and workspace

Yusuf authorized continued autonomous hyper-realistic modelling of Mamak and its
immediate surroundings on 11 September 2026 while AFK. No asset-by-asset approval
is needed. This does **not** authorize merging, pushing or deploying. No agents.

Worktree: `/Users/yusufsuhair/Downloads/astra-mamak-realism`
Branch: `codex/mamak-realism`, based on main `9f83fc5` (includes Mamak V6).
Do not touch the main checkout or the other model task worktrees.
PETRONAS is separately complete on `codex/petronas-model`, commit `86d6859`;
it has not been merged into this worktree or main. Do not redo PETRONAS.

Heartbeat automation `mamak-realism-afk` continues this task every 30 minutes.
Read this file and git status before the next batch. Keep notifications to
meaningful completed batches or genuine blockers; do not repeatedly request approval.

## Batch 01 — dining furniture and tabletop detail

Implemented and locally integrated:

- Five tables at authoritative `shared/tables.json` positions, rolled stainless
  rims, speckled laminate tops, spun pedestal bases and nonmarking feet.
- All 25 gameplay chairs plus the existing reserved NPC chair: dished seats,
  tapered legs, curved red plastic back frames and ventilated slats.
- Glass-look tea mugs/handles, tea/foam, ceramic plates, layered browned roti,
  curry saucers, correctly joined spoons and folded tissue holders.
- Six embedded texture images in the complete Mamak derivative (four new PBR
  images plus the existing counter AO/normal). No external image requests.
- Original V6 architecture, service counter, signs, festoons and gameplay retained.

The original furniture vertices are removed from the V6 source by named vertex
groups before replacement, so there are no overlapping old chairs/tables. The
original V6 source and deployed asset remain intact. This is a detailed rendering
pass, not a claim that the entire city is now photorealistic. Food material and
glass are deliberately lightweight web approximations. People remain stylized.

### Files and measured budget

- Builder: `art/blender/scripts/build_mamak_realism.py`
- Editable source: `assets/mamak-realism/mamak-realism.blend`
- Native CPU Cycles renders: `assets/mamak-realism/renders/`
- Compressed export: `public/assets/models/environment/LM_ENV_MamakMaju_Realism.glb`
- Loader: `src/mamak-realism.ts`, hooked into `src/main.ts`.
- Preview: `http://127.0.0.1:5201/mamak-realism-preview.html`
- Preview controls: dining / tabletop / full site / original V6 / night.
- Geometry: 134,900 triangles, 18 material draws (37 preview calls with shadows).
- Web download: 6,688,140 bytes, down from 10,240,212 raw bytes.
- Compression: 78 lossless streams, every stream decoded byte-for-byte.
- Raw Khronos validation: 0 errors, 0 warnings. Informational unused UV/tangent
  entries remain for unchanged V6 primitives; these are not validation failures.

### Verification completed

`npm run build` passes; only the existing large JS chunk advisory remains.
Eight scoped Playwright tests passed on the **correct worktree** using port 5292:

- All embedded PBR images decode under production CSP, no JS eval relaxation.
- Before/after, night and mobile views load.
- Actual exported geometry is raycast at all 25 authoritative chair positions:
  seat surfaces ~0.62 m and backs >1.15 m, tabletops exactly 1.145 m.
- Real guest avatar sits and stands on an upgraded chair.
- Failed new download falls back to unchanged V6; if both downloads fail, the
  complete procedural Mamak remains visible and seating remains playable.
- Existing Mamak festoon/day/night tests still pass.

The game seating screenshot intentionally uses an offline guest; its connection
notice is caused by the test's closed mock socket, not an asset failure.
An initial run accidentally targeted an unrelated pre-existing main server on
5202. That run was discarded; **do not use port 5202**. Verify a test port is free
before starting because the shared Playwright config permits server reuse.

## Next batch

Prioritize the two planters near the Mamak canopy and realistic broadleaf foliage,
then nearby paving (material grain, joints, subtle wear) and service-front detail.
Stay close to Mamak; do not rebuild distant landmarks or alter avatar rigs/gameplay.
For vegetation, replace existing planter/leaf vertices via named V6 groups,
retain their existing locations and walkable paths, and keep materials batched.
Native source may be denser than the game export. Keep the incremental GPU and
download cost measured; avoid hundreds of leaf objects becoming separate draws.
If food is revisited, make roti less uniformly round and the foam less bead-like.

## Rebuild notes

The builder refuses to overwrite the editable source during a fresh `--build`.
When intentionally regenerating, first preserve the existing source in a uniquely
named file under ignored `assets/mamak-realism/drafts/`. Never delete user edits.
Use `--export` to export an intentionally hand-edited existing source.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/blender/scripts/build_mamak_realism.py -- --build
node art/blender/tools/pack-mamak-realism.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/blender/scripts/build_mamak_realism.py -- --render
PLAYWRIGHT_PORT=5292 npx playwright test tests/mamak-realism.spec.ts tests/mamak-asset.spec.ts --output=/tmp/mamak-realism-verified
npm run build
```

Dependencies are installed in this worktree (not symlinked). The validator is from
`art/blender/tools/node_modules` and is installed with
`npm ci --prefix art/blender/tools --ignore-scripts`. Keep previews on 5201, or
choose another verified-free local port if this process has ended.

Known pipeline pitfalls handled here: generated packed Blender images can retain
stale buffers, so reload fresh FILE images and pack after saving PNGs. Transform
world-authored mesh vertices around their actual center, not the object origin.
Use CPU Cycles; do not launch a second GUI Blender or change the user's open scene.
