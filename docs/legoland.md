# LEGOLAND destination

Open `/legoland.html`, or choose **Jom LEGOLAND · Johor** on the city title screen or in Settings. The resort is its own large scene (490 × 370 world units) rather than another neighbourhood squeezed inside the city's existing multiplayer coordinate bounds.

## Implemented

- Ten areas: The Beginning, Technic, Kingdoms, Imagination, Land of Adventure, City, NINJAGO, MINILAND, Water Park, and SEA LIFE.
- 47 named activities, with shared gameplay systems for coaster, boat/train, tower, spinning ride, driving checkpoints, shooting targets, building blocks, sliding, and exploration collections.
- Walking/running, touch direction buttons, wheel zoom, panorama, a location map and destination selector.
- A train circuit through the main park, distinct zone landmarks, block-style scenery, coaster tracks, water slides and aquarium displays.
- Choose block colours, place blocks on the workshop table by clicking, or use the accessible placement button. Undo before completing the eight-block challenge.
- Exit any attraction using its button or Escape. Help and background tabs pause the experience. Calm camera mode keeps the view fixed during automatic rides and defaults on for reduced-motion users.
- Device-local passport stamps in `lepak-legoland-pass-v1`. A completed attraction earns one stamp, including on replay.
- Static meshes are batched by material. The park loads as a separate Vite entry and only uses its own renderer while visiting.

## Scope and fidelity

This is a playable fan interpretation, not an official or survey-accurate replica. Zones, attractions and their positions are adapted; the nine shared gameplay systems are not full simulations of each real attraction. Several real-world activities (shops, aquarium exhibits and playgrounds) become building or collection challenges. It does not reproduce every real-world show, exhibit, restaurant, hotel room or attraction. It does not reuse the official map image or logo artwork.

The resort currently runs solo. It does not connect to the city WebSocket, change city currency or write to Supabase. Returning to KL loads the normal city page. Shared multiplayer rides, more accurate park layout and unique mechanics per attraction remain future work; no production or development deployment is included in this implementation.

## Reference

Official resort map and attraction pages inspected on 2026-09-10:

- https://www.legoland.com.my/explore/theme-park/park-map/
- https://www.legoland.com.my/explore/theme-park/rides-attractions/
- https://www.legoland.com.my/explore/water-park/rides-attractions/

The attraction catalog and coordinates are in `src/legoland-data.ts`; scenery and interaction code are in `src/legoland.ts`.

## Checks

Run `npm run build` and `PLAYWRIGHT_PORT=5196 npx playwright test tests/legoland.spec.ts --output=test-results-legoland`.

Tests cover all zone destinations, building/undo/stamp persistence, completing and leaving a coaster, mobile controls, actual canvas target hits, ordered driving checkpoints and proximity-based exploration collection. Browser screenshots verify desktop panorama and the mobile layout. These checks do not claim multiplayer or one-to-one real-park fidelity.
