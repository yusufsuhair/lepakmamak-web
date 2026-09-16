# Changelog

## 1.41.0 — 2026-09-17

- Added cat companions that follow their owners around the city. One 250-Lepak-Coin purchase includes all 16 breed/style choices and 17 coat colours.
- Added Pet Studio with independent breed and coat selection, pet names, optional shop ribbons, and a rotatable animated 3D preview.

- Made `/health` report live traffic: sockets, players, per-room socket counts and outbound bytes, bytes in and out per second, voice packet rates in and out, dropped frames, resident memory and uptime. Added optional saturation, shutdown and heartbeat alerts via `ALERT_WEBHOOK_URL` and `HEARTBEAT_URL`.
- Added player reporting, review and enforcement. Players can report someone from the player menu; reports land in the admin console at /reports with their evidence, where they can be muted or banned. Bans are refused at the socket on join so they survive reconnects and Railway restarts, mutes are refused at one server-side gate covering chat, voice, drawings, display names and the Wall, and a 15-second sweep applies both to players already in the city. Voice is still never recorded — a voice report carries the names of who was in earshot instead.

- Added map teleporting to 22 validated destinations on the original map, with server-owned arrivals, chair release and a short cooldown. Drivers and passengers must exit first.

- Added four seating-only tables and twelve chairs near the two mosques. These seats support sitting and chatting but cannot enter any table mini-game.

- Upgraded Lukis Lah with private word choices, progressive hints and answer aliases, speed/placement scoring with artist rewards, synchronized high-resolution drawing, real erasing, undo/redo including clear, correct-answer chimes, mobile controls and a 30-second reconnect grace period.

- Added UNO Lepak with private seven-card hands, shuffle/deal/play/draw animations and sound controls, validated action cards and wild colours, UNO call/catch penalties, timed turns, reconnect grace and 500-point matches.

- Added Werewolf to the table lobby: shared city matchmaking for 7/9 players, private roles and game chat, night actions, accusation/defense/judgment, server timers, reconnect grace and rematches. Nine-player extras include Knight, Princess, Hunter and Mayor.

- Added an automatic table game lobby with illustrated game cards and focused game screens. Improved Lukis Lah with time/place scoring, hints, correct-answer audio, stroke undo, eraser sizes and ranked scores.

- Expanded signed-in social profiles with favourite hangout and geng fields, server-owned gameplay statistics and achievements, recent Wall/activity highlights, and a moderated public guestbook.

- Replaced the map dropdown with visible place labels and a categorized mall-style directory, including tap-to-highlight directions and a scrollable mobile map.

- Simplified tables to games and current seating only, with fixed Meja 1–6 names; removed renaming, cheers, receipts and invitation controls and disabled legacy server actions.

- Added Basket Lepak court, shared basketball possession, dribbling, timed shots, rebounds and server-owned player scores; find it at map location 22.

- Added Pickleball Lepak court and map location, automatic paddles on entry, shared arcade rallies, serve/hit controls and first-to-11 scoring.

- Added Poker Kampung at mamak tables: private Hold'em cards, free per-hand chips, fixed-limit betting, timed turns, automatic showdown and rematches on desktop and mobile.

- Removed the table mamak food-order flow and its served food visuals; table interactions now focus on sitting, social play and Lukis Lah.

- Added Lukis Lah at mamak tables: live drawing, secret words, 60-second turns and server-owned guessing scores for seated friends.

- Returning signed-in players now enter the city automatically when opening or refreshing LepakMamak, while expired or missing sessions still show the normal account screen.

- Added the supplied Ar-Rahman audio around both mosques, using the nearest mosque for one smooth proximity fade and respecting the City sounds setting.

- Disabled guest entry in production and added a server-side rejection so bypassing the login screen cannot create an unauthenticated city session. Local guest mode remains available only with the explicit development flag.

- Added a visible 15-metre voice radius while the microphone is live and server-confirmed audience feedback naming nearby players whose speakers are on, including a clear No one nearby state.

- Added a responsive exit confirmation dialog for account and guest logout, with Cancel as the safe default and disconnect occurring only after choosing Keluar game.

- Hardened chat, profiles and Lepak Wall against XSS and SQL-injection payloads with strict Cloudflare CSP/security headers, parameterized database access verification, plain-text rendering tests and file-signature checks for uploaded media.

- Added Lepak Wall: a responsive live social feed with account-only text, photo and 30-second voice-note posts, public member profiles, server-owned identity, content filtering, post deletion, unread notifications and persistent Supabase storage.

- Added a responsive loading experience with branded animation, accessible progress, startup phases, account-button feedback and an online-entry state that clears on welcome or recovers from connection failure.

- Removed the permanent Meja Kita button from the top-left HUD; nearby tables now show a clear floating Open action for table features on desktop and mobile.

- Added a 7-Eleven Malaysia storefront with its striped fascia, glazed entrance, Fresh to Go, 7CAFé and Slurpee details, plus a city-map location.

- Added a FamilyMart Malaysia storefront with its signature green, white and blue fascia, café and fresh-food displays, a map location and the supplied proximity song.

- Added a Watsons Malaysia storefront and city-map location with the supplied jingle fading in only for nearby players and respecting City sounds.

- Added a numbered notification badge above collapsed City chat for new messages, excluding the player's own messages and system notices, and clearing when chat is opened.

- Added a synchronized six-second Superman motorbike stunt with rider menu, desktop and mobile controls, cancellation, and automatic reset when leaving the bike.

- Redesigned Wardrobe as a visual character studio with a large live avatar stage, Tops and Bottoms tabs, graphical clothing choices, random outfit button and responsive mobile layout.

- Added live Stripe Checkout top-ups for Lepak Coin with RM5, RM10 and RM20 packs, verified server-side and credited idempotently to signed-in accounts.

- Expanded city traffic to twelve vehicles with distinct Ferrari-style and Lamborghini-style supercars plus an open-wheel F1 car with wings, cockpit and halo details.

## Unreleased

- Switched the admin console from Cloudflare Access to server-validated Supabase Auth with an exact Yusuf email allowlist, Google/email sign-in, SSR session cookies, and an admin custom domain deployment.

- Expanded the roaming street-animal population to ten cats and ten dogs across the city, with varied colours and sizes, distance culling and shared sound throttling for mobile performance.

- Filled the Busking Santai area with eleven lightweight spectator NPCs: seven seated fans, one camera holder and three animated wavers.

- Added Masjid Kampung Maju across the road from Mamak Maju, with its entrance facing the mamak and a searchable city-map marker.

- Replaced Stripe purchases with Lepak Coin: 500 starter coins, a 100-coin daily reward, atomic server-side spending, two accessories and two Malaysian outfit skins.

- Added a PETRONAS-inspired Malaysian fuel station with Kedai Mesra, a turquoise canopy, six pumps and a dedicated city-map marker.

- Styled verified Game Master chat messages with a compact gold border, GM label and subtle shine; the server-owned role persists with chat history.

- Persisted room chat in Supabase and restore the latest 50 messages with their original timestamps when players join or refresh. Database writes remain server-only.

- Added Stop dance to the self context menu; cancellation stops the animation and nearby music for all players.

- Reworked Dance from the supplied video into a five-second step/hand/chest sequence with bent elbows and upper-body rolls, repeated over ten seconds. Reduced dance music gain by 35%.

- Added a self-only Dance context action: ten-second hand/chest dance, synchronized to other players, with supplied audio fading out at 18 metres.

- Added four Malaysian retail fronts, two sheltered hangouts with six usable seats, and a numbered map directory with location selection, distance and direction.

- Added animated roadside guitar/cajon buskers and the supplied looping song, with smooth proximity audio fading to silence at 22 metres and City sounds mute support.

- Added roadside air balang and pisang goreng booths, six free snacks/drinks, proximity ordering, consume buttons and nearby player reactions in Malay.

- Remember the last location per account/guest and room on this browser, saving during play and when leaving. Rejoin on foot near the previous chair or vehicle; table invitation links retain their destination.

- Removed the table food-order flow so Meja Kita stays focused on social play and mini-games.

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
