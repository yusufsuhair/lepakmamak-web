# Changelog

## Unreleased

- Added four Malaysian retail fronts, two sheltered hangouts with six usable seats, and a numbered map directory with location selection, distance and direction.

- Added animated roadside guitar/cajon buskers and the supplied looping song, with smooth proximity audio fading to silence at 22 metres and City sounds mute support.

- Added roadside air balang and pisang goreng booths, six free snacks/drinks, proximity ordering, consume buttons and nearby player reactions in Malay.

- Remember the last location per account/guest and room on this browser, saving during play and when leaving. Rejoin on foot near the previous chair or vehicle; table invitation links retain their destination.

- Added a free mamak menu with eight dishes and drinks, shared table visuals, Eat/Drink actions, and server-enforced per-diner orders.

- Added account-only editable public profiles (bio, hometown, interests, languages and mamak order), saved in Supabase account metadata and fetched on demand for profile cards. Guests retain name-only cards.

- Added Meja Kita: live table hosts/names, same-room table invitations, free teh tarik rounds and shared cheers. Added downloadable/shareable Resit Lepak images from server-counted session statistics. Saved the social growth roadmap in docs.

- Added server-issued chat timestamps displayed in Malaysia time, with full date/time available on hover.

- Coalesced movement snapshots to 20 Hz per room, suppressed idle movement spam and stale socket queues, added adaptive graphics quality and ambient distance culling, and configured the realtime server for Singapore.

- Enforced one player per chair on the multiplayer server, with occupied actions and automatic release on standing or disconnecting.

- Added a persistent AFK note above players, editable and clearable in Settings, synchronized to peers and filtered for profanity.

- Improved mobile and desktop usability with camera zoom/reset buttons, larger settings targets, chat keyboard layout and input release, lighter mobile rendering, and browser-engine compatibility checks.

- Added name-only guest entry to the multiplayer city; guests have no shop access, paid accessories or Game Master role.

- Replaced Enter and the fixed mobile interaction button with contextual Sit, Stand, Enter and Get out actions positioned beside nearby chairs and vehicles.

- Lowered background music from 22% to 6% volume for a quieter ambience.

- Prevent repeated taps on fixed gameplay layers from triggering Safari smart zoom, while preserving menu and text input interaction.

- Renamed the settings return button to Resume, centred its text and removed its arrow.

- Removed the wallet label and money amount from the HUD.

- Moved CITY ONLINE directly beneath the top-left logo on desktop and mobile.

- Added Masjid Lepak, a Hindu shrine and a Chinese shrine in the eastern district, with distinct architecture and map footprints.

- Name banners now fit their text and use translucent backgrounds, including the Game Master banner.

- Voice audio is delivered only to listeners within 15 metres, with full volume inside 5 metres and a fade to the cutoff.

- Reduced all city sound effects to 50% volume; background music and voice chat retain their separate levels.

- Removed the recall notification toast.

- Added six roaming street cats and dogs with wagging tails, playful ground animations and distance-faded meow/bark sounds controlled by City sounds.

- Added a separate, remembered Background music toggle in Settings, independent of city sounds and voice.

- Added an exclusive gold, shimmering GAME MASTER name banner for the verified owner account, visible to all players.

- Removed legacy corner positioning and visible voice status text; mic and speaker controls appear only as icons above the character.

- Only one active game connection per account across rooms; a new connection replaces the old one, releases vehicle seats and stops the old client reconnecting.

- Chat messages containing common English or Malay profanity are replaced with `***` server-side, including speech bubbles.

- Added an account accessory shop: spectacles and cap at RM5 each, live Stripe Checkout, verified permanent ownership, equipping and multiplayer appearance sync.

- CITY ONLINE now opens a live list of players in the current room, with a marker for your own account.

- Moved interactive mic/speaker controls above the local character, replacing the top-right panel.

- Added stylised Axia, Myvi, Avanza, Vellfire, SUV and sports coupe models to traffic; the driveable car now uses the Myvi model.

- Added Speedmart, KK Super Mart, kedai dobi and MR.DIY storefronts with shelves and washing-machine displays.

- Added Rahim, a Bangladeshi ice-cream vendor, riding the Matkool bike on a looping route with moving proximity audio.

- Doubled Matkool music gain while preserving distance fade and mute.

- Disabled recall for vehicle drivers and passengers, including server validation.

- Added collapsible chat with unread counts; starts compact on mobile and remembers the preference.

- Hide redundant Enter interaction prompts on touch devices; use the existing action buttons.

- Replaced mic and speaker button text with compact on/off icons on desktop and mobile.

- Cars now seat one driver and three passengers, with a live occupancy and passenger-name panel.

- Added car and motorbike horns: H or the mobile HONK button, audible to nearby players.

- Added distinct chair creaks when sitting down and standing up, respecting mute.

- Added a short punch swoosh, respecting punch cooldown and the sound setting.

- Added a Settings wardrobe to preview and save shirt/trouser colours, with live multiplayer updates.

- Added local footsteps for walking/running and jump/landing sounds, controlled by the existing sound setting.

## 1.0.0 — 2026-09-08

First tagged local release of the existing LepakMamak app.

- Kuala Lumpur world with Mamak Maju, character personalisation and email registration.
- Multiplayer presence, player names, text bubbles, profiles and optional voice chat.
- Desktop and mobile analog controls, jumping, punching, seating and recall emotes.
- Driveable cars and two-seat motorbikes with a driver and passenger.
- Expandable live map and settings that keep the world running.
- Matkool ice-cream motorbike with distance-based music.
- LepakMamak icons, social preview image, SEO metadata and sitemap.
- Shared app version in Settings and the server health endpoint.
