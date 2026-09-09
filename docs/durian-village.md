# Kampung Durian Runtuh module

The open neighbourhood lives in `src/durian-village.ts`. All building and resident positions are relative to `villageOrigin`. Moving that origin relocates the authored scenery and resident group together. Update map place 32 and teleport 32 when relocating.

`createDurianVillage` adds scenery, collisions and map footprints to a host world. `createVillageResidents` returns an independently animated resident group. The city batches static scenery with its existing material batches. Residents are hidden and stop updating beyond 85 world units. This uses distance culling, not network lazy loading: collision and map data are available immediately.

The initial neighbourhood includes a clubhouse exterior, Opah's house, Tok Dalang's home and vegetable garden, Tadika Mesra, Warung Muthu, a playground and 13 stylised residents with short scripted greetings. Interiors, quests and autonomous conversations are not implemented. The dialogue UI is integrated in `src/main.ts`; move it with this module when exporting to another world.
