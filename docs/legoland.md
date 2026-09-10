# LEGOLAND in the LepakMamak city world

LEGOLAND is a large neighbourhood west of the existing city, not a separate page. Walk west through the connector at z=0, or open the existing city map and select **LEGOLAND · Pintu Masuk** to teleport to (-198,0). The old /legoland and /legoland.html URLs redirect to the city root.

The same avatar, scene, renderer, camera, input controls, chat and WebSocket room continue throughout the visit. There is no park-only renderer, account, page or multiplayer session.

## Activities

Ten themed areas and 47 adapted activities reuse nine gameplay types: coaster, boat/train, tower, spinning ride, driving checkpoints, shooting, building, sliding and collecting. Walk near a sign and press Main tarikan; press Keluar tarikan to return to the ground. Existing city movement and camera controls remain active for manual activities.

Automated rides and occupancy are authoritative on the city server. Other players receive the rider position and height through normal room snapshots. One player uses an attraction at a time. Shared rides continue while a participant has Settings open. Building objects, targets, checkpoints and passport stamps remain device-local; these are not shared rewards or Supabase records.

## Implementation

- shared/legoland.json: one catalog for client and server.
- shared/legoland.mjs: coordinate transform, duration, ride paths and exits.
- server/legoland.mjs: validated boarding, occupancy, timed motion and exit.
- src/legoland.ts: batched scenery attached to the existing world and contextual HUD.
- shared/world-bounds.mjs: existing city plus west park and connecting corridor.
- Map, location save, districts and server movement support the extended world.

## Scope

This is a playable fan interpretation, not an official or survey-accurate replica. Activities and positions are adapted; the shared gameplay types are not full simulations of each real ride. No official map image or logo artwork is reused.

Official reference pages inspected on 2026-09-10:
- https://www.legoland.com.my/explore/theme-park/park-map/
- https://www.legoland.com.my/explore/theme-park/rides-attractions/
- https://www.legoland.com.my/explore/water-park/rides-attractions/

## Verification

Run npm run build and PLAYWRIGHT_PORT=5198 npx playwright test tests/legoland-world.spec.ts tests/teleport.spec.ts --output=test-results-legoland.

Tests cover connected movement bounds, park entrances, boarding validation, occupancy, automatic completion, two real city WebSocket clients observing rides and chat, desktop/mobile ride/exit without navigation or reconnection, and existing map teleport/3D selection. Deploy frontend and realtime together to development only; production remains outside this assignment.
