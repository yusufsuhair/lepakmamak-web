# Kampung Durian Runtuh module

The open neighbourhood lives in `src/durian-village.ts`. All building and resident positions are relative to `villageOrigin`. Moving that origin relocates the authored scenery and resident group together. Update map place 32 and teleport 32 when relocating.

`createDurianVillage` adds scenery, collisions and map footprints to a host world. `createVillageResidents` returns an independently animated resident group. The city batches static scenery with its existing material batches. Residents are hidden and stop updating beyond 85 world units. This uses distance culling, not network lazy loading: collision and map data are available immediately.

The neighbourhood includes a clubhouse exterior, Opah's house, Tok Dalang's home and vegetable garden, Tadika Mesra, Warung Muthu, a playground and 21 stylised residents with short scripted greetings. Added residents include Abang Salleh, Abang Iz, Dzul, Ijat, Devi, Rajoo, Ah Tong and Cikgu Jasmin. This is a recurring village cast, not every guest character from the series.

The routines in `src/village-activities.ts` use a shared elapsed clock with no frame-dependent accumulation:

- Upin, Ipin, Ehsan, Fizi and Dzul walk together then run in a trailing group on the west lawn. Their shared pace changes continuously along the route without teleporting.
- Mei Mei, Susanti and Devi stroll together on the east lawn.
- Mail and Rajoo cycle around the southeast lawn, with rotating wheels, cranks and articulated pedalling legs. Bicycles share the resident root so conversation follows the rider.
- Jarjit and Ijat play a continuous scripted badminton rally on the central court with rackets, a net and an arcing shuttlecock.
- Tok Dalang scatters grain to six chickens (including Rembo); the flock circles the feeding patch and pecks.
- Opah lifts washing to a clothesline with swaying garments, pegs and a laundry basket.
- Kak Ros sweeps leaves with a handheld broom.

These are ambient spectator activities, not player-controlled minigames. Reduced motion freezes all routines through the host's existing time-zero update; distance culling remains unchanged. `nearby` resolves dialogue against the current animated positions instead of spawn coordinates. Clothesline posts and the laundry basket are registered as static colliders.

The `Tegur <nama>` action is a lightweight local interaction. It places the resident's line in the same floating speech bubble used for character speech, anchored above the animated resident, and expires after a few seconds. It does not open a modal, pause the game or send a message through City chat/network chat.

Interiors, quests and autonomous conversations are not implemented. The dialogue UI is integrated in `src/main.ts`; move it with this module when exporting to another world. Verify with `PLAYWRIGHT_PORT=5184 npx playwright test tests/durian-village.spec.ts --output=test-results-game-dev-4`.
