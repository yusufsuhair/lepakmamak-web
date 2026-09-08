# LepakMamak — browser prototype plan

## Direction
A stylised third-person open-world game in a fictional, compressed Kuala Lumpur. KLCC anchors the skyline; Mamak Maju anchors the neighbourhood. Warm late-afternoon light, colourful shophouses, tropical foliage, left-side traffic, and local signage establish the setting.

## First playable slice (this build)
- A live 3D title screen and keyboard/touch controls.
- One connected neighbourhood with a main road, cross streets, a KLCC park, shophouses, and an open mamak courtyard.
- A Malaysian protagonist who can walk, run, mount a kapcai, drive, brake, and dismount.
- Collision against buildings and street furniture, moving traffic, and pedestrians.
- A complete food delivery: collect at the mamak, deliver outside KLCC, earn RM 25. Repeat deliveries or free roam.
- A north-up minimap, destination beacon, interaction hints, mission feedback, speedometer, pause/settings, and saved earnings.
- Optional rain, looping music, and sound. Desktop keyboard is the primary target; touch controls provide a secondary path, including a reachable recall emote button.

## Implementation
Vite + TypeScript + Three.js. Browser GPU renders every frame. Procedural geometry is bundled with the app, with no external model services. Static meshes are merged by material, geometry/materials reused, device pixel ratio capped, and shadows switchable. Simple substepped circle/AABB collision supports arcade movement without adding a physics engine. Settings and tab blur do not pause the game; held inputs clear to prevent stuck movement. Background rendering remains subject to browser throttling.

## Build order
1. World blockout, readable landmark silhouettes, mamak, and street composition.
2. Walking/camera and bike movement with collision.
3. Delivery state machine, HUD, minimap, earnings persistence.
4. Atmosphere, traffic, pedestrians, sound, rain, and input polish.
5. Typecheck, production build, browser inspection, and gameplay smoke tests.

## Acceptance
The user can start, pick up a mission, enter the bike, ride a connected route, dismount, complete delivery, and see the reward persist on reload. Collisions prevent entering buildings; settings keep simulation running; reset recovers the player without granting rewards. No browser runtime errors in the tested desktop flow.

## Later milestones
Replace selected objects with Blender-authored GLB assets; add character rigging and better bike animation; extend missions and map; improve traffic AI; add pursuit mechanics. Multiplayer, combat, large interiors, and a city-scale map are outside this first slice. Rain is initially a visual weather option, not a traction simulation.

## Live release and multiplayer direction
The frontend is published on Cloudflare Pages and the realtime service is published on Railway. The browser executes the game and stores earnings locally; multiplayer guest rooms do not need a database yet.

Supabase Auth now stores email/password accounts and display names. Railway verifies the Supabase session before joining its in-memory `kampung` room, then broadcasts player movement, chat, and recall emotes. Email confirmation is disabled for initial immediate entry; configure custom SMTP before depending on verification/recovery emails. Chat and world state are temporary; accounts persist. Add application tables when inventories or progress need to follow players between devices.
