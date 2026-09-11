# Façade night readability pass

Continuation of `094da79` on `codex/mamak-facade`. This is a runtime lighting pass
on the existing Blender fixtures, not a new geometry export or a site rebuild.
All `.blend` / GLB files, furniture, chair IDs, collision and Blender scripts remain
unchanged. The façade GLB hash remains
`1dce4e5bf46bd55dd6d127ba6f84cc84be4faa2e5860c3990b647f0224a659bd`.

## Behaviour

`src/mamak-facade-lighting.ts` adds a warm, soft wash to the existing MAMAK MAJU
sign and the two side plaques. Four broad pools align with the Blender fixture X
coordinates: -41.65, -34, -24, -16.35 metres. The fixture lens height is 5.105m.
Only front-facing surfaces within world Y 3.48–5.13 and Z 42.25–43 participate;
soft edges and normal gating keep it off the windows, tables and sign backs.
This is an art-directed approximation, not physically simulated light or an extra
shadow-casting light. Existing canopy warmth and baked vertex colours are preserved
by composing the material's existing compile hook and cache key.

The wash is enabled only when the kit is ready, visible, and night is active.
Day/night changes update one uniform rather than recompiling materials. Failed
downloads do not illuminate the base site. Preview before/after hides the wash
together with the kit. The development probe's `setWashEnabled` isolates lighting
from geometry when comparing renders.

## Cost and portability

- No additional geometry, textures, draw calls or Three.js Light objects.
- Existing five façade draws and 3,732 triangles remain unchanged.
- Eight material instances receive the hook in the accepted site + kit preview.
- Four exponential falloffs add fragment-shader work within the sign region;
  this is not a claim of zero GPU cost. No physical-phone benchmark was run.
- The shader uses static world-space coordinates at the current Mamak location.
  Moving the restaurant or changing its scale requires updating this contract.
- Unity should reproduce the same band, normal gating, pool positions and night
  uniform in its own shader; this effect is intentionally not baked into the GLB.

## Verification

`tests/mamak-facade-lighting.spec.ts` compares actual rendered pixels after explicit
renderer draws. Desktop/mobile viewport probes verify brighter night lettering,
identical day pixels before/after, restoration on return to day, no changed table
or window pixels, unchanged draw calls, and no page/shader errors. The off-screen
side plaque in the narrow mobile view is excluded from its brightness assertion.
The desktop plaque is tested. These samples are not an accessibility contrast audit.

```sh
npm run build
PLAYWRIGHT_PORT=5293 npx playwright test tests/mamak-facade-lighting.spec.ts tests/mamak-facade.spec.ts tests/mamak-asset.spec.ts tests/mamak-realism.spec.ts tests/mamak-steam.spec.ts --output=test-results/mamak-facade-night-verified
```

Only isolated local verification is in scope. No merge, push or deployment.
The full application/admin regression suite has not been run.

Final verification: build passed; **20 focused tests passed in 1.6m**, including
all 25 seats, Low/High sit/stand, delayed-night loading and download failures.
One initial test checked optional-kit failure before the base GLB had loaded and
hit its five-second assertion timeout. It now explicitly waits for the base site;
the complete suite was rerun successfully. Screenshots and `verification.json`
capture the final run. The game connection notice is intentional in offline guest
tests, which close their mock multiplayer socket.
