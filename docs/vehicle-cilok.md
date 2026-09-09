# City cars and Cilok

The 12 traffic cars and 10 Rembayung parked cars share stable IDs in `shared/fleet.json`. They are separate movable models, not baked into static building geometry.

The room server advances traffic at 10 Hz, validates nearby claims, and grants one driver per car. An NPC-occupied car offers Cilok; an empty car offers Enter. Player-driven cars use the existing passenger interaction. Ownership ends on exit/disconnect. The car remains parked at its last driven location until the room disappears or server restarts; this is not a persistent account purchase.

Clients interpolate fleet positions and use the existing driving controls after a successful claim. Other players see the selected car model. Ejected NPCs gesture for eight seconds; an original computer-generated voice line fades to silence at 25 world units and follows the sound-effects setting. `public/audio/angry-driver.wav` was generated with macOS Daniel speech, not sampled from GTA.

Validation: `npx playwright test tests/fleet.spec.ts tests/teleport.spec.ts --trace=off` covers contested claims, range/state validation, parked cars, disconnect cleanup, room isolation, driving, dismounting and map regressions.
